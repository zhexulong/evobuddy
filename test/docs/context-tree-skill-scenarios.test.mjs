import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function readDoc(relPath) {
  return readFileSync(resolve(ROOT, relPath), 'utf8');
}

describe('context tree skill scenarios', () => {
  it('covers save use and native-spawn positive/negative scenarios', () => {
    const text = readDoc('docs/evals/context-tree-skill-scenarios.md');
    for (const heading of [
      'Save Checkpoint Positive',
      'Save Checkpoint Negative',
      'Use Checkpoint Positive',
      'Use Checkpoint Negative',
      'Codex Native Spawn Positive',
      'Codex Native Spawn Negative',
    ]) {
      assert.match(text, new RegExp(`## ${heading}`));
    }

    assert.match(text, /Save Checkpoint Positive[\s\S]*short label and purpose/i);
    assert.match(text, /Save Checkpoint Negative[\s\S]*No checkpoint is saved/i);
    assert.match(text, /Use Checkpoint Positive[\s\S]*checkpoint-derived reviewer, checker, oracle, reflector, or planner/i);
    assert.match(text, /Use Checkpoint Positive[\s\S]*waits? for the derived agent result before proceeding/i);
    assert.match(text, /Use Checkpoint Negative[\s\S]*ordinary artifact-local review, not a checkpoint-derived agent/i);
    assert.match(text, /Codex Native Spawn Positive[\s\S]*spawn_agent[\s\S]*wait_agent/i);
    assert.match(text, /Codex Native Spawn Positive[\s\S]*wait.*confirm(?:s)? completion|wait.*status/i);
    assert.match(text, /Codex Native Spawn Positive[\s\S]*final answer is read from the child thread|read[s]? the child thread final answer/i);
    assert.match(text, /Codex Native Spawn Positive[\s\S]*checkpoint-manifest\.json[\s\S]*spawn-manifest\.json[\s\S]*spawn-result\.json/i);
    assert.match(text, /Codex Native Spawn Positive[\s\S]*materialSelectionMode: native-fork[\s\S]*fidelity: native-context-fork/i);
    assert.match(text, /Codex Native Spawn Positive[\s\S]*Runtime native spawn is owned by the Codex agent; the writeback only records observed data/i);
    assert.doesNotMatch(text, /Codex Native Spawn Positive[\s\S]*final answer returned by `wait_agent`/i);
    assert.match(text, /Codex Native Spawn Negative[\s\S]*app-server thread\/fork[\s\S]*retained artifact ingest[\s\S]*fresh-thread[\s\S]*summary-only handoff/i);
    assert.match(text, /Codex Native Spawn Negative[\s\S]*does not label the result as a native spawn[\s\S]*rejects the input or marks it inconclusive/i);
  });
});
