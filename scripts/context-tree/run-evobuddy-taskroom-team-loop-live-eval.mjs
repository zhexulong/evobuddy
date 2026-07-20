#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildTaskRoomLiveEvalReport } from '../../src/core/evobuddy-taskroom-live-eval.mjs';
import { produceClaudeTaskRoomObservedRoot } from '../../src/core/evobuddy-claude-taskroom-producer.mjs';
import { produceOpenCodeTaskRoomObservedRoot } from '../../src/core/evobuddy-opencode-taskroom-producer.mjs';

function defaultOpenCodeDbPath() {
  return resolve(homedir(), '.local/share/opencode/opencode.db');
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') args.project = requireValue(argv, ++index, arg);
    else if (arg === '--runtime') args.runtime = requireValue(argv, ++index, arg);
    else if (arg === '--out') args.out = requireValue(argv, ++index, arg);
    else if (arg === '--claude-project-dir') args.claudeProjectDir = requireValue(argv, ++index, arg);
    else if (arg === '--observed-taskroom-root') args.observedTaskRoomRoot = requireValue(argv, ++index, arg);
    else if (arg === '--allow-retained-fixture') args.allowRetainedFixture = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.project) throw new Error('missing value for --project');
  if (!args.runtime) throw new Error('missing value for --runtime');
  if (!args.out) throw new Error('missing value for --out');
  return args;
}

async function produceObservedTaskRoomRoot(args, out) {
  if (args.runtime === 'opencode') {
    return produceOpenCodeTaskRoomObservedRoot({
      projectRoot: resolve(args.project),
      runtime: args.runtime,
      out,
      dbPath: defaultOpenCodeDbPath(),
      observedTaskRoomRoot: args.observedTaskRoomRoot,
    });
  }
  if (args.runtime === 'claude') {
    return produceClaudeTaskRoomObservedRoot({
      projectRoot: resolve(args.project),
      runtime: args.runtime,
      out,
      claudeProjectDir: args.claudeProjectDir,
      observedTaskRoomRoot: args.observedTaskRoomRoot,
    });
  }
  return {
    status: 'blocked',
    proofScope: 'product-observed',
    blockedReasons: [`unsupported taskroom runtime: ${args.runtime}`],
    issues: [],
    source: 'producer-blocked',
    report: {
      schema: 'evobuddy-taskroom-team-loop-live-eval.v1',
      status: 'blocked',
      proofScope: 'product-observed',
      blockedReasons: [`unsupported taskroom runtime: ${args.runtime}`],
      issues: [],
      taskRoom: { status: 'blocked' },
      reviewerContinuity: { status: 'blocked' },
      evolutionHandoff: { status: 'blocked' },
    },
  };
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function runEvobuddyTaskroomTeamLoopLiveEvalCli(argv) {
  const args = parseArgs(argv);
  const out = resolve(args.out);
  let report;

  if (args.allowRetainedFixture) {
    report = buildTaskRoomLiveEvalReport({ proofScope: 'retained', taskRoomLoop: null, evolutionHandoff: null });
  } else {
    const produced = await produceObservedTaskRoomRoot(args, out);
    report = produced.report;
    if (produced.status === 'pass') {
      report.runtime = args.runtime;
      report.observedTaskroomRootPath = produced.observedTaskRoomRootPath;
    } else if (produced.status === 'blocked' && produced.source === 'producer-blocked') {
      report = {
        ...report,
        proofScope: produced.proofScope,
        blockedReasons: produced.blockedReasons,
        runtime: args.runtime,
      };
    }
  }

  report.reportKind = 'evobuddy-taskroom-team-loop-report';
  report.runtime = args.runtime;
  const reportPath = join(out, 'evobuddy-taskroom-team-loop-report.json');
  await writeJson(reportPath, report);
  return { status: report.status, reportPath };
}

async function main() {
  const summary = await runEvobuddyTaskroomTeamLoopLiveEvalCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  process.exitCode = summary.status === 'fail' ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
