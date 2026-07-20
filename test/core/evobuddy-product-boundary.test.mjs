import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

function readRepo(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

describe('EvoBuddy product preset and fixture boundary documentation', () => {
  it('documents product preset BUDDY.md and registry metadata as authority', () => {
    const docs = [
      readRepo('README.md'),
      readRepo('docs/contracts/evobuddy-evolution-patch-contract.md'),
      readRepo('docs/superpowers/specs/2026-07-12-evobuddy-self-evolving-buddy-design.md'),
      readRepo('docs/superpowers/specs/2026-07-13-buddy-skill-co-evolution-design.md'),
    ].join('\n');
    assert.match(docs, /src\/presets\/buddies\/[^\s]+\/BUDDY\.md/);
    assert.match(docs, /preset registry metadata/i);
    assert.match(docs, /fixtures? remain retained test data only/i);
  });

  it('keeps a fixture README boundary if fixtures are retained', () => {
    const fixtureReadme = resolve(ROOT, 'fixtures/README.md');
    assert.equal(existsSync(fixtureReadme), true);
    const text = readFileSync(fixtureReadme, 'utf8');
    assert.match(text, /retained test data only/i);
    assert.match(text, /not authoritative product definitions/i);
    assert.match(text, /src\/presets\/buddies\/.*BUDDY\.md/);
  });
});
