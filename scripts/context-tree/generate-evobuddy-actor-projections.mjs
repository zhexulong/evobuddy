#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildActorProjectionPlan } from '../../src/core/evobuddy-actor-projection-plan.mjs';
import { ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION } from '../../src/core/evobuddy-actor-runtime-projection.mjs';

function digest(content) {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseInclude(value) {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function parseArgs(argv) {
  const args = { inPlace: false, includeVisibility: ['active', 'available'] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') args.project = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, i += 1, arg);
    else if (arg === '--in-place') args.inPlace = true;
    else if (arg === '--include') args.includeVisibility = parseInclude(requireValue(argv, i += 1, arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.project) throw new Error('missing value for --project');
  if (!args.inPlace && !args.out) throw new Error('missing value for --out');
  if (args.inPlace && args.out) throw new Error('--out and --in-place are mutually exclusive');
  return args;
}

async function pathHasSymlink(path) {
  const resolved = resolve(path);
  const root = resolved.startsWith(sep) ? sep : resolve('.').split(sep)[0];
  const relativeParts = relative(root, resolved).split(sep).filter(Boolean);
  let current = root;
  for (const part of relativeParts) {
    current = current === sep ? `${sep}${part}` : resolve(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) return true;
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
  }
  return false;
}

async function safeWriteFile(path, content) {
  if (await pathHasSymlink(path)) throw new Error('refuses to write through symlinked path');
  await mkdir(dirname(path), { recursive: true });
  if (await pathHasSymlink(path)) throw new Error('refuses to write through symlinked path');
  await writeFile(path, content, 'utf8');
}

function outputRef(root, path) {
  return relative(root, path).replaceAll('\\', '/');
}

export async function generateActorProjectionsCli(argv) {
  const args = parseArgs(argv);
  const projectRoot = resolve(args.project);
  const outputRoot = args.inPlace ? projectRoot : resolve(args.out);
  const plan = await buildActorProjectionPlan({ projectRoot, includeVisibility: args.includeVisibility });

  const reportActors = [];
  for (const actor of plan.actorPlans) {
    for (const [runtime, fileRef] of Object.entries(actor.files)) {
      await safeWriteFile(resolve(outputRoot, fileRef), actor.rendered[runtime]);
    }
    reportActors.push({
      actorName: actor.actorName,
      actorKind: actor.actorKind,
      visibility: actor.visibility,
      sourceFamily: actor.sourceFamily,
      definitionRef: actor.definitionRef,
      sourceDigest: actor.sourceDigest,
      runtimeFiles: Object.fromEntries(Object.entries(actor.files).map(([runtime, fileRef]) => [runtime, {
        ref: fileRef,
        digest: digest(actor.rendered[runtime]),
        runtimeActorName: actor.projections[runtime].runtimeActorName,
      }])),
    });
  }

  const report = {
    reportKind: 'evobuddy-actor-projection-install-report',
    generatorVersion: ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION,
    projectRoot,
    outputRoot,
    includeVisibility: plan.includeVisibility,
    registries: {
      agents: outputRef(outputRoot, plan.agentsRegistryRef),
      buddies: outputRef(outputRoot, plan.buddiesRegistryRef),
    },
    actors: reportActors,
  };
  const reportPath = resolve(outputRoot, 'evobuddy-actor-projection-install-report.json');
  await safeWriteFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return { status: 'pass', reportPath, actors: reportActors.length, outputRoot };
}

async function main() {
  process.stdout.write(`${JSON.stringify(await generateActorProjectionsCli(process.argv.slice(2)))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
