import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const SUPPORTED_KINDS = new Set(['practice', 'loop-harness']);
const SUPPORTED_STATUSES = new Set(['candidate', 'active', 'retired']);
const SUPPORTED_RISK_LEVELS = new Set(['low', 'medium', 'high']);

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '-');
}

function parseSimpleFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/u.exec(text);
  if (!match) throw new Error('practice markdown must start with frontmatter');
  const [, frontmatterText, body] = match;
  const metadata = {};
  for (const line of frontmatterText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) throw new Error(`invalid practice frontmatter line: ${trimmed}`);
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    metadata[key] = rawValue;
  }
  metadata.body = body.trim();
  metadata.sourceRefs = metadata.sourceRefs ? metadata.sourceRefs.split('|').map((item) => item.trim()).filter(Boolean) : [];
  return metadata;
}

function renderPracticeMarkdown(practice) {
  return [
    '---',
    `schemaVersion: ${practice.schemaVersion}`,
    `name: ${practice.name}`,
    `kind: ${practice.kind}`,
    `summary: ${practice.summary}`,
    `sourceRefs: ${practice.sourceRefs.join(' | ')}`,
    `createdByBuddy: ${practice.createdByBuddy}`,
    `riskLevel: ${practice.riskLevel}`,
    `status: ${practice.status}`,
    '---',
    '',
    practice.body,
    '',
  ].join('\n');
}

export function validatePracticeArtifact(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('practice must be an object');
  if (value.schemaVersion !== 'evobuddy-practice-v1') throw new Error(`unsupported practice schemaVersion: ${value.schemaVersion}`);
  if (!value.name || typeof value.name !== 'string') throw new Error('practice.name is required');
  if (safeName(value.name) !== value.name) throw new Error('practice.name must be path-safe');
  if (!SUPPORTED_KINDS.has(value.kind)) throw new Error(`unsupported practice kind: ${value.kind}`);
  if (!value.summary || typeof value.summary !== 'string') throw new Error('practice.summary is required');
  if (!value.body || typeof value.body !== 'string') throw new Error('practice.body is required');
  if (!Array.isArray(value.sourceRefs) || value.sourceRefs.length === 0) throw new Error('practice.sourceRefs must be non-empty');
  if (value.createdByBuddy !== 'evolution-buddy') throw new Error('practice.createdByBuddy must be evolution-buddy');
  if (!SUPPORTED_RISK_LEVELS.has(value.riskLevel)) throw new Error(`unsupported practice riskLevel: ${value.riskLevel}`);
  if (!SUPPORTED_STATUSES.has(value.status)) throw new Error(`unsupported practice status: ${value.status}`);
  return JSON.parse(JSON.stringify(value));
}

export async function writePracticeArtifact({ projectRoot, practice }) {
  const valid = validatePracticeArtifact(practice);
  const dir = join(resolve(projectRoot), '.evobuddy', 'practices');
  await mkdir(dir, { recursive: true });
  const ref = join(dir, `${safeName(valid.name)}.md`);
  await writeFile(ref, renderPracticeMarkdown(valid), 'utf8');
  return ref;
}

export async function materializePracticeContext({ projectRoot, practiceName }) {
  const ref = join(resolve(projectRoot), '.evobuddy', 'practices', `${safeName(practiceName)}.md`);
  const parsed = parseSimpleFrontmatter(await readFile(ref, 'utf8'));
  const practice = validatePracticeArtifact(parsed);
  if (practice.status !== 'active') throw new Error(`practice is not active: ${practiceName}`);
  return {
    ref,
    practiceName: practice.name,
    text: `# ${practice.name}\n\n${practice.summary}\n\n${practice.body}\n`,
  };
}
