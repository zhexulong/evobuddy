function normalize(text) {
  return String(text ?? '').toLowerCase();
}

function includesPhrase(text, phrase) {
  return normalize(text).includes(normalize(phrase));
}

export function assertRequiredBehavior({ text, requiredPhrases = [], forbiddenPhrases = [] }) {
  const issues = [];
  for (const phrase of requiredPhrases) if (!includesPhrase(text, phrase)) issues.push(`missing required phrase: ${phrase}`);
  for (const phrase of forbiddenPhrases) if (includesPhrase(text, phrase)) issues.push(`contains forbidden phrase: ${phrase}`);
  return { status: issues.length === 0 ? 'pass' : 'fail', issues };
}

export function evaluateBehaviorDelta(input) {
  const issues = [];
  const beforeText = input?.beforeRun?.outputText ?? '';
  const afterText = input?.afterRun?.outputText ?? '';
  const expected = input?.expectedDelta ?? {};
  const afterRequired = assertRequiredBehavior({ text: afterText, requiredPhrases: expected.requiredAfterPhrases ?? [] });
  const beforeForbidden = assertRequiredBehavior({ text: beforeText, forbiddenPhrases: expected.forbiddenBeforePhrases ?? [] });
  if (afterRequired.status !== 'pass') issues.push(...afterRequired.issues);
  if (beforeForbidden.status !== 'pass') issues.push(...beforeForbidden.issues.map((issue) => `before run ${issue}`));
  if (input?.patch?.status !== 'applied') issues.push(`expected patch status applied, got ${input?.patch?.status ?? 'missing'}`);
  if (!input?.versionChange || input.versionChange.beforeVersion === input.versionChange.afterVersion) issues.push('expected Buddy version to change');
  return { status: issues.length === 0 ? 'pass' : 'fail', scenarioId: input?.scenarioId, buddyName: input?.buddyName, behaviorChanged: beforeText !== afterText, beforeMatchedForbidden: beforeForbidden.status !== 'pass', afterMatchedRequired: afterRequired.status === 'pass', patchApplied: input?.patch?.status === 'applied', versionChanged: input?.versionChange?.beforeVersion !== input?.versionChange?.afterVersion, issues };
}
