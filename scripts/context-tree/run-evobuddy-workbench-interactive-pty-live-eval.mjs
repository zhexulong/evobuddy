#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runWorkbenchPtySession } from '../../src/tui/evobuddy-workbench-pty-session.mjs';

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readArgs(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function buildWorkbenchArgs(argv) {
  if (!argv.project) throw new Error('missing value for --project');
  const args = ['scripts/evobuddy/evobuddy.mjs', 'workbench', '--project', argv.project, '--interactive'];
  if (argv.inputRoot) args.push('--input-root', argv.inputRoot);
  if (argv.aggregateReport) args.push('--aggregate-report', argv.aggregateReport);
  if (argv.plan1Report) args.push('--plan1-report', argv.plan1Report);
  if (argv.plan2Report) args.push('--plan2-report', argv.plan2Report);
  for (const taskroomReport of argv.taskroomReports) args.push('--taskroom-report', taskroomReport);
  if (argv.frameDumpPath) args.push('--frame-dump-path', argv.frameDumpPath);
  return args;
}

function stripAnsi(text) {
  return String(text ?? '')
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\r/g, '');
}

const out = resolve(readArg('--out') ?? '/tmp/evobuddy-workbench-interactive-pty-live');
await mkdir(out, { recursive: true });
const frameDumpPath = join(out, 'interactive-frame-dump.txt');

const project = resolve(readArg('--project') ?? '');
const args = buildWorkbenchArgs({
  project,
  inputRoot: readArg('--input-root'),
  aggregateReport: readArg('--aggregate-report'),
  plan1Report: readArg('--plan1-report'),
  plan2Report: readArg('--plan2-report'),
  taskroomReports: readArgs('--taskroom-report'),
  frameDumpPath,
});

const session = await runWorkbenchPtySession({
  command: 'node',
  args,
  cwd: resolve('.'),
  env: { ...process.env, TERM: process.env.TERM ?? 'xterm-256color' },
  inputChunks: [
    { afterMs: 300, data: '\t' },
    { afterMs: 600, data: '\r' },
    { afterMs: 900, data: '\u001b' },
    { afterMs: 1200, data: '?' },
    { afterMs: 1500, data: '\u001b' },
    { afterMs: 1800, data: 'q' },
  ],
  columns: 120,
  rows: 40,
});

const frameDump = await readFile(frameDumpPath, 'utf8').catch(() => '');
const text = `${session.stdout ?? ''}${frameDump}`;
const plain = stripAnsi(text);
const failures = [];
if (session.status !== 'blocked') {
  if (session.exitCode !== 0) failures.push(`interactive entrypoint exited with code ${session.exitCode}`);
  const enterAlternateScreenCount = (text.match(/\u001b\[\?1049h/g) ?? []).length;
  const exitAlternateScreenCount = (text.match(/\u001b\[\?1049l/g) ?? []).length;
  const repaintCount = (text.match(/\u001b\[[0-9;]*H/g) ?? []).length;
  const frameDumpCount = (plain.match(/<FRAME>/g) ?? []).length;
  if (enterAlternateScreenCount !== 1) failures.push(`expected exactly one alternate-screen enter sequence, observed ${enterAlternateScreenCount}`);
  if (exitAlternateScreenCount !== 1) failures.push(`expected exactly one alternate-screen exit sequence, observed ${exitAlternateScreenCount}`);
  if (repaintCount < 2 && frameDumpCount < 2) failures.push(`expected at least two in-place repaints or frames, observed repaint=${repaintCount}, frameDump=${frameDumpCount}`);
  if (!/TaskRoom Workspace/.test(plain)) failures.push('missing TaskRoom workspace after open input');
  if (!/Read-only boundary/.test(plain)) failures.push('missing read-only boundary banner');
  if (!/❯/.test(plain)) failures.push('missing visible focus chrome');
  if (!/EvoBuddy Workbench/.test(plain)) failures.push('missing dashboard overview after back input');
  if (!(/Help/.test(plain) && /Tab cycle focus/.test(plain))) failures.push('missing help overlay evidence');
}

const enterAlternateScreenCount = (text.match(/\u001b\[\?1049h/g) ?? []).length;
const exitAlternateScreenCount = (text.match(/\u001b\[\?1049l/g) ?? []).length;
const repaintCount = (text.match(/\u001b\[[0-9;]*H/g) ?? []).length;
const frameDumpCount = (plain.match(/<FRAME>/g) ?? []).length;
const status = session.status === 'blocked'
  ? 'blocked'
  : failures.length === 0
    ? 'pass'
    : 'fail';

const report = {
  reportKind: 'evobuddy-workbench-interactive-pty-live-eval-report',
  status,
  proofScope: 'interactive-pty-runtime-eval',
  productEntrypoint: { command: ['node', ...args] },
  escapeSequences: {
    enterAlternateScreen: enterAlternateScreenCount === 1,
    exitAlternateScreen: exitAlternateScreenCount === 1,
    repaintHome: repaintCount >= 2 || frameDumpCount >= 2,
    enterAlternateScreenCount,
    exitAlternateScreenCount,
    repaintCount,
    frameDumpCount,
  },
  navigation: {
    readOnlyBannerObserved: /Read-only boundary/.test(plain),
    visibleFocusObserved: /❯/.test(plain),
    openTaskroomObserved: /TaskRoom Workspace/.test(plain),
    backToOverviewObserved: /EvoBuddy Workbench/.test(plain),
    helpObserved: /Help/.test(plain) && /Tab cycle focus/.test(plain),
    quitObserved: session.exitCode === 0,
  },
  transcriptPath: join(out, 'interactive-pty-session.txt'),
  ...(status === 'fail' ? { failures } : {}),
  ...(status === 'blocked' ? { blockedReasons: session.blockedReasons ?? ['PTY capability unavailable.'] } : {}),
};

await writeFile(join(out, 'interactive-pty-session.txt'), text, 'utf8');
await writeFile(join(out, 'evobuddy-workbench-interactive-pty-live-eval-report.json'), JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify({ status, reportPath: join(out, 'evobuddy-workbench-interactive-pty-live-eval-report.json') }) + '\n');
process.exitCode = 0;
