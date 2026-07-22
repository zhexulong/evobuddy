#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  inspectPiRpcWorker,
  resolvePiRpcArgv,
  startPiRpcWorker,
  stopPiRpcWorker,
} from '../../src/core/evobuddy-pi-rpc-worker.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = {
    count: 1,
    holdMs: 1000,
    project: resolve('.'),
    out: null,
    includeOpencode: false,
    opencodeBin: process.env.EVOBUDDY_OPENCODE_BIN ?? 'opencode',
    opencodeTreePid: process.env.EVOBUDDY_S3_OPENCODE_TREE_PID ? Number.parseInt(process.env.EVOBUDDY_S3_OPENCODE_TREE_PID, 10) : null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--count' || arg === '--workers') args.count = Number.parseInt(requireValue(argv, ++index, arg), 10);
    else if (arg === '--hold-ms') args.holdMs = Number.parseInt(requireValue(argv, ++index, arg), 10);
    else if (arg === '--project') args.project = resolve(requireValue(argv, ++index, arg));
    else if (arg === '--out') args.out = resolve(requireValue(argv, ++index, arg));
    else if (arg === '--include-opencode') args.includeOpencode = true;
    else if (arg === '--opencode-bin') args.opencodeBin = requireValue(argv, ++index, arg);
    else if (arg === '--opencode-tree-pid') args.opencodeTreePid = Number.parseInt(requireValue(argv, ++index, arg), 10);
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (!Number.isInteger(args.count) || args.count < 1) throw new Error('--count must be a positive integer');
  if (!Number.isInteger(args.holdMs) || args.holdMs < 0) throw new Error('--hold-ms must be a non-negative integer');
  return args;
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function firstNonEmptyLine(text) {
  return String(text ?? '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function commandPath(command) {
  if (command.includes('/') || /^[A-Za-z]:[/\\]/.test(command)) return existsSync(command) ? command : null;
  const lookup = process.platform === 'win32'
    ? spawnSync('where', [command], { encoding: 'utf8' })
    : spawnSync('which', [command], { encoding: 'utf8' });
  if (lookup.error || lookup.status !== 0) return null;
  return firstNonEmptyLine(lookup.stdout);
}

function sampleRssKb(pid) {
  if (!pid || process.platform !== 'linux') return null;
  try {
    const status = readFileSync(`/proc/${pid}/status`, 'utf8');
    const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
    return match ? Number.parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

function listDescendantPids(rootPid) {
  if (!rootPid || process.platform !== 'linux') return [];
  const childrenByParent = new Map();
  try {
    const listing = spawnSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' });
    if (listing.status !== 0) return [rootPid];
    for (const line of (listing.stdout ?? '').split('\n')) {
      const match = line.trim().match(/^(\d+)\s+(\d+)$/);
      if (!match) continue;
      const pid = Number.parseInt(match[1], 10);
      const ppid = Number.parseInt(match[2], 10);
      if (!childrenByParent.has(ppid)) childrenByParent.set(ppid, []);
      childrenByParent.get(ppid).push(pid);
    }
  } catch {
    return [rootPid];
  }
  const seen = new Set();
  const stack = [rootPid];
  while (stack.length > 0) {
    const pid = stack.pop();
    if (seen.has(pid)) continue;
    seen.add(pid);
    for (const child of childrenByParent.get(pid) ?? []) stack.push(child);
  }
  return [...seen];
}

function sampleProcessTreeRssKb(rootPid) {
  const pids = listDescendantPids(rootPid);
  let total = 0;
  let measured = 0;
  for (const pid of pids) {
    const rss = sampleRssKb(pid);
    if (Number.isFinite(rss)) {
      total += rss;
      measured += 1;
    }
  }
  return {
    rootPid,
    processCount: pids.length,
    measuredProcessCount: measured,
    treeRssKb: measured > 0 ? total : null,
    parentRssKb: sampleRssKb(rootPid),
  };
}

function summarize(samples) {
  const values = samples.map((sample) => sample.rssKb).filter((value) => Number.isFinite(value));
  if (values.length === 0) return { measured: 0, minRssKb: null, maxRssKb: null, avgRssKb: null };
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    measured: values.length,
    minRssKb: Math.min(...values),
    maxRssKb: Math.max(...values),
    avgRssKb: Math.round(total / values.length),
  };
}

async function samplePiWorkers({ count, holdMs, project }) {
  const argv = resolvePiRpcArgv();
  if (!commandPath(argv[0])) {
    return {
      status: 'skipped',
      skipReason: `${argv[0]} not found on PATH`,
      requested: count,
      argv,
      samples: [],
      summary: summarize([]),
    };
  }

  const workers = [];
  try {
    for (let index = 0; index < count; index += 1) {
      workers.push(await startPiRpcWorker({ cwd: project, env: process.env }));
    }
    await delay(holdMs);
    const samples = workers.map((worker, index) => ({
      index,
      ...inspectPiRpcWorker(worker),
      rssKb: worker.sampleRssKb(),
    }));
    return {
      status: 'sampled',
      skipReason: null,
      requested: count,
      argv,
      samples,
      summary: summarize(samples),
    };
  } finally {
    await Promise.allSettled(workers.map((worker) => stopPiRpcWorker(worker)));
  }
}

function startPlainWorker(bin, cwd, args = []) {
  const child = spawn(bin, args, { cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  let alive = true;
  const closed = new Promise((resolveClosed) => {
    const settle = () => {
      alive = false;
      resolveClosed();
    };
    child.once('close', settle);
    child.once('exit', settle);
    child.once('error', settle);
  });
  return {
    pid: child.pid ?? null,
    argv: [bin, ...args],
    alive: () => alive,
    rssKb: () => sampleRssKb(child.pid),
    async stop() {
      if (!alive) return;
      try {
        child.stdin?.end?.();
      } catch {
        // Best-effort cleanup before kill.
      }
      if (alive) {
        // Kill process group if possible so tree children die with parent.
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          child.kill('SIGTERM');
        }
      }
      await closed;
      // Sweep remaining descendants after parent exit.
      for (const pid of listDescendantPids(child.pid)) {
        try {
          process.kill(pid, 'SIGTERM');
        } catch {
          // already gone
        }
      }
    },
  };
}

async function sampleOpencodeWorkers({ count, holdMs, project, includeOpencode, opencodeBin }) {
  if (!includeOpencode) {
    return {
      status: 'skipped',
      skipReason: 'not requested; pass --include-opencode to sample opencode workers',
      requested: 0,
      argv: [opencodeBin],
      samples: [],
      summary: summarize([]),
      treeSummary: summarize([]),
    };
  }
  const resolved = commandPath(opencodeBin);
  if (!resolved) {
    return {
      status: 'skipped',
      skipReason: `${opencodeBin} not found on PATH`,
      requested: count,
      argv: [opencodeBin],
      samples: [],
      summary: summarize([]),
      treeSummary: summarize([]),
    };
  }

  // Prefer a single OpenCode tree sample for S3 contrast (count is still honored).
  // Launch with `web` subcommand when available so the process stays up long enough to measure.
  const launchArgs = [];
  const workers = [];
  try {
    for (let index = 0; index < count; index += 1) {
      workers.push(startPlainWorker(resolved, project, launchArgs));
    }
    await delay(Math.max(holdMs, 4000));
    const samples = workers.map((worker, index) => {
      const tree = sampleProcessTreeRssKb(worker.pid);
      return {
        index,
        pid: worker.pid,
        alive: worker.alive(),
        argv: worker.argv,
        rssKb: worker.rssKb(),
        treeRssKb: tree.treeRssKb,
        processCount: tree.processCount,
        parentRssKb: tree.parentRssKb,
      };
    });
    const treeSamples = samples.map((sample) => ({ rssKb: sample.treeRssKb }));
    return {
      status: 'sampled',
      skipReason: null,
      requested: count,
      argv: [resolved, ...launchArgs],
      samples,
      summary: summarize(samples),
      treeSummary: summarize(treeSamples),
      samplingNote: 'treeRssKb includes root + descendants via /proc VmRSS; idle CLI may not spawn full agent tree.',
    };
  } finally {
    await Promise.allSettled(workers.map((worker) => worker.stop()));
  }
}


async function sampleExternalOpencodeTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return {
      status: 'skipped',
      skipReason: 'invalid EVOBUDDY_S3_OPENCODE_TREE_PID / --opencode-tree-pid',
      requested: 1,
      samples: [],
      summary: summarize([]),
      treeSummary: summarize([]),
    };
  }
  const tree = sampleProcessTreeRssKb(pid);
  const samples = [{
    index: 0,
    pid,
    alive: tree.parentRssKb != null,
    argv: ['external-opencode-tree'],
    rssKb: tree.parentRssKb,
    treeRssKb: tree.treeRssKb,
    processCount: tree.processCount,
    parentRssKb: tree.parentRssKb,
  }];
  return {
    status: tree.treeRssKb != null ? 'sampled' : 'skipped',
    skipReason: tree.treeRssKb != null ? null : `cannot read process tree for pid ${pid}`,
    requested: 1,
    samples,
    summary: summarize(samples),
    treeSummary: summarize([{ rssKb: tree.treeRssKb }]),
    samplingNote: 'External full-tree PID sample via EVOBUDDY_S3_OPENCODE_TREE_PID / --opencode-tree-pid',
  };
}

export async function runSampleSeatRss(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const pi = await samplePiWorkers(args);
  const opencode = args.opencodeTreePid
    ? await sampleExternalOpencodeTree(args.opencodeTreePid)
    : await sampleOpencodeWorkers(args);
  const piSumKb = (pi.samples ?? []).reduce((acc, sample) => acc + (sample.rssKb ?? 0), 0);
  const opencodeTreeMaxKb = opencode.treeSummary?.maxRssKb ?? null;
  const density = {
    piWorkerCount: pi.samples?.length ?? 0,
    piSumRssKb: pi.status === 'sampled' ? piSumKb : null,
    opencodeTreeMaxRssKb: opencode.status === 'sampled' ? opencodeTreeMaxKb : null,
    piSumVsOneOpencodeTreeRatio:
      opencode.status === 'sampled' && opencodeTreeMaxKb > 0 && pi.status === 'sampled'
        ? Number((piSumKb / opencodeTreeMaxKb).toFixed(3))
        : null,
    s3PassRule: 'piSumRss <= 0.5 * oneOpencodeTreeRss (process-tree RSS)',
    s3Pass:
      opencode.status === 'sampled'
      && pi.status === 'sampled'
      && Number.isFinite(opencodeTreeMaxKb)
      && opencodeTreeMaxKb > 0
        ? piSumKb <= 0.5 * opencodeTreeMaxKb
        : null,
  };
  const report = {
    schema: 'evobuddy.seat-rss-sample.v1',
    sampledAt: new Date().toISOString(),
    note: 'OpenCode samples include process-tree RSS (root + descendants). Live observation only unless density.s3Pass is true/false.',
    options: {
      count: args.count,
      holdMs: args.holdMs,
      project: args.project,
      includeOpencode: args.includeOpencode,
    },
    pi,
    opencode,
    density,
  };

  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (args.out) await writeFile(args.out, json, 'utf8');
  return { report, json };
}

async function main() {
  const { json } = await runSampleSeatRss();
  process.stdout.write(json);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
