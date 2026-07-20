import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PRODUCT_SOURCE_FILES = [
  'src/core/member-task-request.mjs',
  'src/core/member-invocation-packet.mjs',
  'src/core/member-context-render.mjs',
  'src/core/material-selection-report.mjs',
  'src/core/member-product-invocation.mjs',
  'src/core/buddy-product-invocation.mjs',
  'src/eval/explicit-member-activation-artifact.mjs',
  'scripts/context-tree/prepare-opencode-native-buddy-task.mjs',
  'scripts/context-tree/run-member-system-e2e-eval.mjs',
  'scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs',
  'scripts/context-tree/explicit-member-executor-fixture.mjs',
  'scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs',
];

const PRODUCT_CONSUMER_FILES = [
  'src/core/member-invocation-run-bundle.mjs',
  'src/core/explicit-member-task-run-record.mjs',
  'src/eval/explicit-member-activation-artifact.mjs',
  'src/eval/native-spawn-artifact.mjs',
];

const FORBIDDEN_PRODUCT_AUDIT_STRINGS = [
  'member-m[1]',
  'Material proof requirement',
  'repeat these visible proof canaries',
  'missing expected canary in executorOutput.answer',
];

describe('invocation artifact schema migration product guard', () => {
  it('keeps normal product sources free of legacy m1 and answer-canary proof requirements', () => {
    const violations = [];
    for (const filePath of PRODUCT_SOURCE_FILES) {
      const text = readFileSync(filePath, 'utf8');
      for (const forbidden of FORBIDDEN_PRODUCT_AUDIT_STRINGS) {
        if (text.includes(forbidden)) violations.push(`${filePath}: ${forbidden}`);
      }
    }

    assert.deepEqual(violations, []);
  });

  it('keeps product consumers from using finalM0Refs/finalM1Refs as visibility authority', () => {
    const violations = [];
    for (const filePath of PRODUCT_CONSUMER_FILES) {
      const text = readFileSync(filePath, 'utf8');
      for (const legacyField of ['finalM0Refs', 'finalM1Refs']) {
        if (text.includes(legacyField)) violations.push(`${filePath}: ${legacyField}`);
      }
    }

    assert.deepEqual(violations, []);
  });

  it('keeps deltaDigest off the first-level member surface baseline/report rendering', () => {
    const surfaceFiles = [
      'src/core/member-surface-view-model.mjs',
      'src/report/member-surface-html.mjs',
    ];
    const violations = surfaceFiles.filter((filePath) => readFileSync(filePath, 'utf8').includes('deltaDigest'));

    assert.deepEqual(violations, []);
  });
});
