import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const GENERATE_CLI = join(REPO_ROOT, 'scripts/context-tree/generate-evobuddy-actor-projections.mjs');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-codex-actor-live-surface-proof.mjs');

function run(cli, args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function writeExecutable(path, content) {
  writeFileSync(path, content, 'utf8');
  chmodSync(path, 0o755);
}

describe('run-codex-actor-live-surface-proof CLI', () => {
  it('reports blocked native proof when only surface-current evidence exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'codex-actor-proof-'));
    const project = join(root, 'project');
    const out = join(root, 'out');
    try {
      const generated = run(GENERATE_CLI, ['--project', REPO_ROOT, '--out', project, '--include', 'active,available']);
      assert.equal(generated.status, 0, generated.stderr || generated.stdout);

      const result = run(CLI, [
        '--project', project,
        '--actor-name', 'librarian',
        '--actor-kind', 'subagent-buddy',
        '--out', out,
        '--prompt', 'Review this update and tell me whether it is safe.',
        '--skip-sync',
        '--skip-live-run',
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'codex-actor-live-surface-proof-report.json'), 'utf8'));
      assert.equal(report.surfaceCurrent.status, 'pass');
      assert.equal(report.nativeMechanismObserved.status, 'blocked');
      assert.equal(report.naturalUseObserved.status, 'blocked');
      assert.equal(report.failedLayer, 'routing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('captures TeamAgent session/result evidence from Codex persisted thread attribution', () => {
    const root = mkdtempSync(join(tmpdir(), 'codex-team-agent-proof-'));
    const project = join(root, 'project');
    const out = join(root, 'out');
    const codexHome = join(root, 'codex-home');
    const fakeCodex = join(root, 'fake-codex.js');
    try {
      const generated = run(GENERATE_CLI, ['--project', REPO_ROOT, '--out', project, '--include', 'active,available']);
      assert.equal(generated.status, 0, generated.stderr || generated.stdout);

      mkdirSync(join(codexHome, 'sessions', '2026', '07', '18'), { recursive: true });
      const sessionId = '019fteamagent-session';
      const rolloutPath = join(codexHome, 'sessions', '2026', '07', '18', `rollout-2026-07-18T22-00-00-${sessionId}.jsonl`);
      writeFileSync(rolloutPath, [
        JSON.stringify({
          timestamp: '2026-07-18T14:00:00.000Z',
          type: 'session_meta',
          payload: {
            session_id: sessionId,
            id: sessionId,
            cwd: project,
            thread_source: 'subagent',
            source: { subagent: { thread_spawn: { parent_thread_id: 'parent-session', depth: 1, agent_role: 'reviewer' } } },
            agent_role: 'reviewer',
          },
        }),
        JSON.stringify({
          timestamp: '2026-07-18T14:00:02.000Z',
          type: 'assistant',
          role: 'assistant',
          content: 'Main release risk: legacy Buddy proof could be misread as TeamAgent proof.',
          resultReturn: { returnedTo: 'parent-agent', resultRef: 'codex-thread:parent:result', resultDigest: 'sha256:abababababababababababababababababababababababababababababababab' },
        }),
      ].join('\n') + '\n', 'utf8');

      writeExecutable(fakeCodex, `#!/usr/bin/env node\nprocess.stderr.write('OpenAI Codex v0.144.1\\n');\nprocess.stderr.write('session id: ${sessionId}\\n');\nprocess.exit(0);\n`);

      const result = run(CLI, [
        '--project', project,
        '--actor-name', 'reviewer',
        '--actor-kind', 'team-agent',
        '--out', out,
        '--prompt', 'Review the current EvoBuddy proof-separation changes and return the main release-risk.',
        '--skip-sync',
        '--codex-home', codexHome,
        '--codex-command', fakeCodex,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'codex-actor-live-surface-proof-report.json'), 'utf8'));
      assert.equal(report.surfaceCurrent.status, 'pass');
      assert.equal(report.teamAgentSessionObserved.status, 'pass');
      assert.equal(report.teamAgentResultObserved.status, 'pass');
      assert.equal(report.failedLayer, null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('anchors TeamAgent proof to the attributed child thread and parent-visible stdout result', () => {
    const root = mkdtempSync(join(tmpdir(), 'codex-team-agent-child-proof-'));
    const project = join(root, 'project');
    const out = join(root, 'out');
    const codexHome = join(root, 'codex-home');
    const fakeCodex = join(root, 'fake-codex.js');
    try {
      const generated = run(GENERATE_CLI, ['--project', REPO_ROOT, '--out', project, '--include', 'active,available']);
      assert.equal(generated.status, 0, generated.stderr || generated.stdout);

      mkdirSync(join(codexHome, 'sessions', '2026', '07', '18'), { recursive: true });
      const parentSessionId = '019fparent-session';
      const childSessionId = '019freviewer-child';
      writeExecutable(fakeCodex, `#!/usr/bin/env node
const { writeFileSync } = await import('node:fs');
const { join, resolve } = await import('node:path');
const codexHome = resolve(process.env.CODEX_HOME);
const dir = join(codexHome, 'sessions', '2026', '07', '18');
writeFileSync(join(dir, 'rollout-2026-07-18T22-10-00-${parentSessionId}.jsonl'), [
  JSON.stringify({ timestamp: '2026-07-18T14:10:00.000Z', type: 'session_meta', payload: { session_id: '${parentSessionId}', id: '${parentSessionId}', cwd: process.cwd(), source: 'exec', thread_source: 'user' } }),
  JSON.stringify({ timestamp: '2026-07-18T14:10:01.000Z', type: 'response_item', payload: { type: 'function_call', name: 'spawn_agent', arguments: '{"agent_type":"reviewer"}' } })
].join('\\n') + '\\n', 'utf8');
writeFileSync(join(dir, 'rollout-2026-07-18T22-10-01-${childSessionId}.jsonl'), [
  JSON.stringify({ timestamp: '2026-07-18T14:10:01.000Z', type: 'session_meta', payload: { session_id: '${parentSessionId}', id: '${childSessionId}', parent_thread_id: '${parentSessionId}', cwd: process.cwd(), thread_source: 'subagent', source: { subagent: { thread_spawn: { parent_thread_id: '${parentSessionId}', depth: 1, agent_role: 'reviewer' } } }, agent_role: 'reviewer' } }),
  JSON.stringify({ timestamp: '2026-07-18T14:10:02.000Z', type: 'assistant', role: 'assistant', content: 'Reviewer risk.' })
].join('\\n') + '\\n', 'utf8');
process.stdout.write('Reviewer risk returned to parent.\\n');
process.stderr.write('session id: ${parentSessionId}\\n');
process.exit(0);
`);

      const result = run(CLI, [
        '--project', project,
        '--actor-name', 'reviewer',
        '--actor-kind', 'team-agent',
        '--out', out,
        '--prompt', 'Have reviewer inspect the current EvoBuddy proof-separation changes and return the main release-risk.',
        '--skip-sync',
        '--codex-home', codexHome,
        '--codex-command', fakeCodex,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'codex-actor-live-surface-proof-report.json'), 'utf8'));
      assert.equal(report.teamAgentSessionObserved.status, 'pass');
      assert.equal(report.teamAgentResultObserved.status, 'pass');
      assert.equal(report.liveRun.sessionId, childSessionId);
      assert.match(report.liveRun.sessionFile, /019freviewer-child/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
