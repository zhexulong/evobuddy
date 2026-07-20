import { createHash } from 'node:crypto';
import { validateRoleMemoryCandidate } from './member-role-memory.mjs';

const FEEDBACK_MARKERS = [
  /不能|不应|不是|不要|别|错了|修正|改成|应该|未必|不一定/u,
  /wrong|incorrect|correction|corrected|should not|shouldn't|must not|do not|instead|not .* because/i,
];
const ORDINARY_FOLLOW_UP = /^(now|next|then|please|can you|could you|继续|然后|接着|现在)\b|another file|review another/i;
const DATE_MARKER = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i;
const ANGER_MARKER = /\b(?:stop|again and again|ignored?|frustrat(?:ed|ing|ion)|angry|mad|ridiculous|stupid|annoying)\b|别再|生气|愤怒|火大/u;
const GENERATED_AT = '1970-01-01T00:00:00.000Z';

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function escapeXmlText(text) {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function parseAttributes(rawAttributes) {
  const attributes = {};
  for (const match of rawAttributes.matchAll(/([A-Za-z][\w:-]*)\s*=\s*(["'])(.*?)\2/gs)) {
    attributes[match[1]] = escapeXmlText(match[3].trim());
  }
  return attributes;
}

function normalizeTokens(text) {
  return String(text)
    .toLowerCase()
    .replace(/[“”"'`.,;:!?()[\]{}，。！？、：；]/gu, ' ')
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function sourceOverlap(content, sourceUserTexts) {
  const contentTokens = new Set(normalizeTokens(content));
  if (contentTokens.size === 0) return 0;
  let highest = 0;
  for (const sourceText of sourceUserTexts ?? []) {
    const sourceTokens = new Set(normalizeTokens(sourceText));
    if (sourceTokens.size === 0) continue;
    let shared = 0;
    for (const token of contentTokens) if (sourceTokens.has(token)) shared += 1;
    highest = Math.max(highest, shared / contentTokens.size);
  }
  return highest;
}

function stableId(prefix, payload) {
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
  return `${prefix}-${digest}`;
}

export function createStableRetrospectiveId(prefix, payload) {
  return stableId(prefix, payload);
}

function isFeedbackText(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return false;
  if (ORDINARY_FOLLOW_UP.test(trimmed) && !FEEDBACK_MARKERS.some((marker) => marker.test(trimmed))) return false;
  return FEEDBACK_MARKERS.some((marker) => marker.test(trimmed));
}

export function detectMemberFeedbackWindow(input) {
  requireObject(input, 'input');
  requireObject(input.memberTaskRun, 'memberTaskRun');
  const memberName = requireString(input.memberTaskRun.memberName, 'memberTaskRun.memberName');
  const runId = requireString(input.memberTaskRun.id, 'memberTaskRun.id');
  if (input.memberTaskRun.result?.returnedTo !== 'parent-agent') return null;
  if (!Array.isArray(input.followingMessages)) return null;

  const feedbackMessages = input.followingMessages
    .filter((message) => message?.role === 'user' && isFeedbackText(message.text));
  if (feedbackMessages.length === 0) return null;

  const userMessageRefs = feedbackMessages.map((message, index) => `message:${message.messageId ?? `following-${index}`}`);
  const sourceUserTexts = feedbackMessages.map((message) => String(message.text).trim());
  const sourceRefs = [`member-task-run:${runId}`, ...userMessageRefs];
  return {
    id: stableId('feedback-window', { runId, userMessageRefs }),
    memberName,
    sourceRefs,
    userMessageRefs,
    sourceUserTexts,
  };
}

export function parseRetrospectiveLearningXml(text) {
  if (typeof text !== 'string' || !text.includes('<learnings')) return [];
  const block = text.match(/<learnings\b[^>]*>([\s\S]*?)<\/learnings>/i);
  if (!block) return [];
  const learnings = [];
  for (const match of block[1].matchAll(/<learning\b([^>]*)>([\s\S]*?)<\/learning>/gi)) {
    const attributes = parseAttributes(match[1] ?? '');
    const content = escapeXmlText(match[2].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' '));
    if (!content) continue;
    learnings.push({
      route: attributes.route ?? 'discard',
      ...(attributes.memberName ? { memberName: attributes.memberName } : {}),
      ...(attributes.type ? { type: attributes.type } : {}),
      content,
    });
  }
  return learnings;
}

export function validateRetrospectiveLearning(learning, sourceUserTexts = []) {
  requireObject(learning, 'learning');
  const route = requireString(learning.route, 'learning.route');
  const content = requireString(learning.content, 'learning.content');
  if (/["“”]/u.test(content) || /\buser said\b/i.test(content)) throw new Error('retrospective learning must distill, not quote or transcribe raw user text');
  if (DATE_MARKER.test(content)) throw new Error('retrospective learning must omit dates');
  if (ANGER_MARKER.test(content)) throw new Error('retrospective learning must omit frustration or anger markers');
  if (sourceOverlap(content, sourceUserTexts) >= 0.75) throw new Error('retrospective learning has high source overlap; distill instead of transcribe');
  if (route === 'member-memory') {
    requireString(learning.memberName, 'learning.memberName');
    requireString(learning.type, 'learning.type');
  }
  return {
    route,
    ...(learning.memberName !== undefined ? { memberName: requireString(learning.memberName, 'learning.memberName') } : {}),
    ...(learning.type !== undefined ? { type: requireString(learning.type, 'learning.type') } : {}),
    content,
  };
}

export function routeRetrospectiveLearning({ learning, memberName, sourceRefs, sourceUserTexts = [], confidence = 0.5 }) {
  const validated = validateRetrospectiveLearning(learning, sourceUserTexts);
  const refs = Array.isArray(sourceRefs) ? sourceRefs.filter((ref) => typeof ref === 'string' && ref.trim()) : [];
  if (validated.route !== 'member-memory') {
    return { kind: 'discard', route: 'discard', reason: 'learning route is not member-memory', learning: validated };
  }
  const targetMember = validated.memberName ?? memberName;
  if (!targetMember || (memberName && validated.memberName !== memberName)) {
    return { kind: 'discard', route: 'discard', reason: 'learning is not specific to this member', learning: validated };
  }
  if (refs.length === 0) return { kind: 'discard', route: 'discard', reason: 'missing source refs', learning: validated };

  const candidate = validateRoleMemoryCandidate({
    id: stableId('role-memory-candidate', { targetMember, content: validated.content, refs }),
    memberName: targetMember,
    proposedType: validated.type,
    content: validated.content,
    sourceRefs: refs,
    creationSource: 'retrospective-learning',
    sourceAuthority: 'host-applied',
    signalType: 'feedback',
    proposedDefaultVisibility: 'searchable',
    confidence,
    createdAt: GENERATED_AT,
    status: 'pending',
    metadata: { learningRoute: validated.route },
  });

  return {
    kind: 'role-memory-candidate',
    route: 'member-memory',
    creationSource: candidate.creationSource,
    sourceAuthority: candidate.sourceAuthority,
    memberName: targetMember,
    learning: validated,
    candidate,
  };
}
