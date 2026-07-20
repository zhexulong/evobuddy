#!/usr/bin/env node

import { readEvobuddyWorkbenchArtifacts } from '../../src/core/evobuddy-workbench-artifacts.mjs';
import { buildEvobuddyWorkbenchModel } from '../../src/core/evobuddy-workbench-model.mjs';
import { renderEvobuddyWorkbenchTerminal } from '../../src/report/evobuddy-workbench-terminal.mjs';
import { runEvobuddyWorkbenchInteractiveTerminal } from '../../src/tui/evobuddy-workbench-interactive-terminal.mjs';

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

const artifacts = await readEvobuddyWorkbenchArtifacts({
  inputRoot: readArg('--input-root'),
  aggregateReportPath: readArg('--aggregate-report'),
  plan1ReportPath: readArg('--plan1-report'),
  plan2ReportPath: readArg('--plan2-report'),
  taskRoomReportPaths: readArgs('--taskroom-report'),
});

const model = buildEvobuddyWorkbenchModel({
  artifacts,
  selectedActorName: readArg('--actor'),
  selectedTaskRoomId: readArg('--taskroom'),
});

if (process.argv.includes('--interactive')) {
  await runEvobuddyWorkbenchInteractiveTerminal({ model, input: process.stdin, output: process.stdout });
} else {
  process.stdout.write(renderEvobuddyWorkbenchTerminal(model, {
    view: readArg('--view') ?? 'overview',
    actor: readArg('--actor'),
    taskroom: readArg('--taskroom'),
    ansi: false,
  }));
}
