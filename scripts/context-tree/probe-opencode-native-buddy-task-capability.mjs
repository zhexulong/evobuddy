#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { probeOpenCodeNativeBuddyTaskCapability } from '../../src/core/opencode-native-buddy-capability-probe.mjs';
import { runExportOpenCodeSessionCorpusCli } from './export-opencode-session-corpus.mjs';

const execFileAsync = promisify(execFile);

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = { json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--db') args.dbPath = requireValue(argv, i += 1, arg);
    else if (arg === '--project-identity') args.projectIdentity = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, i += 1, arg);
    else if (arg === '--max-sessions') args.maxSessions = requireValue(argv, i += 1, arg);
    else if (arg === '--max-root-sessions') args.maxRootSessions = requireValue(argv, i += 1, arg);
    else if (arg === '--max-subagent-sessions') args.maxSubagentSessions = requireValue(argv, i += 1, arg);
    else if (arg === '--json') args.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.dbPath) throw new Error('missing value for --db');
  if (!args.projectIdentity) throw new Error('missing value for --project-identity');
  if (!args.out) throw new Error('missing value for --out');
  return args;
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fieldNames(rows) {
  return new Set(Array.isArray(rows) ? rows.map((row) => row?.name).filter(Boolean) : []);
}

async function sqliteJson(dbPath, sql) {
  const { stdout } = await execFileAsync('sqlite3', ['-json', dbPath, sql], { maxBuffer: 1024 * 1024 * 16 });
  return stdout.trim().length > 0 ? JSON.parse(stdout) : [];
}

async function discoverSchema(dbPath) {
  try {
    const [sessionColumns, messageColumns, partColumns] = await Promise.all([
      sqliteJson(dbPath, 'pragma table_info(session);'),
      sqliteJson(dbPath, 'pragma table_info(message);'),
      sqliteJson(dbPath, 'pragma table_info(part);'),
    ]);
    const sessionNames = fieldNames(sessionColumns);
    const messageNames = fieldNames(messageColumns);
    const partNames = fieldNames(partColumns);
    const requiredFields = {
      sessionParentId: sessionNames.has('parent_id'),
      messageData: messageNames.has('data'),
      partData: partNames.has('data'),
      timestampOrdering: (sessionNames.has('time_created') || sessionNames.has('time_updated'))
        && (messageNames.has('time_created') || messageNames.has('time_updated'))
        && (partNames.has('time_created') || partNames.has('time_updated')),
    };
    const blockedReasons = [];
    if (!requiredFields.sessionParentId) blockedReasons.push('session.parent_id is not available.');
    if (!requiredFields.partData) blockedReasons.push('part.data is not available for result-return bytes.');
    if (!requiredFields.messageData) blockedReasons.push('message.data is not available.');
    if (!requiredFields.timestampOrdering) blockedReasons.push('timestamp ordering fields are not available.');
    return {
      status: blockedReasons.length > 0 ? 'blocked' : 'pass',
      tables: {
        session: sessionColumns,
        message: messageColumns,
        part: partColumns,
      },
      columns: {
        session: [...sessionNames],
        message: [...messageNames],
        part: [...partNames],
      },
      requiredFields,
      blockedReasons,
      failedReasons: [],
    };
  } catch (error) {
    return {
      status: 'fail',
      tables: {},
      columns: {},
      requiredFields: {
        sessionParentId: false,
        messageData: false,
        partData: false,
        timestampOrdering: false,
      },
      blockedReasons: [],
      failedReasons: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export async function runProbeOpenCodeNativeBuddyTaskCapabilityCli(argv) {
  const args = parseArgs(argv);
  const outDir = resolve(args.out);
  await mkdir(outDir, { recursive: true });

  const schemaDiscovery = await discoverSchema(resolve(args.dbPath));
  const schemaPath = join(outDir, 'opencode-native-buddy-schema-discovery.json');
  await writeJson(schemaPath, schemaDiscovery);

  const exportResult = await runExportOpenCodeSessionCorpusCli([
    '--db', args.dbPath,
    '--project-identity', args.projectIdentity,
    '--out', outDir,
    ...(args.maxSessions ? ['--max-sessions', args.maxSessions] : []),
    ...(args.maxRootSessions ? ['--max-root-sessions', args.maxRootSessions] : []),
    ...(args.maxSubagentSessions ? ['--max-subagent-sessions', args.maxSubagentSessions] : []),
  ]);

  const corpus = JSON.parse(await (await import('node:fs/promises')).readFile(exportResult.corpusPath, 'utf8'));
  const manifest = JSON.parse(await (await import('node:fs/promises')).readFile(exportResult.manifestPath, 'utf8'));

  const report = probeOpenCodeNativeBuddyTaskCapability({ corpus, manifest, schemaDiscovery });
  const reportPath = join(outDir, 'opencode-native-buddy-task-capability-report.json');
  await writeJson(reportPath, report);
  return {
    ...report,
    reportPath,
    corpusPath: exportResult.corpusPath,
    manifestPath: exportResult.manifestPath,
    schemaPath,
  };
}

async function main() {
  const result = await runProbeOpenCodeNativeBuddyTaskCapabilityCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
