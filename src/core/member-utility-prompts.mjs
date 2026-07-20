function normalizeSignalLabel(signal) {
  if (typeof signal === 'string' && signal.trim().length > 0) return signal.trim();
  if (signal && typeof signal === 'object' && typeof signal.signalKind === 'string') return signal.signalKind;
  return '';
}

export function buildMemberUtilityGatePrompt({ episodes, runtimeCoverage } = {}) {
  const episodeList = Array.isArray(episodes) ? episodes : [];
  const coverageNote = runtimeCoverage?.coverageLimitation
    ? `\n\nRuntime Coverage Limitation: ${runtimeCoverage.coverageLimitation}\nThis means some runtimes or user histories may not be represented in the episodes below. Consider this gap when assessing delegation opportunities.`
    : '';

  const episodeDescriptions = episodeList.map((ep) => {
    const signalKinds = (ep.utilitySignals || []).map(normalizeSignalLabel).filter(Boolean).join(', ');
    return `- ${ep.episodeRef} (session ${ep.sessionId}, runtime ${ep.runtime}, root: ${ep.rootStatus}): "${ep.summaryText}" — signals: ${signalKinds || 'none'}`;
  }).join('\n');

  return `You are a utility analysis tool evaluating whether a specialist teammate could reduce context burden, improve reliability, or lower cost for repeated work observed across sessions.

Your task: review the episodes below and determine whether delegating repeated specialist work to a dedicated teammate would be cheaper, more reliable, or less context-heavy than the current approach.

CRITICAL: Do not require explicit member naming in the evidence. A delegation opportunity may exist even when nobody says "let X handle this" — repeated specialist work patterns with consistent responsibilities are sufficient.

CRITICAL: Topic frequency alone is not sufficient evidence for a delegation opportunity. The work must exhibit a consistent responsibility boundary, specialized judgment, or reusable procedure that a designated teammate could own. Two episodes sharing a general topic like "code review" without consistent specialist work is not enough.

IMPORTANT: Return only valid JSON — no markdown, no code blocks, no explanatory text.

Expected JSON shape:
{
  "hasDelegationOpportunity": <boolean>,
  "episodeRefs": [<string, episode refs supporting this decision>],
  "reason": "<non-empty string explaining the decision>"
}${coverageNote}

Episodes:
${episodeDescriptions}`;
}

export function buildMemberUtilityProposalPrompt({ episodes } = {}) {
  const episodeList = Array.isArray(episodes) ? episodes : [];

  const episodeDescriptions = episodeList.map((ep) => {
    const signalKinds = (ep.utilitySignals || []).map(normalizeSignalLabel).filter(Boolean).join(', ');
    const refs = (ep.messageRefs || []).map((m) => `${m.ref} (digest: ${m.digest})`).join(', ');
    return `- ${ep.episodeRef}: "${ep.summaryText}" — signals: ${signalKinds || 'none'} — message refs: ${refs}`;
  }).join('\n');

  return `You are a utility proposal tool that generates structured teammate proposals from observed work patterns.

Based on the episodes below, propose one or more specialist teammates (members) that would reduce context burden, improve reliability, or lower cost. Each proposal must use ONLY these episode message refs and digests as evidence — do not invent references.

IMPORTANT: Return only valid JSON — no markdown, no code blocks, no explanatory text.

Expected JSON shape:
{
  "proposals": [
    {
      "memberName": "<kebab-case name>",
      "memberClass": "<one of: explicit-repeated-teammate | repeated-specialist-work | long-lived-context-owner>",
      "role": "<short role title>",
      "routingDescription": "<when to route to this member>",
      "responsibilities": ["<responsibility 1>", "<responsibility 2>"],
      "nonResponsibilities": ["<what this member explicitly does NOT do>"],
      "whenToUse": "<detailed guidance on when this member should be invoked>",
      "contextPack": "<what context/knowledge this member always carries>",
      "memoryPolicy": "<how this member's memory/state is managed across calls>",
      "returnContract": "<what the caller can expect in return from this member>",
      "contextBurdenReduction": "<how delegating to this member reduces context burden>",
      "whyReusable": "<why this member is reusable across sessions, not single-purpose>",
      "evidenceRefs": [
        { "ref": "<session:...message:...>", "digest": "<sha256:...>" }
      ],
      "negativeSignals": ["<known limitations or when NOT to use this member>"]
    }
  ]
}

Return {"proposals": []} when evidence is insufficient for any proposal.

Episodes:
${episodeDescriptions}`;
}
