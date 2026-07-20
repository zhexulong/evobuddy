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
