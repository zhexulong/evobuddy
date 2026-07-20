import { createHash } from 'node:crypto';

export const TEAM_POLICY_PARSER_VERSION = 'evobuddy-team-policy-v0';

const DEFAULT_POLICY = Object.freeze({
  defaultMode: 'parent-first',
  forkBudget: Object.freeze({ maxActiveInstances: 1 }),
  autoFork: Object.freeze({ codeReview: false, implementation: false }),
  askBefore: Object.freeze({ destructiveAction: true }),
  destroy: Object.freeze({ idleMinutes: 60 }),
});

const DEFAULT_MODE_VALUES = new Set(['parent-first', 'team-preferred', 'manual-only']);

export function digestTeamPolicySource(markdown) {
  return `sha256:${createHash('sha256').update(String(markdown), 'utf8').digest('hex')}`;
}

export function defaultTeamPolicyMarkdown() {
  return `# EvoBuddy Team Policy

# V0 deterministic keys. Free prose below does not change policy state.
defaultMode: parent-first
forkBudget.maxActiveInstances: 1
autoFork.codeReview: false
autoFork.implementation: false
askBefore.destructiveAction: true
destroy.idleMinutes: 60
`;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function parseScalar(value) {
  const trimmed = String(value ?? '').trim();
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true';
  if (/^(yes|no)$/i.test(trimmed)) return trimmed.toLowerCase() === 'yes';
  if (/^(on|off)$/i.test(trimmed)) return trimmed.toLowerCase() === 'on';
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  return trimmed.replace(/^['"]|['"]$/g, '');
}

function setPolicyValue(policy, key, value) {
  if (key === 'defaultMode') policy.defaultMode = normalizeDefaultMode(value);
  else if (key === 'forkBudget' || key === 'forkBudget.maxActiveInstances') policy.forkBudget.maxActiveInstances = normalizePositiveInteger(value, 'forkBudget.maxActiveInstances');
  else if (key === 'autoFork.codeReview') policy.autoFork.codeReview = Boolean(value);
  else if (key === 'autoFork.implementation') policy.autoFork.implementation = Boolean(value);
  else if (key === 'askBefore.destructiveAction') policy.askBefore.destructiveAction = Boolean(value);
  else if (key === 'destroy.idleMinutes') policy.destroy.idleMinutes = normalizePositiveInteger(value, 'destroy.idleMinutes');
}

function normalizeDefaultMode(value) {
  const normalized = requireString(String(value), 'defaultMode');
  if (!DEFAULT_MODE_VALUES.has(normalized)) throw new Error(`invalid defaultMode: ${normalized}`);
  return normalized;
}

function normalizePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`required non-negative integer: ${name}`);
  return value;
}

function emptyPolicy() {
  return {
    defaultMode: DEFAULT_POLICY.defaultMode,
    forkBudget: { ...DEFAULT_POLICY.forkBudget },
    autoFork: { ...DEFAULT_POLICY.autoFork },
    askBefore: { ...DEFAULT_POLICY.askBefore },
    destroy: { ...DEFAULT_POLICY.destroy },
  };
}

function extractFrontmatter(markdown) {
  const normalized = markdown.replaceAll('\r\n', '\n');
  if (!normalized.startsWith('---\n')) return null;
  const end = normalized.indexOf('\n---', 4);
  if (end === -1) throw new Error('unterminated team policy frontmatter');
  return normalized.slice(4, end).trimEnd();
}

function parseFrontmatterObject(frontmatter) {
  const result = {};
  let currentKey = null;
  for (const rawLine of frontmatter.split(/\r?\n/)) {
    if (rawLine.trim().length === 0 || rawLine.trimStart().startsWith('#')) continue;
    const nested = rawLine.match(/^\s{2,}([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (nested && currentKey) {
      result[currentKey] ??= {};
      result[currentKey][nested[1]] = parseScalar(nested[2]);
      continue;
    }
    const top = rawLine.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (!top) continue;
    currentKey = top[1];
    result[currentKey] = top[2].trim().length === 0 ? {} : parseScalar(top[2]);
  }
  return result;
}

function applyFrontmatter(policy, data) {
  if (Object.hasOwn(data, 'defaultMode')) setPolicyValue(policy, 'defaultMode', data.defaultMode);
  if (Object.hasOwn(data, 'forkBudget')) {
    const value = typeof data.forkBudget === 'object' ? data.forkBudget.maxActiveInstances : data.forkBudget;
    setPolicyValue(policy, 'forkBudget.maxActiveInstances', value);
  }
  if (data.autoFork && typeof data.autoFork === 'object') {
    if (Object.hasOwn(data.autoFork, 'codeReview')) setPolicyValue(policy, 'autoFork.codeReview', data.autoFork.codeReview);
    if (Object.hasOwn(data.autoFork, 'implementation')) setPolicyValue(policy, 'autoFork.implementation', data.autoFork.implementation);
  }
  if (data.askBefore && typeof data.askBefore === 'object' && Object.hasOwn(data.askBefore, 'destructiveAction')) {
    setPolicyValue(policy, 'askBefore.destructiveAction', data.askBefore.destructiveAction);
  }
  if (data.destroy && typeof data.destroy === 'object' && Object.hasOwn(data.destroy, 'idleMinutes')) {
    setPolicyValue(policy, 'destroy.idleMinutes', data.destroy.idleMinutes);
  }
}

function applyDocumentedMarkdownKeys(policy, markdown) {
  const supportedKeys = new Set([
    'defaultMode',
    'forkBudget.maxActiveInstances',
    'autoFork.codeReview',
    'autoFork.implementation',
    'askBefore.destructiveAction',
    'destroy.idleMinutes',
  ]);
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#') || line.startsWith('-')) continue;
    const match = line.match(/^([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)?):\s*(.+)$/);
    if (!match || !supportedKeys.has(match[1])) continue;
    setPolicyValue(policy, match[1], parseScalar(match[2]));
  }
}

export function parseTeamPolicyMarkdown({ sourceRef, markdown }) {
  const normalizedSourceRef = requireString(sourceRef, 'sourceRef');
  const source = typeof markdown === 'string' ? markdown : String(markdown ?? '');
  const policy = emptyPolicy();
  const frontmatter = extractFrontmatter(source);
  if (frontmatter !== null) applyFrontmatter(policy, parseFrontmatterObject(frontmatter));
  else applyDocumentedMarkdownKeys(policy, source);
  return {
    sourceRef: normalizedSourceRef,
    parserVersion: TEAM_POLICY_PARSER_VERSION,
    ...policy,
  };
}

export function createTeamPolicyIndex({ sourceRef, markdown, generatedAt = new Date().toISOString() }) {
  const policy = parseTeamPolicyMarkdown({ sourceRef, markdown });
  return {
    generated: true,
    sourceRef: policy.sourceRef,
    sourceDigest: digestTeamPolicySource(markdown),
    generatedAt: requireString(generatedAt, 'generatedAt'),
    parserVersion: TEAM_POLICY_PARSER_VERSION,
    defaultMode: policy.defaultMode,
    forkBudget: policy.forkBudget,
    autoFork: policy.autoFork,
    askBefore: policy.askBefore,
    destroy: policy.destroy,
  };
}

export function validateTeamPolicyIndex({ index, markdown }) {
  if (!index || typeof index !== 'object' || Array.isArray(index)) throw new Error('required object: team policy index');
  if (index.generated !== true) throw new Error('team policy index must be generated');
  if (index.parserVersion !== TEAM_POLICY_PARSER_VERSION) throw new Error(`invalid team policy parserVersion: ${index.parserVersion}`);
  const actualDigest = digestTeamPolicySource(markdown);
  if (index.sourceDigest !== actualDigest) throw new Error('stale team policy index: sourceDigest does not match team-policy.md');
  const regenerated = createTeamPolicyIndex({ sourceRef: index.sourceRef, markdown, generatedAt: index.generatedAt });
  return { ...regenerated, sourceDigest: actualDigest };
}

function hardConstraintBlocks(hardConstraints) {
  const blockedReasons = [];
  if (hardConstraints.runtimeForkSupported === false) blockedReasons.push('runtime capability/exporter evidence does not allow fork proof');
  if (hardConstraints.actorAuthority === false) blockedReasons.push('actor authority hard constraint blocks fork');
  if (hardConstraints.budgetRemaining !== undefined && hardConstraints.budgetRemaining <= 0) blockedReasons.push('hard fork budget exhausted');
  if (hardConstraints.destructiveActionConfirmed === false) blockedReasons.push('destructive-action confirmation is required');
  if (hardConstraints.releaseProofAllowed === false) blockedReasons.push('release proof requirements block fork claim');
  return blockedReasons;
}

export function resolveTeamPolicyDecision({ policy, explicitRequest = {}, hardConstraints = {}, taskSignals = {} }) {
  const normalizedPolicy = policy?.parserVersion === TEAM_POLICY_PARSER_VERSION ? policy : parseTeamPolicyMarkdown({ sourceRef: '.evobuddy/team-policy.md', markdown: defaultTeamPolicyMarkdown() });
  const preference = explicitRequest.fork === true
    || (normalizedPolicy.defaultMode === 'team-preferred')
    || (taskSignals.kind === 'codeReview' && normalizedPolicy.autoFork.codeReview === true)
    || (taskSignals.kind === 'implementation' && normalizedPolicy.autoFork.implementation === true);
  const blockedReasons = hardConstraintBlocks(hardConstraints);

  if (blockedReasons.length > 0) {
    return { decision: 'blocked', reason: 'hard-constraints', preferred: preference, blockedReasons };
  }
  if (explicitRequest.workAlone === true) return { decision: 'parent-alone', reason: 'explicit-user-request', preferred: false, blockedReasons: [] };
  if (explicitRequest.fork === true) return { decision: 'fork', reason: 'explicit-user-request', preferred: true, blockedReasons: [] };
  if (preference) return { decision: 'fork', reason: 'policy-preference', preferred: true, blockedReasons: [] };
  return { decision: 'parent-alone', reason: 'policy-default', preferred: false, blockedReasons: [] };
}
