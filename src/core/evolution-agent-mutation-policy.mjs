const RISK_LEVELS = new Set(['low', 'medium', 'high']);
const AUTHORITY_HEADINGS = ['## Authority', '## Tools and Authority'];

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function countNonBlankLines(text) {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function hasHeading(text, heading) {
  return text.split(/\r?\n/).some((line) => line.trim() === heading);
}

function deletionRatio(beforeText, afterText) {
  const before = countNonBlankLines(beforeText);
  const after = countNonBlankLines(afterText);
  if (before === 0) return 0;
  return Math.max(0, before - after) / before;
}

function unique(values) {
  return [...new Set(values)];
}

export function classifyEvolutionAgentMutation(input) {
  const targetRef = requireString(input?.targetRef, 'targetRef');
  const beforeText = requireString(input?.beforeText, 'beforeText');
  const afterText = requireString(input?.afterText, 'afterText');
  const declaredRiskLevel = requireString(input?.declaredRiskLevel ?? 'medium', 'declaredRiskLevel');
  const actorKind = requireString(input?.actorKind ?? 'team-agent', 'actorKind');
  const actorName = requireString(input?.actorName ?? 'evolution-agent', 'actorName');
  if (!RISK_LEVELS.has(declaredRiskLevel)) throw new Error(`invalid declaredRiskLevel: ${declaredRiskLevel}`);

  const reasons = [];
  if (actorKind !== 'team-agent' || actorName !== 'evolution-agent') reasons.push('invalid-evolution-actor');
  if (/agents\/evolution-agent\/AGENT\.md$/.test(targetRef)) reasons.push('self-change');
  if (deletionRatio(beforeText, afterText) > 0.35) reasons.push('large-deletion');
  for (const heading of AUTHORITY_HEADINGS) {
    if (hasHeading(beforeText, heading) && !hasHeading(afterText, heading)) reasons.push('authority-boundary-change');
  }
  if (/visibility"?\s*:\s*"active"/.test(beforeText) && /visibility"?\s*:\s*"archived"/.test(afterText)) reasons.push('active-roster-removal');

  const highRisk = reasons.length > 0;
  const riskLevel = highRisk ? 'high' : declaredRiskLevel;
  let status = 'pass';
  if (highRisk && declaredRiskLevel === 'high') status = 'pending-review';
  else if (highRisk) status = 'blocked';

  return {
    status,
    targetRef,
    actorKind,
    actorName,
    declaredRiskLevel,
    riskLevel,
    reasons: unique(reasons),
    deletionRatio: deletionRatio(beforeText, afterText),
  };
}

export function assertEvolutionAgentMutationAllowed(input) {
  const result = classifyEvolutionAgentMutation(input);
  if (result.status !== 'pass') {
    throw new Error(`evolution mutation blocked: ${result.status}: ${result.reasons.join(', ')}`);
  }
  return result;
}
