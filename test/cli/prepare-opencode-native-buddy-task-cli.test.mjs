import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/prepare-opencode-native-buddy-task.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeRegistry(root) {
  const membersDir = join(root, 'docs', 'members');
  mkdirSync(membersDir, { recursive: true });
  writeJson(join(membersDir, 'member-bootstrap-curator.json'), {
    name: 'member-bootstrap-curator',
    description: 'Use when reviewing Buddy execution policy implementation boundaries.',
    role: 'Bootstrap Curator',
    responsibilities: ['Review Buddy execution boundaries'],
    standardsRefs: [],
    roleMemoryRefs: [],
    activationHints: ['buddy execution policy'],
    negativeActivationHints: [],
  });
  writeJson(join(membersDir, 'registry.json'), {
    version: '1',
    members: [
      {
        name: 'member-bootstrap-curator',
        resolvedMemberId: 'mem-bootstrap-curator-001',
        profileRef: './member-bootstrap-curator.json',
      },
    ],
  });
  return join(membersDir, 'registry.json');
}

describe('prepare-opencode-native-buddy-task CLI', () => {
  it('writes the invocation packet, native prompt, and preparation summary with preparation-only status', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-opencode-native-buddy-task-'));
    try {
      const out = join(root, 'out');
      const targetRef = join(root, 'docs', 'plan.md');
      mkdirSync(dirname(targetRef), { recursive: true });
      writeFileSync(targetRef, 'Plan text\n', 'utf8');
      const registry = writeRegistry(root);

      const result = run([
        '--buddy-name', 'member-bootstrap-curator',
        '--task', 'Review the Buddy execution policy implementation for native OpenCode task proof boundaries.',
        '--project-identity', root,
        '--out', out,
        '--target-ref', targetRef,
        '--registry', registry,
        '--json',
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(existsSync(join(out, 'member-invocation-packet.json')), true);
      assert.equal(existsSync(join(out, 'opencode-native-buddy-task-prompt.txt')), true);
      assert.equal(existsSync(join(out, 'opencode-native-buddy-task-preparation.json')), true);

      const packet = readJson(join(out, 'member-invocation-packet.json'));
      const preparation = readJson(join(out, 'opencode-native-buddy-task-preparation.json'));
      const prompt = readFileSync(join(out, 'opencode-native-buddy-task-prompt.txt'), 'utf8');

      assert.equal(packet.memberName, 'member-bootstrap-curator');
      assert.equal(packet.task.question, 'Review the Buddy execution policy implementation for native OpenCode task proof boundaries.');
      assert.equal(packet.targetRefs.includes(targetRef), true);

      assert.equal(preparation.status, 'prepared');
      assert.equal(preparation.executionProof, 'not-run');
      assert.equal(preparation.nativeSubagent, false);
      assert.equal(preparation.message, 'Prepared native OpenCode task prompt only; product proof requires observed child session evidence.');
      assert.equal(preparation.invocationPacketDigest, packet.invocationPacketDigest);

      assert.match(prompt, new RegExp(packet.invocationPacketDigest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(prompt, /member-bootstrap-curator/);
      assert.match(prompt, /return the result directly to the parent agent/i);
      assert.doesNotMatch(prompt, /invoke-buddy|invoke-member|ctree\s+buddies\s+invoke|scripts\/context-tree/i);

      const stdoutJson = JSON.parse(result.stdout);
      assert.equal(stdoutJson.status, 'prepared');
      assert.equal(stdoutJson.executionProof, 'not-run');
      assert.equal(stdoutJson.nativeSubagent, false);
      assert.equal(stdoutJson.message, 'Prepared native OpenCode task prompt only; product proof requires observed child session evidence.');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
