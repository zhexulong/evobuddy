# Subagent Baseline Install Report Contract

The Context Tree subagent baseline is the stable, projection-time materialization of a confirmed member profile plus readable active role memory. Runtime subagent definitions must contain materialized role memory content, not only refs, so a synced definition is useful without a separate invocation artifact.

`context-tree-subagent-baseline-install-report.json` is projection-only. It records baseline digests, source refs, material digests, runtime definition paths, runtime definition digests, and known losses from projection. It does not prove invocation, model visibility, child session creation, task execution, or result return.

Dynamic invocation prompt is parent-owned. The parent/runtime supplies the task-specific prompt when it chooses a synced Buddy/subagent. Baseline projection must not require task-local target refs, delivery evidence, result return evidence, proof canaries, or a `member-m[1]` product requirement.

The report must preserve these boundaries:

- `projectionOnly: true` is required.
- Baseline materials record readable included content digests and unreadable/truncated known losses.
- Baseline install does not prove invocation.
- Baseline install does not prove result return.
- There is no `member-m[1]` product requirement.
