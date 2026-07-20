import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { installContextTreeCodexSkills } from '../../src/install/codex-skill-install.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

describe('installContextTreeCodexSkills', () => {
  it('installs runtime skill assets into a temporary CODEX_HOME skills directory', async () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-codex-skill-install-'));
    try {
      const codexHome = join(runDir, 'codex-home');
      const installed = await installContextTreeCodexSkills({
        codexHome,
        sourceRoot: REPO_ROOT,
      });

      assert.deepEqual(installed.installedSkillPaths, [
        join(codexHome, 'skills/context-tree-save-checkpoint'),
        join(codexHome, 'skills/context-tree-use-checkpoint'),
      ]);

      for (const skillPath of installed.installedSkillPaths) {
        const skillFile = join(skillPath, 'SKILL.md');
        assert.ok(existsSync(skillFile), `expected installed skill file at ${skillFile}`);
        assert.match(readFileSync(skillFile, 'utf8'), /^---\nname:/m);
      }

      assert.ok(
        existsSync(join(REPO_ROOT, 'skills/context-tree-save-checkpoint/SKILL.md')),
        'source runtime skill asset should remain in the repository',
      );
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });
});
