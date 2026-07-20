import { createHash } from 'node:crypto';
import { sourceLooksNonGenuineEvidence } from './session-evidence-hygiene.mjs';

const MANIFEST_KIND = 'member-profile-candidate-manifest';
const MEMBER_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const EXPLICIT_MENTION_RE = /@([a-z][a-z0-9]*(?:[-_][a-z0-9]+)*)/gi;
const ENGLISH_DELEGATION_RE = /\b(?:let|use|ask|route|find)\s+(@?[a-z][a-z0-9]*(?:[-_\s][a-z0-9]+)*?)\s+(?:(?:to|for)\s+)?(?:review|check|inspect|audit|look(?:\s+up)?)\b/gi;
const ENGLISH_MEMBER_SHOULD_RE = /\b(@?[a-z][a-z0-9]*(?:[-_\s][a-z0-9]+)*)\s+(?:should|can|must)\s+(?:review|check|inspect|audit)\b/gi;
const CHINESE_DELEGATION_RE = /(?:让|找)\s*(@?[\p{Script=Latin}][\p{Script=Latin}\p{Number}_ -]*)\s*(?:看|审查|检查)/giu;

const BLOCKED_MEMBER_NAMES = new Set([
  'abc', 'api', 'app', 'apps', 'bug', 'build', 'cli', 'config', 'db', 'doc', 'docs', 'expert', 'file', 'files', 'fix', 'member', 'package', 'plan', 'readme', 'reviewer', 'src', 'test', 'tests', 'todo', 'version',
]);

const OPTIONAL_UTILITY_MEMBER_CLASSES = new Set(['explicit-repeated-teammate', 'repeated-specialist-work', 'long-lived-context-owner']);

const STOP_WORDS = new Set([
  'again', 'acceptance', 'after', 'agent', 'agents', 'also', 'and', 'ask', 'before', 'can', 'check', 'consistency', 'context', 'evidence', 'flow', 'for', 'from', 'guidance', 'inspect', 'must', 'please', 'produce', 'release', 'report', 'reports', 'review', 'routing', 'session', 'should', 'summarize', 'the', 'this', 'use', 'when', 'with',
]);

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function normalizeText(value) {
  return String(value ?? '').replace(/-\s+/g, '-').replace(/\s+/g, ' ').trim();
}

function normalizeMemberName(value) {
  const normalized = cleanString(value)?.replace(/^@/, '').replace(/-\s+/g, '-').replace(/\s+/g, '-').replace(/_/g, '-').toLowerCase();
  if (!normalized || !MEMBER_NAME_PATTERN.test(normalized)) return undefined;
  if (BLOCKED_MEMBER_NAMES.has(normalized) || /^v\d+$/.test(normalized)) return undefined;
  return normalized;
}

function extractExplicitMemberNames(textValue) {
  const text = normalizeText(textValue);
  const names = new Set();
  for (const match of text.matchAll(EXPLICIT_MENTION_RE)) {
    const name = normalizeMemberName(match[1]);
    if (name) names.add(name);
  }
  for (const match of text.matchAll(ENGLISH_DELEGATION_RE)) {
    const name = normalizeMemberName(match[1]);
    if (name) names.add(name);
  }
  for (const match of text.matchAll(ENGLISH_MEMBER_SHOULD_RE)) {
    const name = normalizeMemberName(match[1]);
    if (name) names.add(name);
  }
  for (const match of text.matchAll(CHINESE_DELEGATION_RE)) {
    const name = normalizeMemberName(match[1]);
    if (name) names.add(name);
  }
  return [...names];
}

function messageRef(message) {
  return `session:${message.sessionId}:message:${message.ordinal}`;
}

function runCorroboratesMember(run, memberName) {
  const values = [run?.memberName, run?.importedMemberName, run?.candidateMemberName, run?.ref, run?.path]
    .map((value) => cleanString(value))
    .filter(Boolean);
  return values.some((value) => normalizeMemberName(value) === memberName || value.includes(memberName));
}

function signalKindFromText(text) {
  if (/again|多次|repeated|每次/i.test(text)) return 'repeated delegation';
  if (/avoid|不要|不能|纠正|correction/i.test(text)) return 'correction';
  if (/review|check|检查|审查/i.test(text)) return 'recurring review standard';
  return 'repeated delegation';
}

function wordsFromMessages(messages) {
  const counts = new Map();
  for (const message of messages) {
    for (const word of normalizeText(message.text).toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []) {
      if (STOP_WORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function sourceLooksToolOrSearchLike(textValue) {
  return sourceLooksNonGenuineEvidence(normalizeText(textValue));
}

function isGenuineCandidateMessage(message) {
  const sourceKind = cleanString(message?.evidenceSourceKind);
  return !sourceKind || sourceKind === 'genuine-user-message';
}

function sourceEvidenceSummary({ memberName, messages, supportingRuns = [] }) {
  const memberParts = new Set(memberName.split('-').filter(Boolean));
  const uniqueEvidenceDigests = new Set(messages.map((message) => cleanString(message.digest)).filter(Boolean));
  const groundingTerms = wordsFromMessages(messages)
    .map(([word]) => word)
    .filter((word) => !memberParts.has(word) && !sourceLooksToolOrSearchLike(word))
    .slice(0, 6);
  const nonGenericEvidenceRefCount = messages.filter((message) => {
    const terms = wordsFromMessages([message]).map(([word]) => word).filter((word) => !memberParts.has(word));
    return terms.length >= 2 && !sourceLooksToolOrSearchLike(message.text) && isGenuineCandidateMessage(message);
  }).length;
  const directUserDelegationCount = messages.filter((message) => extractExplicitMemberNames(message.text).includes(memberName) && isGenuineCandidateMessage(message) && !sourceLooksToolOrSearchLike(message.text)).length;
  const supportingRunCount = asArray(supportingRuns).length;
  const sourceBacked = supportingRunCount > 0
    ? directUserDelegationCount >= 1
    : groundingTerms.length >= 2 && nonGenericEvidenceRefCount >= 2 && directUserDelegationCount >= 2;
  const status = sourceBacked ? 'source-backed' : 'regex-pattern-only';
  return {
    status,
    groundingTerms,
    groundingTermCount: groundingTerms.length,
    directUserDelegationCount,
    nonGenericEvidenceRefCount,
    supportingRunCount,
    uniqueEvidenceDigestCount: uniqueEvidenceDigests.size,
  };
}

function buildWindow({ memberName, nameKind, messages, scan, supportingRuns = [] }) {
  const sessionIds = [...new Set(messages.map((message) => message.sessionId))];
  const windowMessages = messages.map((message) => ({ sessionId: message.sessionId, ordinal: message.ordinal, text: normalizeText(message.text), ref: messageRef(message), digest: message.digest ?? sha256Json(message.text) }));
  const uniqueEvidenceDigestCount = new Set(windowMessages.map((message) => message.digest)).size;
  const evidenceCoverage = { rootSessionCount: sessionIds.length, messageCount: messages.length, supportingRunCount: supportingRuns.length, uniqueEvidenceDigestCount };
  return {
    artifactKind: 'member-role-need-window',
    projectIdentity: scan.projectIdentity,
    memberName,
    nameKind,
    matchKind: nameKind === 'explicit-user-name' ? 'explicit-member-delegation' : 'unnamed-role-need',
    sessionRefs: sessionIds.map((sessionId) => `session:${sessionId}`),
    messages: windowMessages,
    signalKinds: [...new Set(messages.map((message) => signalKindFromText(message.text)))],
    evidenceCoverage,
    supportingRuns,
    sourceEvidenceSummary: sourceEvidenceSummary({ memberName, messages: windowMessages, supportingRuns }),
    negativeSignals: [],
    promotionEligibility: { canCreateCandidate: true, reason: 'explicit user-named member window' },
    dreamerDiagnostics: { extractorKind: 'explicit-user-identity', extractorRun: false, proposedCandidateCount: 1, reason: 'member identity came from explicit user text or import/run corroboration; role/routing is conservative scaffold, not dreamer output' },
  };
}

export function buildMemberNeedWindows({ scan }) {
  requireObject(scan, 'scan');
  const messages = asArray(scan.scannedMessages).filter((message) => message?.role === 'user' && !message.isOverlap && cleanString(message.text));
  const byMember = new Map();
  for (const message of messages) {
    for (const memberName of extractExplicitMemberNames(message.text)) {
      const item = byMember.get(memberName) ?? [];
      item.push(message);
      byMember.set(memberName, item);
    }
  }

  const windows = [];
  for (const [memberName, memberMessages] of byMember.entries()) {
    const supportingRuns = asArray(scan.supportingRuns).filter((run) => runCorroboratesMember(run, memberName));
    windows.push(buildWindow({ memberName, nameKind: 'explicit-user-name', messages: memberMessages, scan, supportingRuns }));
  }

  return windows;
}

function roleFromWindow(window) {
  return `${window.memberName.split('-').map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(' ')} Candidate`;
}

function routingFromWindow(window) {
  return `Pending session-derived candidate for ${window.memberName.replaceAll('-', ' ')}; confirm routing, role, and responsibilities before promotion.`;
}

export function buildMemberCandidateManifest({ window }) {
  requireObject(window, 'window');
  if (window.promotionEligibility?.canCreateCandidate === false) throw new Error(window.promotionEligibility.reason ?? 'role-need window is not promotable');
  const memberName = cleanString(window.memberName);
  if (!memberName) throw new Error('memberName is required for candidate manifest promotion');
  const messages = asArray(window.messages);
  const evidenceRefs = messages.map((message) => ({ kind: 'session-message', ref: message.ref, digest: message.digest, memberName }));
  return {
    manifestKind: MANIFEST_KIND,
    projectIdentity: window.projectIdentity,
    memberName,
    role: roleFromWindow(window),
    routingDescription: routingFromWindow(window),
    responsibilities: [
      'Review recurring source-backed requests before candidate promotion.',
      'Check routing fit, responsibilities, and evidence quality for the observed role need.',
    ],
    evidenceRefs,
    evidenceCoverage: { ...window.evidenceCoverage },
    sessionRefs: asArray(window.sessionRefs),
    signalKinds: asArray(window.signalKinds),
    confidence: window.evidenceCoverage?.rootSessionCount >= 2 ? 0.78 : 0.61,
    negativeSignals: window.sourceEvidenceSummary?.status === 'source-backed' ? asArray(window.negativeSignals) : [...asArray(window.negativeSignals), 'regex-only'],
    supportingRuns: asArray(window.supportingRuns),
    sourceEvidenceSummary: window.sourceEvidenceSummary,
    sourceTexts: messages.map((message) => message.text),
    nameKind: window.nameKind,
    fallbackExtractor: 'deterministic-v0-conservative-source-backed-prefilter',
    extractorKind: 'explicit-user-identity-v0',
    roleRoutingSource: 'explicit-clean-user-identity-scaffold',
    dreamerExtractorRun: false,
  };
}

function stringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  const result = value.map((item, index) => {
    const text = cleanString(item);
    if (!text) throw new Error(`required non-empty string: ${name}[${index}]`);
    return text;
  });
  if (result.length === 0) throw new Error(`${name} must be non-empty`);
  return result;
}

function optionalStringArray(value, name) {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return stringArray([value], name);
  return stringArray(value, name);
}

function optionalString(value, name) {
  if (value === undefined) return undefined;
  const text = cleanString(value);
  if (!text) throw new Error(`required non-empty string: ${name}`);
  return text;
}

function optionalUtilityMetadata(input) {
  const metadata = {};
  if (input.memberClass !== undefined) {
    const memberClass = optionalString(input.memberClass, 'memberClass');
    if (!OPTIONAL_UTILITY_MEMBER_CLASSES.has(memberClass)) throw new Error('memberClass must be a known utility member class');
    metadata.memberClass = memberClass;
  }
  const nonResponsibilities = optionalStringArray(input.nonResponsibilities, 'nonResponsibilities');
  if (nonResponsibilities) metadata.nonResponsibilities = nonResponsibilities;
  const whenToUse = optionalStringArray(input.whenToUse, 'whenToUse');
  if (whenToUse) metadata.whenToUse = whenToUse;
  for (const field of ['contextPack', 'memoryPolicy', 'returnContract', 'contextBurdenReduction', 'utilityEvidenceSummary']) {
    const value = optionalString(input[field], field);
    if (value) metadata[field] = value;
  }
  return metadata;
}

function evidenceRefs(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('evidence refs are required');
  return value.map((item, index) => {
    if (typeof item === 'string') return { kind: item.startsWith('session:') ? 'session-message' : 'unknown', ref: item, digest: sha256Json(item) };
    requireObject(item, `evidenceRefs[${index}]`);
    const ref = cleanString(item.ref);
    const digest = cleanString(item.digest);
    if (!ref || !digest) throw new Error(`evidenceRefs[${index}] requires ref and digest`);
    return { ...item, ref, digest };
  });
}

function overlapRatio(source, candidate) {
  const sourceWords = new Set(normalizeText(source).toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []);
  const candidateWords = normalizeText(candidate).toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [];
  if (candidateWords.length === 0) return 0;
  return candidateWords.filter((word) => sourceWords.has(word)).length / candidateWords.length;
}

function assertNotRawQuote(manifest) {
  const sourceTexts = asArray(manifest.sourceTexts).map(normalizeText).filter(Boolean);
  const generatedTexts = [manifest.role, manifest.routingDescription, ...asArray(manifest.responsibilities)].map(normalizeText).filter(Boolean);
  for (const generated of generatedTexts) {
    if (/\b(?:today|yesterday|tomorrow|202\d|root-[a-z0-9-]+|message \d+)\b/i.test(generated)) throw new Error('manifest contains date/session-local wording');
    for (const source of sourceTexts) {
      if (source.length > 20 && source.includes(generated)) throw new Error('manifest appears to copy a raw quote');
      if (generated.length > 20 && overlapRatio(source, generated) > 0.85) throw new Error('manifest has excessive source overlap');
    }
  }
}

export function validateMemberCandidateManifest(input) {
  requireObject(input, 'manifest');
  if (input.manifestKind !== MANIFEST_KIND) throw new Error(`manifestKind must be ${MANIFEST_KIND}`);
  const memberName = normalizeMemberName(input.memberName);
  if (!memberName) throw new Error('memberName must be stable kebab-case and not a generic blocked term');
  const role = cleanString(input.role);
  const routingDescription = cleanString(input.routingDescription);
  if (!role) throw new Error('role is required');
  if (!routingDescription) throw new Error('routingDescription is required');
  if (input.defaultExpert === true) throw new Error('candidate manifests cannot request defaultExpert: true');
  const refs = evidenceRefs(input.evidenceRefs);
  if (refs.every((ref) => ref.kind !== 'session-message' && !String(ref.ref).startsWith('session:'))) throw new Error('evidence must include genuine session-message refs');
  if (refs.every((ref) => ['synthetic', 'handoff'].includes(ref.kind) || /synthetic|handoff/i.test(ref.ref))) throw new Error('synthetic/handoff-only evidence cannot create a candidate');
  const coverage = input.evidenceCoverage && typeof input.evidenceCoverage === 'object' ? input.evidenceCoverage : {};
  const rootSessionCount = Number.isInteger(coverage.rootSessionCount) ? coverage.rootSessionCount : 0;
  const supportingRunCount = Number.isInteger(coverage.supportingRunCount) ? coverage.supportingRunCount : asArray(input.supportingRuns).length;
  const uniqueEvidenceDigestCount = Number.isInteger(coverage.uniqueEvidenceDigestCount) ? coverage.uniqueEvidenceDigestCount : new Set(refs.map((ref) => ref.digest).filter(Boolean)).size;
  if (rootSessionCount < 2 && supportingRunCount === 0) throw new Error('root-session count below threshold without run/import corroboration');
  if (uniqueEvidenceDigestCount < 2 && supportingRunCount === 0) throw new Error('unique source digest count below threshold; duplicate evidence cannot satisfy cross-root coverage');
  if (coverage.syntheticOnly === true || coverage.handoffOnly === true || input.negativeSignals?.includes('synthetic-only') || input.negativeSignals?.includes('handoff-only')) throw new Error('synthetic/handoff-only evidence cannot create a candidate');
  const responsibilities = stringArray(input.responsibilities, 'responsibilities');
  if (asArray(input.negativeSignals).includes('regex-only')) throw new Error('regex-only evidence cannot create a candidate without source-backed responsibility and routing summary');
  assertNotRawQuote(input);
  const confidence = typeof input.confidence === 'number' && input.confidence >= 0 && input.confidence <= 1 ? input.confidence : 0;
  const utilityMetadata = optionalUtilityMetadata(input);
  return {
    manifestKind: MANIFEST_KIND,
    projectIdentity: cleanString(input.projectIdentity) ?? 'unknown-project',
    memberName,
    role,
    routingDescription,
    responsibilities,
    evidenceRefs: refs,
    evidenceCoverage: { rootSessionCount, messageCount: Number.isInteger(coverage.messageCount) ? coverage.messageCount : refs.length, supportingRunCount, uniqueEvidenceDigestCount },
    sessionRefs: asArray(input.sessionRefs).map((item) => cleanString(item)).filter(Boolean),
    signalKinds: asArray(input.signalKinds).map((item) => cleanString(item)).filter(Boolean),
    confidence,
    negativeSignals: asArray(input.negativeSignals).map((item) => cleanString(item)).filter(Boolean),
    supportingRuns: asArray(input.supportingRuns),
    sourceEvidenceSummary: input.sourceEvidenceSummary && typeof input.sourceEvidenceSummary === 'object' ? {
      status: cleanString(input.sourceEvidenceSummary.status) ?? 'unknown',
      groundingTerms: asArray(input.sourceEvidenceSummary.groundingTerms).map((item) => cleanString(item)).filter(Boolean),
      groundingTermCount: Number.isInteger(input.sourceEvidenceSummary.groundingTermCount) ? input.sourceEvidenceSummary.groundingTermCount : asArray(input.sourceEvidenceSummary.groundingTerms).length,
      directUserDelegationCount: Number.isInteger(input.sourceEvidenceSummary.directUserDelegationCount) ? input.sourceEvidenceSummary.directUserDelegationCount : 0,
      nonGenericEvidenceRefCount: Number.isInteger(input.sourceEvidenceSummary.nonGenericEvidenceRefCount) ? input.sourceEvidenceSummary.nonGenericEvidenceRefCount : 0,
      uniqueEvidenceDigestCount: Number.isInteger(input.sourceEvidenceSummary.uniqueEvidenceDigestCount) ? input.sourceEvidenceSummary.uniqueEvidenceDigestCount : uniqueEvidenceDigestCount,
    } : { status: 'unknown', groundingTerms: [], groundingTermCount: 0, directUserDelegationCount: 0, nonGenericEvidenceRefCount: 0, uniqueEvidenceDigestCount },
    nameKind: cleanString(input.nameKind) ?? 'unknown',
    fallbackExtractor: cleanString(input.fallbackExtractor) ?? 'deterministic-v0-conservative-source-backed-prefilter',
    roleRoutingSource: cleanString(input.roleRoutingSource) ?? 'unknown',
    dreamerExtractorRun: input.dreamerExtractorRun === true,
    ...utilityMetadata,
  };
}

export function manifestToMemberProfileCandidate(manifest) {
  const validated = validateMemberCandidateManifest(manifest);
  const sourceRefDigests = Object.fromEntries(validated.evidenceRefs.map((ref) => [ref.ref, ref.digest]));
  return {
    id: `candidate:${validated.memberName}:session-cold-start`,
    memberName: validated.memberName,
    projectIdentity: validated.projectIdentity,
    role: validated.role,
    routingDescription: validated.routingDescription,
    responsibilities: validated.responsibilities,
    status: 'candidate',
    defaultExpert: false,
    sessionRefs: validated.sessionRefs,
    signalKinds: validated.signalKinds,
    confidence: validated.confidence,
    evidenceRefs: validated.evidenceRefs,
    sourceRefDigests,
    sourceKinds: ['session'],
    sourceAuthority: 'session-derived-unconfirmed',
    evidenceCoverage: validated.evidenceCoverage,
    negativeSignals: validated.negativeSignals,
    sourceEvidenceSummary: validated.sourceEvidenceSummary,
    roleRoutingSource: validated.roleRoutingSource,
    ...optionalUtilityMetadata(validated),
  };
}
