import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/run-codex-live-surface-proof.mjs');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeExecutable(path, content) {
  writeFileSync(path, content, 'utf8');
  chmodSync(path, 0o755);
}

function writeProjectSources(projectRoot) {
  mkdirSync(join(projectRoot, 'src', 'install'), { recursive: true });
  mkdirSync(join(projectRoot, 'src', 'presets', 'buddies', 'evolution-buddy'), { recursive: true });
  writeFileSync(join(projectRoot, 'src', 'install', 'codex-member-instructions.mjs'), 'export const codex = true;\n', 'utf8');
  writeFileSync(join(projectRoot, 'src', 'presets', 'buddies', 'evolution-buddy.json'), '{"name":"evolution-buddy"}\n', 'utf8');
  writeFileSync(join(projectRoot, 'src', 'presets', 'buddies', 'evolution-buddy', 'BUDDY.md'), '# Evolution Buddy\n', 'utf8');
}

describe('run-codex-live-surface-proof CLI', () => {
  it('writes a blocked report with pinned surface digests and layer classification when Codex stays local', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-codex-live-proof-'));
    const projectRoot = join(tempRoot, 'project');
    const codexHome = join(tempRoot, 'codex-home');
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(codexHome, { recursive: true });
    writeProjectSources(projectRoot);

    const syncCommand = join(tempRoot, 'fake-sync.mjs');
    writeExecutable(syncCommand, `#!/usr/bin/env node
const { mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
const { join, resolve } = await import('node:path');
const { createHash } = await import('node:crypto');
const args = process.argv.slice(2);
const projectIndex = args.indexOf('--project');
const projectRoot = resolve(args[projectIndex + 1]);
mkdirSync(join(projectRoot, '.evobuddy', 'instructions'), { recursive: true });
mkdirSync(join(projectRoot, '.codex', 'agents'), { recursive: true });
const parent = '# parent instructions\\n';
const toml = 'name = "evolution_buddy"\\n';
writeFileSync(join(projectRoot, '.evobuddy', 'instructions', 'codex-parent-instructions.md'), parent, 'utf8');
writeFileSync(join(projectRoot, '.codex', 'agents', 'evolution_buddy.toml'), toml, 'utf8');
const digest = (text) => 'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex');
const report = {
  reportKind: 'context-tree-subagent-baseline-install-report',
  members: [{
    memberName: 'evolution-buddy',
    runtimeAgentName: 'evolution_buddy',
    baselineDigest: digest(readFileSync(join(projectRoot, 'src', 'presets', 'buddies', 'evolution-buddy', 'BUDDY.md'), 'utf8')),
    runtimeFile: {
      path: '.codex/agents/evolution_buddy.toml',
      digest: digest(toml),
      runtimeAgentName: 'evolution_buddy'
    }
  }]
};
writeFileSync(join(projectRoot, 'context-tree-member-projection-install-report.json'), JSON.stringify(report, null, 2) + '\\n', 'utf8');
process.stdout.write(JSON.stringify({ status: 'pass' }) + '\\n');
`);

    const codexCommand = join(tempRoot, 'fake-codex.mjs');
    writeExecutable(codexCommand, `#!/usr/bin/env node
const { mkdirSync, writeFileSync } = await import('node:fs');
const { join, resolve } = await import('node:path');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const cdIndex = args.indexOf('--cd');
const outputPath = outputIndex >= 0 ? resolve(args[outputIndex + 1]) : null;
const projectRoot = cdIndex >= 0 ? resolve(args[cdIndex + 1]) : process.cwd();
const prompt = args.at(-1);
const codexHome = resolve(process.env.CODEX_HOME);
mkdirSync(join(codexHome, 'sessions'), { recursive: true });
writeFileSync(join(codexHome, 'session_index.jsonl'), JSON.stringify({ id: 'sess-123', cwd: projectRoot, file: 'sessions/rollout-parent.jsonl' }) + '\\n', 'utf8');
writeFileSync(join(codexHome, 'sessions', 'rollout-parent.jsonl'), [
  JSON.stringify({ type: 'session_meta', payload: { session_id: 'sess-123', id: 'root-123', cwd: projectRoot } }),
  JSON.stringify({ type: 'message', role: 'user', content: prompt }),
  JSON.stringify({ type: 'assistant', role: 'assistant', content: 'Handled locally without native child.' })
].join('\\n') + '\\n', 'utf8');
if (outputPath) writeFileSync(outputPath, 'Handled locally without native child.\\n', 'utf8');
process.stdout.write(JSON.stringify({ session_id: 'sess-123' }) + '\\n');
`);

    const outRoot = join(tempRoot, 'out');
    const result = spawnSync(process.execPath, [CLI,
      '--project', projectRoot,
      '--member', 'evolution-buddy',
      '--out', outRoot,
      '--codex-home', codexHome,
      '--codex-command', codexCommand,
      '--sync-command', syncCommand,
      '--prompt', 'Repeated corrected release-proof work shows that retained eval outputs keep being mistaken for shipping proof. Decide the durable project-behavior change that should prevent recurrence.',
    ], { cwd: ROOT, encoding: 'utf8', timeout: 180000 });

    try {
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      const report = readJson(join(outRoot, 'codex-live-proof-report.json'));
      const surfaceState = readJson(join(outRoot, 'codex-surface-state.json'));
      assert.equal(summary.status, 'blocked');
      assert.equal(report.status, 'blocked');
      assert.equal(report.surfacesWereCurrent, true);
      assert.equal(report.liveRun.sessionId, 'sess-123');
      assert.equal(report.liveRun.rootId, 'root-123');
      assert.equal(report.childSessionObserved, false);
      assert.equal(report.resultReturnObserved, false);
      assert.equal(report.primaryFailureLayer, 'routing');
      assert.deepEqual(report.failedLayers, ['routing']);
      assert.equal(Array.isArray(surfaceState.files), true);
      assert.equal(surfaceState.files.length, 5);
      assert.deepEqual(surfaceState.files.map((entry) => entry.path).sort(), [
        '.codex/agents/evolution_buddy.toml',
        '.evobuddy/instructions/codex-parent-instructions.md',
        'src/install/codex-member-instructions.mjs',
        'src/presets/buddies/evolution-buddy.json',
        'src/presets/buddies/evolution-buddy/BUDDY.md',
      ].sort());
      assert.equal(report.surfaceStateRef, join(outRoot, 'codex-surface-state.json'));
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('anchors proof export to the current live run instead of older matching Codex sessions', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-codex-live-proof-anchor-'));
    const projectRoot = join(tempRoot, 'project');
    const codexHome = join(tempRoot, 'codex-home');
    mkdirSync(join(codexHome, 'sessions', '2026', '07', '17'), { recursive: true });
    mkdirSync(projectRoot, { recursive: true });
    writeProjectSources(projectRoot);

    writeFileSync(join(codexHome, 'session_index.jsonl'), [
      JSON.stringify({ id: 'old-native', cwd: projectRoot, file: 'sessions/2026/07/17/rollout-old-native.jsonl' }),
      JSON.stringify({ id: 'new-local', cwd: projectRoot, file: 'sessions/2026/07/17/rollout-new-local.jsonl' }),
    ].join('\n') + '\n', 'utf8');
    writeFileSync(join(codexHome, 'sessions', '2026', '07', '17', 'rollout-old-native.jsonl'), [
      JSON.stringify({ type: 'response_item', payload: { type: 'function_call', id: 'fc_spawn_1', name: 'spawn_agent', arguments: '{"agent_type":"evolution_buddy","message":"Use evolution_buddy."}', call_id: 'call_spawn_1', internal_chat_message_metadata_passthrough: { turn_id: 'old-turn' } } }),
      JSON.stringify({ type: 'response_item', payload: { type: 'function_call_output', call_id: 'call_spawn_1', output: '{"agent_id":"old-child"}', internal_chat_message_metadata_passthrough: { turn_id: 'old-turn' } } }),
      JSON.stringify({ type: 'response_item', payload: { type: 'function_call', id: 'fc_wait_1', name: 'wait_agent', arguments: '{"targets":["old-child"]}', call_id: 'call_wait_1', internal_chat_message_metadata_passthrough: { turn_id: 'old-turn' } } }),
      JSON.stringify({ type: 'response_item', payload: { type: 'function_call_output', call_id: 'call_wait_1', output: '{"status":{"old-child":{"completed":"done"}},"timed_out":false}', internal_chat_message_metadata_passthrough: { turn_id: 'old-turn' } } }),
      JSON.stringify({ type: 'assistant', uuid: 'old-result', role: 'assistant', childResult: { childThreadId: 'old-child', memberName: 'evolution-buddy', runtimeAgentName: 'evolution_buddy', returnedToParent: true, resultText: 'done' }, content: 'done' }),
    ].join('\n') + '\n', 'utf8');

    const syncCommand = join(tempRoot, 'fake-sync.mjs');
    writeExecutable(syncCommand, `#!/usr/bin/env node
const { mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
const { join, resolve } = await import('node:path');
const { createHash } = await import('node:crypto');
const args = process.argv.slice(2);
const projectIndex = args.indexOf('--project');
const projectRoot = resolve(args[projectIndex + 1]);
mkdirSync(join(projectRoot, '.evobuddy', 'instructions'), { recursive: true });
mkdirSync(join(projectRoot, '.codex', 'agents'), { recursive: true });
const parent = '# parent instructions\\n';
const toml = 'name = "evolution_buddy"\\n';
writeFileSync(join(projectRoot, '.evobuddy', 'instructions', 'codex-parent-instructions.md'), parent, 'utf8');
writeFileSync(join(projectRoot, '.codex', 'agents', 'evolution_buddy.toml'), toml, 'utf8');
const digest = (text) => 'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex');
const report = {
  reportKind: 'context-tree-subagent-baseline-install-report',
  members: [{
    memberName: 'evolution-buddy',
    runtimeAgentName: 'evolution_buddy',
    baselineDigest: digest(readFileSync(join(projectRoot, 'src', 'presets', 'buddies', 'evolution-buddy', 'BUDDY.md'), 'utf8')),
    runtimeFile: { path: '.codex/agents/evolution_buddy.toml', digest: digest(toml), runtimeAgentName: 'evolution_buddy' }
  }]
};
writeFileSync(join(projectRoot, 'context-tree-member-projection-install-report.json'), JSON.stringify(report, null, 2) + '\\n', 'utf8');
process.stdout.write(JSON.stringify({ status: 'pass' }) + '\\n');
`);

    const codexCommand = join(tempRoot, 'fake-codex.mjs');
    writeExecutable(codexCommand, `#!/usr/bin/env node
const { writeFileSync } = await import('node:fs');
const { join, resolve } = await import('node:path');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const cdIndex = args.indexOf('--cd');
const outputPath = outputIndex >= 0 ? resolve(args[outputIndex + 1]) : null;
const projectRoot = cdIndex >= 0 ? resolve(args[cdIndex + 1]) : process.cwd();
const prompt = args.at(-1);
const codexHome = resolve(process.env.CODEX_HOME);
writeFileSync(join(codexHome, 'sessions', '2026', '07', '17', 'rollout-new-local.jsonl'), [
  JSON.stringify({ type: 'session_meta', payload: { session_id: 'new-local', id: 'new-local', cwd: projectRoot } }),
  JSON.stringify({ type: 'message', role: 'user', content: prompt }),
  JSON.stringify({ type: 'assistant', role: 'assistant', content: 'Handled locally without native child.' })
].join('\\n') + '\\n', 'utf8');
if (outputPath) writeFileSync(outputPath, 'Handled locally without native child.\\n', 'utf8');
process.stdout.write(JSON.stringify({ session_id: 'new-local' }) + '\\n');
`);

    const outRoot = join(tempRoot, 'out');
    const result = spawnSync(process.execPath, [CLI,
      '--project', projectRoot,
      '--member', 'evolution-buddy',
      '--out', outRoot,
      '--codex-home', codexHome,
      '--codex-command', codexCommand,
      '--sync-command', syncCommand,
      '--prompt', 'Repeated corrected release-proof work shows that retained eval outputs keep being mistaken for shipping proof. Decide the durable project-behavior change that should prevent recurrence.',
    ], { cwd: ROOT, encoding: 'utf8', timeout: 180000 });

    try {
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(outRoot, 'codex-live-proof-report.json'));
      assert.equal(report.status, 'blocked');
      assert.equal(report.liveRun.sessionId, 'new-local');
      assert.equal(report.primaryFailureLayer, 'routing');
      assert.equal(report.childSessionObserved, false);
      assert.equal(report.resultReturnObserved, false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
