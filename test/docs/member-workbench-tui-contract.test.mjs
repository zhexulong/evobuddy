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

describe('member workbench TUI contract docs', () => {
  const text = readDoc('docs/contracts/member-workbench-tui-contract.md');

  it('defines the read-only workbench boundary and primary model', () => {
    assert.match(text, /^# Member Workbench TUI Contract/m);
    assert.match(text, /read-only workbench/i);
    assert.match(text, /same artifacts/i);
    assert.match(text, /must not mutate artifacts|no artifact mutation/i);
    assert.match(text, /must not invoke runtime|no runtime invocation|does not execute runtime/i);
    assert.match(text, /Expert\s*->\s*TaskRun\[\]/i);
    assert.match(text, /runtime instance.*task runtime facet/i);
    assert.match(text, /Trace/i);
  });

  it('defines top-level model fields and expert display language', () => {
    for (const token of ['`expertKey`', '`displayName`', '`shortTitle`', '`runKind`']) {
      assert.match(text, new RegExp(token), `missing token ${token}`);
    }

    assert.match(text, /displayName.*user/i);
    assert.match(text, /expertKey.*aggregate|expertKey.*lookup/i);
    assert.match(text, /memberName.*stable/i);
  });

  it('defines allowed first-level status and run-kind words', () => {
    const allowedStatuses = [
      'Assigned',
      'Working',
      'Returned',
      'Applied',
      'Needs input',
      'Needs review',
      'Blocked',
      'Failed',
      'Archived',
    ];

    for (const status of allowedStatuses) {
      assert.match(text, new RegExp(`\\b${status.replace(' ', '\\s+')}\\b`), `missing status ${status}`);
    }

    const runKinds = [
      'Live run',
      'Local harness',
      'Test run',
      'Retained run',
      'Unknown run',
    ];

    for (const runKind of runKinds) {
      assert.match(text, new RegExp(`\\b${runKind.replace(' ', '\\s+')}\\b`), `missing run kind ${runKind}`);
    }
  });

  it('forbids first-level proof taxonomy labels in WorkBuddy language', () => {
    for (const forbidden of [
      'MECHANISM PASS',
      'PRODUCT PENDING',
      'PRODUCT PASS',
      'nativeSpawnPass',
      'authorized-natural-native-spawn',
      'authorized-explicit-member-activation',
    ]) {
      assert.match(text, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    assert.match(text, /forbidden.*first-level|must not appear.*first-level/i);
    assert.match(text, /proof taxonomy.*internal|trace.*debug/i);
  });

  it('defines trace, status mapping, run-kind mapping, and terminal rendering rules', () => {
    assert.match(text, /status mapping/i);
    assert.match(text, /run-kind mapping/i);
    assert.match(text, /terminal rendering rules/i);
    assert.match(text, /Trace.*collapsed by default|default.*collapsed/i);
    assert.match(text, /artifact path.*copy/i);
    assert.match(text, /Experts.*Tasks.*Detail.*Trace/is);
  });

  it('documents packet, result-return, memory, and suggestion boundaries without default expert authority', () => {
    assert.match(text, /Returned to.*accepted result-return evidence/i);
    assert.match(text, /Packet delivery: observed \| missing \| definition-only/i);
    assert.match(text, /Result return: parent-agent observed \| file-only \| unknown/i);
    assert.match(text, /Memory: active \| pending review \| searchable only/i);
    assert.match(text, /Suggestions: deferred \/ hidden from default Experts/i);
    assert.match(text, /docs-only.*not grouped as Experts by default|no expert authority/i);
    assert.match(text, /candidate.*not default Experts until confirmed|unconfirmed/i);
  });
});

describe('member surface V0 docs', () => {
  const text = readDoc('docs/member-surface-v0.md');

  it('explains the relationship between the static member surface and TUI workbench', () => {
    assert.match(text, /evidence\/report substrate|evidence and report substrate/i);
    assert.match(text, /TUI workbench/i);
    assert.match(text, /WorkBuddy-style terminal projection/i);
    assert.match(text, /same artifacts/i);
  });
});
