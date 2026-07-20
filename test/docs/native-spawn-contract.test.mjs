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

function extractAssignmentValues(text, name) {
  return [...text.matchAll(new RegExp(`${name} = ([a-z-]+)`, 'g'))].map((match) => match[1]);
}

function extractManifestSetValues(constName) {
  const source = readDoc('src/core/context-tree-manifest.mjs');
  const match = source.match(new RegExp(`const ${constName} = new Set\\(\\[([\\s\\S]*?)\\]\\);`));
  assert.ok(match, `missing set declaration for ${constName}`);
  return new Set([...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]));
}

/** Extract backtick-quoted enum values from `- \`value\`;` / `- \`value\`.` lines. */
function extractEnumValues(text) {
  const matches = text.matchAll(/^- `([a-z][a-z0-9-]*)`[.;]/gm);
  return new Set([...matches].map((m) => m[1]));
}

// ── Native Spawn Contract ─────────────────────────────────────────────

describe('native spawn contract docs', () => {
  const text = readDoc('docs/contracts/codex-native-spawn-record-contract.md');
  const installText = () => readDoc('docs/codex-native-spawn-install.md');

  it('uses existing manifest enum values for native spawn', () => {
    assert.deepStrictEqual(extractAssignmentValues(text, 'materialSelectionMode'), ['native-fork']);
    assert.deepStrictEqual(extractAssignmentValues(text, 'fidelity'), ['native-context-fork']);
    assert.doesNotMatch(text, /checkpoint-pruned-material/);
    assert.doesNotMatch(text, /checkpoint-pruned-session/);
  });

  it('explicitly excludes non-native spawn paths from native-spawn success', () => {
    // All four non-native paths must appear in the exclusion clause.
    assert.match(text, /app-server thread\/fork/i);
    assert.match(text, /retained artifact ingest/i);
    assert.match(text, /fresh-thread/i);
    assert.match(text, /summary-only/i);
    // The contract must say these are NOT the target native-spawn path.
    assert.match(text, /not the target user-operation path|comparison, fallback, or proof-boundary/i);
  });

  it('keeps native-spawn mechanics owned by Codex runtime and writeback owned by Context Tree', () => {
    assert.match(text, /Codex agent runtime owns native spawn/i);
    assert.match(text, /Context Tree owns structured writeback/i);
    assert.match(text, /must not claim it can call `spawn_agent` itself/i);
    assert.match(text, /authorized-natural-native-spawn/i);
  });

  it('requires child-thread answer semantics after wait completion and rejects stale wait-agent-as-answer wording', () => {
    assert.match(text, /observedAnswer[":` ]+.*child-thread final answer/i);
    assert.match(text, /after wait completion|after `wait_agent` confirms completion|terminal child-thread closure evidence|read after wait completion/i);
    assert.match(text, /child-thread read|read from the child thread/i);
    assert.doesNotMatch(text, /Final answer returned by `wait_agent`/i);
    assert.doesNotMatch(text, /collect spawnedAgentId and final answer/i);
  });

  it('documents hermetic skill install scope and out-of-scope persistent installation surfaces', () => {
    const install = installText();
    assert.match(install, /temporary `CODEX_HOME`|tempCodexHome/i);
    assert.match(install, /does install Context Tree runtime skills into a temporary `CODEX_HOME`/i);
    assert.match(install, /context-tree-save-checkpoint/i);
    assert.match(install, /context-tree-use-checkpoint/i);
    assert.match(install, /provider-forced-live mode.*providerForcedLiveProof: true/is);
    assert.match(install, /canonical live UX path|canonical live UX acceptance path/i);
    assert.match(install, /does not install or register a persistent MCP server/i);
    assert.match(install, /does not install or register a persistent plugin/i);
    assert.match(install, /does not modify the real `~\/.codex`/i);
    assert.match(install, /remains provider-forced-live proof/i);
  });

  it('documents runtime prerequisite diagnostics separately from native spawn proof', () => {
    assert.match(text, /Runtime prerequisite diagnostics/i);
    assert.match(text, /codex-linux-sandbox/i);
    assert.match(text, /quality diagnostics/i);
  });
});

// ── Checkpoint-Derived Contract ───────────────────────────────────────

describe('checkpoint-derived agent contract exact enum compatibility', () => {
  const text = readDoc('docs/contracts/checkpoint-derived-agent-record-contract.md');

  it('materialSelectionMode values exactly match manifest enum set', () => {
    // Extract only the materialSelectionMode enum list, stopping at the fidelity field.
    const section = text.match(
      /materialSelectionMode.*?Current values:\n([\s\S]*?)(?=\n`fidelity`)/,
    );
    assert.ok(section, 'could not find materialSelectionMode values section');

    const docValues = extractEnumValues(section[1]);
    assert.deepStrictEqual(
      docValues,
      extractManifestSetValues('MATERIAL_SELECTION_MODES'),
      'contract materialSelectionMode values must exactly match src/core/context-tree-manifest.mjs',
    );
  });

  it('fidelity values exactly match manifest enum set', () => {
    // Extract only the fidelity enum list, stopping at the evidenceRefs field.
    const section = text.match(
      /fidelity.*?Current values:\n([\s\S]*?)(?=\n`evidenceRefs`)/,
    );
    assert.ok(section, 'could not find fidelity values section');

    const docValues = extractEnumValues(section[1]);
    assert.deepStrictEqual(
      docValues,
      extractManifestSetValues('FIDELITIES'),
      'contract fidelity values must exactly match src/core/context-tree-manifest.mjs',
    );
  });
});
