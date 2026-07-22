import { createHash } from 'node:crypto';

const RUNTIMES = new Set(['opencode', 'claude', 'codex']);
const PROOF_LAYERS = new Set(['nativeMechanism', 'naturalUse']);
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const OBVIOUS_PLACEHOLDER_DIGEST_PATTERN = /^sha256:(?:0{64}|1{64})$/;
const NEGATIVE_CONTROL_KEYS = [
  'adapterOnly',
  'projectionOnly',
  'retainedOnly',
  'summaryOnly',
  'answerCanaryOnly',
  'selfClaimOnly',
  'mechanismNamedPrompt',
];
const FAILING_NEGATIVE_CONTROL_KEYS = NEGATIVE_CONTROL_KEYS.filter((key) => key !== 'mechanismNamedPrompt');
const ALLOWED_TOP_LEVEL_INPUT_KEYS = new Set([
  'proofKind',
  'kind',
  'schemaVersion',
  'runtime',
  'actorKind',
  'memberName',
  'buddyName',
  'runtimeAgentName',
  'subagentName',
  'agentName',
  'actualSurface',
  'runtimeSurface',
  'proofLayer',
  'baselineDigest',
  'baselineDefinitionRef',
  'baselineDefinitionDigest',
  'parentSessionRef',
  'childSessionRef',
  'parentChildLink',
  'invocationPromptRef',
  'invocationPromptDigest',
  'childPromptDigest',
  'resultReturn',
  'resultReturnedToParent',
  'resultReturnEvidenceRef',
  'resultReturnEvidenceDigest',
  'exporterManifestRef',
  'exporterManifestDigest',
  'sourceTranscriptRef',
  'sourceTranscriptDigest',
  'observedTranscriptRef',
  'observedTranscriptDigest',
  'negativeControls',
  'knownLosses',
  'runtimeEvidence',
  'rawRefs',
  'parentPromptText',
  'userPromptText',
  'promptText',
  'baselineProjectionPass',
  'nativeMechanismPass',
  'naturalUsePass',
]);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (isObject(value)) {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stableClone(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha256StableJson(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex')}`;
}

function defaultNegativeControls() {
  return {
    adapterOnly: false,
    projectionOnly: false,
    retainedOnly: false,
    summaryOnly: false,
    answerCanaryOnly: false,
    selfClaimOnly: false,
    mechanismNamedPrompt: false,
  };
}

function sourcePromptText(input) {
  return [input?.parentPromptText, input?.userPromptText, input?.promptText].filter(nonEmptyString).join('\n');
}

function hasMechanismNamedPrompt(text) {
  if (!nonEmptyString(text)) return false;
  const instructionPattern = /\b(?:use|run|call|invoke(?![-_])|spawn(?![-_])|wait(?![-_])|delegate|launch|start|ask|open|trigger)\b[\s\S]{0,120}\b(?:ctree|invoke-buddy|spawn_agent|wait_agent|task|subagent)\b/i;
  const imperativePattern = /\b(?:ctree|invoke-buddy|spawn_agent|wait_agent|task|subagent)\b[\s\S]{0,80}\b(?:now|next|here|directly|instead|please)\b/i;
  return instructionPattern.test(text) || imperativePattern.test(text);
}

function hasObviousPlaceholderDigest(value) {
  return typeof value === 'string' && OBVIOUS_PLACEHOLDER_DIGEST_PATTERN.test(value);
}

function hasClaudePlaceholderSessionId(value) {
  if (!nonEmptyString(value)) return false;
  const id = value.replace(/^claude-session:/, '');
  return /^claude-(?:parent|child)-session$/i.test(id);
}

function addClaudePlaceholderIssues(issues, proof) {
  for (const [field, value] of [
    ['parentSessionRef', proof.parentSessionRef],
    ['childSessionRef', proof.childSessionRef],
    ['parentChildLink.parentId', proof.parentChildLink?.parentId],
    ['parentChildLink.childId', proof.parentChildLink?.childId],
    ['runtimeEvidence.sourceSessionIds.parentSessionId', proof.runtimeEvidence?.sourceSessionIds?.parentSessionId],
    ['runtimeEvidence.sourceSessionIds.childSessionId', proof.runtimeEvidence?.sourceSessionIds?.childSessionId],
  ]) {
    if (hasClaudePlaceholderSessionId(value)) issues.push(`${field} must not be a placeholder Claude session id`);
  }

  for (const [field, value] of [
    ['invocationPromptDigest', proof.invocationPromptDigest],
    ['runtimeEvidence.invocation.promptDigest', proof.runtimeEvidence?.invocation?.promptDigest],
    ['runtimeEvidence.childTranscript.promptDigest', proof.runtimeEvidence?.childTranscript?.promptDigest],
  ]) {
    if (hasObviousPlaceholderDigest(value)) issues.push(`${field} must not be an obvious placeholder digest`);
  }
}

function computeNegativeControls(input) {
  const controls = defaultNegativeControls();
  const supplied = isObject(input?.negativeControls) ? input.negativeControls : {};
  for (const key of NEGATIVE_CONTROL_KEYS) {
    if (typeof supplied[key] === 'boolean') controls[key] = supplied[key];
  }
  if (!controls.mechanismNamedPrompt) {
    controls.mechanismNamedPrompt = hasMechanismNamedPrompt(sourcePromptText(input));
  }
  return controls;
}

function computePasses(proof) {
  const observedRuntimeAgentName = proof.runtime === 'opencode'
    ? proof.runtimeEvidence?.observedRuntimeAgentName
    : undefined;
  const hasOpencodeObservedAgentMismatch = nonEmptyString(observedRuntimeAgentName)
    && observedRuntimeAgentName !== proof.runtimeAgentName;
  const hasCoreStructure = proof.actualSurface === 'runtime-native-subagent'
    && nonEmptyString(proof.runtime)
    && nonEmptyString(proof.memberName)
    && nonEmptyString(proof.runtimeAgentName)
    && nonEmptyString(proof.baselineDefinitionRef)
    && SHA256_PATTERN.test(proof.baselineDigest)
    && SHA256_PATTERN.test(proof.baselineDefinitionDigest)
    && nonEmptyString(proof.parentSessionRef)
    && nonEmptyString(proof.childSessionRef)
    && isObject(proof.parentChildLink)
    && proof.parentChildLink.kind === 'runtime-parent-child-link'
    && nonEmptyString(proof.parentChildLink.parentId)
    && nonEmptyString(proof.parentChildLink.childId)
    && nonEmptyString(proof.invocationPromptRef)
    && SHA256_PATTERN.test(proof.invocationPromptDigest)
    && isObject(proof.resultReturn)
    && proof.resultReturn.returnedTo === 'parent-agent'
    && nonEmptyString(proof.resultReturn.resultRef)
    && SHA256_PATTERN.test(proof.resultReturn.resultDigest)
    && nonEmptyString(proof.exporterManifestRef)
    && SHA256_PATTERN.test(proof.exporterManifestDigest)
    && nonEmptyString(proof.sourceTranscriptRef)
    && SHA256_PATTERN.test(proof.sourceTranscriptDigest);
  const negativeControls = proof.negativeControls ?? defaultNegativeControls();
  const hasFailingNegativeControl = FAILING_NEGATIVE_CONTROL_KEYS.some((key) => negativeControls[key] === true);
  const baselineProjectionPass = hasCoreStructure && !hasFailingNegativeControl && !hasOpencodeObservedAgentMismatch;
  const nativeMechanismPass = baselineProjectionPass;
  const naturalUsePass = nativeMechanismPass && proof.proofLayer === 'naturalUse' && negativeControls.mechanismNamedPrompt !== true;
  return { baselineProjectionPass, nativeMechanismPass, naturalUsePass };
}

function requiredStringIssues(issues, value, field) {
  if (!nonEmptyString(value)) issues.push(`${field} is required`);
}

function requiredDigestIssues(issues, value, field) {
  requiredStringIssues(issues, value, field);
  if (nonEmptyString(value) && !SHA256_PATTERN.test(value)) issues.push(`${field} must be a sha256 digest`);
}

function normalizeResultReturn(input) {
  if (isObject(input?.resultReturn)) {
    return {
      returnedTo: input.resultReturn.returnedTo,
      resultRef: input.resultReturn.resultRef,
      resultDigest: input.resultReturn.resultDigest,
    };
  }
  return {
    returnedTo: input?.resultReturnedToParent === true ? 'parent-agent' : undefined,
    resultRef: input?.resultReturnEvidenceRef,
    resultDigest: input?.resultReturnEvidenceDigest,
  };
}

function normalizedTopLevelKeySet() {
  return new Set([
    'proofKind',
    'schemaVersion',
    'runtime',
    'actorKind',
    'memberName',
    'runtimeAgentName',
    'actualSurface',
    'runtimeSurface',
    'proofLayer',
    'baselineProjectionPass',
    'nativeMechanismPass',
    'naturalUsePass',
    'baselineDigest',
    'baselineDefinitionRef',
    'baselineDefinitionDigest',
    'parentSessionRef',
    'childSessionRef',
    'parentChildLink',
    'invocationPromptRef',
    'invocationPromptDigest',
    'resultReturn',
    'exporterManifestRef',
    'exporterManifestDigest',
    'sourceTranscriptRef',
    'sourceTranscriptDigest',
    'negativeControls',
    'knownLosses',
    'runtimeEvidence',
    'parentPromptText',
  ]);
}

function explicitSourceRefSet(proof) {
  const refs = new Set();
  const candidates = [proof?.runtimeEvidence?.explicitSourceRefs];
  for (const candidateList of candidates) {
    if (!Array.isArray(candidateList)) continue;
    for (const candidate of candidateList) {
      if (nonEmptyString(candidate)) refs.add(candidate);
    }
  }
  return refs;
}

function sanitizeDigestValue(value, explicitSourceRefs, keyPath = []) {
  if (Array.isArray(value)) return value.map((item, index) => sanitizeDigestValue(item, explicitSourceRefs, [...keyPath, String(index)]));
  if (isObject(value)) {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sanitizeDigestValue(value[key], explicitSourceRefs, [...keyPath, key]);
      return acc;
    }, {});
  }
  if (typeof value === 'string') {
    const key = keyPath[keyPath.length - 1] ?? '';
    if (
      /^(outputDirectory|outputDir|outDir|outputRoot|productRoot)$/i.test(key)
      && value.startsWith('/')
      && !explicitSourceRefs.has(value)
    ) {
      return '[omitted-absolute-output-path]';
    }
  }
  return value;
}

export function classifyNativeBuddyNegativeControls(input = {}) {
  if (!isObject(input)) throw new Error('runtime-native Buddy proof input must be an object');
  return computeNegativeControls(input);
}

export function normalizeRuntimeNativeBuddySurfaceProof(input) {
  if (!isObject(input)) throw new Error('runtime-native Buddy proof input must be an object');
  const normalized = {
    proofKind: input.proofKind ?? input.kind ?? 'runtime-native-buddy-surface-proof',
    schemaVersion: input.schemaVersion ?? 'runtime-native-buddy-surface-proof-v1',
    runtime: input.runtime,
    actorKind: input.actorKind ?? 'subagent-buddy',
    memberName: input.memberName ?? input.buddyName,
    runtimeAgentName: input.runtimeAgentName ?? input.subagentName ?? input.agentName ?? input.memberName ?? input.buddyName,
    actualSurface: input.actualSurface,
    runtimeSurface: input.runtimeSurface,
    proofLayer: input.proofLayer,
    baselineDigest: input.baselineDigest,
    baselineDefinitionRef: input.baselineDefinitionRef,
    baselineDefinitionDigest: input.baselineDefinitionDigest,
    parentSessionRef: input.parentSessionRef ?? input.rawRefs?.parentSessionRef,
    childSessionRef: input.childSessionRef ?? input.rawRefs?.childSessionRef,
    parentChildLink: isObject(input.parentChildLink) ? {
      kind: input.parentChildLink.kind,
      parentId: input.parentChildLink.parentId,
      childId: input.parentChildLink.childId,
    } : input.parentChildLink,
    invocationPromptRef: input.invocationPromptRef ?? input.rawRefs?.childPromptRef,
    invocationPromptDigest: input.invocationPromptDigest ?? input.childPromptDigest,
    resultReturn: normalizeResultReturn(input),
    exporterManifestRef: input.exporterManifestRef,
    exporterManifestDigest: input.exporterManifestDigest,
    sourceTranscriptRef: input.sourceTranscriptRef ?? input.observedTranscriptRef,
    sourceTranscriptDigest: input.sourceTranscriptDigest ?? input.observedTranscriptDigest,
    negativeControls: computeNegativeControls(input),
    knownLosses: Array.isArray(input.knownLosses) ? [...input.knownLosses] : [],
    runtimeEvidence: isObject(input.runtimeEvidence) ? stableClone(input.runtimeEvidence) : {},
    parentPromptText: sourcePromptText(input),
  };
  return { ...normalized, ...computePasses(normalized) };
}

export function validateRuntimeNativeBuddySurfaceProof(input, options = {}) {
  if (!isObject(input)) throw new Error('runtime-native Buddy proof input must be an object');
  const proof = normalizeRuntimeNativeBuddySurfaceProof(input);
  const issues = [];

  for (const key of Object.keys(input)) {
    if (!ALLOWED_TOP_LEVEL_INPUT_KEYS.has(key)) {
      issues.push(`${key} is not allowed at the top level; move runtime-specific fields under runtimeEvidence`);
    }
  }

  if (proof.proofKind !== 'runtime-native-buddy-surface-proof') issues.push('proofKind must equal runtime-native-buddy-surface-proof');
  if (proof.schemaVersion !== 'runtime-native-buddy-surface-proof-v1') issues.push('schemaVersion must equal runtime-native-buddy-surface-proof-v1');
  if (!RUNTIMES.has(proof.runtime)) issues.push('runtime must be one of opencode, claude, codex');
  requiredStringIssues(issues, proof.memberName, 'memberName');
  requiredStringIssues(issues, proof.runtimeAgentName, 'runtimeAgentName');
  if (proof.actualSurface !== 'runtime-native-subagent') issues.push('actualSurface must equal runtime-native-subagent for release');
  requiredStringIssues(issues, proof.runtimeSurface, 'runtimeSurface');
  if (!PROOF_LAYERS.has(proof.proofLayer)) issues.push('proofLayer must equal nativeMechanism or naturalUse');

  requiredDigestIssues(issues, proof.baselineDigest, 'baselineDigest');
  requiredStringIssues(issues, proof.baselineDefinitionRef, 'baselineDefinitionRef');
  requiredDigestIssues(issues, proof.baselineDefinitionDigest, 'baselineDefinitionDigest');

  requiredStringIssues(issues, proof.parentSessionRef, 'parentSessionRef');
  requiredStringIssues(issues, proof.childSessionRef, 'childSessionRef');
  if (!isObject(proof.parentChildLink)) {
    issues.push('parentChildLink is required');
  } else {
    if (proof.parentChildLink.kind !== 'runtime-parent-child-link') issues.push('parentChildLink.kind must equal runtime-parent-child-link');
    requiredStringIssues(issues, proof.parentChildLink.parentId, 'parentChildLink.parentId');
    requiredStringIssues(issues, proof.parentChildLink.childId, 'parentChildLink.childId');
  }

  requiredStringIssues(issues, proof.invocationPromptRef, 'invocationPromptRef');
  requiredDigestIssues(issues, proof.invocationPromptDigest, 'invocationPromptDigest');

  if (!isObject(proof.resultReturn)) {
    issues.push('resultReturn is required');
  } else {
    if (proof.resultReturn.returnedTo !== 'parent-agent') issues.push('resultReturn.returnedTo must equal parent-agent');
    requiredStringIssues(issues, proof.resultReturn.resultRef, 'resultReturn.resultRef');
    requiredDigestIssues(issues, proof.resultReturn.resultDigest, 'resultReturn.resultDigest');
  }

  requiredStringIssues(issues, proof.exporterManifestRef, 'exporterManifestRef');
  requiredDigestIssues(issues, proof.exporterManifestDigest, 'exporterManifestDigest');
  requiredStringIssues(issues, proof.sourceTranscriptRef, 'sourceTranscriptRef');
  requiredDigestIssues(issues, proof.sourceTranscriptDigest, 'sourceTranscriptDigest');

  if (!Array.isArray(proof.knownLosses)) issues.push('knownLosses must be an array');
  if (!isObject(proof.runtimeEvidence)) issues.push('runtimeEvidence must be an object');

  for (const key of NEGATIVE_CONTROL_KEYS) {
    if (typeof proof.negativeControls?.[key] !== 'boolean') issues.push(`negativeControls.${key} must be boolean`);
  }
  for (const key of FAILING_NEGATIVE_CONTROL_KEYS) {
    if (proof.negativeControls?.[key] === true) issues.push(`negativeControls.${key} must be false for release`);
  }
  if (proof.proofLayer === 'naturalUse' && proof.negativeControls?.mechanismNamedPrompt === true) {
    issues.push('naturalUse proof cannot use a mechanismNamedPrompt instruction');
  }

  if (proof.runtime === 'codex') {
    const invocation = isObject(proof.runtimeEvidence?.invocation) ? proof.runtimeEvidence.invocation : undefined;
    if (invocation) {
      if (nonEmptyString(invocation.runtimeAgentName) && invocation.runtimeAgentName !== proof.runtimeAgentName) {
        issues.push('Codex invocation runtimeAgentName must match runtimeAgentName');
      }
      if (nonEmptyString(invocation.memberName) && invocation.memberName !== proof.memberName) {
        issues.push('Codex invocation memberName must match memberName');
      }
      if (nonEmptyString(invocation.baselineDigest) && invocation.baselineDigest !== proof.baselineDigest) {
        issues.push('Codex invocation baselineDigest must match baselineDigest');
      }
      if (!nonEmptyString(invocation.baselineDigest)) {
        issues.push('Codex invocation baselineDigest is required');
      }
      if (!nonEmptyString(invocation.baselineDefinitionRef)) {
        issues.push('Codex invocation baselineDefinitionRef is required');
      } else if (!String(invocation.baselineDefinitionRef).endsWith(`.codex/agents/${proof.runtimeAgentName}.toml`)) {
        issues.push(`Codex invocation baselineDefinitionRef must bind the synced ${proof.runtimeAgentName} definition`);
      }
    }
  }

  if (proof.runtime === 'opencode') {
    const observedRuntimeAgentName = proof.runtimeEvidence?.observedRuntimeAgentName;
    if (nonEmptyString(observedRuntimeAgentName) && observedRuntimeAgentName !== proof.runtimeAgentName) {
      issues.push('OpenCode observedRuntimeAgentName must match runtimeAgentName');
    }
  }

  if (proof.runtime === 'claude') {
    addClaudePlaceholderIssues(issues, proof);
  }

  if (nonEmptyString(options.requiredRuntime) && proof.runtime !== options.requiredRuntime) {
    issues.push(`requiredRuntime mismatch: expected ${options.requiredRuntime}`);
  }
  if (nonEmptyString(options.requiredMemberName) && proof.memberName !== options.requiredMemberName) {
    issues.push(`requiredMemberName mismatch: expected ${options.requiredMemberName}`);
  }
  if (nonEmptyString(options.expectedBaselineDigest) && proof.baselineDigest !== options.expectedBaselineDigest) {
    issues.push('expectedBaselineDigest mismatch');
  }
  if (nonEmptyString(options.requiredProofLayer) && proof.proofLayer !== options.requiredProofLayer) {
    issues.push(`requiredProofLayer mismatch: expected ${options.requiredProofLayer}`);
  }

  return {
    status: issues.length > 0 ? 'fail' : 'pass',
    issues,
    proof,
  };
}

export function digestRuntimeNativeBuddySurfaceProof(proof) {
  const normalized = normalizeRuntimeNativeBuddySurfaceProof(proof);
  const sourceRefs = explicitSourceRefSet(normalized);
  const digestable = sanitizeDigestValue({
    ...normalized,
    parentPromptText: normalized.parentPromptText,
  }, sourceRefs);
  return sha256StableJson(digestable);
}

export function normalizedRuntimeNativeBuddySurfaceProofKeys() {
  return [...normalizedTopLevelKeySet()].sort();
}
