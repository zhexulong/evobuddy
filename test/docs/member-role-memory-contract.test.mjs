import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('member-role-memory contract', () => {
  it('documents role memory lifecycle and host-applied dreamer manifests', () => {
    const text = readFileSync('docs/contracts/member-role-memory-contract.md', 'utf8');
    for (const token of [
      'MemberRoleMemory',
      'RoleMemoryCandidate',
      'MemberRoleMemoryMutationLog',
      'MemberDreamerRun',
      'candidate',
      'active',
      'archived',
      'superseded',
      'host-applied',
    ]) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(text, /wrong archive|wrong archival|conservative archive/is);
  });

  it('documents candidate creation boundary and excludes parent-agent guessed candidates', () => {
    const text = readFileSync('docs/contracts/member-role-memory-contract.md', 'utf8');

    for (const token of [
      'creationSource',
      'sourceAuthority',
      'retrospective-learning',
      'explicit-remember',
      'import-migration',
      'eval-correction-loop',
      'parent-agent-observation',
      'agent-guessed',
      'legacy-v0',
    ]) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    assert.match(text, /parent-agent[\s\S]{0,120}(excluded|rejected|not allowed|must not)/i);
    assert.match(text, /sourceRefs[\s\S]{0,120}non-empty/i);
  });

  it('documents workspace-session cold-start candidates as unconfirmed and non-baseline', () => {
    const text = readFileSync('docs/contracts/member-role-memory-contract.md', 'utf8');

    for (const token of [
      'workspace-session-derived',
      'session corpus',
      'root sessions',
      'subagent',
      'default Expert',
      'member-m[0]',
    ]) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    assert.match(text, /session corpus[\s\S]{0,180}candidate/i);
    assert.match(text, /docs-only[\s\S]{0,180}(must not|cannot|not).*default Expert/i);
  });

  it('documents maintenance manifests as proposals with host-applied mutation logs', () => {
    const text = readFileSync('docs/contracts/member-role-memory-contract.md', 'utf8');

    for (const token of [
      'validateVerifyRoleMemoryManifest',
      'validateClassifyRoleMemoryManifest',
      'applyHostRoleMemoryMutations',
      'targetLifecycleStatus',
      'defaultVisibility: "m0"',
      'mutationLog',
    ]) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    assert.match(text, /archive.*supersede.*source evidence|supersede.*archive.*source evidence/is);
    assert.match(text, /m0.*only.*active memory|active memory.*m0/is);
    assert.match(text, /manifest.*not.*mutation|manifest.*proposal/is);
  });

  it('documents setup/import merge as candidate-to-existing-member without m0 promotion', () => {
    const text = readFileSync('docs/contracts/member-role-memory-contract.md', 'utf8');

    assert.match(text, /candidate\/searchable first|candidate.*searchable/i);
    assert.match(text, /merge_candidate_into_member/i);
    assert.match(text, /MemberProfileCandidate -> existing member/i);
    assert.match(text, /Add to existing Expert/i);
    assert.match(text, /candidate role memory.*not.*active/is);
    assert.match(text, /not.*member-m\[0\]/i);
  });
});
