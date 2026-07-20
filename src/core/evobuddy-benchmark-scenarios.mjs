export const BENCHMARK_ARMS = Object.freeze([
  'plain-runtime',
  'evobuddy-no-orchestrator',
  'evobuddy-light-affordance',
  'evobuddy-evolved-loop',
  'omo-hosted-compatibility',
  'omo-only',
]);

export const SCENARIO_KINDS = Object.freeze([
  'implementation-plan-review',
  'code-review',
  'debugging-issue-resolution',
  'codebase-exploration',
  'external-reference-research',
  'buddy-definition-improvement',
  'release-proof-review',
  'eval-correction-loop',
  'feature-implementation-with-review',
  'second-similar-task-after-practice',
]);

const FIXED_WORKFLOW_PATTERNS = Object.freeze([
  /always\s+plan/i,
  /always\s+.*explore/i,
  /delegate.*by default/i,
  /continue until complete/i,
  /verify.*before.*complete/i,
  /planner.*critic.*executor/i,
]);

const LIGHT_AFFORDANCE_PATTERNS = Object.freeze([
  /EvoBuddy Buddies/i,
  /native Buddy/i,
  /recent updates/i,
  /evolution-buddy/i,
]);

export function validateBenchmarkArm(value) {
  if (!BENCHMARK_ARMS.includes(value)) throw new Error(`unknown benchmark arm: ${value}`);
  return value;
}

export function validateScenarioKind(value) {
  if (!SCENARIO_KINDS.includes(value)) throw new Error(`unknown scenario kind: ${value}`);
  return value;
}

export function classifyPromptInjection({ promptText = '', host = {} } = {}) {
  if (host.omoActive === true) {
    return { kind: 'omo-hosted', allowedForNativeEvoBuddy: false, reasons: ['OMO host metadata is active'] };
  }

  const text = String(promptText ?? '');
  const fixedReasons = FIXED_WORKFLOW_PATTERNS
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `matched fixed workflow pattern: ${pattern}`);
  if (fixedReasons.length > 0) {
    return { kind: 'fixed-workflow', allowedForNativeEvoBuddy: false, reasons: fixedReasons };
  }

  const lightMatches = LIGHT_AFFORDANCE_PATTERNS.filter((pattern) => pattern.test(text)).length;
  if (lightMatches > 0) {
    return { kind: 'light-affordance', allowedForNativeEvoBuddy: true, reasons: [`matched ${lightMatches} light affordance hints`] };
  }

  return { kind: 'none', allowedForNativeEvoBuddy: true, reasons: [] };
}
