import assert from 'node:assert/strict';
import test from 'node:test';

import { validateGeneratedSkillProjection } from '../../src/core/evobuddy-generated-skill-projection.mjs';

test('accepts Skill wrapper with SOP refs', () => {
  const result = validateGeneratedSkillProjection({
    skillRef: 'projections/codex/skills/evolution-agent/SKILL.md',
    skillMarkdown: '---\nname: evolution-agent\n---\n# Skill\nThis is an activation wrapper.\nRead knowledge/sops/evolution-stable-mutation.md first.',
  });

  assert.equal(result.status, 'pass');
  assert.deepEqual(result.sopRefs, ['knowledge/sops/evolution-stable-mutation.md']);
});

test('rejects Skill claiming canonical SOP ownership', () => {
  assert.throws(
    () => validateGeneratedSkillProjection({
      skillRef: 'skills/bad/SKILL.md',
      skillMarkdown: '# Bad\nThis SKILL.md is the canonical SOP source for the project.',
    }),
    /Skill must not claim canonical SOP ownership/,
  );
});

test('rejects old ontology refs', () => {
  assert.throws(
    () => validateGeneratedSkillProjection({
      skillRef: 'skills/bad/SKILL.md',
      skillMarkdown: '# Bad\nRead .evobuddy/workflows/release.md',
    }),
    /forbidden EvoBuddy ontology ref/,
  );
});
