import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function stripProofNoise(text) {
  return String(text ?? '')
    .replace(/sha256:[a-fA-F0-9]+/g, '')
    .replace(/\b(?:proof|digest|canary|baselineDigest|digestState)\b:?[\w.-]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortText(value) {
  const text = stripProofNoise(value);
  if (text.length <= 140) return text;
  return `${text.slice(0, 137).trimEnd()}...`;
}

function shortBullet(value) {
  const text = stripProofNoise(value);
  if (text.length <= 96) return text;
  return `${text.slice(0, 93).trimEnd()}...`;
}

const ROSTER_SUMMARY_TEXT = Object.freeze({
  'roster-activated': (change) => `Activated Buddy: ${change.buddyName}.`,
  'roster-available': (change) => `Made Buddy available: ${change.buddyName}.`,
  'roster-internal': (change) => `Kept internal Buddy hidden: ${change.buddyName}.`,
  'roster-archived': (change) => `Archived Buddy: ${change.buddyName}.`,
  'taskroom-evolution-handoff': (change) => `TaskRoom ${change.roomId} handed evolution update to ${change.targetRef} (${change.riskLevel}): ${change.summary}.`,
});

export function summarizeEvobuddyUpdates({ changes = [] } = {}) {
  const bullets = changes
    .map((change) => {
      const render = ROSTER_SUMMARY_TEXT[change?.kind];
      if (render) return render(change);
      if (cleanString(change?.text)) return shortText(change.text);
      return undefined;
    })
    .filter(Boolean)
    .map((bullet) => shortBullet(bullet));
  return { bullets };
}

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return undefined;
    throw error;
  }
}

async function readLedgerItems(state) {
  if (!existsSync(state.evolutionLedgerPath)) return [];
  const text = await readFile(state.evolutionLedgerPath, 'utf8');
  return text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line)).map((entry) => {
    const target = cleanString(entry.targetRef)?.replace(/^buddy:/, '') ?? cleanString(entry.targetKind) ?? 'EvoBuddy';
    const action = cleanString(entry.action) ?? 'updated';
    const fallback = `${action.replace(/-/g, ' ')} ${target}: ${entry.targetKind ?? 'change'}.`;
    return {
      kind: action === 'applied' ? 'applied-change' : 'pending-improvement',
      ref: cleanString(entry.patchId) ?? cleanString(entry.patchRef) ?? action,
      relatedRef: cleanString(entry.patchRef),
      createdAt: cleanString(entry.createdAt) ?? cleanString(entry.at) ?? '',
      text: shortText(cleanString(entry.summary) ?? fallback),
    };
  });
}

async function readRecentItems(state) {
  const recent = await readJsonIfExists(state.recentUpdatesPath);
  const sourceItems = Array.isArray(recent?.updates) ? recent.updates : [];
  return sourceItems.map((entry) => ({
    kind: cleanString(entry.kind) ?? 'applied-change',
    ref: cleanString(entry.ref) ?? cleanString(entry.patchId) ?? 'recent-update',
    relatedRef: cleanString(entry.relatedRef),
    createdAt: cleanString(entry.createdAt) ?? '',
    text: shortText(cleanString(entry.text) ?? cleanString(entry.summary) ?? 'Applied EvoBuddy update.'),
  }));
}

async function readProjectionItems(state) {
  try {
    const entries = await readdir(state.projectionsPath, { withFileTypes: true });
    const items = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const ref = join(state.projectionsPath, entry.name);
      const report = await readJsonIfExists(ref);
      if (!report) continue;
      items.push({
        kind: 'projection-sync',
        ref: entry.name,
        relatedRef: ref,
        createdAt: cleanString(report.createdAt) ?? cleanString(report.generatedAt) ?? '',
        text: shortText(cleanString(report.summary) ?? `Synced Buddy projections: ${report.status ?? 'updated'}.`),
      });
    }
    return items;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
    throw error;
  }
}

export async function buildRecentUpdateSummary({ projectRoot, limit = 10, createdAt = new Date().toISOString() }) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  const items = [...await readRecentItems(state), ...await readLedgerItems(state), ...await readProjectionItems(state)]
    .filter((item) => cleanString(item.text))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)) || String(right.ref).localeCompare(String(left.ref)))
    .slice(0, limit)
    .map((item) => ({ ...item, text: shortText(item.text) }));
  return { schemaVersion: 'evobuddy-update-summary-v1', generatedAt: createdAt, items };
}

export async function generateRecentUpdateSummary(input) {
  const state = resolveEvobuddyProjectState({ projectRoot: input.projectRoot });
  const summary = await buildRecentUpdateSummary(input);
  await mkdir(state.updatesPath, { recursive: true });
  const summaryPath = join(state.updatesPath, 'recent.json');
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return { ...summary, summaryPath };
}

export async function readRecentUpdateSummary({ projectRoot, limit = 10 }) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  const existing = await readJsonIfExists(join(state.updatesPath, 'recent.json'));
  if (existing?.schemaVersion === 'evobuddy-update-summary-v1') return { ...existing, items: (existing.items ?? []).slice(0, limit), summaryPath: join(state.updatesPath, 'recent.json') };
  return generateRecentUpdateSummary({ projectRoot, limit });
}
