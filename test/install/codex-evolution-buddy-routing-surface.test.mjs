import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const REPO_ROOT = '/home/prosumer/agent/context-tree';
const TOML_PATH = `${REPO_ROOT}/.codex/agents/evolution_agent.toml`;
const PARENT_PATH = `${REPO_ROOT}/.evobuddy/instructions/codex-parent-instructions.md`;

test('synced Codex TOML keeps evolution-agent operational and narrow', async () => {
  const toml = await readFile(TOML_PATH, 'utf8');
  assert.match(toml, /description = ".*source-backed, small-step durable improvements/i);
  assert.match(toml, /Actor kind: team-agent/i);
  assert.match(toml, /Visibility: active/i);
  assert.match(toml, /not a hidden subagent and not a one-shot rewrite tool/i);
  assert.match(toml, /Must not auto-apply changes that alter active roster/i);
});

test('synced Codex parent instructions stay mechanism-clean while allowing the narrow route', async () => {
  const parent = await readFile(PARENT_PATH, 'utf8');
  assert.match(parent, /route to Codex native agent `evolution_agent` for EvoBuddy `evolution-agent` by default/i);
  assert.match(parent, /Codex native agent: `evolution_agent`/i);
  assert.match(parent, /hyphens? to underscores/i);
  assert.match(parent, /docs-only rewrite without behavior change/i);
  assert.match(parent, /single ordinary specialist task/i);
  assert.match(parent, /do not substitute repo-local `invoke-buddy` wrappers|project-local Buddy CLI glue/i);
  assert.doesNotMatch(parent, /apply_role_to_config|apply_spawn_agent_runtime_overrides|apply_requested_spawn_agent_model_overrides|HOOK_EVENT_NAMES/i);
  assert.doesNotMatch(parent, /spawn_agent-style collaboration/i);
  assert.doesNotMatch(parent, /fallback adapter/i);
});
