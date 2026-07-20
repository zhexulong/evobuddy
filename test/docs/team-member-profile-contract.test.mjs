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

// ── Team Member Profile Contract ──────────────────────────────────────

describe('team member profile contract docs', () => {
  const text = readDoc('docs/contracts/team-member-profile-contract.md');

  it('requires all eight required fields', () => {
    assert.match(text, /`name`/);
    assert.match(text, /`description`/);
    assert.match(text, /`role`/);
    assert.match(text, /`responsibilities`/);
    assert.match(text, /`standardsRefs`/);
    assert.match(text, /`roleMemoryRefs`/);
    assert.match(text, /`activationHints`/);
    assert.match(text, /`negativeActivationHints`/);
  });

  it('requires name to be stable kebab-case', () => {
    assert.match(text, /kebab-case/i);
    assert.match(text, /lowercase letters.*digits.*hyphens|\[a-z\]\[a-z0-9-\]/i);
  });

  it('requires name to express reusable responsibility not one-off task', () => {
    assert.match(text, /reusable responsibility|express.*responsibility/i);
    assert.match(text, /not.*one-off|not.*transient|not.*date.*session/i);
  });

  it('distinguishes stable user-facing memberName from runtimeAgentId', () => {
    assert.match(text, /memberName.*runtimeAgentId|Member Name vs Runtime Agent ID/i);
    assert.match(text, /stable user-facing/i);
    assert.match(text, /ephemeral.*runtime.*identifier|ephemeral host-platform instance id/i);
    assert.match(text, /must not be conflated|must not.*substitute|distinct/i);
  });

  it('states profile files are identity inputs not evidence of material consumption', () => {
    assert.match(text, /not.*evidence.*spawned member saw|not.*evidence.*consumption/i);
    assert.match(text, /identity inputs/i);
    assert.match(text, /does NOT certify|does NOT prove/i);
  });

  it('requires description to be routing/trigger language not capability advertisement', () => {
    assert.match(text, /routing.*trigger|trigger condition|when to activate/i);
    assert.match(text, /not.*capability advertisement|not a generic capability/i);
    assert.match(text, /Use when writing or reviewing|Use when/i);
  });

  it('forbids post-hoc member relabeling without memberTaskRequestRef or equivalent evidence', () => {
    assert.match(text, /post-hoc.*relabel|relabel.*prohibited|relabeling.*forbidden/i);
    assert.match(text, /memberTaskRequestRef/i);
    assert.match(text, /runtime.*provider.*evidence|runtime\/provider evidence/i);
  });

  it('distinguishes confirmed profiles from MemberProfileCandidate suggestions', () => {
    assert.match(text, /confirmed profile/i);
    assert.match(text, /MemberProfileCandidate/i);
    assert.match(text, /suggested Expert|建议的 Expert/i);
    assert.match(text, /defaultExpert: false/i);
    assert.match(text, /Confirm \/ Rename \/ Add to existing Expert \/ Discard/i);
    assert.match(text, /must not.*default Expert/i);
  });
});
