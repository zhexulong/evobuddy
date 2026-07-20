import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { assertNoRetainedRawDbArtifacts, scanRetainedRawDbArtifacts } from '../../src/core/retained-artifact-guard.mjs';

describe('retained artifact guard', () => {
  it('reports retained SQLite and DB files under scanned roots', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-retained-artifact-guard-'));
    try {
      mkdirSync(join(root, 'nested'), { recursive: true });
      writeFileSync(join(root, 'session-corpus-export.json'), '{}\n', 'utf8');
      writeFileSync(join(root, 'runtime.sqlite'), 'raw sqlite bytes', 'utf8');
      writeFileSync(join(root, 'nested', 'runtime.sqlite3'), 'raw sqlite3 bytes', 'utf8');
      writeFileSync(join(root, 'nested', 'runtime.db'), 'raw db bytes', 'utf8');

      const result = scanRetainedRawDbArtifacts([root]);

      assert.equal(result.status, 'fail');
      assert.deepEqual(result.artifacts.map((artifact) => artifact.extension).sort(), ['.db', '.sqlite', '.sqlite3']);
      assert.equal(result.artifacts.every((artifact) => artifact.root === root), true);
      assert.match(result.issues.join('\n'), /runtime\.sqlite/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes when retained roots contain extracted evidence only', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-retained-artifact-guard-pass-'));
    try {
      mkdirSync(join(root, 'nested'), { recursive: true });
      writeFileSync(join(root, 'session-corpus-export.json'), '{}\n', 'utf8');
      writeFileSync(join(root, 'nested', 'notes.txt'), 'not a raw database', 'utf8');

      const result = scanRetainedRawDbArtifacts([root]);

      assert.deepEqual(result, { status: 'pass', artifacts: [], issues: [], blockedReasons: [] });
      assert.doesNotThrow(() => assertNoRetainedRawDbArtifacts([root]));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws with retained artifact details when assertion fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-retained-artifact-guard-throw-'));
    try {
      writeFileSync(join(root, 'opencode.db'), 'raw db bytes', 'utf8');

      assert.throws(() => assertNoRetainedRawDbArtifacts([root]), /retained raw DB artifacts.*opencode\.db/is);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
