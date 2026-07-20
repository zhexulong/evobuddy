import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  expectedRuntimeProjectionFiles,
  generateMemberRuntimeProjections,
  MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
  renderClaudeAgentMarkdown,
  renderCodexAgentToml,
  renderOpenCodeAgentMarkdown,
} from '../../src/core/member-runtime-projection.mjs';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSubagentBaseline as compileBaseline } from '../../src/core/subagent-baseline.mjs';

const profile = {
  name: 'skill-designer',
  description: 'Use when writing or reviewing Context Tree skills, especially trigger rules, rule/skill separation, and Superpowers compatibility.',
  role: 'Skill Designer',
  responsibilities: ['Review skill trigger rules'],
  standardsRefs: ['docs/skills/context-tree-skill-rules.md'],
  roleMemoryRefs: ['docs/role-memory/skill-designer.json'],
  activationHints: ['skill design'],
  negativeActivationHints: ['runtime implementation'],
};

describe('member runtime projection', () => {
  it('generates deterministic Claude/OpenCode/Codex definitions without task-local material', () => {
    const first = generateMemberRuntimeProjections({ memberName: 'skill-designer', profile, generatorVersion: 'test-v1' });
    const second = generateMemberRuntimeProjections({ memberName: 'skill-designer', profile, generatorVersion: 'test-v1' });
    assert.deepEqual(first, second);

    const codex = renderCodexAgentToml(first.codex);
    assert.match(codex, /name = "skill_designer"/);
    assert.match(codex, /description = "/);
    assert.match(codex, /developer_instructions/);
    assert.match(codex, /Do not substitute repo-local invoke-buddy wrappers|project-local Buddy CLI glue/i);
    assert.doesNotMatch(codex, /member_name\s*=/);
    assert.doesNotMatch(codex, /^role\s*=/m);
    assert.doesNotMatch(codex, /^generator_version\s*=/m);
    assert.doesNotMatch(codex, /^baseline_digest\s*=/m);
    assert.doesNotMatch(codex, /^responsibilities\s*=/m);
    assert.doesNotMatch(codex, /^standards_refs\s*=/m);
    assert.doesNotMatch(codex, /^role_memory_refs\s*=/m);
    assert.doesNotMatch(codex, /^activation_hints\s*=/m);
    assert.doesNotMatch(codex, /^negative_activation_hints\s*=/m);
    assert.doesNotMatch(codex, /targetRefs|current task target|model-visible/i);

    const claude = renderClaudeAgentMarkdown(first.claude);
    assert.match(claude, /^---\n/m);
    assert.match(claude, /native runtime subagent\/Buddy behavior/i);
    assert.match(claude, /Do not substitute repo-local invoke-buddy wrappers|project-local Buddy CLI glue/i);
    assert.doesNotMatch(claude, /targetRefs|current task target|model-visible/i);

    const opencode = renderOpenCodeAgentMarkdown(first.opencode);
    assert.match(opencode, /mode:\s*subagent/i);
    assert.match(opencode, /return.*parent agent/i);
    assert.match(opencode, /Do not substitute repo-local invoke-buddy wrappers|project-local Buddy CLI glue/i);
  });

  it('exposes deterministic expected runtime file paths for installers', () => {
    const projections = generateMemberRuntimeProjections({
      memberName: 'skill-designer',
      profile,
      generatorVersion: MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
    });
  assert.deepEqual(expectedRuntimeProjectionFiles(projections), {
    codex: '.codex/agents/skill_designer.toml',
    claude: '.claude/agents/skill-designer.md',
    opencode: '.opencode/agents/skill-designer.md',
  });
  });

  it('materializes supplied baseline content in Claude/OpenCode/Codex definitions while preserving refs', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-baseline-'));
    try {
      mkdirSync(join(root, 'docs/role-memory'), { recursive: true });
      writeFileSync(join(root, 'docs/role-memory/skill-designer.json'), 'Prefer symptom-driven trigger review before implementation details.\n', 'utf8');
      const subagentBaseline = compileBaseline({
        memberName: 'skill-designer',
        profile,
        profileRef: 'generated:test-profile',
        projectRoot: root,
        roleMemoryRefs: profile.roleMemoryRefs,
        generatorVersion: MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
      });
      const projections = generateMemberRuntimeProjections({ memberName: 'skill-designer', profile, generatorVersion: 'test-v1', subagentBaseline });
      const rendered = {
        codex: renderCodexAgentToml(projections.codex),
        claude: renderClaudeAgentMarkdown(projections.claude),
        opencode: renderOpenCodeAgentMarkdown(projections.opencode),
      };

      for (const content of Object.values(rendered)) {
        assert.match(content, /Prefer symptom-driven trigger review before implementation details\./);
        assert.match(content, new RegExp(subagentBaseline.baselineDigest.replaceAll(':', ':')));
        assert.match(content, new RegExp(subagentBaseline.baselineMaterials.find((material) => material.kind === 'role-memory').includedDigest.replaceAll(':', ':')));
        assert.match(content, /docs\/role-memory\/skill-designer\.json/);
        assert.doesNotMatch(content, /targetRefs|member-m\[1\]|MemberTaskRun|deliveryEvidence|resultReturnEvidence/i);
      }
      assert.match(rendered.codex, /Baseline digest: sha256:/);
      assert.match(rendered.codex, /docs\/role-memory\/skill-designer\.json/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runtime projection renders EvoBuddy roster visibility and knowledge refs without delivery-proof claims', () => {
    const projections = generateMemberRuntimeProjections({
      memberName: 'explore',
      generatorVersion: MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
      profile: {
        name: 'explore',
        description: 'Use when read-only codebase exploration is needed.',
        role: 'Explore',
        responsibilities: ['Map codebase evidence'],
        standardsRefs: ['knowledge/sops/codebase-exploration.md'],
        roleMemoryRefs: ['buddies/explore/BUDDY.md'],
        activationHints: ['understand subsystem'],
        negativeActivationHints: ['external docs only'],
      },
      visibility: 'active',
      sourceFamily: 'omo-derived',
      knowledgeRefs: ['knowledge/sops/codebase-exploration.md'],
      skillRefs: [],
      routingPriority: 'default',
    });
    const rendered = [
      renderOpenCodeAgentMarkdown(projections.opencode),
      renderClaudeAgentMarkdown(projections.claude),
      renderCodexAgentToml(projections.codex),
    ];
    for (const content of rendered) {
      assert.match(content, /EvoBuddy/i);
      assert.match(content, /Visibility: active/);
      assert.match(content, /Source family: omo-derived/);
      assert.match(content, /knowledge\/sops\/codebase-exploration\.md/);
      assert.doesNotMatch(content, /Context Tree/);
      assert.doesNotMatch(content, /returnedTo: parent-agent|deliveryEvidence|resultReturnEvidence/);
    }
  });
});
