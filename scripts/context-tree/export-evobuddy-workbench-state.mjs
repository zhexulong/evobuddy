#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { exportEvobuddyWorkbenchState } from '../../src/core/evobuddy-workbench-state-contract.mjs';

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

const projectRoot = readArg('--project');
if (!projectRoot) throw new Error('missing value for --project');

const state = await exportEvobuddyWorkbenchState({
  projectRoot,
  inputRoot: readArg('--input-root'),
  aggregateReportPath: readArg('--aggregate-report'),
  plan1ReportPath: readArg('--plan1-report'),
  plan2ReportPath: readArg('--plan2-report'),
  taskRoomReportPaths: readArgs('--taskroom-report'),
});

const text = `${JSON.stringify(state, null, 2)}\n`;
const outPath = readArg('--out');
if (outPath) await writeFile(resolve(outPath), text, 'utf8');
else process.stdout.write(text);
