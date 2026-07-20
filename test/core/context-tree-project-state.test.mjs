import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chdir, cwd } from 'node:process';
import {
  ensureContextTreeProjectState,
  resolveContextTreeProjectState,
} from '../../src/core/context-tree-project-state.mjs';

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

describe('context-tree project state resolver', () => {
  it('resolves stable .context-tree paths from arbitrary cwd', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-state-resolve-'));
    const previous = cwd();
    try {
      const nested = join(root, 'a/b/c');
      ensureContextTreeProjectState({ projectRoot: root });
      mkdirSync(nested, { recursive: true });
      chdir(nested);
      const state = resolveContextTreeProjectState({ projectRoot: root });
      assert.equal(state.projectRoot, resolve(root));
      assert.equal(state.stateRoot, join(resolve(root), '.context-tree'));
      assert.equal(state.registryPath, join(resolve(root), '.context-tree/registry.json'));
      assert.equal(state.mutationLogPath, join(resolve(root), '.context-tree/mutations.jsonl'));
      assert.match(state.importsPath, /\.context-tree\/imports$/);
      assert.match(state.runsPath, /\.context-tree\/runs$/);
      assert.match(state.projectionsPath, /\.context-tree\/projections$/);
      assert.match(state.instructionsPath, /\.context-tree\/instructions$/);
    } finally {
      chdir(previous);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('idempotently creates layout without overwriting registry or mutation log', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-state-setup-'));
    try {
      const first = ensureContextTreeProjectState({ projectRoot: root });
      assert.equal(readJson(first.registryPath).version, '1');
      writeFileSync(first.registryPath, '{"version":"1","members":[{"name":"kept"}] }\n', 'utf8');
      writeFileSync(first.mutationLogPath, '{"id":"kept"}\n', 'utf8');

      const second = ensureContextTreeProjectState({ projectRoot: root });
      assert.equal(second.created.registry, false);
      assert.equal(second.created.mutationLog, false);
      assert.match(readFileSync(second.registryPath, 'utf8'), /"kept"/);
      assert.equal(readFileSync(second.mutationLogPath, 'utf8'), '{"id":"kept"}\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
