import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const SKILL_NAMES = [
  'context-tree-save-checkpoint',
  'context-tree-use-checkpoint',
];

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
  return value.trim();
}

export async function installContextTreeCodexSkills({ codexHome, sourceRoot }) {
  const resolvedCodexHome = resolve(requireNonEmptyString(codexHome, 'codexHome'));
  const resolvedSourceRoot = resolve(requireNonEmptyString(sourceRoot, 'sourceRoot'));
  const skillsRoot = resolve(resolvedCodexHome, 'skills');
  await mkdir(skillsRoot, { recursive: true });

  const installedSkillPaths = [];
  for (const skillName of SKILL_NAMES) {
    const sourceDir = resolve(resolvedSourceRoot, 'skills', skillName);
    const destDir = resolve(skillsRoot, skillName);
    await cp(sourceDir, destDir, { recursive: true, force: true });
    installedSkillPaths.push(destDir);
  }

  return {
    codexHome: resolvedCodexHome,
    skillsRoot,
    installedSkillPaths,
  };
}
