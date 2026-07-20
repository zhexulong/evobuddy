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
  const args = ['scripts/evobuddy/evobuddy.mjs', 'workbench', '--project', argv.project];
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

function extractFrames(text) {
  return String(text ?? '').match(/<FRAME>[\s\S]*?<\/FRAME>/g) ?? [];
}

const out = resolve(readArg('--out') ?? '/tmp/evobuddy-rust-tui-pty-live');
await mkdir(out, { recursive: true });
const frameDumpPath = join(out, 'rust-tui-frame-dump.txt');

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
  env: { ...process.env, TERM: process.env.TERM ?? 'xterm-256color', COLUMNS: '120', LINES: '40' },
  inputChunks: [
    { afterMs: 900, data: '\r' },
    { afterMs: 1200, data: 'h' },
    { afterMs: 1500, data: 'b' },
    { afterMs: 1800, data: '\u001b' },
    { afterMs: 2100, data: '\u001b' },
    { afterMs: 2400, data: 'n' },
    { afterMs: 2700, data: 'map' },
    { afterMs: 3000, data: '\u001b' },
    { afterMs: 3300, data: '\t\t\t' },
    { afterMs: 3600, data: '\r' },
    { afterMs: 3900, data: '\u001b' },
    { afterMs: 4200, data: 'jjj' },
    { afterMs: 4500, data: '\r' },
    { afterMs: 4800, data: '\u001b' },
    { afterMs: 5100, data: ':' },
    { afterMs: 5400, data: 'open' },
    { afterMs: 5700, data: '\u001b' },
    { afterMs: 6000, data: '/' },
    { afterMs: 6300, data: 'open' },
    { afterMs: 6600, data: '\u001b' },
    { afterMs: 6900, data: '?' },
    { afterMs: 7200, data: '\u001b' },
    { afterMs: 7500, data: 'r' },
    { afterMs: 7800, data: '\u001b' },
    { afterMs: 8100, data: 'q' },
  ],
  columns: 120,
  rows: 40,
  timeoutMs: 15000,
});

const frameDump = await readFile(frameDumpPath, 'utf8').catch(() => '');
const text = `${session.stdout ?? ''}${session.stderr ?? ''}${frameDump}`;
const plain = stripAnsi(text);
const forbiddenFirstLevelHits = [
  'sha256:',
  '/tmp/',
  'ses_',
  'msg_',
  'MECHANISM PASS',
  'PRODUCT PASS',
  'runtimeEvidence',
  'sourceTranscriptRef',
  'nativeMechanismObserved',
  'releaseParity',
  'not-run-no-fresh-observed-proof',
].filter((token) => plain.includes(token));
const enterAlternateScreenCount = (text.match(/\u001b\[\?1049h/g) ?? []).length;
const exitAlternateScreenCount = (text.match(/\u001b\[\?1049l/g) ?? []).length;
const repaintCount = (text.match(/\u001b\[[0-9;]*H/g) ?? []).length;
const frameDumpCount = (plain.match(/<FRAME>/g) ?? []).length;

const uiEvidence = {
  alternateScreen: enterAlternateScreenCount >= 1,
  cleanup: exitAlternateScreenCount >= 1 && session.exitCode === 0,
  attentionStripObserved: /Attention/.test(plain),
  teamDelegateSplitObserved: /Team · Members/.test(plain) && /Delegates · OMO specialists/.test(plain) && /TeamMember/.test(plain) && /FocusedBuddy/.test(plain),
  agentCommandCenterObserved: /Team · Members/.test(plain) && /Delegates · OMO specialists/.test(plain) && /TaskRooms/.test(plain) && /Active Workspace/.test(plain) && /Inspector/.test(plain),
  teamMemberWorkspaceObserved: /Team Member Workspace/.test(plain) && /Visible team member/.test(plain) && /Start member adapter task/.test(plain),
  focusedBuddyWorkspaceObserved: /Focused Delegate Workspace/.test(plain) && /OMO specialist delegate/.test(plain) && /Start buddy adapter task/.test(plain),
  taskRoomWorkspaceObserved: /TaskRoom Workspace/.test(plain) && /Participants/.test(plain) && /Rounds/.test(plain) && /Artifacts/.test(plain),
  commandPaletteObserved: /Command Palette/.test(plain) && /create taskroom/.test(plain),
  taskRoomFormObserved: /TaskRoom Form/.test(plain) && /Destination: Create TaskRoom/.test(plain),
  handoffFormObserved: /Handoff Form/.test(plain) && /Destination: durable HandoffRecord/.test(plain),
  traceDrawerObserved: /Trace/.test(plain) && /Claim ceiling/.test(plain),
  contextualFooterObserved: /\/ search/.test(plain) && /: commands/.test(plain) && /a Open (native runtime|session)/.test(plain),
  rawListRegressionAbsent: !/Team & Buddies/.test(plain) && !/Peek/.test(plain) && !/Experts/.test(plain) && !/Agent Workspace/.test(plain) && !/Raft/.test(plain),
  selectionMarkerObserved: /❯/.test(plain),
  helpObserved: /Help/.test(plain),
  runtimeSetupObserved: /Runtime Setup Detail|Runtime Setup/.test(plain),
  borderedLayoutObserved: /┌/.test(plain) && /┘/.test(plain),
  leftRightPaneSplitObserved: /┌.*┐┌.*┐/s.test(plain),
  forbiddenFirstLevelHits,
};

const failures = [];
if (session.status !== 'blocked') {
  if (session.exitCode !== 0) failures.push(`product entrypoint exited with code ${session.exitCode}`);
  if (!uiEvidence.alternateScreen) failures.push('missing alternate-screen enter sequence');
  if (!uiEvidence.cleanup) failures.push('missing alternate-screen cleanup or clean exit');
  if (repaintCount < 2 && frameDumpCount < 2) failures.push(`expected at least two repaints, observed repaint=${repaintCount}, frameDump=${frameDumpCount}`);
  if (!uiEvidence.attentionStripObserved) failures.push('missing attention strip in PTY transcript');
  if (!uiEvidence.teamDelegateSplitObserved) failures.push('missing TeamAgent/member vs FocusedBuddy/delegate split in PTY transcript');
  if (!uiEvidence.agentCommandCenterObserved) failures.push('missing agent command center panes in PTY transcript');
  if (!uiEvidence.teamMemberWorkspaceObserved) failures.push('missing team member workspace evidence');
  if (!uiEvidence.focusedBuddyWorkspaceObserved) failures.push('missing focused buddy workspace evidence');
  if (!uiEvidence.taskRoomWorkspaceObserved) failures.push('missing task room workspace evidence');
  if (!uiEvidence.commandPaletteObserved) failures.push('missing command palette evidence');
  if (!uiEvidence.taskRoomFormObserved) failures.push('missing taskroom form evidence');
  if (!uiEvidence.handoffFormObserved) failures.push('missing handoff form evidence');
  if (!uiEvidence.traceDrawerObserved) failures.push('missing trace drawer evidence');
  if (!uiEvidence.contextualFooterObserved) failures.push('missing contextual footer evidence');
  if (!uiEvidence.rawListRegressionAbsent) failures.push('raw v0 list shell regression observed');
  if (!uiEvidence.selectionMarkerObserved) failures.push('missing selection marker');
  if (!uiEvidence.helpObserved) failures.push('missing help overlay evidence');
  if (!uiEvidence.runtimeSetupObserved) failures.push('missing runtime setup evidence');
  if (!uiEvidence.borderedLayoutObserved) failures.push('missing bordered layout evidence');
  if (!uiEvidence.leftRightPaneSplitObserved) failures.push('missing left/right pane split evidence');
  if (uiEvidence.forbiddenFirstLevelHits.length > 0) failures.push(`forbidden first-level hits observed: ${uiEvidence.forbiddenFirstLevelHits.join(', ')}`);
}

const status = session.status === 'blocked'
  ? 'blocked'
  : failures.length === 0
    ? 'pass'
    : 'fail';

const report = {
  reportKind: 'evobuddy-rust-tui-pty-live-eval-report',
  status,
  proofScope: 'rust-tui-product-pty-live',
  productEntrypoint: { command: ['node', ...args] },
  uiEvidence,
  claimCeiling: 'TUI interaction proof only; not runtime-native TaskRoom proof',
  transcriptPath: join(out, 'rust-tui-pty-session.txt'),
  ...(status === 'fail' ? { failures } : {}),
  ...(status === 'blocked' ? { blockedReasons: session.blockedReasons ?? ['PTY capability unavailable.'] } : {}),
};

await writeFile(join(out, 'rust-tui-pty-session.txt'), text, 'utf8');
await writeFile(join(out, 'evobuddy-rust-tui-pty-live-eval-report.json'), JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify({ status, reportPath: join(out, 'evobuddy-rust-tui-pty-live-eval-report.json') }) + '\n');
process.exitCode = 0;
