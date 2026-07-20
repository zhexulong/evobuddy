import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  compileSubagentBaseline,
  digestSubagentBaseline,
  renderSubagentBaselineMarkdownSection,
} from '../../src/core/subagent-baseline.mjs';

const profile = {
  name: 'skill-designer',
  description: 'Use when writing or reviewing Context Tree skills and trigger rules.',
  role: 'Skill Designer',
  responsibilities: ['Review skill trigger rules'],
  standardsRefs: ['docs/skills/context-tree-skill-rules.md'],
  roleMemoryRefs: ['docs/role-memory/skill-designer-corrections.md'],
  activationHints: ['skill design'],
  negativeActivationHints: ['native spawn debugging'],
};

function withProject(fn) {
  const root = mkdtempSync(join(tmpdir(), 'ctree-subagent-baseline-'));
  try {
    mkdirSync(join(root, 'docs/role-memory'), { recursive: true });
    writeFileSync(join(root, 'docs/role-memory/skill-designer-corrections.md'), 'Prefer symptom-driven trigger review before implementation details.\n', 'utf8');
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('subagent baseline compiler', () => {
  it('includes role memory content and digests', () => withProject((projectRoot) => {
    const baseline = compileSubagentBaseline({ memberName: 'skill-designer', profile, profileRef: 'members/skill-designer.json', projectRoot, roleMemoryRefs: profile.roleMemoryRefs, generatorVersion: 'test-v1' });
    const memory = baseline.baselineMaterials.find((material) => material.kind === 'role-memory');

    assert.equal(baseline.artifactKind, 'context-tree-subagent-baseline');
    assert.equal(memory.included, true);
    assert.equal(memory.includedContent, 'Prefer symptom-driven trigger review before implementation details.\n');
    assert.match(memory.sourceDigest, /^sha256:[0-9a-f]+$/);
    assert.match(memory.includedDigest, /^sha256:[0-9a-f]+$/);
    assert.match(baseline.baselineDigest, /^sha256:[0-9a-f]+$/);
    assert.equal(digestSubagentBaseline(baseline), baseline.baselineDigest);
  }));

  it('records unreadable role memory as known loss without invocation proof', () => withProject((projectRoot) => {
    const baseline = compileSubagentBaseline({ memberName: 'skill-designer', profile, profileRef: 'members/skill-designer.json', projectRoot, roleMemoryRefs: ['docs/role-memory/missing.md'], generatorVersion: 'test-v1' });
    const rendered = JSON.stringify(baseline);

    assert.equal(baseline.baselineMaterials[0].included, false);
    assert.ok(baseline.baselineMaterials[0].knownLosses.length > 0);
    assert.ok(baseline.knownLosses.length > 0);
    assert.doesNotMatch(rendered, /deliveryEvidence|resultReturnEvidence|MemberTaskRun|returnedTo/);
  }));

  it('changes digest when role memory content changes', () => withProject((projectRoot) => {
    const first = compileSubagentBaseline({ memberName: 'skill-designer', profile, profileRef: 'members/skill-designer.json', projectRoot, roleMemoryRefs: profile.roleMemoryRefs, generatorVersion: 'test-v1' });
    writeFileSync(join(projectRoot, 'docs/role-memory/skill-designer-corrections.md'), 'Changed role memory.\n', 'utf8');
    const second = compileSubagentBaseline({ memberName: 'skill-designer', profile, profileRef: 'members/skill-designer.json', projectRoot, roleMemoryRefs: profile.roleMemoryRefs, generatorVersion: 'test-v1' });

    assert.notEqual(first.baselineDigest, second.baselineDigest);
  }));

  it('renders baseline markdown sections and excludes task/proof fields', () => withProject((projectRoot) => {
    const baseline = compileSubagentBaseline({ memberName: 'skill-designer', profile, profileRef: 'members/skill-designer.json', projectRoot, roleMemoryRefs: profile.roleMemoryRefs, generatorVersion: 'test-v1' });
    const markdown = renderSubagentBaselineMarkdownSection(baseline);

    assert.match(markdown, /## EvoBuddy Subagent Baseline/);
    assert.match(markdown, /### Responsibilities/);
    assert.match(markdown, /### Standards refs/);
    assert.match(markdown, /### Activation hints/);
    assert.match(markdown, /### Negative activation hints/);
    assert.match(markdown, /### Role Memory/);
    assert.match(markdown, /Prefer symptom-driven trigger review before implementation details\./);
    assert.doesNotMatch(markdown, /member-m\[1\]|targetRefs|deliveryEvidence|resultReturnEvidence|proof canary/i);
  }));

  it('records truncation known losses and renders included content only', () => withProject((projectRoot) => {
    const baseline = compileSubagentBaseline({ memberName: 'skill-designer', profile, profileRef: 'members/skill-designer.json', projectRoot, roleMemoryRefs: profile.roleMemoryRefs, generatorVersion: 'test-v1', maxMaterialBytes: 20 });
    const material = baseline.baselineMaterials.find((entry) => entry.kind === 'role-memory');
    const markdown = renderSubagentBaselineMarkdownSection(baseline);

    assert.equal(material.truncated, true);
    assert.notEqual(material.sourceDigest, material.includedDigest);
    assert.equal(material.includedContent, 'Prefer symptom-drive');
    assert.match(material.knownLosses[0], /truncated from/);
    assert.match(markdown, /Prefer symptom-drive/);
    assert.doesNotMatch(markdown, /trigger review before implementation details/);
    assert.match(markdown, /Known loss:/);
  }));

  it('keeps baselineDigest stable when only output paths change', () => withProject((projectRoot) => {
    const first = compileSubagentBaseline({ memberName: 'skill-designer', profile, profileRef: 'members/skill-designer.json', projectRoot, roleMemoryRefs: profile.roleMemoryRefs, generatorVersion: 'test-v1', outputDir: 'one', runtimeDefinitionPath: 'agents/a.md' });
    const second = compileSubagentBaseline({ memberName: 'skill-designer', profile, profileRef: 'members/skill-designer.json', projectRoot, roleMemoryRefs: profile.roleMemoryRefs, generatorVersion: 'test-v1', outputDir: 'two', runtimeDefinitionPath: 'agents/b.md' });

    assert.equal(first.baselineDigest, second.baselineDigest);
  }));

  it('materializes bundled preset role memory from portable preset refs', () => withProject((projectRoot) => {
    const presetProfile = {
      name: 'evolution-buddy',
      description: 'Use when you need to interpret Buddy benchmark results, identify missing proof legs, or turn observed behavior into concrete improvement proposals.',
      role: 'Evolution Buddy',
      responsibilities: ['Interpret Buddy benchmark results'],
      standardsRefs: [],
      roleMemoryRefs: ['preset:product/evolution-buddy/BUDDY.md'],
      activationHints: ['benchmark review'],
      negativeActivationHints: ['direct user coding'],
    };
    const baseline = compileSubagentBaseline({
      memberName: 'evolution-buddy',
      profile: presetProfile,
      profileRef: 'preset:product/evolution-buddy',
      projectRoot,
      roleMemoryRefs: presetProfile.roleMemoryRefs,
      generatorVersion: 'test-v1',
    });
    const memory = baseline.baselineMaterials.find((material) => material.kind === 'role-memory');

    assert.equal(memory.ref, 'preset:product/evolution-buddy/BUDDY.md');
    assert.equal(memory.included, true);
    assert.match(memory.includedContent, /Evolution Buddy/);
    assert.doesNotMatch(JSON.stringify(baseline), /\/home\/prosumer\/agent\/context-tree/);
  }));
});
