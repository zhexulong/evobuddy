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

function assertRuntimeShapeAssumptions(text, label) {
  assert.match(text, /CollabAgentToolCall/, `${label} must document collab spawn items`);
  assert.match(text, /receiverThreadIds|receiver_thread_ids/, `${label} must document receiver thread ids`);
  assert.match(text, /task_name/, `${label} must document v2 task_name identity metadata`);
  assert.match(text, /wait.*mailbox[- ]change|wait.*completion/i, `${label} must document v2 wait semantics`);
  assert.match(text, /child thread.*final answer/i, `${label} must require child-thread final answers`);
  assert.match(text, /thread\/read.*\{ thread: \{ turns/i, `${label} must document thread/read wire shape`);
  assert.match(text, /agentMessage.*text/i, `${label} must document agentMessage text answers`);
  assert.match(
    text,
    /agentsStates.*message.*never accepted|never.*agentsStates.*message/i,
    `${label} must reject agentsStates messages as observed answers`,
  );
}

describe('runtime native-spawn shape docs', () => {
  it('documents real observable runtime shapes in the acceptance runbook', () => {
    assertRuntimeShapeAssumptions(
      readDoc('docs/codex-native-spawn-acceptance-runbook.md'),
      'acceptance runbook',
    );
  });

  it('keeps the runtime pipeline plan aligned with real observable runtime shapes', () => {
    assertRuntimeShapeAssumptions(
      readDoc('docs/superpowers/plans/2026-07-06-codex-native-spawn-runtime-pipeline.md'),
      'runtime pipeline plan',
    );
  });

  it('documents the acceptance CLI surfaces and not-yet-wired boundary', () => {
    const text = readDoc('docs/codex-native-spawn-install.md');
    assert.match(text, /CollabAgentToolCall/, 'install doc must name CollabAgentToolCall');
    assert.match(text, /receiverThreadIds|receiver_thread_ids/, 'install doc must name receiver thread ids');
    assert.match(text, /child thread id/i, 'install doc must name the child thread id');
    assert.match(text, /child thread read|thread\/read/i, 'install doc must document child-thread reads');
    assert.match(text, /context-tree:run-native-spawn-acceptance/, 'install doc must document npm script entrypoint');
    assert.match(text, /node scripts\/context-tree\/run-native-spawn-acceptance\.mjs --config <json> --out <dir>/i, 'install doc must document direct CLI entrypoint');
    assert.match(text, /context-tree:run-real-user-path-v0/, 'install doc must document real-user-path npm script entrypoint');
    assert.match(text, /node scripts\/context-tree\/run-real-user-path-v0\.mjs --config <json> --out <dir>/i, 'install doc must document real-user-path direct CLI entrypoint');
    assert.match(text, /context-tree:run-authorized-member-activation/, 'install doc must document authorized UX npm entrypoint');
    assert.match(text, /run-authorized-member-activation-e2e\.mjs/i, 'install doc must document authorized UX direct CLI entrypoint');
    assert.match(text, /temporary `CODEX_HOME`|tempCodexHome/i, 'install doc must document temporary CODEX_HOME behavior');
    assert.match(text, /acceptanceProofPath|acceptance-proof\.json/i, 'install doc must document persisted acceptance proof output');
    assert.match(text, /evalSeed/i, 'install doc must document derived eval seed output');
    assert.match(text, /evalReportPath|capability-matrix\.json/i, 'install doc must document eval report output');
    assert.match(text, /not-yet-wired|not yet wired/i, 'install doc must document not-yet-wired status');
    assert.match(text, /controlled-provider/i, 'install doc must document controlled-provider mode');
    assert.match(text, /provider-forced-live/i, 'install doc must document provider-forced-live mode');
    assert.match(text, /authorized-natural-native-spawn/i, 'install doc must document the canonical authorized acceptance tier');
    assert.match(text, /codex-linux-sandbox/i, 'install doc must document reviewer runtime prerequisite diagnostics');
    assert.match(text, /Codex-compatible app-server harness proof/i, 'install doc must name the controlled-provider proof boundary precisely');
    assert.doesNotMatch(text, /controlled-provider mode is the deterministic app-server\/provider proof path/i, 'install doc must not overstate controlled-provider mode as full provider proof');
  });

  it('keeps eval docs from claiming native-spawn acceptance is fixture-only or future-only', () => {
    const text = readDoc('docs/codex-context-fork-eval.md');
    assert.doesNotMatch(text, /successful local path is fixture acceptance only/i);
    assert.doesNotMatch(text, /fixture acceptance is available locally, deterministic runtime proof needs later live app-server wiring/i);
    assert.match(text, /controlled-provider/i);
    assert.match(text, /provider-forced-live/i);
    assert.match(text, /acceptance-proof\.json/i);
    assert.match(text, /--acceptance-proof/i);
  });

  it('does not overstate the controlled app-server harness as real provider-forced live proof', () => {
    const install = readDoc('docs/codex-native-spawn-install.md');
    const runbook = readDoc('docs/codex-native-spawn-acceptance-runbook.md');

    assert.doesNotMatch(`${install}\n${runbook}`, /deterministic provider proof \(controlled app-server harness\)/i);
    assert.doesNotMatch(`${install}\n${runbook}`, /A stronger future path would wire the live harness directly/i);
    assert.match(`${install}\n${runbook}`, /controlled-provider mode.*does not claim provider-forced live proof/is);
    assert.match(`${install}\n${runbook}`, /provider-forced-live mode.*real Codex app-server|real Codex app-server.*provider-forced-live mode/is);
  });

  it('documents that wait_agent confirms completion or wait-path evidence before child-thread read', () => {
    const text = readDoc('docs/codex-native-spawn-acceptance-runbook.md');
    assert.match(text, /wait_agent.*confirm(?:s)? completion|wait path confirms completion|terminal child-thread turn.*closure evidence/i);
    assert.match(text, /child thread final answer/i);
  });

  it('documents the hermetic real-user-path V0 procedure and outputs', () => {
    const text = readDoc('docs/codex-native-spawn-acceptance-runbook.md');
    assert.match(text, /Hermetic Real-User-Path V0 Procedure/i);
    assert.match(text, /context-tree:run-real-user-path-v0/i);
    assert.match(text, /temporary `CODEX_HOME`|tempCodexHome/i);
    assert.match(text, /context-tree-save-checkpoint/i);
    assert.match(text, /context-tree-use-checkpoint/i);
    assert.match(text, /--acceptance-proof/i);
    assert.match(text, /eval seed/i);
    assert.match(text, /summary\.nativeSpawnPass: true/i);
    assert.match(text, /nativeSpawnArtifacts/i);
    assert.match(text, /acceptanceMode: "provider-forced-live"/i);
    assert.match(text, /natural-trigger proof|natural user workflow/i);
  });

  it('documents the natural-trigger E2E procedure without overstating autonomous native spawn', () => {
    const text = readDoc('docs/codex-native-spawn-acceptance-runbook.md');
    assert.match(text, /Natural-Trigger E2E Procedure/i);
    assert.match(text, /context-tree:run-natural-trigger-e2e/i);
    assert.match(text, /natural-scenario-skill-request/i);
    assert.match(text, /spawn_agent.*,.*fork_context.*,.*wait_agent|spawn_agent[\s\S]*fork_context[\s\S]*wait_agent/i);
    assert.match(text, /forbiddenPromptTermsPresent/i);
    assert.match(text, /checkpoint:[\s\S]*role: reviewer[\s\S]*question:[\s\S]*targets:/i);
    assert.match(text, /summary\.nativeSpawnPass: true/i);
    assert.match(text, /does not prove that the model independently chose the native `spawn_agent` tool/i);
  });

  it('documents the one-segment natural native-spawn proof without claiming autonomous model choice', () => {
    const text = readDoc('docs/codex-native-spawn-acceptance-runbook.md');
    assert.match(text, /One-Segment Natural Native-Spawn Procedure/i);
    assert.match(text, /Natural-Trigger E2E Procedure/i);
    assert.match(text, /natural-scenario-skill-request/i);
    assert.match(text, /context-tree:run-natural-native-spawn-e2e/i);
    assert.match(text, /natural-scenario-provider-driven-native-spawn/i);
    assert.match(text, /authorized-natural-native-spawn/i);
    assert.match(text, /separate, opt-in.*artifact and command|artifact and command.*opt-in/i);
    assert.match(text, /providerDrivenNativeSpawnProof/i);
    assert.match(text, /autonomousNativeSpawnProof: false/i);
    assert.match(text, /same parent turn/i);
    assert.match(text, /CollabAgentToolCall/i);
    assert.match(text, /summary\.nativeSpawnPass: true/i);
    assert.match(text, /does not prove.*independently chose.*spawn_agent|not.*autonomous model choice/i);
  });

  it('documents the acceptance tier matrix and autonomous experiment boundary', () => {
    const text = readDoc('docs/codex-native-spawn-acceptance-runbook.md');
    assert.match(text, /Acceptance Tier Matrix/i);
    assert.match(text, /provider-forced-live-runtime/i);
    assert.match(text, /natural-skill-request/i);
    assert.match(text, /natural-provider-driven-native-spawn/i);
    assert.match(text, /authorized-natural-native-spawn/i);
    assert.match(text, /context-tree:run-authorized-member-activation/i);
    assert.match(text, /run-authorized-member-activation-e2e\.mjs/i);
    assert.match(text, /CTREE_AUTHORIZED_NATIVE_SPAWN=1/i);
    assert.match(text, /--authorized/i);
    assert.match(text, /authorized-native-spawn-pass/i);
    assert.match(text, /authorized-no-trigger/i);
    assert.match(text, /runtime-not-wired/i);
    assert.match(text, /model-error/i);
    assert.match(text, /prompt-rejected/i);
    assert.match(text, /authorized-failure-artifact\.json/i);
    assert.match(text, /continueAfterReview|same-parent-thread continuation turn|same parent thread continues/i);
    assert.match(text, /stdout\/stderr|stderr\/stdout|exit reason/i);
    assert.match(text, /not treat.*authorized-failure-artifact\.json.*acceptance proof|not.*eval-ingestable native-spawn artifact/i);
    assert.match(text, /UX\/skill\/agent behavior metric|UX.*metric/i);
    assert.match(text, /not.*product mechanism gate|not.*mechanism prerequisite/i);
  });

  it('documents the authorized member activation runner without conflating it with provider-forced proof', () => {
    const text = readDoc('docs/codex-native-spawn-acceptance-runbook.md');
    assert.match(text, /run-authorized-member-activation-e2e/i);
    assert.match(text, /authorized-natural-member-activation/i);
    assert.match(text, /result\.returnedTo.*parent-agent|returnedTo = "parent-agent"/i);
    assert.match(text, /not be satisfied by provider-forced proof|must not be satisfied by provider-forced proof|must not use provider-forced/i);
  });

  it('documents eval acceptance tier reporting and autonomous not-run semantics', () => {
    const text = readDoc('docs/codex-context-fork-eval.md');
    assert.match(text, /acceptanceTier/i);
    assert.match(text, /summary\.acceptanceTiers/i);
    assert.match(text, /authorized-natural-member-activation/i);
    assert.match(text, /summary\.nativeSpawnLifecyclePass/i);
    assert.match(text, /summary\.lifecycleVerdicts/i);
    assert.match(text, /not-run/i);
    assert.match(text, /authorized-no-trigger.*not a mechanism failure/i);
  });

  it('documents the explicit member activation route pivot without product-grade overclaiming', () => {
    const runbook = readDoc('docs/codex-native-spawn-acceptance-runbook.md');
    const install = readDoc('docs/codex-native-spawn-install.md');
    const evalDoc = readDoc('docs/codex-context-fork-eval.md');
    const combined = `${runbook}\n${install}\n${evalDoc}`;

    assert.match(combined, /authorized-explicit-member-activation/i);
    assert.match(combined, /current repo-supported member mechanism candidate|current reliable member-route candidate/i);
    assert.match(combined, /differs from `authorized-natural-native-spawn`|explicit.*differs.*authorized-natural-native-spawn/is);
    assert.match(combined, /fixture mechanism proof.*non-fixture agent-runtime product proof|non-fixture agent-runtime product proof.*fixture mechanism proof/is);
    assert.match(combined, /explicit sidecar\/fixture execution.*not native-spawn proof|not native-spawn proof.*explicit sidecar\/fixture execution/is);
    assert.match(combined, /retained.*live proof|live.*retained proof/is);
    assert.match(combined, /hermetic\/retained explicit mechanism proof.*exists|exists.*hermetic\/retained explicit mechanism proof/is);
    assert.match(combined, /repo-side explicit route wiring.*exists|exists.*repo-side explicit route wiring/is);
    assert.match(combined, /corroborated transcript-seam.*explicit product|explicit product.*corroborated transcript-seam/is);
    assert.match(combined, /future fresh live explicit route.*new observed parent-agent transcript|fresh live explicit route.*RUNTIME_OBSERVER_EXPORT_PATH/is);
  });

  it('keeps explicit fixture and sidecar evidence out of native-spawn and product-accepted claims', () => {
    const combined = `${readDoc('docs/codex-native-spawn-acceptance-runbook.md')}\n${readDoc('docs/codex-native-spawn-install.md')}\n${readDoc('docs/codex-context-fork-eval.md')}`;

    assert.doesNotMatch(combined, /authorized-explicit-member-activation[^\n.]{0,120}(?:product-accepted|accepted live UX|canonical live UX acceptance path|reliable product route)/i);
    assert.doesNotMatch(combined, /fixture[^\n.]{0,120}(?:counts as|is accepted as|is product-grade|proves product-grade|proves fresh live)/i);
    assert.doesNotMatch(combined, /explicit sidecar[^\n.]{0,120}(?:counts as|is accepted as|proves)[^\n.]{0,80}native-spawn proof/i);
    assert.doesNotMatch(combined, /authorized-natural-native-spawn[^\n.]{0,120}pass[^\n.]{0,120}authorized-explicit-member-activation/i);
  });

  it('documents explicit product-grade parent invocation proof without native or natural overclaiming', () => {
    const runbook = readDoc('docs/codex-native-spawn-acceptance-runbook.md');
    const install = readDoc('docs/codex-native-spawn-install.md');
    const evalDoc = readDoc('docs/codex-context-fork-eval.md');
    const combined = `${runbook}\n${install}\n${evalDoc}`;

    assert.match(runbook, /authorized-explicit-member-parent-invocation-live-proof/);
    assert.match(combined, /explicit member product-grade proof/i);
    assert.match(combined, /observed parent-agent source artifact|observed parent-agent call-path evidence/i);
    assert.match(combined, /non-fixture adapter-owned executor observation|adapter-observed executor authority|non-fixture executor observation/i);
    assert.match(combined, /not native-spawn proof/i);
    assert.match(combined, /not natural model choice|does not prove native spawn or natural model choice/i);
    assert.match(combined, /parentTurnId/);
    assert.match(combined, /invocationId/);
    assert.match(combined, /invocationSurface/);
    assert.match(combined, /manual shell.*must not count|must not count.*manual shell/is);
    assert.match(combined, /file-writer.*must not count|must not count.*file-writer/is);
    assert.match(combined, /native\/natural tiers remain false\/not-run|native.*natural.*false.*not-run/is);
    assert.match(combined, /path normalization|normalize.*paths/i);
    assert.match(combined, /fixture\/regression|regression\/fixture/i);
  });

  it('documents the explicit parent transcript acceptance seam without claiming exporter implementation', () => {
    const text = readDoc('docs/codex-native-spawn-acceptance-runbook.md');
    assert.match(text, /Explicit Parent Transcript Acceptance Seam/i);
    assert.match(text, /RUNTIME_OBSERVER_EXPORT_PATH/);
    assert.match(text, /context-tree:run-explicit-parent-transcript-acceptance/);
    assert.match(text, /observed-parent-agent-call-transcript/);
    assert.match(text, /observed-parent-agent-call/);
    assert.match(text, /blocked/);
    assert.match(text, /does not implement a Codex\/OpenCode exporter/i);
    assert.match(text, /Test-owned positive transcripts.*not live product proof/is);
    assert.match(text, /Provider-forced\/native evidence.*does not satisfy explicit product proof/is);
    assert.match(text, /authorized-explicit-member-activation.*pass.*not.*authorized-natural-native-spawn/is);
    assert.match(text, /nativeSpawnPass.*false|spawnPass.*false/is);
  });
});
