function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderBadge(label, status) {
  return `<span class="badge badge-${escapeHtml(status ?? 'unknown')}">${escapeHtml(`${label}: ${status ?? 'unknown'}`)}</span>`;
}

function renderList(items, emptyLabel = 'none') {
  if (!items || items.length === 0) return `<p class="empty">${escapeHtml(emptyLabel)}</p>`;
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function renderDefinitionRows(entries) {
  return entries
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`)
    .join('');
}

function renderContextSources(run) {
  return renderList(run.contextSources.map((source) => {
    const detail = source.targetRef ?? source.profileRef ?? source.historyRef ?? source.runtimeRef ?? source.sessionRef ?? source.forkMode ?? '';
    return `<strong>${escapeHtml(source.kind)}</strong>${detail ? ` — ${escapeHtml(detail)}` : ''}`;
  }));
}

function renderMaterials(run) {
  if (run.materials.length === 0) return `<p class="empty">none</p>`;
  const rows = run.materials.map((item) => `
    <tr>
      <td>${escapeHtml(item.materialRef)}</td>
      <td>${escapeHtml(item.selectionMode)}</td>
      <td>${escapeHtml(item.visibility)}</td>
      <td>${item.contentDigest ? escapeHtml(item.contentDigest) : '<span class="muted">none</span>'}</td>
      <td>${item.snapshotRef ? escapeHtml(item.snapshotRef) : item.digestUnavailable ? escapeHtml(`digestUnavailable: ${item.digestUnavailable}`) : '<span class="muted">none</span>'}</td>
      <td>${renderList((item.evidenceRefs ?? []).map((ref) => `${escapeHtml(ref.kind)} — ${escapeHtml(ref.ref)}`), 'none')}</td>
    </tr>`).join('');

  return `<table>
    <thead><tr><th>material</th><th>selectionMode</th><th>visibility</th><th>contentDigest</th><th>snapshot / loss</th><th>evidence</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderEvidenceGroups(run) {
  return renderList(run.evidenceGroups.map((group) => `${escapeHtml(group.kind)} (${group.refs.length})${renderList(group.refs.map((ref) => `${escapeHtml(ref.ref)}${ref.excerpt ? ` — ${escapeHtml(ref.excerpt)}` : ''}`), 'none')}`));
}

function renderLifecycle(run) {
  return renderList(run.lifecycle.map((entry) => `${escapeHtml(entry.event)} — ${escapeHtml(entry.at)}`));
}

function renderArtifactRefs(run) {
  return renderList(Object.entries(run.artifactRefs).map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(value)}`));
}

function renderCompactCountRow(counts, preferredOrder = []) {
  if (!counts || Object.keys(counts).length === 0) return '<p class="empty">none</p>';
  const orderedKeys = [...new Set([...preferredOrder, ...Object.keys(counts).sort()])].filter((key) => counts[key] !== undefined);
  return `<p>${orderedKeys.map((key) => `${escapeHtml(key)}: ${escapeHtml(String(counts[key]))}`).join(' · ')}</p>`;
}

function renderBaseline(run) {
  if (!run.baseline) return '<p class="empty">none</p>';
  return `<dl>${renderDefinitionRows([
    ['version', escapeHtml(run.baseline.version ?? 'unknown')],
    ['digest', escapeHtml(run.baseline.digest ?? 'unknown')],
    ['reuseStatus', escapeHtml(run.baseline.reuseStatus ?? 'unknown')],
    ['knownLosses', run.baseline.knownLosses?.map(escapeHtml).join(', ') || 'none'],
  ])}</dl>`;
}

function renderSelection(run) {
  if (!run.selection) return '<p class="empty">none</p>';
  return `${renderDefinitionRows([
    ['reportRef', escapeHtml(run.selection.reportRef ?? 'unknown')],
    ['reportId', escapeHtml(run.selection.reportId ?? 'unknown')],
  ]) ? `<dl>${renderDefinitionRows([
    ['reportRef', escapeHtml(run.selection.reportRef ?? 'unknown')],
    ['reportId', escapeHtml(run.selection.reportId ?? 'unknown')],
  ])}</dl>` : ''}
  <div class="compact-row-group">
    <div><strong>candidate counts</strong>${renderCompactCountRow(run.selection.candidateCounts, ['total', 'selected', 'rejected'])}</div>
    <div><strong>placements</strong>${renderCompactCountRow(run.selection.placementCounts, ['m0', 'm1', 'mounted', 'searchable', 'source-only', 'unknown'])}</div>
  </div>`;
}

function renderMemoryLifecycle(run) {
  if (!run.memoryLifecycle) return '<p class="empty">none</p>';
  return renderCompactCountRow(run.memoryLifecycle, ['active', 'pending', 'archived', 'superseded']);
}

function renderRunDrawer(run) {
  return `<details class="run-drawer">
    <summary>
      <span>${escapeHtml(run.runId)}</span>
      ${renderBadge('execution outcome', run.executionOutcome.status)}
      ${renderBadge('material proof', run.materialProof.status)}
    </summary>
    <div class="drawer-grid">
      <section>
        <h4>Task</h4>
        <dl>${renderDefinitionRows([
          ['question', escapeHtml(run.task.question)],
          ['targets', run.task.targetRefs.length ? run.task.targetRefs.map(escapeHtml).join(', ') : 'none'],
          ['returned to', escapeHtml(run.resultReturn.returnedTo ?? 'unknown')],
        ])}</dl>
      </section>
      <section>
        <h4>Runtime</h4>
        <dl>${renderDefinitionRows([
          ['runtimeAgentId', run.runtime ? escapeHtml(run.runtime.runtimeAgentId) : 'n/a'],
          ['runtimeAgentType', run.runtime ? escapeHtml(run.runtime.runtimeAgentType) : 'n/a'],
          ['activation turn', escapeHtml(run.activationPoint.turnId)],
          ['activation createdAt', escapeHtml(run.activationPoint.createdAt)],
        ])}</dl>
      </section>
      <section>
        <h4>Baseline</h4>
        <p class="muted">Derived from retained lifecycle artifacts; not standalone proof of model visibility.</p>
        ${renderBaseline(run)}
      </section>
      <section>
        <h4>Selection summary</h4>
        <p class="muted">Selection explains placement and counts; the run ledger remains the visibility authority.</p>
        ${renderSelection(run)}
      </section>
      <section>
        <h4>Memory lifecycle</h4>
        <p class="muted">Lifecycle counts summarize retained records only.</p>
        ${renderMemoryLifecycle(run)}
      </section>
      <section>
        <h4>Material proof</h4>
        <dl>${renderDefinitionRows([
          ['status', escapeHtml(run.materialProof.status)],
          ['required canaries', run.materialProof.requiredCanaries.map(escapeHtml).join(', ') || 'none'],
          ['observed canaries', run.materialProof.observedCanaries.map(escapeHtml).join(', ') || 'none'],
          ['missing canaries', run.materialProof.missingCanaries.map(escapeHtml).join(', ') || 'none'],
          ['sources', run.materialProof.sources.map(escapeHtml).join(', ') || 'none'],
          ['negative control expected', escapeHtml(String(Boolean(run.materialProof.negativeControlExpected)))],
        ])}</dl>
      </section>
      <section>
        <h4>Result return</h4>
        <dl>${renderDefinitionRows([
          ['summary', escapeHtml(run.resultReturn.summary ?? 'none')],
          ['resultRef', escapeHtml(run.resultReturn.resultRef ?? 'none')],
        ])}</dl>
      </section>
      <section>
        <h4>Context sources</h4>
        ${renderContextSources(run)}
      </section>
      <section>
        <h4>Materials</h4>
        ${renderMaterials(run)}
      </section>
      <section>
        <h4>Lifecycle</h4>
        ${renderLifecycle(run)}
      </section>
      <section>
        <h4>Evidence groups</h4>
        ${renderEvidenceGroups(run)}
      </section>
      <section>
        <h4>knownLosses</h4>
        ${renderList(run.knownLosses.map(escapeHtml), 'none')}
      </section>
      <section>
        <h4>Raw artifact refs</h4>
        ${renderArtifactRefs(run)}
      </section>
    </div>
  </details>`;
}

function renderMemberCard(member, runs) {
  return `<article class="member-card">
    <h3>${escapeHtml(member.memberName)}</h3>
    <p>${escapeHtml(member.role ?? 'Unknown role')}</p>
    <p>${escapeHtml(member.description ?? 'No description')}</p>
    <dl>${renderDefinitionRows([
      ['resolvedMemberId', member.resolvedMemberId ? escapeHtml(member.resolvedMemberId) : 'n/a'],
      ['recent runs', escapeHtml(String(member.recentRunIds.length))],
      ['execution pass', escapeHtml(String(member.runCounts.executionPass))],
      ['material proof pass', escapeHtml(String(member.runCounts.materialProofPass))],
      ['material proof fail', escapeHtml(String(member.runCounts.materialProofFail))],
      ['runtime compatibility', member.runtimeCompatibility?.map(escapeHtml).join(', ') || 'none'],
      ['task kinds', member.taskKinds?.map(escapeHtml).join(', ') || 'none'],
    ])}</dl>
    <section>
      <h4>Warnings</h4>
      ${renderList(member.warnings.map(escapeHtml), 'none')}
    </section>
    <section>
      <h4>Recent runs</h4>
      ${runs.map(renderRunDrawer).join('')}
    </section>
  </article>`;
}

export function renderMemberSurfaceHtml(report) {
  const runsByMember = new Map();
  for (const run of report.runs) {
    if (!runsByMember.has(run.memberName)) runsByMember.set(run.memberName, []);
    runsByMember.get(run.memberName).push(run);
  }

  const memberCards = report.members.map((member) => renderMemberCard(member, runsByMember.get(member.memberName) ?? [])).join('');
  const warnings = renderList((report.warnings ?? []).map(escapeHtml), 'none');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Context Tree Members</title>
    <style>
      :root { color-scheme: light dark; }
      body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; }
      .member-card, details { border: 1px solid #8884; border-radius: 0.75rem; padding: 1rem; margin: 1rem 0; }
      .badge { display: inline-block; margin-left: 0.5rem; padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid currentColor; }
      .badge-pass { color: #116611; }
      .badge-fail { color: #9f1c1c; }
      .badge-not-required, .badge-inconclusive, .badge-blocked, .badge-unknown { color: #6b5d00; }
      .drawer-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); }
      dl div { margin: 0.25rem 0; }
      dt { font-weight: 700; }
      dd { margin: 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #8884; padding: 0.4rem; vertical-align: top; text-align: left; }
      .empty, .muted { color: #666; }
      ul { padding-left: 1.2rem; }
      .compact-row-group { display: grid; gap: 0.5rem; }
      .compact-row-group p { margin: 0.2rem 0 0; }
    </style>
  </head>
  <body>
    <header>
      <h1>Context Tree Members</h1>
      <p>Static member roster cards plus evidence drawers. Execution outcome and material proof stay separate.</p>
    </header>
    <main>
      <section>
        <h2>Report warnings</h2>
        ${warnings}
      </section>
      <section>
        <h2>Member roster</h2>
        ${memberCards}
      </section>
    </main>
  </body>
</html>`;
}
