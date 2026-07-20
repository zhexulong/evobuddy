# Member System V1 E2E Eval

Run the hermetic member-system eval:

```bash
npm run context-tree:eval-member-system-v1 -- --out /tmp/context-tree-member-system-v1-eval
```

The command writes `member-system-e2e-report.json`, rendered `overview.txt`, `task.txt`, `trace.txt`, and retained artifacts under `artifacts/` for projection, invocation packet/task-run, cold-start candidates, retrospective memory, and Workbench rendering.

## Report shape

The V1 report has `reportKind: "context-tree-member-system-e2e-v1"` and records:

- `projection.status`
- `packetDelivery.status`
- `explicitInvocation.status` and `explicitInvocation.returnedTo`
- `coldStartCandidate.status` and `coldStartCandidate.defaultExpert`
- `coldStartLiveObserved.status`
- `feedbackToMemory.status`
- `workbench.status`
- `negativeControls.*`
- `productObserved.status` and, for passing product-observed runs, `productObserved.proofRef`
- `issues`
- `boundaries`

Hermetic success expects all positive hermetic checks and negative controls to pass, `issues: []`, `productObserved.status: "not-run"`, and `coldStartLiveObserved.status: "not-run"` unless live evidence is supplied.

## Proof modes and boundaries

- **Hermetic mode**: default. Fixture/harness evidence is allowed. It proves schema, gates, adapter behavior, and Workbench rendering only. It does not prove a fresh product parent-agent invocation.
- **Product-observed mode**: supply `--product-root <dir>`. Product pass requires observed parent-visible result-return evidence from the explicit member executor route: `member-task-run.json` must return to `parent-agent`; `explicit-member-parent-invocation.json` must be `sourceKind: "observed-parent-agent-call"`, `status: "completed"`, and `returnedTo: "parent-agent"`; its `observedCallPathRef` must resolve to an `explicit-member-parent-invocation-source.json`; that source's `parentCallRecordRef` must resolve to a `parent-agent-tool-call-record`; both parent-source and parent-invocation provenance digests must equal `sha256(JSON.stringify(parent-call-record.json))`; and `observed-parent-call-transcript.json` must contain the same parent call record. Passing runs write `artifacts/product/product-observed-proof-ref.json`, referenced by `productObserved.proofRef` and `artifacts.productObservedProofRef`, with the validated parent invocation/source/call-record/transcript artifact refs plus file digests and the recomputed parent-call-record JSON digest. Newer product roots may also carry adapter parent-call result-return evidence in `member-task-run.json`; older reviewed product roots can pass when the observed parent invocation chain itself carries the parent-call provenance. Fixture-only, file-only, generated seed-only, handwritten JSON without the recursive chain, and Workbench-only evidence is blocked. This proves product-grade parent-agent observed explicit member invocation, not native spawn.
- **Live cold-start observed mode**: supply `--cold-start-live-report <path>`. The report must be from `context-tree:eval-member-session-cold-start:live` with `mode: "live"`, `source: "session-corpus-export"`, and `liveSessionDerivedCandidate.status`. The aggregate also opens sibling `live-input-source.json`, recomputes the session-corpus export digest, requires `exporterManifestRef`, opens the OpenCode SQLite exporter manifest, checks source DB digest shape, checks non-empty manifest session entries, and requires corpus/live-input/manifest project identity agreement. Hermetic retained cold-start artifacts, single session-store exports, and unmanifested corpus-shaped JSON cannot satisfy live pass.

## Known open proof prerequisites

- Parent-agent product pass is closed for the reviewed corroborated OpenCode observer-export product root at `/tmp/opencode/runtime-observer-export-source-corroborated-acceptance-20260709/product/`; new product pass claims still require the same recursive observed parent-call provenance and the aggregate's durable `artifacts/product/product-observed-proof-ref.json`. They cannot be inferred from retained fixtures, Workbench output, generated seeds, handwritten JSON, or docs. The closed route is explicit member executor product proof, not native-spawn proof.
- Workbench display alone remains display evidence, not product proof.
- Session-derived cold-start candidates remain unconfirmed and are not default Experts until separately confirmed.
- Docs-only material is not default Expert authority and is not `member-m[0]` memory without explicit profile/import/session/run lifecycle evidence.
- Exporter-produced cold-start live proof closes only `coldStartLiveObserved` after manifest/digest/project-identity validation; the corroborated product root closes `productObserved` separately through observed parent-agent call provenance.
