function normalizeTaskKind(kind) {
  return kind === 'reviewer' ? 'review' : kind;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function extractCanaries(value) {
  if (typeof value !== 'string' || value.length === 0) return [];
  return value.match(/[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9_]+)+/g) ?? [];
}

function getObservedCanaries(artifact) {
  const values = [];
  for (const item of artifact.run.materialProof?.observed ?? []) values.push(item);
  values.push(artifact.run.result?.summary);
  for (const ref of artifact.run.evidenceRefs ?? []) {
    values.push(ref.excerpt, ref.ref);
  }
  for (const ref of artifact.spawnResult?.evidenceRefs ?? []) {
    values.push(ref.excerpt, ref.ref);
  }
  return uniqueSorted(values.flatMap(extractCanaries));
}

function getFinalSummaryRequiredCanaries(summary) {
  if (!summary) return [];
  const missing = [
    ...(summary.materialProofMissing?.roleHistory ?? []),
    ...(summary.materialProofMissing?.targetMaterial ?? []),
  ];
  if (missing.length > 0) return uniqueSorted(missing);
  return [];
}

function getRunRequiredCanaries(run) {
  return uniqueSorted([
    ...(run.materialProof?.required?.roleHistory ?? []),
    ...(run.materialProof?.required?.targetMaterial ?? []),
  ]);
}

function deriveMaterialProof(artifact, materialProofRequirements) {
  const observedCanaries = getObservedCanaries(artifact);
  const configuredCanaries = materialProofRequirements?.[artifact.run.memberName] ?? [];
  const runRequiredCanaries = getRunRequiredCanaries(artifact.run);
  const finalSummaryRequiredCanaries = getFinalSummaryRequiredCanaries(artifact.finalSummary);

  const requiredCanaries = finalSummaryRequiredCanaries.length > 0
    ? uniqueSorted([...finalSummaryRequiredCanaries, ...configuredCanaries, ...runRequiredCanaries])
    : configuredCanaries.length > 0
      ? uniqueSorted([...configuredCanaries, ...runRequiredCanaries])
      : runRequiredCanaries;

  const sources = [];
  if (artifact.finalSummary) sources.push('final-summary');
  if (configuredCanaries.length > 0) sources.push('configured');
  if (observedCanaries.length > 0) sources.push('result-summary');
  if (sources.length === 0) sources.push('none');

  if (requiredCanaries.length === 0) {
    return {
      status: 'not-required',
      observedCanaries,
      requiredCanaries: [],
      missingCanaries: [],
      sources,
    };
  }

  const missingCanaries = requiredCanaries.filter((canary) => !observedCanaries.includes(canary));
  const finalStatus = artifact.finalSummary?.materialProofStatus;
  const status = finalStatus ?? (missingCanaries.length === 0 ? 'pass' : 'fail');

  return {
    status,
    ...(artifact.finalSummary?.expectedFailure || artifact.run.materialProof?.negativeControlExpected
      ? { negativeControlExpected: true }
      : {}),
    observedCanaries,
    requiredCanaries,
    missingCanaries,
    sources,
    ...(artifact.run.materialProof?.detail ? { detail: artifact.run.materialProof.detail } : {}),
  };
}

function groupEvidenceRefs(artifact) {
  const allRefs = [...(artifact.run.evidenceRefs ?? [])];
  for (const ref of artifact.spawnResult?.evidenceRefs ?? []) {
    if (!allRefs.some((existing) => existing.kind === ref.kind && existing.ref === ref.ref)) {
      allRefs.push(ref);
    }
  }
  const byKind = new Map();
  for (const ref of allRefs) {
    if (!byKind.has(ref.kind)) byKind.set(ref.kind, []);
    byKind.get(ref.kind).push({ ...ref });
  }
  return [...byKind.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, refs]) => ({ kind, refs }));
}

function normalizeContextSources(run) {
  return [...(run.contextSources ?? [])]
    .map((source) => ({ ...source }))
    .sort((left, right) => left.kind.localeCompare(right.kind));
}

function normalizeMaterials(run) {
  return [...(run.materials?.items ?? [])].map((item) => ({
    materialRef: item.materialRef,
    sourceRef: item.sourceRef,
    selectionMode: item.selectionMode,
    visibility: item.visibility,
    providerVisibility: item.visibility,
    ...(item.contentDigest ? { contentDigest: item.contentDigest } : {}),
    ...(item.snapshotRef ? { snapshotRef: item.snapshotRef } : {}),
    ...(item.digestUnavailable ? { digestUnavailable: item.digestUnavailable } : {}),
    evidenceRefs: [...(item.evidenceRefs ?? [])],
  }));
}

function normalizeLifecycle(run) {
  return [...(run.lifecycleTrace ?? [])].map((entry) => ({ ...entry }));
}

function normalizeKnownLosses(value) {
  return Array.isArray(value) ? [...value] : [];
}

function countMatches(items, predicate) {
  return items.reduce((count, item) => count + (predicate(item) ? 1 : 0), 0);
}

function deriveBaseline(artifact) {
  if (!artifact.memberContextRender) return undefined;
  return {
    version: artifact.memberContextRender.version ?? artifact.memberContextRender.baselineVersion,
    digest: artifact.memberContextRender.digest ?? artifact.memberContextRender.baselineDigest,
    reuseStatus: artifact.memberContextRender.reuseStatus ?? artifact.memberContextRender.baselineReuseStatus,
    knownLosses: normalizeKnownLosses(artifact.memberContextRender.knownLosses),
  };
}

function deriveSelection(artifact) {
  const report = artifact.materialSelectionReport;
  if (!report) return undefined;

  const candidates = Array.isArray(report.candidates) ? report.candidates.map((candidate) => ({ ...candidate })) : [];
  const selected = candidates.filter((candidate) => candidate.selected === true);
  const rejected = candidates.filter((candidate) => candidate.selected === false);
  const placementCounts = candidates.reduce((counts, candidate) => {
    const placement = typeof candidate.placement === 'string' && candidate.placement.length > 0 ? candidate.placement : 'unknown';
    counts[placement] = (counts[placement] ?? 0) + 1;
    return counts;
  }, {});

  return {
    reportRef: artifact.artifactRefs.materialSelectionReportPath,
    reportId: report.reportId,
    candidateCounts: {
      total: candidates.length,
      selected: selected.length,
      rejected: rejected.length,
    },
    placementCounts,
  };
}

function deriveMemoryLifecycle(artifact) {
  const statuses = [
    artifact.memberRoleMemory?.status,
    artifact.roleMemoryCandidate?.status,
    artifact.memberDreamerRun?.status,
    ...(artifact.memberDreamerRun?.decisions ?? []).map((decision) => decision?.status),
  ].filter((status) => typeof status === 'string' && status.length > 0);

  if (statuses.length === 0) return undefined;

  return {
    active: countMatches(statuses, (status) => status === 'active'),
    pending: countMatches(statuses, (status) => status === 'pending' || status === 'needs-review'),
    archived: countMatches(statuses, (status) => status === 'archived'),
    superseded: countMatches(statuses, (status) => status === 'superseded'),
  };
}

function lifecycleComplete(lifecycle) {
  const events = new Set(lifecycle.map(({ event }) => event));
  return events.has('prepared')
    && events.has('dispatched')
    && (events.has('dispatch-ack') || events.has('child-started'))
    && events.has('child-completed')
    && events.has('recorded');
}

function resolveProfile(artifacts, memberName) {
  return artifacts.registry?.members.find((member) => member.name === memberName || member.aliases.includes(memberName));
}

function getStableReportRunId(artifact, duplicateRunIds) {
  if (!duplicateRunIds.has(artifact.run.id)) return artifact.run.id;
  const disambiguator = artifact.artifactRefs.runRoot?.split(/[\\/]/).filter(Boolean).pop() ?? artifact.artifactRefs.runPath;
  return `${artifact.run.id}:${disambiguator}`;
}

function buildRunView(artifact, materialProofRequirements, duplicateRunIds) {
  const lifecycle = normalizeLifecycle(artifact.run);
  const materialProof = deriveMaterialProof(artifact, materialProofRequirements);
  return {
    runId: getStableReportRunId(artifact, duplicateRunIds),
    memberName: artifact.run.memberName,
    task: {
      kind: normalizeTaskKind(artifact.run.task.kind),
      question: artifact.run.task.question,
      targetRefs: [...(artifact.run.task.targetRefs ?? [])],
    },
    activationPoint: { ...artifact.run.activationPoint },
    executionOutcome: { ...artifact.run.outcome },
    materialProof,
    resultReturn: { ...artifact.run.result },
    ...(artifact.run.runtime ? { runtime: { ...artifact.run.runtime } } : {}),
    contextSources: normalizeContextSources(artifact.run),
    materials: normalizeMaterials(artifact.run),
    evidenceGroups: groupEvidenceRefs(artifact),
    ...(deriveBaseline(artifact) ? { baseline: deriveBaseline(artifact) } : {}),
    ...(deriveSelection(artifact) ? { selection: deriveSelection(artifact) } : {}),
    ...(deriveMemoryLifecycle(artifact) ? { memoryLifecycle: deriveMemoryLifecycle(artifact) } : {}),
    knownLosses: [...(artifact.run.knownLosses ?? [])],
    warnings: lifecycleComplete(lifecycle) ? [...(artifact.run.knownLosses ?? [])] : ['incomplete lifecycle', ...(artifact.run.knownLosses ?? [])],
    lifecycle,
    lifecycleComplete: lifecycleComplete(lifecycle),
    artifactRefs: { ...artifact.artifactRefs },
  };
}

function countByStatus(runs, selector, statuses) {
  return runs.filter((run) => selector(run) === statuses).length;
}

function getMemberWarnings(artifacts, profileEntry, memberRuns) {
  const warnings = [...memberRuns.flatMap((run) => run.knownLosses)];
  if (!artifacts.registry) warnings.push(`missing profile for member ${memberRuns[0]?.memberName ?? 'unknown'}: registry unavailable`);
  else if (!profileEntry) warnings.push(`missing profile for member ${memberRuns[0]?.memberName ?? 'unknown'}`);
  return uniqueSorted(warnings);
}

export function buildMemberSurfaceViewModel(input) {
  const { artifacts, materialProofRequirements } = input;
  const runIdCounts = new Map();
  for (const artifact of artifacts.runs) {
    runIdCounts.set(artifact.run.id, (runIdCounts.get(artifact.run.id) ?? 0) + 1);
  }
  const duplicateRunIds = new Set(
    [...runIdCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([runId]) => runId),
  );
  const runs = artifacts.runs.map((artifact) => buildRunView(artifact, materialProofRequirements, duplicateRunIds));
  const membersByName = new Map();

  for (const run of runs) {
    if (!membersByName.has(run.memberName)) membersByName.set(run.memberName, []);
    membersByName.get(run.memberName).push(run);
  }

  const members = [...membersByName.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([memberName, memberRuns]) => {
    memberRuns.sort((left, right) => {
      const createdAtCompare = left.activationPoint.createdAt.localeCompare(right.activationPoint.createdAt);
      if (createdAtCompare !== 0) return createdAtCompare;
      return left.artifactRefs.runPath.localeCompare(right.artifactRefs.runPath);
    });
    const latestRun = memberRuns[memberRuns.length - 1];
    const profileEntry = resolveProfile(artifacts, memberName);
    const taskKinds = uniqueSorted(memberRuns.map((run) => run.task.kind));
    return {
      memberName,
      ...(profileEntry?.resolvedMemberId ? { resolvedMemberId: profileEntry.resolvedMemberId } : {}),
      ...(profileEntry?.profileRef ? { profileRef: profileEntry.profileRef } : {}),
      ...(profileEntry?.profile?.role ? { role: profileEntry.profile.role } : {}),
      ...(profileEntry?.profile?.description ? { description: profileEntry.profile.description } : {}),
      responsibilities: [...(profileEntry?.profile?.responsibilities ?? [])],
      recentRunIds: memberRuns.map((run) => run.runId),
      runCounts: {
        total: memberRuns.length,
        executionPass: countByStatus(memberRuns, (run) => run.executionOutcome.status, 'pass'),
        executionFail: countByStatus(memberRuns, (run) => run.executionOutcome.status, 'fail'),
        executionInconclusive: countByStatus(memberRuns, (run) => run.executionOutcome.status, 'inconclusive'),
        executionBlocked: countByStatus(memberRuns, (run) => run.executionOutcome.status, 'blocked'),
        materialProofPass: countByStatus(memberRuns, (run) => run.materialProof.status, 'pass'),
        materialProofFail: countByStatus(memberRuns, (run) => run.materialProof.status, 'fail'),
        materialProofInconclusive: countByStatus(memberRuns, (run) => run.materialProof.status, 'inconclusive'),
        materialProofNotRequired: countByStatus(memberRuns, (run) => run.materialProof.status, 'not-required'),
      },
      latestRunSummary: latestRun.resultReturn.summary,
      latestExecutionOutcome: latestRun.executionOutcome,
      latestMaterialProof: latestRun.materialProof,
      routingHints: profileEntry?.profile ? {
        activationHints: [...profileEntry.profile.activationHints],
        negativeActivationHints: [...profileEntry.profile.negativeActivationHints],
      } : undefined,
      runtimeCompatibility: uniqueSorted(memberRuns.flatMap((run) => [run.runtime?.runtimeAgentType].filter(Boolean))),
      taskKinds,
      warnings: getMemberWarnings(artifacts, profileEntry, memberRuns),
    };
  });

  return {
    reportKind: 'context-tree-member-surface',
    version: '1',
    generatedFrom: {
      inputRoot: artifacts.inputRoot,
      ...(artifacts.rootKind ? { inputKind: artifacts.rootKind } : {}),
      ...(artifacts.registry?.registryPath ? { registryRef: artifacts.registry.registryPath } : {}),
      profileRefs: uniqueSorted(artifacts.registry?.members.map((member) => member.profileRef).filter(Boolean) ?? []),
      ...(artifacts.runs[0]?.artifactRefs.finalSummaryPath ? { finalSummaryRef: artifacts.runs[0].artifactRefs.finalSummaryPath } : {}),
    },
    members,
    runs,
    warnings: [...artifacts.warnings],
  };
}
