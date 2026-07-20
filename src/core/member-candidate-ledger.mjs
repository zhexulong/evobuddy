import { makeId } from './ids.mjs';

const ARTIFACT_KIND = 'member-candidate-ledger';
const COMPLETED = 'completed';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeMemberName(value) {
  return cleanString(value)?.replace(/^@/, '').replace(/_/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function normalizeText(value) {
  return String(value ?? '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function projectIdentityFor(proposal, previousLedger) {
  return cleanString(proposal?.projectIdentity) ?? cleanString(previousLedger?.projectIdentity) ?? 'unknown-project';
}

function candidateIdFor({ proposal, memberName, previousLedger }) {
  const existing = asArray(previousLedger?.entries).find((entry) => normalizeMemberName(entry.memberName) === memberName);
  if (cleanString(existing?.candidateId)) return existing.candidateId;
  return makeId('member-candidate', `${projectIdentityFor(proposal, previousLedger)}-${memberName}`);
}

function variantMemberName(memberName, usedNames) {
  if (!usedNames.has(memberName)) return memberName;
  let index = 2;
  while (usedNames.has(`${memberName}-${index}`)) index += 1;
  return `${memberName}-${index}`;
}

function evidenceKey(ref) {
  const digest = cleanString(ref?.digest);
  const eventId = cleanString(ref?.eventId);
  const refValue = cleanString(ref?.ref);
  if (digest) return `digest:${digest}`;
  if (eventId) return `event:${eventId}`;
  if (refValue) return `ref:${refValue}`;
  return undefined;
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of asArray(items)) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function uniqueStrings(items) {
  return [...new Set(asArray(items).map((item) => cleanString(item)).filter(Boolean))].sort();
}

function warningKey(warning) {
  return JSON.stringify({ memberName: normalizeMemberName(warning?.memberName), reason: cleanString(warning?.reason) ?? JSON.stringify(warning) });
}

function warningsFor(proposal, warnings) {
  const memberName = normalizeMemberName(proposal?.memberName);
  return [...asArray(proposal?.warnings), ...asArray(warnings).filter((warning) => !cleanString(warning?.memberName) || normalizeMemberName(warning.memberName) === memberName)];
}

function proofScopeFor(proposal) {
  return cleanString(proposal?.proofScope) ?? cleanString(proposal?.memberClass) ?? cleanString(proposal?.returnContract);
}

function firstObservedAt(eventStream, previousEntry) {
  return cleanString(previousEntry?.firstObservedAt) ?? cleanString(eventStream?.watermark?.prior) ?? cleanString(eventStream?.watermark?.next) ?? cleanString(eventStream?.safeFrontier?.timestamp);
}

function lastObservedAt(eventStream, previousEntry) {
  return cleanString(eventStream?.safeFrontier?.timestamp) ?? cleanString(eventStream?.watermark?.next) ?? cleanString(previousEntry?.lastObservedAt);
}

function buildInitialLedger(previousLedger) {
  return {
    artifactKind: ARTIFACT_KIND,
    projectIdentity: cleanString(previousLedger?.projectIdentity),
    entries: asArray(previousLedger?.entries).map((entry) => ({ ...entry })),
    watermark: { ...(previousLedger?.watermark ?? {}) },
    overlap: { ...(previousLedger?.overlap ?? {}) },
    safeFrontier: previousLedger?.safeFrontier ?? null,
    runHistory: asArray(previousLedger?.runHistory).map((run) => ({ ...run })),
  };
}

function mergeEntry({ previousEntry, proposal, previousLedger, eventStream, warnings }) {
  const memberName = normalizeMemberName(proposal.memberName);
  const evidenceRefs = dedupeBy([...asArray(previousEntry?.evidenceRefs), ...asArray(proposal.evidenceRefs)], evidenceKey);
  const mergedWarnings = dedupeBy([...asArray(previousEntry?.warnings), ...warningsFor(proposal, warnings)], warningKey);
  const proofScope = proofScopeFor(proposal);
  return {
    candidateId: candidateIdFor({ proposal, memberName, previousLedger }),
    memberName,
    status: previousEntry?.status ?? 'candidate',
    memberClass: cleanString(proposal.memberClass) ?? previousEntry?.memberClass,
    role: cleanString(proposal.role) ?? previousEntry?.role,
    returnContract: cleanString(proposal.returnContract) ?? previousEntry?.returnContract,
    seenCount: (previousEntry?.seenCount ?? 0) + 1,
    useCount: previousEntry?.useCount ?? 0,
    correctionCount: previousEntry?.correctionCount ?? 0,
    firstObservedAt: firstObservedAt(eventStream, previousEntry),
    lastObservedAt: lastObservedAt(eventStream, previousEntry),
    evidenceRefs,
    warnings: mergedWarnings,
    proofScopeHistory: uniqueStrings([...asArray(previousEntry?.proofScopeHistory), proofScope]),
    mergedFrom: uniqueStrings(previousEntry?.mergedFrom),
    supersededBy: cleanString(previousEntry?.supersededBy),
    overlapCandidateIds: uniqueStrings(previousEntry?.overlapCandidateIds),
  };
}

function evidenceDigests(entry) {
  return new Set(asArray(entry.evidenceRefs).map((ref) => cleanString(ref?.digest)).filter(Boolean));
}

function hasSharedEvidence(left, right) {
  const rightDigests = evidenceDigests(right);
  return [...evidenceDigests(left)].some((digest) => rightDigests.has(digest));
}

function hasSimilarContract(left, right) {
  const leftContract = normalizeText(left.returnContract);
  const rightContract = normalizeText(right.returnContract);
  return Boolean(leftContract && rightContract && leftContract === rightContract);
}

function applyOverlapLinks(entries) {
  for (const entry of entries) entry.overlapCandidateIds = uniqueStrings(entry.overlapCandidateIds);
  for (let index = 0; index < entries.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < entries.length; otherIndex += 1) {
      const left = entries[index];
      const right = entries[otherIndex];
      if (left.candidateId === right.candidateId) continue;
      if (!hasSharedEvidence(left, right) && !hasSimilarContract(left, right)) continue;
      left.overlapCandidateIds = uniqueStrings([...left.overlapCandidateIds, right.candidateId]);
      right.overlapCandidateIds = uniqueStrings([...right.overlapCandidateIds, left.candidateId]);
    }
  }
}

function runHistoryEntry({ eventStream, proposals, rejectedProposals, warnings, runStatus }) {
  return {
    status: cleanString(runStatus) ?? 'unknown',
    priorWatermark: cleanString(eventStream?.watermark?.prior),
    nextWatermark: cleanString(eventStream?.watermark?.next),
    safeFrontier: eventStream?.safeFrontier ?? null,
    proposalCount: asArray(proposals).length,
    rejectedProposalCount: asArray(rejectedProposals).length,
    warningCount: asArray(warnings).length,
  };
}

function nextWatermark(previousLedger, eventStream, runStatus) {
  const current = cleanString(previousLedger?.watermark?.current);
  if (runStatus !== COMPLETED) return current;
  return cleanString(eventStream?.safeFrontier?.timestamp) ?? cleanString(eventStream?.watermark?.next) ?? current;
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => left.candidateId.localeCompare(right.candidateId));
}

export function updateMemberCandidateLedger({ previousLedger, eventStream, proposals, rejectedProposals, warnings, runStatus }) {
  const ledger = buildInitialLedger(previousLedger);
  ledger.artifactKind = ARTIFACT_KIND;
  ledger.safeFrontier = eventStream?.safeFrontier ?? null;
  ledger.overlap = eventStream?.overlap ?? ledger.overlap ?? {};
  ledger.runHistory = [...ledger.runHistory, runHistoryEntry({ eventStream, proposals, rejectedProposals, warnings, runStatus })];
  ledger.watermark = { ...ledger.watermark, current: nextWatermark(previousLedger, eventStream, runStatus) };

  if (runStatus === COMPLETED) {
    const byName = new Map(ledger.entries.map((entry) => [normalizeMemberName(entry.memberName), entry]));
    const usedNames = new Set(byName.keys());
    const namesSeenThisRun = new Set();
    for (const proposal of asArray(proposals)) {
      const normalizedName = normalizeMemberName(proposal?.memberName);
      if (!normalizedName) continue;
      const isDuplicateInRun = namesSeenThisRun.has(normalizedName);
      const previousEntry = isDuplicateInRun ? undefined : byName.get(normalizedName);
      const memberName = previousEntry ? normalizedName : variantMemberName(normalizedName, usedNames);
      usedNames.add(memberName);
      namesSeenThisRun.add(normalizedName);
      byName.set(memberName, mergeEntry({ previousEntry, proposal: { ...proposal, memberName }, previousLedger, eventStream, warnings }));
    }
    ledger.entries = sortEntries([...byName.values()]);
    applyOverlapLinks(ledger.entries);
  }

  return ledger;
}

function namesNearIdentical(left, right) {
  return normalizeText(left.memberName) === normalizeText(right.memberName);
}

function shouldMerge(left, right) {
  return namesNearIdentical(left, right) || hasSharedEvidence(left, right) || hasSimilarContract(left, right);
}

export function curateMemberCandidateLedger({ ledger }) {
  const entries = sortEntries(asArray(ledger?.entries).map((entry) => ({ ...entry, mergedFrom: uniqueStrings(entry.mergedFrom), overlapCandidateIds: uniqueStrings(entry.overlapCandidateIds) })));
  for (let index = 0; index < entries.length; index += 1) {
    const survivor = entries[index];
    if (survivor.supersededBy) continue;
    for (let otherIndex = index + 1; otherIndex < entries.length; otherIndex += 1) {
      const other = entries[otherIndex];
      if (other.supersededBy || !shouldMerge(survivor, other)) continue;
      survivor.mergedFrom = uniqueStrings([...survivor.mergedFrom, other.candidateId, ...asArray(other.mergedFrom)]);
      other.supersededBy = survivor.candidateId;
      other.status = other.status === 'active' ? 'candidate' : other.status;
    }
  }
  return { ...ledger, artifactKind: ARTIFACT_KIND, entries };
}
