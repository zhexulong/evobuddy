import { runtimeLabel } from './member-discovery-runtime-coverage.mjs';

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSentenceList(labels) {
  if (labels.length === 0) return 'no identified runtimes';
  if (labels.length === 1) return `${labels[0]} only`;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

export function buildMemberNeedGatePrompt({ lines, runtimeCoverage } = {}) {
  const renderedLines = asArray(lines).map((line) => `${line.lineOrdinal}. ${cleanString(line.text) ?? ''}`).join('\n');

  let coveragePreamble;
  let limitationSuffix = '';

  if (runtimeCoverage && runtimeCoverage.representedRuntimes) {
    // Canonical coverage path
    const labels = [...new Set(runtimeCoverage.representedRuntimes)].map(runtimeLabel);
    coveragePreamble = `Coverage: evidence lines in this request come from ${toSentenceList(labels)}.`;
    if (runtimeCoverage.coverageLimitation) {
      limitationSuffix = ` ${runtimeCoverage.coverageLimitation}`;
    }
  } else {
    // Line-local coverage path
    const runtimes = [...new Set(asArray(lines).map((line) => cleanString(line.runtime)).filter(Boolean))];
    const labels = runtimes.length > 0 ? runtimes.map(runtimeLabel) : ['unknown'];
    coveragePreamble = `Coverage: evidence lines in this request come from ${toSentenceList(labels)}.`;
  }

  return [
    'Decide whether these transcript lines express reusable member/expert/team-role needs.',
    'Flag only needs for a reusable member, expert, specialist, or team-role boundary that could help across future tasks.',
    'Negatives: topic-only mentions such as "continue eval plan", ordinary implementation topics, status updates, and one-off tasks are not member needs.',
    'Negatives: workflow wrappers, tool outputs, controller boilerplate, and internal markers are excluded even if they mention agents or review words.',
    'Do not use fixed topic-to-name mappings; topics like eval, proof, graph, or evidence do not imply a member name.',
    'Output exactly one line: n or y: <ordinals>. Use only the displayed line ordinals.',
    '',
    `${coveragePreamble}${limitationSuffix}`,
    '',
    renderedLines,
  ].join('\n');
}

export function buildMemberCandidateExtractorPrompt({ window } = {}) {
  const messages = asArray(window?.messages).map((message) => `- ${message.ref} ${message.digest}: ${cleanString(message.text) ?? ''}`).join('\n');
  return [
    'Extract reusable member/expert/team-role candidate proposals from this semantic need window.',
    'Return JSON only with shape: { "proposals": [{ "memberName": "kebab-case-name", "role": "short role", "routingDescription": "when to use this member", "responsibilities": ["one", "two"], "evidenceRefs": [{ "ref": "session:...", "digest": "sha256:..." }], "whyReusable": "why this is not a one-off task", "negativeSignals": [] }] }.',
    'Zero proposals is valid when evidence is topic-only, one-off, wrapper-like, or insufficient.',
    'Use evidenceRefs only from the provided window messages.',
    'No fixed topic-to-name mappings; derive memberName only from the reusable role need.',
    'No raw quote copying from source text into role, routingDescription, or responsibilities; summarize abstractly.',
    '',
    messages,
  ].join('\n');
}
