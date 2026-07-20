const SHA256_RE = /#sha256:[a-f0-9]{64}$/;
const RUNTIME_REF_RE = /^(observed-transcript|runtime-export|parent-call):[^#\s]+#sha256:[a-f0-9]{64}$/;

const ACTIVE_TARGET_KINDS = new Set([
  'knowledge-fact',
  'knowledge-sop',
  'skill',
  'existing-buddy-update',
  'new-buddy-candidate',
]);

function isDirtyQuality(sourceQuality = {}) {
  if (sourceQuality.status === 'fail') return true;
  if ((sourceQuality.excludedToolOutputCount ?? 0) > 0) return true;
  if ((sourceQuality.excludedWorkflowWrapperCount ?? 0) > 0) return true;
  return /tool-output|workflow-wrapper|synthetic-fixture|docs-only/i.test(String(sourceQuality.reason ?? sourceQuality.status ?? ''));
}

export function isDurableSourceRef(ref) {
  const value = String(ref ?? '').trim();
  if (RUNTIME_REF_RE.test(value)) return true;
  if (/^(artifact:)?\/tmp\//.test(value)) return false;
  if (/^tool:/.test(value)) return false;
  if (/^\/[^#\s]+/.test(value)) return false;
  return SHA256_RE.test(value) && !value.includes('/tmp/');
}

export function classifySourceSupport({ sourceRefs = [], sourceQuality = {} } = {}) {
  const refs = Array.isArray(sourceRefs) ? sourceRefs : [];
  if (isDirtyQuality(sourceQuality)) {
    return {
      status: 'rejected-dirty-source',
      reason: 'dirty source quality cannot support active EvoBuddy updates',
      activeSourceRefs: [],
      sourceQuality,
    };
  }
  const activeSourceRefs = refs.filter(isDurableSourceRef);
  if (activeSourceRefs.length > 0) {
    return { status: 'active-source-supported', activeSourceRefs, sourceQuality };
  }
  return {
    status: 'pending-stable-source',
    reason: 'volatile tmp or missing stable source support; do not copy into evidence buckets',
    activeSourceRefs: [],
    sourceQuality,
  };
}

export function assertActiveSourceSupport({ targetKind, sourceRefs = [], sourceQuality = {} } = {}) {
  if (targetKind === 'discard') return true;
  if (isDirtyQuality(sourceQuality)) throw new Error('active EvoBuddy update rejected: dirty source support');
  if (ACTIVE_TARGET_KINDS.has(targetKind) && classifySourceSupport({ sourceRefs, sourceQuality }).activeSourceRefs.length === 0) {
    throw new Error('active EvoBuddy update requires stable source support');
  }
  return true;
}
