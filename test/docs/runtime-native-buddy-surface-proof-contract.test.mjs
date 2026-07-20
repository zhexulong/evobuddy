import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function readContract() {
  return readFileSync(resolve(ROOT, 'docs/contracts/runtime-native-buddy-surface-proof-contract.md'), 'utf8');
}

describe('runtime native buddy surface proof contract', () => {
  it('documents the three-runtime same-capability boundary and non-proof constraints', () => {
    const text = readContract();
    assert.match(text, /OpenCode.*Claude Code.*Codex/s);
    assert.match(text, /same product capability|same functionality/i);
    assert.match(text, /projection-only.*cannot.*pass/i);
    assert.match(text, /adapter-only.*cannot.*pass/i);
    assert.match(text, /Codex.*not optional|Codex.*required/i);
    assert.match(text, /spawn_agent.*fork_turns|fork_turns.*spawn_agent/s);
    assert.match(text, /naturalUsePass.*nativeMechanismPass|nativeMechanismPass.*naturalUsePass/s);
    assert.match(text, /runtime-native-subagent/);
    assert.match(text, /parent.*child.*result return/i);
  });

  it('defines normalized proof fields and runtime-specific evidence boundaries', () => {
    const text = readContract();
    for (const field of [
      'proofKind',
      'schemaVersion',
      'runtime',
      'memberName',
      'runtimeAgentName',
      'actualSurface',
      'runtimeSurface',
      'baselineDigest',
      'baselineDefinitionRef',
      'baselineDefinitionDigest',
      'parentSessionRef',
      'childSessionRef',
      'parentChildLink',
      'invocationPromptRef',
      'invocationPromptDigest',
      'resultReturn',
      'exporterManifestRef',
      'exporterManifestDigest',
      'sourceTranscriptRef',
      'sourceTranscriptDigest',
      'negativeControls',
      'knownLosses',
    ]) {
      assert.match(text, new RegExp(`"${field}"|\\b${field}\\b`), `missing ${field}`);
    }
    assert.match(text, /runtime-specific names are allowed only inside `runtimeSurface` \/ `runtimeEvidence`|runtimeSurface.*runtimeEvidence/s);
    assert.match(text, /release status uses the same normalized fields for all three runtimes|same normalized fields for all three runtimes/i);
  });
});
