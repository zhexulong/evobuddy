# Agent-Assisted Member Discovery V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixture-only member cold-start discovery with an agent-assisted member discovery path that a real parent agent can execute from normal Context Tree product entrypoints.

**Architecture:** Do not add an MCP server in V0. The repo already has a product-facing `ctree` bin and OpenCode instruction installer, so V0 adds a thin, transport-neutral CLI protocol that asks the current parent agent to provide gate and extractor decisions, then feeds those decisions into the existing `deriveMemberSessionColdStart()` pipeline as non-fixture adapter records. Runtime skills/instructions only guide when and how the agent should call the CLI; schema validation and proof gates remain in code.

**Tech Stack:** Node.js ESM, `node:test`, existing `ctree` dispatcher, existing session corpus exporters, existing member cold-start pipeline, existing OpenCode instruction installer, project-local `docs/skills/*` skill docs.

## Global Constraints

- Do not introduce MCP as the first product transport. MCP can be a later wrapper over the same protocol after the CLI path is proven.
- Do not use `fixture-semantic-gate` or `fixture-semantic-extractor` for product member discovery proof.
- Do not let fail-closed default adapters claim member discovery.
- Use one naming family for new work: `member discovery` for the product capability, `ctree members discover` for the command, `member-discovery-*` for request/artifact files, `context-tree-discover-members` for the skill, and `agent-assisted-parent-turn` for the adapter kind. Skill names must stay verb-object like existing `context-tree-save-checkpoint` and `context-tree-use-checkpoint`.
- Treat existing `semanticCandidateDiscovery`, `semanticZeroCandidate`, and `semanticDiscovery` report names as legacy compatibility fields only. New reports must also expose canonical member-discovery names.
- Do not hardcode member names, topic-to-member mappings, or `review/check/inspect/audit/检查/审查` as discovery authority.
- Do not let workflow wrappers, DCP/Compression summaries, tool/search/file output, handoff rows, or internal markers enter member-discovery gate input.
- Do not make durable member mutations automatically. Discovery creates unconfirmed candidates; Confirm/Rename/Add/Discard remains explicit setup/import action.
- Do not claim the CLI itself invokes a model. The parent agent supplies the discovery answers; Context Tree validates, records, and evaluates them.
- Do not let a manually written answer file close product member-discovery proof. Manual answer files may close protocol/retained proof only. Product proof requires an observed parent-agent turn source, or an equivalent runtime transcript/export ref that shows the parent agent read the request and produced the answer.
- Do not let report JSON self-certify discovery proof. Eval ingestion must verify that referenced input/raw/parsed artifacts exist under the claimed root, adapter kinds are allowed for the claimed proof scope, and answer source metadata supports the proof scope.
- No commits unless the user explicitly asks.

---

## Current State And Answer To The Design Question

- **MCP:** There is no current repo MCP server for this path. The existing product entrypoint is `bin.ctree` in `package.json`, backed by `scripts/context-tree/ctree.mjs`.
- **CLI:** `ctree setup`, `ctree members import`, `ctree members invoke`, and `ctree workbench` already exist. V0 should extend this surface instead of introducing a second transport.
- **Skills:** Existing `docs/skills/context-tree-save-checkpoint` and `docs/skills/context-tree-use-checkpoint` are about checkpoint boundaries. They are not sufficient for member cold-start discovery or member-discovery gate/extractor answering.
- **Instruction installer:** `src/install/opencode-member-instructions.mjs` already writes runtime-facing OpenCode parent instructions. V0 should update that installer and add a new discover-members skill, but neither should become the proof authority.

## Concrete Examples

### Example 1: Parent Agent Supplies A Candidate

- **Example:** The agent runs member discovery for `/home/prosumer/agent/agent-wiki-lab`, receives a gate request containing genuine user lines, decides that lines 2 and 5 express a repeated reusable proof-tier specialist need, then supplies an extractor JSON proposal with `memberName`, `role`, `routingDescription`, `responsibilities`, `evidenceRefs`, `whyReusable`, and `negativeSignals`.
- **Expected result:** Context Tree writes a live report with canonical `memberDiscoveryProofKind: "agentAssistedCandidateDiscovery"`, compatibility `discoveryProofKind: "semanticCandidateDiscovery"`, `adapterKind: "agent-assisted-parent-turn"`, retained gate/extractor input/raw/parsed artifacts, an answer-source artifact, and an unconfirmed `MemberProfileCandidate`.
- **Verification:** `npm run context-tree:eval-member-session-cold-start:live -- --session-corpus-export <corpus> --project-identity /home/prosumer/agent/agent-wiki-lab --agent-assisted-root <run-dir> --out <eval-dir>` passes only when the report contains no fixture adapter kinds, the retained artifact refs exist, and `member-discovery-answer-source-gate.json` plus `member-discovery-answer-source-extractor.json` record `sourceKind: "observed-parent-agent-turn"` for product proof. If answer source is `manual-retained`, the eval may pass as retained/protocol proof but must not close product discovery.
- **Failure signal:** Candidate appears from fixture adapters, fixed member names, DCP/tool/workflow evidence, or parsed extractor output missing full proposal fields.
- **If it fails:** Fix the adapter protocol, validation, or evidence hygiene; do not weaken member discovery gates.

### Example 2: Parent Agent Finds No Reusable Member Need

- **Example:** The agent runs discovery on real agent-wiki-lab corpus and answers the gate as `n` because the visible genuine user lines are task-local, operational, or too weak for a reusable member.
- **Expected result:** Context Tree writes `candidateCount: 0`, canonical `memberDiscoveryProofKind: "agentAssistedZeroCandidate"`, compatibility `discoveryProofKind: "semanticZeroCandidate"`, retained agent-assisted gate artifacts, answer-source metadata, and aggregate `memberDiscovery.status: "pass"` only when adapter records are non-fixture, retained artifacts exist, answer source supports the claimed scope, and evidence hygiene passes.
- **Verification:** The final report shows `flaggedLineCount: 0`, no extractor candidate, no fixture adapter kinds, and aggregate accepts agent-assisted zero-candidate only for the correct proof scope.
- **Failure signal:** Report downgrades to `diagnosticZeroCandidate` despite real agent-assisted artifacts, or passes member discovery with all lines flagged and no defensible gate result.
- **If it fails:** Fix proof classification and gate-quality checks before changing product instructions.

### Example 3: Normal Product Entry Is Still Agent-Visible

- **Example:** OpenCode setup installs parent-agent instructions. During normal work, the agent sees a project without enough confirmed members and runs `ctree members discover --project <path> --json` rather than silently inventing a member.
- **Expected result:** The command either creates an unconfirmed candidate bundle or records agent-assisted zero-candidate diagnostics. Durable mutation still requires explicit import action.
- **Verification:** `ctree setup --project <tmp> --runtime opencode --json` writes instructions that mention member discovery triggers and the agent-assisted command, and `ctree doctor --json` reports the new command target.
- **Failure signal:** Instructions tell the agent to auto-confirm members, imply hidden approval, or require loading schema docs for normal runtime use.
- **If it fails:** Fix the installed instruction and skill wording; do not add hidden product policy to the CLI.

### Invariants

- Invariant 1: The parent agent, not a fixture adapter, supplies member-discovery gate/extractor answers for product member discovery proof.
- Invariant 2: Context Tree validates, stores, and classifies discovery answers; it does not infer member names or role contracts from topic vocabularies.
- Invariant 3: Runtime skill/instruction text guides agent behavior but is not the proof authority.
- Invariant 4: The first release transport is CLI/bin; any future MCP server must be a thin wrapper over the same request/answer protocol.
- Invariant 5: Product member-discovery proof requires source attribution for the answer itself. `manual-retained` answers are useful protocol evidence, but only `observed-parent-agent-turn` or an equivalent runtime transcript/export source can close product proof.

---

## File Structure

- Create `src/core/member-discovery-agent-io.mjs`: pure protocol helpers for agent-assisted gate/extractor request packets, answer parsing, answer-source metadata, proof-scope classification, and adapter records.
- Create `scripts/context-tree/run-member-discovery-agent-assisted.mjs`: CLI that exports/prepares discovery requests, accepts parent-agent answers, replays the existing cold-start pipeline with agent-assisted adapters, and writes reports/artifacts.
- Modify `scripts/context-tree/ctree.mjs`: add `ctree members discover` as the product-facing alias; keep `ctree members import` backward compatible.
- Modify `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`: accept `--agent-assisted-root <path>` and classify non-fixture agent-assisted artifacts as discovery proof.
- Modify `scripts/context-tree/run-member-system-e2e-eval.mjs`: reject fixture adapters for product member discovery proof when the report claims product/agent-assisted mode.
- Create `scripts/context-tree/run-member-discovery-natural-use-e2e.mjs`: live E2E that reuses the discovered member candidate and the source user input that justified it, then verifies a normal parent-agent flow invokes or selects that member.
- Modify `src/install/opencode-member-instructions.mjs`: teach OpenCode parent agents when to use member discovery and how to handle unconfirmed candidates.
- Create `docs/skills/context-tree-discover-members/SKILL.md`: runtime skill for member discovery triggers and agent-assisted discovery answering.
- Modify `docs/skills/context-tree-skill-rules.md`: add the new skill boundary and non-replaceable behavior meaning.
- Modify `package.json`: add `context-tree:run-member-discovery-agent-assisted` script.
- Add tests under `test/core`, `test/cli`, `test/eval`, and `test/quality` for protocol, CLI, instruction wording, proof gates, natural use E2E artifacts, and hardcoded-name prevention.

---

## Task 1: Agent-Assisted Member Discovery Adapter Protocol

**Files:**

- Create: `src/core/member-discovery-agent-io.mjs`
- Test: `test/core/member-discovery-agent-io.test.mjs`

**Example:** implements Example 1 and Example 2; preserves Invariant 1 and Invariant 2

**Interfaces:**

- Produces `createGateRequestPacket({ projectIdentity, prompt, gateLines, sourceRef })`.
- Produces `parseAgentGateAnswer(text)` returning `{ hit, ordinals, rawOutput, parsedOutput, parseErrors }`.
- Produces `createExtractorRequestPacket({ projectIdentity, prompt, window, sourceRef })`.
- Produces `parseAgentExtractorAnswer(text, window)` returning `{ proposals, rawOutput, parsedOutput, parseErrors }`.
- Produces `createAnswerSourceRecord({ phase, sourceKind, transcriptRef, answerFileRef, requestRef, observedTurnDigest })` returning structured answer-source metadata.
- Produces `memberDiscoveryProofScope({ gateRecord, extractorRecord, answerSource })` returning `agent-assisted-product`, `manual-retained`, `retained-fixture`, `diagnostic`, or `unknown`.
- Produces `createAgentAssistedAdapterRecord({ phase, prompt, rawOutput, parsedOutput, artifactRefs, parseErrors })` returning adapter records with `adapterKind: "agent-assisted-parent-turn"`; discovery claims are true only when all retained refs exist and parse errors are empty.

- [ ] **Step 1: Write failing protocol tests**

Create `test/core/member-discovery-agent-io.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgentAssistedAdapterRecord,
  createAnswerSourceRecord,
  createExtractorRequestPacket,
  createGateRequestPacket,
  memberDiscoveryProofScope,
  parseAgentExtractorAnswer,
  parseAgentGateAnswer,
} from '../../src/core/member-discovery-agent-io.mjs';

const lineA = { lineOrdinal: 1, sourceOrdinal: 4, sessionId: 'root-a', ref: 'session:root-a:message:4', digest: 'sha256:a', text: '每次下结论前先区分 retained/live/product proof' };
const lineB = { lineOrdinal: 2, sourceOrdinal: 9, sessionId: 'root-b', ref: 'session:root-b:message:9', digest: 'sha256:b', text: '判断报告前先看 evidence path 和 proof tier' };

describe('member discovery agent IO', () => {
  it('creates gate packets without turning source ordinals into gate ordinals', () => {
    const packet = createGateRequestPacket({ projectIdentity: '/repo', prompt: 'gate prompt', gateLines: [lineA, lineB], sourceRef: 'scan.json' });
    assert.equal(packet.packetKind, 'member-discovery-gate-request');
    assert.equal(packet.adapterKind, 'agent-assisted-parent-turn');
    assert.deepEqual(packet.lines.map((line) => line.lineOrdinal), [1, 2]);
    assert.deepEqual(packet.lines.map((line) => line.sourceOrdinal), [4, 9]);
    assert.match(packet.instructions, /Return exactly `n` or `y: <ordinals>`/);
  });

  it('parses gate answers fail closed', () => {
    assert.deepEqual(parseAgentGateAnswer('n').parsedOutput, { hit: false, ordinals: [] });
    assert.deepEqual(parseAgentGateAnswer('y: 1, 2').parsedOutput, { hit: true, ordinals: [1, 2] });
    assert.equal(parseAgentGateAnswer('yes maybe line two').parsedOutput.hit, false);
    assert.ok(parseAgentGateAnswer('yes maybe line two').parseErrors.length > 0);
  });

  it('requires full extractor proposal fields and window evidence refs without losing parse artifacts', () => {
    const window = { messages: [{ ref: lineA.ref, digest: lineA.digest }, { ref: lineB.ref, digest: lineB.digest }] };
    const answer = JSON.stringify({ proposals: [{
      memberName: 'proof-tier-specialist',
      role: 'Proof Tier Specialist',
      routingDescription: 'Use before accepting eval or product proof claims that depend on proof-tier distinctions.',
      responsibilities: ['Separate retained, hermetic, live, and product proof.', 'Check evidence path before acceptance.'],
      evidenceRefs: [{ ref: lineA.ref, digest: lineA.digest }, { ref: lineB.ref, digest: lineB.digest }],
      whyReusable: 'The same proof-tier judgment repeats across sessions.',
      negativeSignals: [],
    }] });
    const parsed = parseAgentExtractorAnswer(answer, window);
    assert.equal(parsed.proposals[0].memberName, 'proof-tier-specialist');
    assert.equal(parsed.parseErrors.length, 0);
    const invalid = parseAgentExtractorAnswer('{"proposals":[{"memberName":"x"}]}', window);
    assert.equal(invalid.proposals.length, 0);
    assert.match(invalid.parseErrors.join('\n'), /role is required|routingDescription is required|responsibilities/);
    assert.deepEqual(invalid.parsedOutput, { proposals: [] });
  });

  it('creates claiming non-fixture adapter records only when retained refs exist and parse errors are empty', () => {
    const record = createAgentAssistedAdapterRecord({
      phase: 'gate',
      prompt: 'prompt',
      rawOutput: 'y: 1',
      parsedOutput: { hit: true, ordinals: [1] },
      artifactRefs: { inputArtifactRef: 'a/input.json', rawOutputArtifactRef: 'a/raw.txt', parsedOutputArtifactRef: 'a/parsed.json' },
      parseErrors: [],
    });
    assert.equal(record.adapterKind, 'agent-assisted-parent-turn');
    assert.equal(record.memberDiscoveryClaim, true);
    assert.equal(record.semanticClaim, true);

    const missingRefs = createAgentAssistedAdapterRecord({ phase: 'gate', prompt: 'prompt', rawOutput: 'y: 1', parsedOutput: { hit: true, ordinals: [1] }, artifactRefs: { inputArtifactRef: 'a/input.json' } });
    assert.equal(missingRefs.memberDiscoveryClaim, false);
    assert.equal(missingRefs.semanticClaim, false);

    const parseFailed = createAgentAssistedAdapterRecord({
      phase: 'gate',
      prompt: 'prompt',
      rawOutput: 'maybe',
      parsedOutput: { hit: false, ordinals: [] },
      artifactRefs: { inputArtifactRef: 'a/input.json', rawOutputArtifactRef: 'a/raw.txt', parsedOutputArtifactRef: 'a/parsed.json' },
      parseErrors: ['gate answer must be `n` or `y: <ordinals>`'],
    });
    assert.equal(parseFailed.memberDiscoveryClaim, false);
    assert.equal(parseFailed.semanticClaim, false);
  });

  it('separates observed parent-agent answers from manual retained answers', () => {
    const observed = createAnswerSourceRecord({ phase: 'gate', sourceKind: 'observed-parent-agent-turn', transcriptRef: 'runtime/parent-turn.json', requestRef: 'member-discovery-gate-request.json', observedTurnDigest: 'sha256:turn' });
    const manual = createAnswerSourceRecord({ phase: 'gate', sourceKind: 'manual-retained', answerFileRef: 'gate-answer.txt', requestRef: 'member-discovery-gate-request.json' });
    assert.equal(observed.sourceKind, 'observed-parent-agent-turn');
    assert.equal(manual.sourceKind, 'manual-retained');

    const claimingRecord = createAgentAssistedAdapterRecord({
      phase: 'gate',
      prompt: 'prompt',
      rawOutput: 'n',
      parsedOutput: { hit: false, ordinals: [] },
      artifactRefs: { inputArtifactRef: 'a/input.json', rawOutputArtifactRef: 'a/raw.txt', parsedOutputArtifactRef: 'a/parsed.json' },
      parseErrors: [],
    });
    assert.equal(memberDiscoveryProofScope({ gateRecord: claimingRecord, extractorRecord: claimingRecord, answerSource: observed }), 'agent-assisted-product');
    assert.equal(memberDiscoveryProofScope({ gateRecord: claimingRecord, extractorRecord: claimingRecord, answerSource: manual }), 'manual-retained');
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
node --test test/core/member-discovery-agent-io.test.mjs
```

Expected: FAIL because `src/core/member-discovery-agent-io.mjs` does not exist.

- [ ] **Step 3: Implement `src/core/member-discovery-agent-io.mjs`**

Implement these exports:

```js
import { createGateAdapterRecord, createExtractorAdapterRecord } from './member-need-agent-adapters.mjs';
import { parseMemberNeedGateVerdict } from './member-need-gate.mjs';
import { normalizeExtractorProposal } from './member-candidate-extractor.mjs';

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function createGateRequestPacket({ projectIdentity, prompt, gateLines, sourceRef } = {}) {
  return {
    packetKind: 'member-discovery-gate-request',
    adapterKind: 'agent-assisted-parent-turn',
    projectIdentity: cleanString(projectIdentity) ?? 'unknown-project',
    sourceRef: cleanString(sourceRef),
    prompt: cleanString(prompt) ?? '',
    instructions: 'Return exactly `n` or `y: <ordinals>`. Use displayed lineOrdinal values only. Do not infer from fixed topic names.',
    lines: asArray(gateLines).map((line) => ({
      lineOrdinal: line.lineOrdinal,
      sourceOrdinal: line.sourceOrdinal,
      sessionId: line.sessionId,
      ref: line.ref,
      digest: line.digest,
      text: line.text,
    })),
  };
}

export function parseAgentGateAnswer(text) {
  const rawOutput = String(text ?? '').trim();
  const parsedOutput = parseMemberNeedGateVerdict(rawOutput);
  const parseErrors = rawOutput.length === 0 || (!/^\s*(?:n|no|y\s*:|yes\s*:)/i.test(rawOutput) && parsedOutput.hit === false)
    ? ['gate answer must be `n` or `y: <ordinals>`']
    : [];
  return { rawOutput, parsedOutput, parseErrors, hit: parsedOutput.hit, ordinals: parsedOutput.ordinals };
}

export function createExtractorRequestPacket({ projectIdentity, prompt, window, sourceRef } = {}) {
  return {
    packetKind: 'member-discovery-extractor-request',
    adapterKind: 'agent-assisted-parent-turn',
    projectIdentity: cleanString(projectIdentity) ?? cleanString(window?.projectIdentity) ?? 'unknown-project',
    sourceRef: cleanString(sourceRef),
    prompt: cleanString(prompt) ?? '',
    instructions: 'Return JSON only: {"proposals":[{"memberName":"kebab-case","role":"...","routingDescription":"...","responsibilities":["..."],"evidenceRefs":[{"ref":"session:...","digest":"sha256:..."}],"whyReusable":"...","negativeSignals":[]}]} . Return {"proposals":[]} when evidence is insufficient.',
    window,
  };
}

export function parseAgentExtractorAnswer(text, window) {
  const rawOutput = String(text ?? '').trim();
  let parsedOutput;
  try {
    parsedOutput = JSON.parse(rawOutput);
  } catch (error) {
    return { rawOutput, parsedOutput: { proposals: [] }, proposals: [], parseErrors: [`extractor answer must be JSON: ${error.message}`] };
  }
  const proposals = [];
  const parseErrors = [];
  for (const proposal of asArray(parsedOutput.proposals)) {
    try {
      proposals.push(normalizeExtractorProposal(proposal, window));
    } catch (error) {
      parseErrors.push(error.message);
    }
  }
  if (!Array.isArray(parsedOutput.proposals)) parseErrors.push('extractor answer requires proposals array');
  return { rawOutput, parsedOutput: { proposals: parseErrors.length > 0 ? [] : proposals }, proposals: parseErrors.length > 0 ? [] : proposals, parseErrors };
}

function refsComplete(artifactRefs) {
  return Boolean(cleanString(artifactRefs?.inputArtifactRef) && cleanString(artifactRefs?.rawOutputArtifactRef) && cleanString(artifactRefs?.parsedOutputArtifactRef));
}

export function createAnswerSourceRecord({ phase, sourceKind, transcriptRef, answerFileRef, requestRef, observedTurnDigest } = {}) {
  const normalizedSourceKind = cleanString(sourceKind) ?? 'manual-retained';
  return {
    artifactKind: 'member-discovery-answer-source',
    phase: cleanString(phase) ?? 'unknown',
    sourceKind: normalizedSourceKind,
    transcriptRef: cleanString(transcriptRef),
    answerFileRef: cleanString(answerFileRef),
    requestRef: cleanString(requestRef),
    observedTurnDigest: cleanString(observedTurnDigest),
    productEligible: normalizedSourceKind === 'observed-parent-agent-turn' && Boolean(cleanString(transcriptRef) && cleanString(observedTurnDigest)),
  };
}

export function createAgentAssistedAdapterRecord({ phase, prompt, rawOutput, parsedOutput, artifactRefs, parseErrors = [] } = {}) {
  const create = phase === 'extractor' ? createExtractorAdapterRecord : createGateAdapterRecord;
  const claim = refsComplete(artifactRefs) && asArray(parseErrors).length === 0;
  return {
    ...create({ adapterKind: 'agent-assisted-parent-turn', prompt, rawOutput, parsedOutput, artifactRefs, parseErrors }),
    memberDiscoveryClaim: claim,
    semanticClaim: claim,
  };
}

export function memberDiscoveryProofScope({ gateRecord, extractorRecord, answerSource } = {}) {
  const gateKind = cleanString(gateRecord?.adapterKind);
  const extractorKind = cleanString(extractorRecord?.adapterKind);
  if (gateKind === 'fail-closed-default' || extractorKind === 'fail-closed-default') return 'diagnostic';
  if (gateKind?.startsWith('fixture-') || extractorKind?.startsWith('fixture-')) return 'retained-fixture';
  const recordsClaim = gateRecord?.memberDiscoveryClaim === true && extractorRecord?.memberDiscoveryClaim === true;
  if (gateKind === 'agent-assisted-parent-turn' && extractorKind === 'agent-assisted-parent-turn' && recordsClaim) {
    return answerSource?.productEligible === true ? 'agent-assisted-product' : 'manual-retained';
  }
  return 'unknown';
}
```

- [ ] **Step 4: Run the protocol tests**

Run:

```bash
node --test test/core/member-discovery-agent-io.test.mjs
```

Expected: PASS.

---

## Task 2: Agent-Assisted Discovery CLI And `ctree members discover`

**Files:**

- Create: `scripts/context-tree/run-member-discovery-agent-assisted.mjs`
- Modify: `scripts/context-tree/ctree.mjs`
- Modify: `package.json`
- Test: `test/cli/run-member-discovery-agent-assisted-cli.test.mjs`
- Test: `test/cli/ctree-cli.test.mjs`

**Example:** implements Example 1, Example 2, and Example 3; preserves Invariant 1 and Invariant 4

**Interfaces:**

- CLI phase 1: `node scripts/context-tree/run-member-discovery-agent-assisted.mjs prepare --session-corpus <path> --project-identity <path> --out <dir>`.
- CLI phase 2: `node scripts/context-tree/run-member-discovery-agent-assisted.mjs answer-gate --state <dir> --answer-file <path> [--answer-source manual-retained|observed-parent-agent-turn --transcript-ref <path> --observed-turn-digest <sha256:...>]`.
- CLI phase 3: `node scripts/context-tree/run-member-discovery-agent-assisted.mjs answer-extractor --state <dir> --answer-file <path> [--answer-source manual-retained|observed-parent-agent-turn --transcript-ref <path> --observed-turn-digest <sha256:...>]`.
- Product alias: `ctree members discover --project <path> [--db <path>] [--out <dir>] [--json]` prepares discovery by exporting OpenCode corpus and writing the first request packet.

- [ ] **Step 1: Write failing CLI tests**

Create `test/cli/run-member-discovery-agent-assisted-cli.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-member-discovery-agent-assisted.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function writeCorpus(root) {
  const corpusPath = join(root, 'corpus.json');
  writeFileSync(corpusPath, `${JSON.stringify({
    corpusKind: 'context-tree-session-corpus-export',
    source: 'session-corpus-export',
    projectIdentity: '/repo',
    sessions: [
      { sessionId: 'a', projectIdentity: '/repo', messages: [{ role: 'user', ordinal: 1, text: 'Every release decision needs a reusable proof-tier specialist before accepting product proof.' }] },
      { sessionId: 'b', projectIdentity: '/repo', messages: [{ role: 'user', ordinal: 1, text: 'Again use the same proof-tier specialist to check evidence path before acceptance.' }] },
    ],
  }, null, 2)}\n`, 'utf8');
  return corpusPath;
}

describe('agent-assisted member discovery CLI', () => {
  it('prepares gate request, accepts parent-agent answers, and writes an agent-assisted candidate report', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-member-discovery-agent-assisted-'));
    try {
      const corpusPath = writeCorpus(root);
      const out = join(root, 'out');
      const prepared = run(['prepare', '--session-corpus', corpusPath, '--project-identity', '/repo', '--out', out]);
      assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
      const prepareSummary = JSON.parse(prepared.stdout);
      assert.equal(prepareSummary.status, 'needs-agent-gate');
      assert.equal(existsSync(join(out, 'member-discovery-gate-request.json')), true);

      const gateAnswer = join(root, 'gate-answer.txt');
      writeFileSync(gateAnswer, 'y: 1, 2\n', 'utf8');
      const gated = run(['answer-gate', '--state', out, '--answer-file', gateAnswer]);
      assert.equal(gated.status, 0, gated.stderr || gated.stdout);
      assert.equal(JSON.parse(gated.stdout).status, 'needs-agent-extractor');
      assert.equal(existsSync(join(out, 'member-discovery-extractor-request.json')), true);
      assert.equal(JSON.parse(readFileSync(join(out, 'member-discovery-answer-source-gate.json'), 'utf8')).sourceKind, 'manual-retained');

      const extractorAnswer = join(root, 'extractor-answer.json');
      writeFileSync(extractorAnswer, `${JSON.stringify({ proposals: [{
        memberName: 'proof-tier-specialist',
        role: 'Proof Tier Specialist',
        routingDescription: 'Use before accepting proof-tier or product-proof claims.',
        responsibilities: ['Separate proof tiers.', 'Check evidence paths.'],
        evidenceRefs: [
          { ref: 'session:a:message:1', digest: JSON.parse(readFileSync(join(out, 'session-corpus-scan.json'), 'utf8')).scannedMessages[0].digest },
          { ref: 'session:b:message:1', digest: JSON.parse(readFileSync(join(out, 'session-corpus-scan.json'), 'utf8')).scannedMessages[1].digest },
        ],
        whyReusable: 'The same proof-tier specialist need repeats across sessions.',
        negativeSignals: [],
        sourceEvidenceSummary: { status: 'source-backed', groundingTermCount: 4, directUserDelegationCount: 2, nonGenericEvidenceRefCount: 2, uniqueEvidenceDigestCount: 2 },
      }] }, null, 2)}\n`, 'utf8');
      const extracted = run(['answer-extractor', '--state', out, '--answer-file', extractorAnswer]);
      assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout);
      const summary = JSON.parse(extracted.stdout);
      assert.equal(summary.status, 'pass');
      assert.equal(summary.memberDiscoveryProofKind, 'agentAssistedCandidateDiscovery');
      assert.equal(summary.memberDiscoveryProofScope, 'manual-retained');
      assert.equal(summary.discoveryProofKind, 'semanticCandidateDiscovery');
      const report = JSON.parse(readFileSync(join(out, 'member-session-cold-start-live-eval-report.json'), 'utf8'));
      assert.equal(report.evidenceQuality.gateDiagnostics.adapterKind, 'agent-assisted-parent-turn');
      assert.equal(report.evidenceQuality.extractorDiagnostics.adapterKind, 'agent-assisted-parent-turn');
      assert.equal(report.memberDiscoveryProofScope, 'manual-retained');
      assert.equal(report.liveSessionDerivedCandidate.memberName, 'proof-tier-specialist');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes an agent-assisted zero-candidate report when the parent agent answers n', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-member-discovery-agent-assisted-zero-'));
    try {
      const corpusPath = writeCorpus(root);
      const out = join(root, 'out');
      assert.equal(run(['prepare', '--session-corpus', corpusPath, '--project-identity', '/repo', '--out', out]).status, 0);
      const gateAnswer = join(root, 'gate-answer.txt');
      writeFileSync(gateAnswer, 'n\n', 'utf8');
      const gated = run(['answer-gate', '--state', out, '--answer-file', gateAnswer]);
      assert.equal(gated.status, 0, gated.stderr || gated.stdout);
      const summary = JSON.parse(gated.stdout);
      assert.equal(summary.status, 'pass');
      assert.equal(summary.memberDiscoveryProofKind, 'agentAssistedZeroCandidate');
      assert.equal(summary.memberDiscoveryProofScope, 'manual-retained');
      assert.equal(summary.discoveryProofKind, 'semanticZeroCandidate');
      const report = JSON.parse(readFileSync(join(out, 'member-session-cold-start-live-eval-report.json'), 'utf8'));
      assert.equal(report.liveSessionDerivedCandidate.candidateCount, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run the failing CLI tests**

Run:

```bash
node --test test/cli/run-member-discovery-agent-assisted-cli.test.mjs
```

Expected: FAIL because the CLI does not exist.

- [ ] **Step 3: Implement CLI phase behavior**

Create `scripts/context-tree/run-member-discovery-agent-assisted.mjs` with these concrete behaviors:

- `prepare` reads the corpus, calls `deriveMemberSessionColdStart()` only far enough to produce scan/gate prompt/lines with default fail-closed adapters, writes `session-corpus-scan.json`, `member-discovery-gate-request.json`, and `agent-assisted-state.json`.
- `answer-gate` reads state and gate answer, parses via `parseAgentGateAnswer()`, writes `member-need-gate-input.json`, `member-need-gate-raw-output.txt`, `member-need-gate-parsed-output.json`, and either writes an agent-assisted zero-candidate report or writes `member-discovery-extractor-request.json`.
- `answer-gate` also writes `member-discovery-answer-source-gate.json`. Default `--answer-source` is `manual-retained`; `observed-parent-agent-turn` requires `--transcript-ref` and `--observed-turn-digest`.
- `answer-extractor` reads state and extractor answer, parses via `parseAgentExtractorAnswer()`, writes raw/parsed/error artifacts even when parsing fails, replays `deriveMemberSessionColdStart()` with injected `memberNeedGate` and `candidateExtractor` functions using `adapterKind: "agent-assisted-parent-turn"`, attaches retained artifact refs, writes `member-discovery-answer-source-extractor.json`, then writes the same artifact/report shape used by `run-live-member-session-cold-start-eval.mjs`.
- The command must refuse `answer-extractor` before a gate answer exists.
- The command must fail structurally if parsed extractor proposals omit required fields, while still retaining raw/parsed/error artifacts for diagnosis.
- Reports must include both `memberDiscoveryProofKind` and `memberDiscoveryProofScope`. `manual-retained` answer sources can produce `agentAssistedCandidateDiscovery` or `agentAssistedZeroCandidate`, but their scope is `manual-retained` and cannot close product proof.

Use existing helpers rather than duplicating validators:

```js
import { deriveMemberSessionColdStart } from '../../src/core/member-session-cold-start.mjs';
import { buildMemberNeedGatePrompt, buildMemberCandidateExtractorPrompt } from '../../src/core/member-need-prompts.mjs';
import { buildMemberNeedWindowsFromGate, renderMemberNeedGateLines } from '../../src/core/member-need-gate.mjs';
import {
  createExtractorRequestPacket,
  createGateRequestPacket,
  parseAgentExtractorAnswer,
  parseAgentGateAnswer,
} from '../../src/core/member-discovery-agent-io.mjs';
```

The implementation can copy small report-quality helpers from `run-live-member-session-cold-start-eval.mjs`, but keep fixture adapter names out of this file. Use `adapterKind: "agent-assisted-parent-turn"` only.

- [ ] **Step 4: Add package script**

Modify `package.json` scripts:

```json
"context-tree:run-member-discovery-agent-assisted": "node scripts/context-tree/run-member-discovery-agent-assisted.mjs"
```

- [ ] **Step 5: Extend `ctree` dispatcher**

Modify `scripts/context-tree/ctree.mjs`:

- Add target:

```js
memberDiscoveryAgentAssisted: 'scripts/context-tree/run-member-discovery-agent-assisted.mjs'
```

- Update usage:

```text
ctree members discover --project <path> [--db <path>] [--out <path>] [--json]
ctree members discover answer-gate --state <path> --answer-file <path> [--answer-source ...]
ctree members discover answer-extractor --state <path> --answer-file <path> [--answer-source ...]
```

- Implement `membersDiscover(argv)`:

```js
async function membersDiscover(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: discoverHelp() };
  if (argv[0] === 'answer-gate' || argv[0] === 'answer-extractor') return spawnNode(TARGETS.memberDiscoveryAgentAssisted, argv);
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  const project = resolve(args.project);
  const state = ensureContextTreeProjectState({ projectRoot: project });
  const discoverRoot = resolve(args.out ?? state.importPath(`member-discovery-${Date.now()}`));
  const corpusRoot = join(discoverRoot, 'session-corpus');
  const exported = spawnNode(TARGETS.exportOpenCodeCorpus, ['--db', args.db ?? DEFAULT_OPENCODE_DB, '--project-identity', project, '--out', corpusRoot]);
  if (exported.code !== 0) return exported;
  const corpus = JSON.parse(exported.stdout);
  const prepared = spawnNode(TARGETS.memberDiscoveryAgentAssisted, ['prepare', '--session-corpus', corpus.corpusPath, '--project-identity', project, '--out', discoverRoot]);
  return prepared;
}
```

- Wire under `command === 'members'`:

```js
if (subcommand === 'discover') return membersDiscover([action, ...rest].filter((value) => value !== undefined));
```

- [ ] **Step 6: Add dispatcher tests**

Modify `test/cli/ctree-cli.test.mjs` with assertions that:

- `ctree doctor --json` includes `memberDiscoveryAgentAssisted.exists: true`.
- `ctree members discover --help` documents prepare/answer-gate/answer-extractor.
- `ctree members discover answer-gate --state <missing> --answer-file <missing>` delegates to the new script and fails with a state-file error, not `unknown command`.

- [ ] **Step 7: Run focused CLI tests**

Run:

```bash
node --test test/core/member-discovery-agent-io.test.mjs test/cli/run-member-discovery-agent-assisted-cli.test.mjs test/cli/ctree-cli.test.mjs
```

Expected: PASS.

---

## Task 3: Skill And Runtime Instruction Quality

**Files:**

- Create: `docs/skills/context-tree-discover-members/SKILL.md`
- Modify: `docs/skills/context-tree-skill-rules.md`
- Modify: `src/install/opencode-member-instructions.mjs`
- Test: `test/docs/context-tree-skills.test.mjs`
- Test: `test/cli/install-member-projections-cli.test.mjs` or existing instruction installer test file if present

**Example:** implements Example 3; preserves Invariant 3

**Interfaces:**

- Skill trigger: member discovery only, not checkpointing and not invocation.
- Installed instruction trigger: when the parent agent lacks a suitable confirmed member or user asks to discover/import members.
- Normal runtime docs must not require loading contracts or schema files.

- [ ] **Step 1: Write failing skill quality tests**

Create or extend `test/docs/context-tree-skills.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function read(path) {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}

describe('Context Tree runtime skills', () => {
  it('has a discover-members skill with symptom-driven trigger wording', () => {
    const text = read('docs/skills/context-tree-discover-members/SKILL.md');
    assert.match(text, /^---\nname: context-tree-discover-members\ndescription: Use when /);
    assert.match(text, /no suitable confirmed member|discover reusable Context Tree members|import member candidates/i);
    assert.doesNotMatch(text, /What This Skill Is Not/i);
    assert.doesNotMatch(text, /schema|enum|negative-control/i);
  });

  it('keeps discover-members skill separate from checkpoint skills and durable mutation policy', () => {
    const text = read('docs/skills/context-tree-discover-members/SKILL.md');
    assert.match(text, /ctree members discover/);
    assert.match(text, /unconfirmed candidates/i);
    assert.match(text, /Do not confirm, rename, merge, add, or discard candidates unless the user asks/i);
    assert.doesNotMatch(text, /save checkpoint|checkpoint-derived/i);
  });
});
```

- [ ] **Step 2: Run failing skill tests**

Run:

```bash
node --test test/docs/context-tree-skills.test.mjs
```

Expected: FAIL because the discover-members skill does not exist.

- [ ] **Step 3: Create `docs/skills/context-tree-discover-members/SKILL.md`**

Write this skill body:

```markdown
---
name: context-tree-discover-members
description: Use when a project has no suitable confirmed member, a user asks to discover or import reusable experts, or repeated prior-session needs suggest a member candidate may exist.
---

# Context Tree Discover Members

Use this when the current project may need reusable Context Tree members and the confirmed registry does not already cover the need.

## When To Use

Run discovery when any of these are true:

- the user asks to discover, import, set up, or refresh members;
- you need a specialist member but no confirmed member routing description fits;
- repeated prior-session needs suggest a reusable expert may exist;
- setup/import work should propose candidates before invocation.

Skip discovery when a confirmed member already fits the task, the next action is mechanical, or the user only asked to invoke an existing member.

## How To Run

Prepare discovery:

```bash
ctree members discover --project <project-path> --json
```

If the command returns `needs-agent-gate`, open the reported `gateRequestPath`. Answer only from the displayed genuine user lines:

```text
n
```

or:

```text
y: 2, 5
```

Then write that answer to a file and continue:

```bash
ctree members discover answer-gate --state <run-dir> --answer-file <gate-answer-file>
```

If the command returns `needs-agent-extractor`, open the reported `extractorRequestPath`. Return JSON only, with either no proposals:

```json
{"proposals":[]}
```

or full candidate proposals using only evidence refs from the request:

```json
{
  "proposals": [{
    "memberName": "<derived-kebab-case-member-name>",
    "role": "<short role derived from the repeated need>",
    "routingDescription": "<when to use this member>",
    "responsibilities": ["<responsibility from the repeated need>", "<second responsibility>"],
    "evidenceRefs": [{"ref": "session:root-a:message:1", "digest": "sha256:..."}],
    "whyReusable": "<why this is reusable rather than a one-off task>",
    "negativeSignals": []
  }]
}
```

Then continue:

```bash
ctree members discover answer-extractor --state <run-dir> --answer-file <extractor-answer-file>
```

## Rules

- Do not invent candidates from topic words or fixed member names.
- Derive `memberName`, role, routing, and responsibilities from the displayed repeated role need; do not copy example names.
- Do not use workflow wrappers, tool output, DCP summaries, or hidden prompt text as evidence.
- Do not confirm, rename, merge, add, or discard candidates unless the user asks.
- Discovery creates unconfirmed candidates only.
- If the evidence is weak, answer `n` or `{"proposals":[]}`.
```

- [ ] **Step 4: Update skill rules**

Modify `docs/skills/context-tree-skill-rules.md`:

- Add `context-tree-discover-members` as a third skill.
- State its non-replaceable behavior: it changes when the parent agent starts cold-start discovery and how it supplies member-discovery gate/extractor answers.
- State it must not duplicate checkpoint save/use or schema contracts.
- State `ctree members discover` is the V0 transport; MCP can wrap it later but is not required for the skill.

- [ ] **Step 5: Update OpenCode parent instructions**

Modify `src/install/opencode-member-instructions.mjs` so `renderOpenCodeMemberInstructions()` includes:

```text
If no confirmed member fits and the user is asking to set up/import/discover reusable experts, run:

ctree members discover --project <path> --json

When discovery returns a gate or extractor request, answer from the displayed genuine user lines only and continue with the reported answer command. Discovery creates unconfirmed candidates only. Do not apply Confirm/Rename/Add/Discard unless the user asks.
```

Keep the existing invocation instruction for confirmed members.

- [ ] **Step 6: Run skill/instruction tests**

Run:

```bash
node --test test/docs/context-tree-skills.test.mjs test/cli/install-member-projections-cli.test.mjs test/cli/ctree-cli.test.mjs
```

Expected: PASS.

---

## Task 4: Eval Gates For Agent-Assisted Discovery Proof

**Files:**

- Modify: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`
- Modify: `scripts/context-tree/run-member-system-e2e-eval.mjs`
- Modify: `test/eval/member-session-cold-start-live-eval.test.mjs`
- Modify: `test/eval/member-system-e2e.test.mjs`
- Modify: `test/quality/no-hardcoded-member-discovery.test.mjs`

**Example:** observes Example 1 and Example 2; preserves Invariant 1 and Invariant 2

**Interfaces:**

- `run-live-member-session-cold-start-eval.mjs` accepts `--agent-assisted-root <path>` to ingest reports/artifacts from Task 2.
- Aggregate eval treats `agent-assisted-parent-turn` as discovery proof support and treats `fixture-semantic-*` as retained/test proof only unless explicitly running fixture mode.

- [ ] **Step 1: Add failing live-eval ingestion tests**

Extend `test/eval/member-session-cold-start-live-eval.test.mjs` with an ingestion test that uses real files, not report self-certification:

```js
it('ingests agent-assisted roots only when retained artifacts and answer source support the claimed scope', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ctree-agent-assisted-eval-'));
  try {
    const agentRoot = join(root, 'agent-assisted');
    runAgentAssistedDiscoveryCliToCompletion({ root: agentRoot, answerSource: 'observed-parent-agent-turn' });
    const ingested = runLiveEval(['--agent-assisted-root', agentRoot, '--out', join(root, 'ingested')]);
    assert.equal(ingested.status, 0, ingested.stderr || ingested.stdout);
    const report = JSON.parse(readFileSync(join(root, 'ingested', 'member-session-cold-start-live-eval-report.json'), 'utf8'));
    assert.equal(report.memberDiscoveryProofKind, 'agentAssistedCandidateDiscovery');
    assert.equal(report.memberDiscoveryProofScope, 'agent-assisted-product');
    assert.equal(report.discoveryProofKind, 'semanticCandidateDiscovery');
    assert.equal(report.evidenceQuality.gateDiagnostics.adapterKind, 'agent-assisted-parent-turn');
    assert.equal(report.evidenceQuality.extractorDiagnostics.adapterKind, 'agent-assisted-parent-turn');
    assert.equal(existsSync(join(agentRoot, report.evidenceQuality.gateDiagnostics.inputArtifactRef)), true);
    assert.equal(existsSync(join(agentRoot, report.evidenceQuality.gateDiagnostics.rawOutputArtifactRef)), true);
    assert.equal(existsSync(join(agentRoot, report.evidenceQuality.gateDiagnostics.parsedOutputArtifactRef)), true);

    const manualRoot = join(root, 'manual-assisted');
    runAgentAssistedDiscoveryCliToCompletion({ root: manualRoot, answerSource: 'manual-retained' });
    const manualIngest = runLiveEval(['--agent-assisted-root', manualRoot, '--out', join(root, 'manual-ingested')]);
    assert.equal(manualIngest.status, 0, manualIngest.stderr || manualIngest.stdout);
    const manualReport = JSON.parse(readFileSync(join(root, 'manual-ingested', 'member-session-cold-start-live-eval-report.json'), 'utf8'));
    assert.equal(manualReport.memberDiscoveryProofScope, 'manual-retained');

    const fixtureRoot = copyRootAndPatchReport({ sourceRoot: agentRoot, targetRoot: join(root, 'fixture-root'), patch: (value) => {
      value.evidenceQuality.gateDiagnostics.adapterKind = 'fixture-semantic-gate';
      value.evidenceQuality.extractorDiagnostics.adapterKind = 'fixture-semantic-extractor';
      return value;
    } });
    const fixtureIngest = runLiveEval(['--agent-assisted-root', fixtureRoot, '--out', join(root, 'fixture-ingested')]);
    assert.notEqual(fixtureIngest.status, 0, fixtureIngest.stdout);

    const missingArtifactRoot = copyRootAndPatchReport({ sourceRoot: agentRoot, targetRoot: join(root, 'missing-artifact-root'), patch: (value) => {
      value.evidenceQuality.gateDiagnostics.rawOutputArtifactRef = 'attempt-1/missing-gate-raw-output.txt';
      return value;
    } });
    const missingArtifactIngest = runLiveEval(['--agent-assisted-root', missingArtifactRoot, '--out', join(root, 'missing-artifact-ingested')]);
    assert.notEqual(missingArtifactIngest.status, 0, missingArtifactIngest.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

The helper names above are illustrative, but the final test must actually execute the Task 2 CLI or an equivalent repo helper to create a root with real retained files. It must not pass by writing a report JSON and asserting its own fields. Keep these exact assertions for the accepted observed-source case:

```js
assert.equal(report.memberDiscoveryProofKind, 'agentAssistedCandidateDiscovery');
assert.equal(report.memberDiscoveryProofScope, 'agent-assisted-product');
assert.equal(report.discoveryProofKind, 'semanticCandidateDiscovery');
assert.equal(report.evidenceQuality.gateDiagnostics.adapterKind, 'agent-assisted-parent-turn');
assert.equal(report.evidenceQuality.extractorDiagnostics.adapterKind, 'agent-assisted-parent-turn');
```

And keep these negative checks:

```js
assert.notEqual(fixtureIngest.status, 0);
assert.notEqual(missingArtifactIngest.status, 0);
assert.equal(manualReport.memberDiscoveryProofScope, 'manual-retained');
```

- [ ] **Step 2: Add aggregate eval tests**

Extend `test/eval/member-system-e2e.test.mjs` or `test/cli/run-member-system-e2e-eval-cli.test.mjs`:

```js
it('marks agent-assisted member discovery as product-capable and fixture member discovery as retained-only', () => {
  const agentAssisted = memberDiscoveryProofScope({ evidenceQuality: { gateDiagnostics: { adapterKind: 'agent-assisted-parent-turn' }, extractorDiagnostics: { adapterKind: 'agent-assisted-parent-turn' } }, memberDiscoveryAnswerSource: { productEligible: true, sourceKind: 'observed-parent-agent-turn' } });
  const manual = memberDiscoveryProofScope({ evidenceQuality: { gateDiagnostics: { adapterKind: 'agent-assisted-parent-turn' }, extractorDiagnostics: { adapterKind: 'agent-assisted-parent-turn' } }, memberDiscoveryAnswerSource: { productEligible: false, sourceKind: 'manual-retained' } });
  const fixture = memberDiscoveryProofScope({ evidenceQuality: { gateDiagnostics: { adapterKind: 'fixture-semantic-gate' }, extractorDiagnostics: { adapterKind: 'fixture-semantic-extractor' } } });
  assert.equal(agentAssisted, 'agent-assisted-product');
  assert.equal(manual, 'manual-retained');
  assert.equal(fixture, 'retained-fixture');
});
```

- [ ] **Step 3: Implement eval ingestion**

Modify `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`:

- Add `--agent-assisted-root` argument.
- If present, read `<root>/member-session-cold-start-live-eval-report.json`.
- Validate that the root contains retained input/raw/parsed refs for gate and extractor when it claims discovery proof.
- Reject product member discovery proof when either adapter kind starts with `fixture-`.
- Preserve existing fixture tests by making fixture mode explicit and retained-only.

Modify `scripts/context-tree/run-member-system-e2e-eval.mjs`:

- Add discovery proof source classification:

```js
function memberDiscoveryProofScope(report) {
  const gate = report.evidenceQuality?.gateDiagnostics?.adapterKind;
  const extractor = report.evidenceQuality?.extractorDiagnostics?.adapterKind;
  const answerSource = report.memberDiscoveryAnswerSource ?? report.answerSource;
  if (gate === 'agent-assisted-parent-turn' && extractor === 'agent-assisted-parent-turn' && answerSource?.productEligible === true) return 'agent-assisted-product';
  if (gate === 'agent-assisted-parent-turn' && extractor === 'agent-assisted-parent-turn') return 'manual-retained';
  if (String(gate).startsWith('fixture-') || String(extractor).startsWith('fixture-')) return 'retained-fixture';
  if (gate === 'fail-closed-default' || extractor === 'fail-closed-default') return 'diagnostic';
  return 'unknown';
}
```

- Only `agent-assisted-product` can close product member discovery. `manual-retained` can close protocol proof, and `retained-fixture` can close retained regression only.

- [ ] **Step 4: Strengthen hardcoded discovery quality test**

Extend `test/quality/no-hardcoded-member-discovery.test.mjs` so it fails if `run-member-discovery-agent-assisted.mjs` contains fixed candidate names like `proof-tier-specialist`, `semantic-reviewer`, or `skill-designer` outside tests/fixtures.

- [ ] **Step 5: Run focused eval tests**

Run:

```bash
node --test test/eval/member-session-cold-start-live-eval.test.mjs test/eval/member-system-e2e.test.mjs test/cli/run-member-system-e2e-eval-cli.test.mjs test/quality/no-hardcoded-member-discovery.test.mjs
```

Expected: PASS.

---

## Task 5: Real Agent-Wiki-Lab Member Discovery Live Eval And Correction Loop

**Files:**

- Modify: `.superpowers/sdd/progress.md`
- No product source file changes unless the correction loop identifies defects.

**Example:** observes Example 1, Example 2, and Example 3; preserves all invariants

**Interfaces:**

- Uses existing OpenCode session corpus exporter and the new `ctree members discover` path.
- Produces a fresh live artifact root under `/tmp/context-tree-member-discovery-agent-assisted-*`.

- [ ] **Step 1: Export or reuse real agent-wiki-lab session corpus**

Prefer existing multi-session corpus if present; otherwise run:

```bash
npm run context-tree:export-opencode-session-corpus -- \
  --db /home/prosumer/.local/share/opencode/opencode.db \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-agent-assisted-corpus
```

Expected: writes a corpus path in stdout and includes more than one root session.

- [ ] **Step 2: Prepare agent-assisted discovery**

Run:

```bash
npm run context-tree:run-member-discovery-agent-assisted -- \
  prepare \
  --session-corpus /tmp/context-tree-agent-wiki-lab-agent-assisted-corpus/session-corpus.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-member-discovery-agent-assisted-live
```

Expected stdout:

```json
{"status":"needs-agent-gate","gateRequestPath":".../member-discovery-gate-request.json"}
```

- [ ] **Step 3: Parent agent answers the gate request**

Open `member-discovery-gate-request.json`. Answer from displayed genuine user lines only.

For a protocol-only/manual run, the answer file source is `manual-retained`. For product proof, first capture or provide a runtime observer/export artifact for the current parent-agent turn that contains the request path/content and the answer. Use that artifact as `--transcript-ref` and record its digest as `--observed-turn-digest`. Do not mark a hand-written answer file as `observed-parent-agent-turn`.

After writing or receiving the observed parent-agent turn artifact, compute its digest:

```bash
node --input-type=module -e "import {createHash} from 'node:crypto'; import {readFileSync} from 'node:fs'; const p=process.argv[1]; process.stdout.write('sha256:'+createHash('sha256').update(readFileSync(p)).digest('hex')+'\n');" /tmp/context-tree-member-discovery-agent-assisted-live/observed-parent-gate-turn.json > /tmp/context-tree-member-discovery-agent-assisted-live/observed-parent-gate-turn.digest
```

If no reusable member need is present, write:

```text
n
```

to `/tmp/context-tree-member-discovery-agent-assisted-live/gate-answer.txt`.

If a reusable member need is present, write:

```text
y: <displayed line ordinals>
```

to the same file. Use displayed `lineOrdinal` values only.

- [ ] **Step 4: Continue after gate**

Run:

```bash
npm run context-tree:run-member-discovery-agent-assisted -- \
  answer-gate \
  --state /tmp/context-tree-member-discovery-agent-assisted-live \
  --answer-file /tmp/context-tree-member-discovery-agent-assisted-live/gate-answer.txt \
  --answer-source observed-parent-agent-turn \
  --transcript-ref /tmp/context-tree-member-discovery-agent-assisted-live/observed-parent-gate-turn.json \
  --observed-turn-digest "$(cat /tmp/context-tree-member-discovery-agent-assisted-live/observed-parent-gate-turn.digest)"
```

Expected:

- If gate answer is `n`: stdout contains `"status":"pass"`, `"memberDiscoveryProofKind":"agentAssistedZeroCandidate"`, and compatibility `"discoveryProofKind":"semanticZeroCandidate"`.
- If gate answer is `y: ...`: stdout contains `"status":"needs-agent-extractor"` and an extractor request path.

- [ ] **Step 5: If extractor is needed, parent agent answers it**

Open `member-discovery-extractor-request.json`. Write `/tmp/context-tree-member-discovery-agent-assisted-live/extractor-answer.json` with either:

```json
{"proposals":[]}
```

or a full proposal using only evidence refs from the request.

After writing or receiving the observed parent-agent turn artifact for the extractor answer, compute its digest:

```bash
node --input-type=module -e "import {createHash} from 'node:crypto'; import {readFileSync} from 'node:fs'; const p=process.argv[1]; process.stdout.write('sha256:'+createHash('sha256').update(readFileSync(p)).digest('hex')+'\n');" /tmp/context-tree-member-discovery-agent-assisted-live/observed-parent-extractor-turn.json > /tmp/context-tree-member-discovery-agent-assisted-live/observed-parent-extractor-turn.digest
```

Then run:

```bash
npm run context-tree:run-member-discovery-agent-assisted -- \
  answer-extractor \
  --state /tmp/context-tree-member-discovery-agent-assisted-live \
  --answer-file /tmp/context-tree-member-discovery-agent-assisted-live/extractor-answer.json \
  --answer-source observed-parent-agent-turn \
  --transcript-ref /tmp/context-tree-member-discovery-agent-assisted-live/observed-parent-extractor-turn.json \
  --observed-turn-digest "$(cat /tmp/context-tree-member-discovery-agent-assisted-live/observed-parent-extractor-turn.digest)"
```

Expected: stdout contains `"status":"pass"` and either `"agentAssistedCandidateDiscovery"` or `"agentAssistedZeroCandidate"` in `memberDiscoveryProofKind`.

- [ ] **Step 6: Run aggregate eval using the agent-assisted root**

Run:

```bash
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-member-discovery-agent-assisted-system-live \
  --cold-start-live-report /tmp/context-tree-member-discovery-agent-assisted-live/member-session-cold-start-live-eval-report.json
```

Expected:

```json
{"verdict":"pass"}
```

Inspect `/tmp/context-tree-member-discovery-agent-assisted-system-live/member-system-e2e-report.json`:

- `coldStartLiveObserved.status: "pass"`;
- `memberDiscovery.status: "pass"` only when `memberDiscoveryProofScope: "agent-assisted-product"`; compatibility `semanticDiscovery.status: "pass"` may also be present;
- discovery proof scope is `agent-assisted-product` or equivalent;
- no fixture adapter kinds appear in the proof path.

If no runtime observer/export artifact is available, rerun the same steps with `--answer-source manual-retained`. Expected: aggregate may pass protocol/retained checks, but product member discovery remains not proven and the ledger must say `proof boundary: manual-retained`.

- [ ] **Step 7: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, request packet, raw answer file, parsed answer artifact, or exact error.
2. Classify root cause: implementation defect, skill/instruction defect, eval defect, environment/exporter issue, or unclear product requirement.
3. Write or update a failing regression test for implementation/eval defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the defect. Do not weaken member-discovery gates to turn fixture or default output into product proof.
5. Run the focused test for the fix. Expected: PASS.
6. Rerun the original live command sequence. Expected: PASS, or the same honest external blocked state with retained evidence.
7. Compare the new artifacts to the failing artifacts. If adapter kind, retained refs, evidence hygiene, or candidate/report semantics did not change, do not claim the issue is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

- [ ] **Step 8: Update progress ledger**

Append to `.superpowers/sdd/progress.md`:

```text
Agent-assisted member discovery V0:
- live root: /tmp/context-tree-member-discovery-agent-assisted-live
- aggregate root: /tmp/context-tree-member-discovery-agent-assisted-system-live
- result: pass, blocked, or failed
- proof boundary: agent-assisted-product, manual-retained, retained-fixture, diagnostic, blocked, or failed
- answer source: observed-parent-agent-turn, manual-retained, or blocked
- remaining limitation: none when pass; otherwise name the blocked or failed boundary
```

---

## Task 6: Natural Use E2E For The Discovered Member

**Files:**

- Create: `scripts/context-tree/run-member-discovery-natural-use-e2e.mjs`
- Modify: `package.json`
- Modify: `scripts/context-tree/run-member-system-e2e-eval.mjs` if aggregate reporting needs the new natural-use proof ref
- Test: `test/cli/run-member-discovery-natural-use-e2e-cli.test.mjs`
- Test: `test/eval/member-system-e2e.test.mjs` or `test/cli/run-member-system-e2e-eval-cli.test.mjs`
- Modify: `.superpowers/sdd/progress.md`

**Example:** observes Example 1 and Example 3; preserves Invariant 1, Invariant 3, and Invariant 5

**Interfaces:**

- Consumes the Task 5 agent-assisted discovery root.
- Reads the accepted `MemberProfileCandidate` and its source `evidenceRefs`.
- Builds a normal-use eval input from the same user line that caused the member to be discovered.
- Confirms the candidate through the existing explicit setup/import mutation path before invocation. Unconfirmed candidates must not be invoked.
- Produces `/tmp/context-tree-member-discovery-natural-use-e2e-*/natural-use-e2e-report.json`.

- [ ] **Step 1: Write failing natural-use E2E CLI tests**

Create `test/cli/run-member-discovery-natural-use-e2e-cli.test.mjs` with two retained-root cases:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-member-discovery-natural-use-e2e.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function writeDiscoveryRoot(root) {
  mkdirSync(join(root, 'attempt-1'), { recursive: true });
  writeFileSync(join(root, 'attempt-1', 'session-corpus-scan.json'), `${JSON.stringify({
    scannedMessages: [
      { role: 'user', sessionId: 'need-a', ordinal: 1, ref: 'session:need-a:message:1', digest: 'sha256:a', evidenceSourceKind: 'genuine-user-message', text: 'Every acceptance decision needs the proof tier specialist before saying pass.' },
      { role: 'user', sessionId: 'need-b', ordinal: 1, ref: 'session:need-b:message:1', digest: 'sha256:b', evidenceSourceKind: 'genuine-user-message', text: 'Again use the proof tier specialist to check proof boundaries first.' },
    ],
  }, null, 2)}\n`, 'utf8');
  writeFileSync(join(root, 'attempt-1', 'member-profile-candidates.json'), `${JSON.stringify({ candidates: [{
    memberName: 'proof-tier-specialist',
    role: 'Proof Tier Specialist',
    routingDescription: 'Use before accepting proof-tier or product-proof claims.',
    responsibilities: ['Separate proof tiers.', 'Check evidence paths.'],
    evidenceRefs: [{ ref: 'session:need-a:message:1', digest: 'sha256:a' }, { ref: 'session:need-b:message:1', digest: 'sha256:b' }],
    sourceAuthority: 'session-derived-unconfirmed',
    defaultExpert: false,
  }] }, null, 2)}\n`, 'utf8');
  writeFileSync(join(root, 'member-session-cold-start-live-eval-report.json'), `${JSON.stringify({
    memberDiscoveryProofScope: 'agent-assisted-product',
    liveSessionDerivedCandidate: { status: 'pass', memberName: 'proof-tier-specialist' },
  }, null, 2)}\n`, 'utf8');
}

describe('member discovery natural use e2e', () => {
  it('uses the discovered member for the same kind of user input after explicit confirmation', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-e2e-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      writeDiscoveryRoot(discoveryRoot);
      const out = join(root, 'out');
      const result = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'retained-observed']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'natural-use-e2e-report.json'), 'utf8'));
      assert.equal(report.status, 'pass');
      assert.equal(report.memberName, 'proof-tier-specialist');
      assert.equal(report.confirmedBeforeUse, true);
      assert.equal(report.usedSourceInputRef, 'session:need-a:message:1');
      assert.equal(report.memberInvocationObserved, true);
      assert.equal(report.returnedToParentAgent, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the discovered candidate is not explicitly confirmed before use', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-e2e-unconfirmed-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      writeDiscoveryRoot(discoveryRoot);
      const out = join(root, 'out');
      const result = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'retained-observed', '--skip-confirm']);
      assert.notEqual(result.status, 0, result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'natural-use-e2e-report.json'), 'utf8'));
      assert.equal(report.status, 'fail');
      assert.match(report.reason, /unconfirmed candidate/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run the failing natural-use tests**

Run:

```bash
node --test test/cli/run-member-discovery-natural-use-e2e-cli.test.mjs
```

Expected: FAIL because `scripts/context-tree/run-member-discovery-natural-use-e2e.mjs` does not exist.

- [ ] **Step 3: Implement the natural-use E2E CLI**

Create `scripts/context-tree/run-member-discovery-natural-use-e2e.mjs` with these behaviors:

- Parse `--discovery-root`, `--project-identity`, `--out`, `--mode retained-observed|live-observed`, and optional `--skip-confirm`.
- Read `<discovery-root>/attempt-1/member-profile-candidates.json` and select the first accepted candidate from the discovery report.
- Resolve the candidate's first genuine source user line from `<discovery-root>/attempt-1/session-corpus-scan.json` by `evidenceRefs[0].ref` and digest.
- Write `natural-use-input.json` with `{ memberName, sourceUserInput, sourceInputRef, sourceInputDigest }`.
- Unless `--skip-confirm` is present, use the existing setup/import action path to create a confirmed member registry entry in a temporary project state. The report must record `confirmedBeforeUse: true`.
- Run or simulate only through the existing member invocation/product path for retained tests. Do not call a private helper that bypasses `ctree members invoke` semantics.
- In `live-observed` mode, require an observed parent-agent transcript/export showing that the parent agent saw the natural user input and selected or invoked the discovered member. Without that transcript, write `status: "blocked"`, `reason: "missing observed natural-use parent-agent transcript"`, and exit non-zero.
- Write `natural-use-e2e-report.json` with `status`, `memberName`, `usedSourceInputRef`, `confirmedBeforeUse`, `memberInvocationObserved`, `returnedToParentAgent`, `proofScope`, and retained refs.

The retained test may use a retained invocation artifact, but product proof requires `live-observed` and an observed parent-agent transcript.

- [ ] **Step 4: Add package script**

Modify `package.json` scripts:

```json
"context-tree:run-member-discovery-natural-use-e2e": "node scripts/context-tree/run-member-discovery-natural-use-e2e.mjs"
```

- [ ] **Step 5: Add aggregate reporting for natural-use proof**

Modify `scripts/context-tree/run-member-system-e2e-eval.mjs` so it accepts:

```bash
--natural-use-report <path>
```

When present, the aggregate report must include:

```json
{
  "naturalDiscoveredMemberUse": {
    "status": "pass",
    "memberName": "...",
    "usedSourceInputRef": "session:...",
    "confirmedBeforeUse": true,
    "memberInvocationObserved": true,
    "proofScope": "live-observed"
  }
}
```

Rules:

- `naturalDiscoveredMemberUse.status: "pass"` requires `confirmedBeforeUse: true`, `memberInvocationObserved: true`, and `returnedToParentAgent: true`.
- Product-level natural use proof requires `proofScope: "live-observed"`.
- `proofScope: "retained-observed"` can close retained regression only.
- If discovery produced zero candidates, natural use is `not-applicable`, not pass.

- [ ] **Step 6: Run focused retained natural-use tests**

Run:

```bash
node --test test/cli/run-member-discovery-natural-use-e2e-cli.test.mjs test/eval/member-system-e2e.test.mjs test/cli/run-member-system-e2e-eval-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Run live natural-use eval against the Task 5 discovered member**

Use the Task 5 discovery root. The test input must come from the discovered candidate's own `evidenceRefs`, not a newly invented prompt.

Run:

```bash
npm run context-tree:run-member-discovery-natural-use-e2e -- \
  --discovery-root /tmp/context-tree-member-discovery-agent-assisted-live \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-member-discovery-natural-use-e2e-live \
  --mode live-observed
```

Expected when runtime observer/export evidence is available:

```json
{"status":"pass"}
```

Then run aggregate eval:

```bash
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-member-discovery-agent-assisted-system-live-with-natural-use \
  --cold-start-live-report /tmp/context-tree-member-discovery-agent-assisted-live/member-session-cold-start-live-eval-report.json \
  --natural-use-report /tmp/context-tree-member-discovery-natural-use-e2e-live/natural-use-e2e-report.json
```

Expected:

```json
{"verdict":"pass"}
```

Inspect the aggregate report:

- `memberDiscovery.status: "pass"`;
- `naturalDiscoveredMemberUse.status: "pass"`;
- `naturalDiscoveredMemberUse.proofScope: "live-observed"`;
- `naturalDiscoveredMemberUse.memberName` equals the discovered candidate name;
- `naturalDiscoveredMemberUse.usedSourceInputRef` is one of the discovered candidate's evidence refs;
- no fixture adapter kinds or hand-written natural prompts close the proof.

- [ ] **Step 8: If natural-use verification fails, run the eval -> correction -> re-eval loop**

For each failure:

1. Retain the failing evidence: natural-use report, observed transcript/export, member registry/import artifacts, invocation run artifact, aggregate report, and exact command output.
2. Classify root cause: discovery candidate quality, instruction/routing defect, confirmation/import defect, invocation defect, eval/report defect, runtime observer/export missing, or unclear requirement.
3. Write or update a failing regression test for implementation or eval defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal root-cause fix. Do not rewrite only the report unless the report/check is the defect. Do not weaken gates to count unconfirmed candidates, fixture invocations, or hand-written natural prompts as product proof.
5. Run the focused test for the fix. Expected: PASS.
6. Rerun the exact live natural-use command and aggregate command. Expected: PASS, or the same honest blocked state with retained evidence.
7. Compare new artifacts against the failing artifacts. If the parent-agent behavior, selected member, invocation artifact, or returned result did not change, do not claim the issue is fixed.
8. Repeat until the live natural-use eval passes, a human decision is required, or the same external blocking condition repeats.

- [ ] **Step 9: Update progress ledger with natural-use proof**

Append to `.superpowers/sdd/progress.md`:

```text
Natural discovered-member use E2E:
- discovery root: /tmp/context-tree-member-discovery-agent-assisted-live
- natural-use root: /tmp/context-tree-member-discovery-natural-use-e2e-live
- aggregate root: /tmp/context-tree-member-discovery-agent-assisted-system-live-with-natural-use
- result: pass, retained-only, blocked, or failed
- member used: <memberName>
- source input ref: <session:...>
- proof scope: live-observed, retained-observed, not-applicable, blocked, or failed
- remaining limitation: none when live-observed pass; otherwise name the blocked or failed boundary
```

---

## Final Verification

Run the focused bundle:

```bash
node --test \
  test/core/member-discovery-agent-io.test.mjs \
  test/core/member-need-gate.test.mjs \
  test/core/member-session-cold-start.test.mjs \
  test/cli/run-member-discovery-agent-assisted-cli.test.mjs \
  test/cli/run-member-discovery-natural-use-e2e-cli.test.mjs \
  test/cli/ctree-cli.test.mjs \
  test/docs/context-tree-skills.test.mjs \
  test/eval/member-session-cold-start-live-eval.test.mjs \
  test/eval/member-system-e2e.test.mjs \
  test/quality/no-hardcoded-member-discovery.test.mjs
```

Expected: PASS.

Run the full suite:

```bash
npm test
```

Expected: PASS.

Run syntax hygiene:

```bash
git diff --check
```

Expected: no output and exit 0.

Run the real live correction loop in Task 5. Expected: product member discovery proof is either pass with `agent-assisted-parent-turn` or honestly blocked with retained request/answer/exporter evidence. A fixture-only pass is not acceptable.

Run the natural-use live correction loop in Task 6. Expected: the member discovered in Task 5 is confirmed through the explicit setup/import path, then selected or invoked for the corresponding source user input with observed parent-agent evidence. If runtime observer/export evidence is missing, record `blocked` or `retained-only`; do not claim full natural product E2E.

---

## Self-Review

- Spec coverage: The plan answers the call path question directly: V0 uses existing `ctree` CLI/bin, not MCP. It adds agent-assisted request/answer protocol, dispatcher entry, skill/instruction guidance, eval gates, real corpus live proof, and natural-use proof for the discovered member.
- Skill quality: Existing checkpoint skills remain separate. The new discover-members skill has symptom-driven trigger wording and changes agent behavior in a non-replaceable way.
- Architecture ownership: The CLI is transport, not semantic authority. The parent agent supplies discovery answers; Context Tree validates and records. MCP is explicitly deferred as a wrapper.
- Proof boundary: Fixture adapters remain retained/test support only; product proof requires `agent-assisted-parent-turn` plus observed parent-agent answer-source evidence. Manual answer files close protocol proof only.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation owner remains.

## Plan Review

**Status:** Updated After Review

**Issues addressed:** Eval ingestion can no longer self-certify from report JSON alone; adapter records are fail-closed without retained refs; manual answers are separated from observed parent-agent product proof; skill examples avoid fixed member-name answers.

**Recommendations:** During implementation, keep any shared report helper extraction private and avoid making report helper internals part of the product contract.
