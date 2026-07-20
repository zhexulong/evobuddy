import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-authorized-native-spawn-experiment.mjs');

function envWithGate(enabled) {
  const env = { ...process.env };
  if (enabled) env.CTREE_AUTHORIZED_NATIVE_SPAWN = '1';
  else delete env.CTREE_AUTHORIZED_NATIVE_SPAWN;
  return env;
}

function runCli({ config, outputDir, authorized = true, gate = true }) {
  const configPath = join(outputDir, 'config.json');
  writeFileSync(configPath, JSON.stringify(config), 'utf8');
  const args = [CLI];
  if (authorized) args.push('--authorized');
  args.push('--config', configPath, '--out', outputDir);
  return spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: envWithGate(gate),
    timeout: 120000,
  });
}

function withOutputDir(fn) {
  const outputDir = mkdtempSync(join(tmpdir(), 'ctree-autonomous-native-spawn-experiment-'));
  try {
    return fn(outputDir);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

function runPassingFixture(fixtureMode) {
  return withOutputDir((outputDir) => {
    const result = runCli({ config: { fixtureMode }, outputDir });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return { parsed: JSON.parse(result.stdout), outputDir };
  });
}

function writeAutonomousCodexBinWithChildAnswer(dir, childAnswer) {
  const fakeBin = join(dir, 'autonomous-native-spawn-codex.mjs');
  writeFileSync(fakeBin, `#!/usr/bin/env node
let buffer = '';

if (process.argv[2] !== 'app-server' || process.argv[3] !== '--listen' || process.argv[4] !== 'stdio://') {
  console.error('unexpected argv: ' + process.argv.slice(2).join(' '));
  process.exit(2);
}

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

function error(id, code, message) {
  write({ id, error: { code, message } });
}

function collabItem(overrides) {
  return {
    type: 'collabAgentToolCall',
    id: overrides.id,
    tool: overrides.tool,
    status: 'completed',
    senderThreadId: 'autonomous-parent-thread',
    receiverThreadIds: overrides.receiverThreadIds,
    prompt: overrides.prompt ?? null,
    agentsStates: overrides.agentsStates ?? {},
  };
}

function handle(message) {
  const { id, method, params = {} } = message;
  if (method === 'initialize') {
    write({ id, result: { capabilities: { experimentalApi: true }, serverInfo: { name: 'autonomous-native-spawn-codex', version: '0.0.0' } } });
    return;
  }
  if (method === 'thread/read' && params.threadId === '__probe__') return error(id, -32000, 'invalid thread');
  if (method === 'thread/turns/list') return error(id, -32601, 'Method not found');
  if (method === 'thread/inject_items') return error(id, -32601, 'Method not found');
  if (method === 'thread/fork') return error(id, -32601, 'Method not found');
  if (method === 'thread/start') {
    write({ id, result: { thread: { id: 'autonomous-parent-thread' } } });
    return;
  }
  if (method === 'turn/start') {
    write({ id, result: { turnId: 'autonomous-parent-turn' } });
    setTimeout(() => {
      write({ method: 'item/completed', params: { item: collabItem({
        id: 'spawn-call-autonomous',
        tool: 'spawnAgent',
        receiverThreadIds: ['autonomous-child-thread'],
        prompt: 'Checkpoint-derived reviewer request',
        agentsStates: { 'autonomous-child-thread': { status: 'running', message: null } },
      }) } });
      write({ method: 'item/completed', params: { item: collabItem({
        id: 'wait-call-autonomous',
        tool: 'wait',
        receiverThreadIds: ['autonomous-child-thread'],
        agentsStates: { 'autonomous-child-thread': { status: 'completed', message: null } },
      }) } });
      write({ method: 'turn/completed', params: { threadId: 'autonomous-parent-thread', turnId: 'autonomous-parent-turn' } });
    }, 10);
    return;
  }
  if (method === 'thread/read' && params.threadId === 'autonomous-parent-thread') {
    write({ id, result: { thread: { turns: [{ id: 'autonomous-parent-turn', items: [{ type: 'agentMessage', id: 'parent-answer', text: '{"answer":"parent text mentions CTREE-SURVIVE-autonomous-native-spawn-proof"}' }] }] } } });
    return;
  }
  if (method === 'thread/read' && params.threadId === 'autonomous-child-thread') {
    write({ id, result: { thread: { turns: [{ id: 'autonomous-child-turn', items: [{ type: 'agentMessage', id: 'child-answer', text: ${JSON.stringify(childAnswer)} }] }] } } });
    return;
  }
  error(id, -32601, 'Method not found');
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\\n')) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.id === undefined) continue;
    handle(message);
  }
});
`, 'utf8');
  chmodSync(fakeBin, 0o755);
  return fakeBin;
}

function writeAutonomousCodexBinWithoutAssistantOutput(dir) {
  const fakeBin = join(dir, 'autonomous-native-spawn-no-output-codex.mjs');
  writeFileSync(fakeBin, String.raw`#!/usr/bin/env node
let buffer = '';

if (process.argv[2] !== 'app-server' || process.argv[3] !== '--listen' || process.argv[4] !== 'stdio://') {
  console.error('unexpected argv: ' + process.argv.slice(2).join(' '));
  process.exit(2);
}

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function error(id, code, message) {
  write({ id, error: { code, message } });
}

function handle(message) {
  const { id, method, params = {} } = message;
  if (method === 'initialize') {
    write({ id, result: { capabilities: { experimentalApi: true }, serverInfo: { name: 'autonomous-native-spawn-no-output-codex', version: '0.0.0' } } });
    return;
  }
  if (method === 'thread/read' && params.threadId === '__probe__') return error(id, -32000, 'invalid thread');
  if (method === 'thread/turns/list') return error(id, -32601, 'Method not found');
  if (method === 'thread/inject_items') return error(id, -32601, 'Method not found');
  if (method === 'thread/fork') return error(id, -32601, 'Method not found');
  if (method === 'thread/start') {
    write({ id, result: { thread: { id: 'autonomous-parent-thread' } } });
    return;
  }
  if (method === 'turn/start') {
    console.error('fixture stderr: no assistant output and no native spawn');
    write({ id, result: { turnId: 'autonomous-parent-turn' } });
    setTimeout(() => {
      write({ method: 'turn/completed', params: { threadId: 'autonomous-parent-thread', turnId: 'autonomous-parent-turn' } });
    }, 10);
    return;
  }
  if (method === 'thread/read' && params.threadId === 'autonomous-parent-thread') {
    write({ id, result: { thread: { turns: [{ id: 'autonomous-parent-turn', items: [] }] } } });
    return;
  }
  error(id, -32601, 'Method not found');
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.id === undefined) continue;
    handle(message);
  }
});
`, 'utf8');
  chmodSync(fakeBin, 0o755);
  return fakeBin;
}

function writeAutonomousCodexBinWithFailedParentTurn(dir) {
  const fakeBin = join(dir, 'autonomous-native-spawn-failed-parent-turn-codex.mjs');
  writeFileSync(fakeBin, [
    '#!/usr/bin/env node',
    "let buffer = '';",
    '',
    "if (process.argv[2] !== 'app-server' || process.argv[3] !== '--listen' || process.argv[4] !== 'stdio://') {",
    "  console.error('unexpected argv: ' + process.argv.slice(2).join(' '));",
    '  process.exit(2);',
    '}',
    '',
    'function write(message) {',
    "  process.stdout.write(JSON.stringify(message) + '\\n');",
    '}',
    '',
    'function error(id, code, message) {',
    '  write({ id, error: { code, message } });',
    '}',
    '',
    'function handle(message) {',
    '  const { id, method, params = {} } = message;',
    "  if (method === 'initialize') {",
    "    write({ id, result: { capabilities: { experimentalApi: true }, serverInfo: { name: 'autonomous-native-spawn-failed-parent-turn-codex', version: '0.0.0' } } });",
    '    return;',
    '  }',
    "  if (method === 'thread/read' && params.threadId === '__probe__') return error(id, -32000, 'invalid thread');",
    "  if (method === 'thread/turns/list') return error(id, -32601, 'Method not found');",
    "  if (method === 'thread/inject_items') return error(id, -32601, 'Method not found');",
    "  if (method === 'thread/fork') return error(id, -32601, 'Method not found');",
    "  if (method === 'thread/start') {",
    "    write({ id, result: { thread: { id: 'autonomous-parent-thread' } } });",
    '    return;',
    '  }',
    "  if (method === 'turn/start') {",
    "    console.error('transport error: 403 Forbidden from live provider');",
    "    write({ id, result: { turnId: 'autonomous-parent-turn' } });",
    '    setTimeout(() => {',
    "      write({ method: 'turn/completed', params: { threadId: 'autonomous-parent-thread', turnId: 'autonomous-parent-turn' } });",
    '    }, 10);',
    '    return;',
    '  }',
    "  if (method === 'thread/read' && params.threadId === 'autonomous-parent-thread') {",
    "    write({ id, result: { thread: { turns: [{ id: 'autonomous-parent-turn', items: [], itemsView: 'full', status: 'failed', error: { message: '403 Forbidden' }, startedAt: 1, completedAt: 2, durationMs: 1000 }] } } });",
    '    return;',
    '  }',
    "  error(id, -32601, 'Method not found');",
    '}',
    '',
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data', (chunk) => {",
    '  buffer += chunk;',
    '  let newline;',
    "  while ((newline = buffer.indexOf('\\n')) >= 0) {",
    '    const line = buffer.slice(0, newline).trim();',
    '    buffer = buffer.slice(newline + 1);',
    '    if (!line) continue;',
    '    const message = JSON.parse(line);',
    '    if (message.id === undefined) continue;',
    '    handle(message);',
    '  }',
    '});',
    '',
  ].join('\n'), 'utf8');
  chmodSync(fakeBin, 0o755);
  return fakeBin;
}

function writeAutonomousCodexBinWithProviderBlockedNoObservation(dir) {
  const fakeBin = join(dir, 'autonomous-native-spawn-provider-blocked-no-observation-codex.mjs');
  writeFileSync(fakeBin, [
    '#!/usr/bin/env node',
    "let buffer = '';",
    '',
    "if (process.argv[2] !== 'app-server' || process.argv[3] !== '--listen' || process.argv[4] !== 'stdio://') {",
    "  console.error('unexpected argv: ' + process.argv.slice(2).join(' '));",
    '  process.exit(2);',
    '}',
    '',
    'function write(message) {',
    "  process.stdout.write(JSON.stringify(message) + '\\n');",
    '}',
    '',
    'function error(id, code, message) {',
    '  write({ id, error: { code, message } });',
    '}',
    '',
    'function handle(message) {',
    '  const { id, method, params = {} } = message;',
    "  if (method === 'initialize') {",
    "    write({ id, result: { capabilities: { experimentalApi: true }, serverInfo: { name: 'autonomous-native-spawn-provider-blocked-no-observation-codex', version: '0.0.0' } } });",
    '    return;',
    '  }',
    "  if (method === 'thread/read' && params.threadId === '__probe__') return error(id, -32000, 'invalid thread');",
    "  if (method === 'thread/turns/list') return error(id, -32601, 'Method not found');",
    "  if (method === 'thread/inject_items') return error(id, -32601, 'Method not found');",
    "  if (method === 'thread/fork') return error(id, -32601, 'Method not found');",
    "  if (method === 'thread/start') {",
    "    write({ id, result: { thread: { id: 'autonomous-parent-thread' } } });",
    '    return;',
    '  }',
    "  if (method === 'turn/start') {",
    "    write({ id, result: { turnId: 'autonomous-parent-turn' } });",
    '    setTimeout(() => {',
    `      write({ method: 'error', params: { error: { message: 'Reconnecting... 2/5', codexErrorInfo: { responseStreamDisconnected: { httpStatusCode: 403 } }, additionalDetails: 'unexpected status 403 Forbidden: Country, region, or territory not supported, url: wss://api.openai.com/v1/responses' }, willRetry: true, threadId: 'autonomous-parent-thread', turnId: 'autonomous-parent-turn' } });`,
    `      write({ method: 'thread/status/changed', params: { threadId: 'autonomous-parent-thread', status: { type: 'systemError' } } });`,
    `      write({ method: 'turn/completed', params: { threadId: 'autonomous-parent-thread', turnId: 'autonomous-parent-turn' } });`,
    '    }, 10);',
    '    return;',
    '  }',
    "  if (method === 'thread/read' && params.threadId === 'autonomous-parent-thread') {",
    `    write({ id, result: { thread: { turns: [{ id: 'autonomous-parent-turn', items: [{ type: 'userMessage', id: 'item-1', text: 'prompt only' }], itemsView: 'full', status: 'completed', error: null, startedAt: 1, completedAt: 2, durationMs: 1000 }] } } });`,
    '    return;',
    '  }',
    "  error(id, -32601, 'Method not found');",
    '}',
    '',
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data', (chunk) => {",
    '  buffer += chunk;',
    '  let newline;',
    "  while ((newline = buffer.indexOf('\\n')) >= 0) {",
    '    const line = buffer.slice(0, newline).trim();',
    '    buffer = buffer.slice(newline + 1);',
    '    if (!line) continue;',
    '    const message = JSON.parse(line);',
    '    if (message.id === undefined) continue;',
    '    handle(message);',
    '  }',
    '});',
    '',
  ].join('\n'), 'utf8');
  chmodSync(fakeBin, 0o755);
  return fakeBin;
}

function writeAutonomousCodexBinWithoutWaitButTerminalChild(dir, childAnswer) {
  const fakeBin = join(dir, 'authorized-native-spawn-no-wait-terminal-child.mjs');
  writeFileSync(fakeBin, String.raw`#!/usr/bin/env node
let buffer = '';
let childReads = 0;

if (process.argv[2] !== 'app-server' || process.argv[3] !== '--listen' || process.argv[4] !== 'stdio://') {
  console.error('unexpected argv: ' + process.argv.slice(2).join(' '));
  process.exit(2);
}

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function error(id, code, message) {
  write({ id, error: { code, message } });
}

function collabItem(overrides) {
  return {
    type: 'collabAgentToolCall',
    id: overrides.id,
    tool: overrides.tool,
    status: 'completed',
    senderThreadId: 'autonomous-parent-thread',
    receiverThreadIds: overrides.receiverThreadIds,
    prompt: overrides.prompt ?? null,
    agentsStates: overrides.agentsStates ?? {},
  };
}

function handle(message) {
  const { id, method, params = {} } = message;
  if (method === 'initialize') {
    write({ id, result: { capabilities: { experimentalApi: true }, serverInfo: { name: 'authorized-native-spawn-no-wait-terminal-child', version: '0.0.0' } } });
    return;
  }
  if (method === 'thread/read' && params.threadId === '__probe__') return error(id, -32000, 'invalid thread');
  if (method === 'thread/turns/list') return error(id, -32601, 'Method not found');
  if (method === 'thread/inject_items') return error(id, -32601, 'Method not found');
  if (method === 'thread/fork') return error(id, -32601, 'Method not found');
  if (method === 'thread/start') {
    write({ id, result: { thread: { id: 'autonomous-parent-thread' } } });
    return;
  }
  if (method === 'turn/start') {
    write({ id, result: { turnId: 'autonomous-parent-turn' } });
    setTimeout(() => {
      write({ method: 'item/completed', params: { item: collabItem({
        id: 'spawn-call-autonomous',
        tool: 'spawnAgent',
        receiverThreadIds: ['autonomous-child-thread'],
        prompt: 'Checkpoint-derived reviewer request',
        agentsStates: { 'autonomous-child-thread': { status: 'pendingInit', message: null } },
      }) } });
      write({ method: 'turn/completed', params: { threadId: 'autonomous-parent-thread', turnId: 'autonomous-parent-turn' } });
    }, 10);
    return;
  }
  if (method === 'thread/read' && params.threadId === 'autonomous-parent-thread') {
    write({ id, result: { thread: { turns: [{ id: 'autonomous-parent-turn', items: [{ type: 'agentMessage', id: 'parent-answer', text: 'Delegated to child.' }] }] } } });
    return;
  }
  if (method === 'thread/read' && params.threadId === 'autonomous-child-thread') {
    childReads += 1;
    if (childReads < 2) {
      write({ id, result: { thread: { turns: [{ id: 'autonomous-child-turn', items: [{ type: 'agentMessage', id: 'child-commentary', text: 'Working...' }], itemsView: { type: 'partial' }, status: 'in_progress', error: null, startedAt: 1, completedAt: null }] } } });
      return;
    }
    write({ id, result: { thread: { turns: [{ id: 'autonomous-child-turn', items: [{ type: 'agentMessage', id: 'child-answer', text: ${JSON.stringify(childAnswer)} }], itemsView: { type: 'complete' }, status: 'completed', error: null, startedAt: 1, completedAt: 2, durationMs: 1000 }] } } });
    return;
  }
  error(id, -32601, 'Method not found');
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.id === undefined) continue;
    handle(message);
  }
});
`, 'utf8');
  chmodSync(fakeBin, 0o755);
  return fakeBin;
}

function writeAutonomousCodexBinWithContinuation(dir, childAnswer, continuationAnswer) {
  const fakeBin = join(dir, 'authorized-native-spawn-with-continuation.mjs');
  writeFileSync(fakeBin, `#!/usr/bin/env node
let buffer = '';
let turnStarts = 0;

if (process.argv[2] !== 'app-server' || process.argv[3] !== '--listen' || process.argv[4] !== 'stdio://') {
  console.error('unexpected argv: ' + process.argv.slice(2).join(' '));
  process.exit(2);
}

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

function error(id, code, message) {
  write({ id, error: { code, message } });
}

function collabItem(overrides) {
  return {
    type: 'collabAgentToolCall',
    id: overrides.id,
    tool: overrides.tool,
    status: 'completed',
    senderThreadId: 'autonomous-parent-thread',
    receiverThreadIds: overrides.receiverThreadIds,
    prompt: overrides.prompt ?? null,
    agentsStates: overrides.agentsStates ?? {},
  };
}

function handle(message) {
  const { id, method, params = {} } = message;
  if (method === 'initialize') {
    write({ id, result: { capabilities: { experimentalApi: true }, serverInfo: { name: 'authorized-native-spawn-with-continuation', version: '0.0.0' } } });
    return;
  }
  if (method === 'thread/read' && params.threadId === '__probe__') return error(id, -32000, 'invalid thread');
  if (method === 'thread/turns/list') return error(id, -32601, 'Method not found');
  if (method === 'thread/inject_items') return error(id, -32601, 'Method not found');
  if (method === 'thread/fork') return error(id, -32601, 'Method not found');
  if (method === 'thread/start') {
    write({ id, result: { thread: { id: 'autonomous-parent-thread' } } });
    return;
  }
  if (method === 'turn/start') {
    turnStarts += 1;
    const turnId = turnStarts === 1 ? 'autonomous-parent-turn' : 'autonomous-parent-turn-2';
    write({ id, result: { turnId } });
    setTimeout(() => {
      if (turnStarts === 1) {
        write({ method: 'item/completed', params: { item: collabItem({
          id: 'spawn-call-autonomous',
          tool: 'spawnAgent',
          receiverThreadIds: ['autonomous-child-thread'],
          prompt: 'Checkpoint-derived reviewer request',
          agentsStates: { 'autonomous-child-thread': { status: 'running', message: null } },
        }) } });
        write({ method: 'item/completed', params: { item: collabItem({
          id: 'wait-call-autonomous',
          tool: 'wait',
          receiverThreadIds: ['autonomous-child-thread'],
          agentsStates: { 'autonomous-child-thread': { status: 'completed', message: null } },
        }) } });
      }
      write({ method: 'turn/completed', params: { threadId: 'autonomous-parent-thread', turnId } });
    }, 10);
    return;
  }
  if (method === 'thread/read' && params.threadId === 'autonomous-parent-thread') {
    const turns = [{ id: 'autonomous-parent-turn', items: [{ type: 'agentMessage', id: 'parent-answer', text: 'Delegated to reviewer under user authorization.' }] }];
    if (turnStarts >= 2) {
      turns.push({ id: 'autonomous-parent-turn-2', items: [{ type: 'agentMessage', id: 'parent-continuation-answer', text: ${JSON.stringify(continuationAnswer)} }] });
    }
    write({ id, result: { thread: { turns } } });
    return;
  }
  if (method === 'thread/read' && params.threadId === 'autonomous-child-thread') {
    write({ id, result: { thread: { turns: [{ id: 'autonomous-child-turn', items: [{ type: 'agentMessage', id: 'child-answer', text: ${JSON.stringify(childAnswer)} }] }] } } });
    return;
  }
  error(id, -32601, 'Method not found');
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\\n')) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.id === undefined) continue;
    handle(message);
  }
});
`, 'utf8');
  chmodSync(fakeBin, 0o755);
  return fakeBin;
}

function authorizedPrompt() {
  return 'I am about to implement critical changes from the previous design. If an independent checkpoint-derived reviewer/oracle would reduce rework risk, you may delegate to one using the available sub-agent capability. Do not ask me for confirmation; decide and proceed if warranted. If you delegate, require the delegated agent\'s final answer to include the literal token CTREE-SURVIVE-authorized-native-spawn-proof.';
}

describe('run-authorized-native-spawn-experiment CLI', () => {
  it('rejects runs missing --authorized', () => withOutputDir((outputDir) => {
    const result = runCli({ config: { fixtureMode: 'no-spawn' }, outputDir, authorized: false, gate: true });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires --authorized/);
  }));

  it('rejects runs missing CTREE_AUTHORIZED_NATIVE_SPAWN=1', () => withOutputDir((outputDir) => {
    const result = runCli({ config: { fixtureMode: 'no-spawn' }, outputDir, authorized: true, gate: false });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CTREE_AUTHORIZED_NATIVE_SPAWN=1/);
  }));

  it('rejects prompts that lack delegation authorization for the authorized experiment', () => withOutputDir((outputDir) => {
    const result = runCli({
      config: { fixtureMode: 'no-spawn', naturalPrompt: 'Before I start, check whether prior checkpoint context should be used to catch review issues that could cause rework.' },
      outputDir,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.resultKind, 'prompt-rejected');
    assert.equal(parsed.authorizationMissing, true);
    assert.equal(parsed.naturalPromptAudit.authorizedDelegationGranted, false);
  }));

  it('classifies forbidden native-spawn prompt terms as prompt-rejected when gates are present', () => withOutputDir((outputDir) => {
    const result = runCli({
      config: { fixtureMode: 'no-spawn', naturalPrompt: 'Please call spawn_agent for me.' },
      outputDir,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.resultKind, 'prompt-rejected');
    assert.equal(parsed.autonomousNativeSpawnProof, false);
    assert.equal(parsed.authorizedDelegationProof, false);
    assert.deepEqual(parsed.naturalPromptAudit.forbiddenPromptTermsPresent, ['spawn_agent']);
  }));

  it('classifies fixture no-spawn mode without overclaiming autonomous proof', () => {
    const { parsed } = runPassingFixture('no-spawn');
    assert.equal(parsed.resultKind, 'authorized-no-trigger');
    assert.equal(parsed.autonomousNativeSpawnProof, false);
    assert.equal(parsed.authorizedDelegationProof, false);
    assert.equal(parsed.acceptanceMode, 'authorized-natural-native-spawn');
    assert.equal(parsed.acceptanceTier.id, 'authorized-natural-native-spawn');
  });

  it('classifies fixture runtime-not-wired mode as missing mechanism prerequisite', () => {
    const { parsed } = runPassingFixture('runtime-not-wired');
    assert.equal(parsed.resultKind, 'runtime-not-wired');
    assert.equal(parsed.mechanismPrerequisiteSatisfied, false);
    assert.equal(parsed.autonomousNativeSpawnProof, false);
  });

  it('classifies fixture model-error mode without autonomous proof', () => {
    const { parsed } = runPassingFixture('model-error');
    assert.equal(parsed.resultKind, 'model-error');
    assert.equal(parsed.mechanismPrerequisiteSatisfied, true);
    assert.equal(parsed.autonomousNativeSpawnProof, false);
    assert.equal(parsed.authorizedDelegationProof, false);
  });

  it('classifies fixture autonomous-pass mode and writes an in-output proof artifact', () => withOutputDir((outputDir) => {
    const result = runCli({ config: { fixtureMode: 'autonomous-pass' }, outputDir });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.resultKind, 'authorized-native-spawn-pass');
    assert.equal(parsed.authorizedDelegationProof, true);
    assert.equal(parsed.autonomousNativeSpawnProof, false);
    assert.equal(parsed.autonomousTriggerObserved, false);
    assert.ok(parsed.acceptanceProofPath, 'expected acceptanceProofPath');
    assert.ok(!relative(outputDir, parsed.acceptanceProofPath).startsWith('..'));
    assert.ok(existsSync(parsed.acceptanceProofPath));

    const proof = JSON.parse(readFileSync(parsed.acceptanceProofPath, 'utf8'));
    assert.equal(proof.acceptanceMode, 'authorized-natural-native-spawn');
    assert.equal(proof.acceptanceTier.id, 'authorized-natural-native-spawn');
    assert.equal(proof.authorizedDelegationProof, true);
    assert.equal(proof.autonomousNativeSpawnProof, false);
    assert.equal(proof.childThreadId, 'fixture-child-thread');

    assert.ok(parsed.evalReportPath, 'expected evalReportPath');
    assert.ok(existsSync(parsed.evalReportPath));
    const report = JSON.parse(readFileSync(parsed.evalReportPath, 'utf8'));
    assert.equal(report.summary.nativeSpawnPass, true);
    assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
  }));

  it('does not pass live autonomous proof from parent text when the child answer lacks the proof canary', () => withOutputDir((outputDir) => {
    const codexBin = writeAutonomousCodexBinWithChildAnswer(outputDir, '{"answer":"child did not retain the proof canary"}');
    const result = runCli({
      config: {
        codexBin,
        cwd: REPO_ROOT,
        naturalPrompt: authorizedPrompt(),
      },
      outputDir,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.resultKind, 'runtime-not-wired');
    assert.equal(parsed.autonomousNativeSpawnProof, false);
    assert.equal(parsed.authorizedDelegationProof, false);
    assert.equal(parsed.childThreadId, 'autonomous-child-thread');
    assert.equal(parsed.missingExpectedCanary, 'CTREE-SURVIVE-authorized-native-spawn-proof');
    assert.equal(parsed.observedAnswer, '{"answer":"child did not retain the proof canary"}');
    assert.equal(parsed.acceptanceProofPath, undefined);
    assert.ok(parsed.failureArtifactPath, 'expected failureArtifactPath');
    assert.ok(existsSync(parsed.failureArtifactPath));
    const failure = JSON.parse(readFileSync(parsed.failureArtifactPath, 'utf8'));
    assert.equal(failure.artifactKind, 'codex-authorized-native-spawn-failure-artifact');
    assert.equal(failure.resultKind, 'runtime-not-wired');
    assert.equal(failure.failureReason, 'child-answer-missing-proof-canary');
    assert.equal(failure.transport.exitReason, 'closed-by-runner');
    assert.deepEqual(failure.observedRuntimeState, {
      assistantOutputPresent: true,
      nativeSpawnObserved: true,
      waitCompletionObserved: true,
    });
  }));

  it('accepts terminal child-thread completion evidence when the parent omitted an explicit wait item', () => withOutputDir((outputDir) => {
    const codexBin = writeAutonomousCodexBinWithoutWaitButTerminalChild(outputDir, '{"answer":"child retained CTREE-SURVIVE-authorized-native-spawn-proof"}');
    const result = runCli({
      config: {
        codexBin,
        cwd: REPO_ROOT,
        naturalPrompt: authorizedPrompt(),
        childWaitTimeoutMs: 200,
        childWaitPollIntervalMs: 1,
      },
      outputDir,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.resultKind, 'authorized-native-spawn-pass');
    assert.equal(parsed.authorizedDelegationProof, true);
    assert.equal(parsed.waitCompletion.proof, 'child-thread-terminal-turn');
    assert.ok(parsed.acceptanceProofPath, 'expected acceptanceProofPath');
  }));

  it('surfaces delegated reviewer runtime diagnosis when the child answer reports missing sandbox support', () => withOutputDir((outputDir) => {
    const codexBin = writeAutonomousCodexBinWithChildAnswer(outputDir, '{"answer":"reviewer could not inspect repo because bwrap: execvp codex-linux-sandbox: No such file or directory CTREE-SURVIVE-authorized-native-spawn-proof"}');
    const result = runCli({
      config: {
        codexBin,
        cwd: REPO_ROOT,
        naturalPrompt: authorizedPrompt(),
      },
      outputDir,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.resultKind, 'authorized-native-spawn-pass');
    assert.equal(parsed.reviewerRuntimeDiagnosis.status, 'degraded');
    assert.equal(parsed.reviewerRuntimeDiagnosis.code, 'missing-codex-linux-sandbox');
    assert.equal(parsed.reviewerRuntimeDiagnosis.source, 'child-answer');
    assert.ok(parsed.acceptanceProofPath, 'expected acceptanceProofPath');

    const proof = JSON.parse(readFileSync(parsed.acceptanceProofPath, 'utf8'));
    assert.equal(proof.reviewerRuntimeDiagnosis.code, 'missing-codex-linux-sandbox');
  }));

  it('proves the authorized main loop can continue on the same parent thread after reviewer findings are returned', () => withOutputDir((outputDir) => {
    const childAnswer = JSON.stringify({
      answer: 'known',
      values: [
        'Risk: verify migration ordering before editing the implementation.',
        'Check: preserve CTREE-SURVIVE-authorized-native-spawn-proof in delegated proof handling.',
      ],
    });
    const continuationAnswer = 'Applying reviewer risk item: verify migration ordering before editing the implementation. Continuing with the critical implementation using the delegated checks.';
    const codexBin = writeAutonomousCodexBinWithContinuation(outputDir, childAnswer, continuationAnswer);
    const result = runCli({
      config: {
        codexBin,
        cwd: REPO_ROOT,
        naturalPrompt: authorizedPrompt(),
        continueAfterReview: true,
      },
      outputDir,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.resultKind, 'authorized-native-spawn-pass');
    assert.ok(parsed.continuation, 'expected continuation payload');
    assert.equal(parsed.continuation.parentThreadId, parsed.sourceThreadId);
    assert.equal(parsed.continuation.turnId, 'autonomous-parent-turn-2');
    assert.match(parsed.continuation.observedAnswer, /Applying reviewer risk item/i);
    assert.ok(parsed.continuation.parentThreadTurnCount >= 2, 'expected same parent thread to contain at least two turns');

    const proof = JSON.parse(readFileSync(parsed.acceptanceProofPath, 'utf8'));
    assert.equal(proof.continuation.parentThreadId, parsed.sourceThreadId);
    assert.equal(proof.continuation.turnId, 'autonomous-parent-turn-2');
  }));

  it('writes a failure artifact when the live attempt ends with no assistant output and no native spawn', () => withOutputDir((outputDir) => {
    const codexBin = writeAutonomousCodexBinWithoutAssistantOutput(outputDir);
    const result = runCli({
      config: {
        codexBin,
        cwd: REPO_ROOT,
        naturalPrompt: authorizedPrompt(),
      },
      outputDir,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.resultKind, 'authorized-no-trigger');
    assert.equal(parsed.autonomousNativeSpawnProof, false);
    assert.equal(parsed.authorizedDelegationProof, false);
    assert.equal(parsed.observedAnswer, undefined);
    assert.ok(parsed.failureArtifactPath, 'expected failureArtifactPath');
    assert.ok(existsSync(parsed.failureArtifactPath));
    const failure = JSON.parse(readFileSync(parsed.failureArtifactPath, 'utf8'));
    assert.equal(failure.artifactKind, 'codex-authorized-native-spawn-failure-artifact');
    assert.equal(failure.resultKind, 'authorized-no-trigger');
    assert.equal(failure.failureReason, 'no-assistant-output-and-no-native-spawn-observed');
    assert.equal(failure.observedAnswer, null);
    assert.equal(failure.latestParentAgentMessage, null);
    assert.equal(failure.transport.stderrLines[0], 'fixture stderr: no assistant output and no native spawn');
    assert.equal(failure.transport.exitReason, 'closed-by-runner');
    assert.deepEqual(failure.observedRuntimeState, {
      assistantOutputPresent: false,
      nativeSpawnObserved: false,
      waitCompletionObserved: false,
    });
    assert.equal(failure.parentThread.thread.turns[0].items.length, 0);
  }));

  it('classifies a failed live parent turn without assistant output as model-error instead of authorized-no-trigger', () => withOutputDir((outputDir) => {
    const codexBin = writeAutonomousCodexBinWithFailedParentTurn(outputDir);
    const result = runCli({
      config: {
        codexBin,
        cwd: REPO_ROOT,
        naturalPrompt: authorizedPrompt(),
      },
      outputDir,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.resultKind, 'model-error');
    assert.equal(parsed.authorizedDelegationProof, false);
    assert.ok(parsed.failureArtifactPath, 'expected failureArtifactPath');

    const failure = JSON.parse(readFileSync(parsed.failureArtifactPath, 'utf8'));
    assert.equal(failure.resultKind, 'model-error');
    assert.equal(failure.failureReason, 'live-turn-failed-before-output');
    assert.equal(failure.errorMessage, 'parent turn failed before assistant output or native spawn observation');
  }));

  it('classifies provider-blocked live runs as model-error even when thread/read only shows the prompt item', () => withOutputDir((outputDir) => {
    const codexBin = writeAutonomousCodexBinWithProviderBlockedNoObservation(outputDir);
    const result = runCli({
      config: {
        codexBin,
        cwd: REPO_ROOT,
        naturalPrompt: authorizedPrompt(),
      },
      outputDir,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.resultKind, 'model-error');
    assert.ok(parsed.failureArtifactPath, 'expected failureArtifactPath');

    const failure = JSON.parse(readFileSync(parsed.failureArtifactPath, 'utf8'));
    assert.equal(failure.resultKind, 'model-error');
    assert.equal(failure.failureReason, 'live-turn-failed-before-output');
    assert.equal(failure.errorMessage, 'parent turn failed before assistant output or native spawn observation');
  }));
});
