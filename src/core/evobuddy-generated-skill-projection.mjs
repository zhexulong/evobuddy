const SOP_REF_PATTERN = /(?:^|[\s`'"(])((?:\.evobuddy\/)?knowledge\/sops\/[A-Za-z0-9._/-]+\.md)(?=$|[\s`'"),.])/g;
const FORBIDDEN_REF_PATTERNS = [
  /(^|\s|[`'"])\.evobuddy\/library\//,
  /(^|\s|[`'"])\.evobuddy\/workflows\//,
  /(^|\s|[`'"])\.evobuddy\/practices\//,
  /(^|\s|[`'"])\.evobuddy\/evidence\//,
];
const CANONICAL_CLAIM_PATTERN = /SKILL\.md\s+is\s+the\s+canonical|canonical\s+SOP\s+source|canonical\s+procedure\s+source/i;

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function normalizeSopRef(ref) {
  return ref.replace(/^\.evobuddy\//, '');
}

export function validateGeneratedSkillProjection({ skillMarkdown, skillRef }) {
  const markdown = requireString(skillMarkdown, 'skillMarkdown');
  const ref = requireString(skillRef, 'skillRef');

  if (!ref.endsWith('/SKILL.md') && !ref.endsWith('SKILL.md')) throw new Error('skillRef must point to SKILL.md');
  if (CANONICAL_CLAIM_PATTERN.test(markdown)) throw new Error('Skill must not claim canonical SOP ownership');

  for (const pattern of FORBIDDEN_REF_PATTERNS) {
    if (pattern.test(markdown)) throw new Error('forbidden EvoBuddy ontology ref');
  }

  const sopRefs = [...markdown.matchAll(SOP_REF_PATTERN)].map((match) => normalizeSopRef(match[1]));
  return {
    status: 'pass',
    skillRef: ref,
    sopRefs: [...new Set(sopRefs)],
    wrapperOnly: true,
  };
}
