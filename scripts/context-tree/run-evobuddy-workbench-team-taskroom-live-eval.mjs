#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readEvobuddyWorkbenchArtifacts } from '../../src/core/evobuddy-workbench-artifacts.mjs';
import { buildEvobuddyWorkbenchModel } from '../../src/core/evobuddy-workbench-model.mjs';
import { renderEvobuddyWorkbenchTerminal } from '../../src/report/evobuddy-workbench-terminal.mjs';
import {
  createEvobuddyWorkbenchInteractionState,
  reduceEvobuddyWorkbenchInteraction,
  renderInteractiveEvobuddyWorkbench,
} from '../../src/tui/evobuddy-workbench-interaction.mjs';

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

function assertContains(text, patterns) {
  const missing = patterns.filter((pattern) => !new RegExp(pattern).test(text));
  return missing.length === 0 ? { status: 'pass' } : { status: 'fail', missing };
}

const out = resolve(readArg('--out') ?? '/tmp/evobuddy-workbench-team-taskroom-live');
await mkdir(out, { recursive: true });

const artifacts = await readEvobuddyWorkbenchArtifacts({
  inputRoot: readArg('--input-root'),
  aggregateReportPath: readArg('--aggregate-report'),
  plan1ReportPath: readArg('--plan1-report'),
  plan2ReportPath: readArg('--plan2-report'),
  taskRoomReportPaths: readArgs('--taskroom-report'),
});
const model = buildEvobuddyWorkbenchModel({ artifacts });

const renders = {
  overview: renderEvobuddyWorkbenchTerminal(model, { view: 'overview', ansi: false }),
  teamAgentReviewer: renderEvobuddyWorkbenchTerminal(model, { view: 'team-agent', actor: 'reviewer', ansi: false }),
  subagentBuddyExplore: renderEvobuddyWorkbenchTerminal(model, { view: 'subagent-buddy', actor: 'explore', ansi: false }),
  taskRoom: renderEvobuddyWorkbenchTerminal(model, { view: 'taskroom', ansi: false }),
  runtimeSetup: renderEvobuddyWorkbenchTerminal(model, { view: 'runtime-setup', ansi: false }),
};

await writeFile(join(out, 'overview.txt'), renders.overview);
await writeFile(join(out, 'team-agent-reviewer.txt'), renders.teamAgentReviewer);
await writeFile(join(out, 'subagent-buddy-explore.txt'), renders.subagentBuddyExplore);
await writeFile(join(out, 'taskroom.txt'), renders.taskRoom);
await writeFile(join(out, 'runtime-setup.txt'), renders.runtimeSetup);

let interactionState = createEvobuddyWorkbenchInteractionState(model);
const interactionSnapshots = [];
for (const [name, event] of [
  ['overview', null],
  ['focus-focused-buddies', { type: 'key', key: 'tab' }],
  ['focus-taskrooms', { type: 'key', key: 'tab' }],
  ['taskroom-open', { type: 'key', key: 'right' }],
  ['back-to-overview', { type: 'key', key: 'left' }],
  ['updates-hidden', { type: 'key', key: 'u' }],
]) {
  if (event) interactionState = reduceEvobuddyWorkbenchInteraction(interactionState, event);
  interactionSnapshots.push({ name, state: interactionState, text: renderInteractiveEvobuddyWorkbench(model, interactionState) });
}
for (const snapshot of interactionSnapshots) {
  await writeFile(join(out, `interaction-${snapshot.name}.txt`), snapshot.text);
}
await writeFile(join(out, 'interaction-transcript.json'), JSON.stringify({
  events: interactionState.transcript ?? [],
  history: interactionState.history ?? [],
  collapsed: interactionState.collapsed ?? {},
}, null, 2));

const views = {
  overview: assertContains(renders.overview, ['Team Agents', 'Focused Buddies', 'Task Rooms', 'OpenCode: team loop observed', 'Claude: team loop observed', 'Codex: (projected|TeamAgent observed; Focused Buddy native observed)']),
  teamAgentReviewer: assertContains(renders.teamAgentReviewer, ['TeamAgent: reviewer', 'round:1', 'round:2', 'Returned to parent-agent']),
  subagentBuddyExplore: assertContains(renders.subagentBuddyExplore, ['Focused Buddy: explore', 'Routing', 'Runtime surfaces']),
  taskRoom: assertContains(renders.taskRoom, ['Participants', 'Rounds', 'Evolution handoff', 'Returned to: parent-agent']),
  runtimeSetup: assertContains(renders.runtimeSetup, ['OpenCode: team loop observed', 'Claude: team loop observed', 'Codex: (projected|TeamAgent observed; Focused Buddy native observed)']),
};

const forbiddenFirstLevel = ['MECHANISM PASS', 'PRODUCT PENDING', 'PRODUCT PASS', 'nativeSpawnPass', 'authorized-explicit-member-activation', 'releaseGradeProductProvenance', 'not-run-no-fresh-observed-proof', 'sha256:', '/tmp/', 'exporter', 'reportPath', 'ses_', 'msg_', '--aggregate-report'];
const forbiddenHits = forbiddenFirstLevel.filter((label) => renders.overview.includes(label));
const interactionReducerEval = {
  status: interactionState.history?.some((entry) => entry.view === 'taskroom') && interactionState.collapsed?.updates === true ? 'pass' : 'fail',
  visitedViews: interactionState.history?.map((entry) => entry.view) ?? [],
  durableWrites: interactionState.durableWrites?.length ?? 0,
};
const renderEval = {
  status: Object.values(views).every((view) => view.status === 'pass') && forbiddenHits.length === 0 ? 'pass' : 'fail',
  views,
  forbiddenFirstLevel: { status: forbiddenHits.length === 0 ? 'pass' : 'fail', hits: forbiddenHits },
};
const interactivePtyEval = {
  status: 'not-run',
  proofScope: 'interactive-pty-runtime-eval',
  reason: 'Run the separate PTY eval (evobuddy:eval-workbench-interactive-pty:live) for terminal-loop proof.',
};
const blockedReasons = artifacts.artifactStatus === 'blocked' ? artifacts.blockedReasons ?? [] : [];
const status = blockedReasons.length > 0
  ? 'blocked'
  : renderEval.status === 'pass' && interactionReducerEval.status === 'pass' && interactionReducerEval.durableWrites === 0
    ? 'pass'
    : 'fail';

const report = {
  reportKind: 'evobuddy-workbench-team-taskroom-live-eval-report',
  status,
  proofScope: 'fresh-artifact-render-eval',
  nonClaims: [
    'does not prove runtime execution',
    'does not prove native spawn/result return beyond supplied runtime reports',
    'does not make TUI visibility a release proof gate',
  ],
  ...(blockedReasons.length > 0 ? { blockedReasons } : {}),
  renderEval,
  interactionReducerEval,
  interactivePtyEval,
  outputFiles: {
    overview: join(out, 'overview.txt'),
    teamAgentReviewer: join(out, 'team-agent-reviewer.txt'),
    subagentBuddyExplore: join(out, 'subagent-buddy-explore.txt'),
    taskRoom: join(out, 'taskroom.txt'),
    runtimeSetup: join(out, 'runtime-setup.txt'),
    interactionTranscript: join(out, 'interaction-transcript.json'),
    interactionOverview: join(out, 'interaction-overview.txt'),
    interactionTaskroomOpen: join(out, 'interaction-taskroom-open.txt'),
    interactionBackToOverview: join(out, 'interaction-back-to-overview.txt'),
    interactionUpdatesHidden: join(out, 'interaction-updates-hidden.txt'),
  },
};

await writeFile(join(out, 'evobuddy-workbench-team-taskroom-live-eval-report.json'), JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify({ status, reportPath: join(out, 'evobuddy-workbench-team-taskroom-live-eval-report.json') }) + '\n');
process.exitCode = status === 'fail' ? 1 : 0;
