# Member Invocation Flow Contract

## Boundary

Runtime projection is not invocation. A runtime definition only makes a stable member discoverable. It does not prove packet delivery, model-visible materials, execution, result return, or writeback.

Packet artifact existence is not model-visible evidence. A packet artifact becomes delivery evidence only when an accepted delivery path records what bytes were delivered and how the runtime or member could see them.

`returnedTo: parent-agent` requires parent-visible result evidence such as a parent transcript, runtime wait result, tool return, or adapter parent-call record. Files, Workbench output, retained artifacts, and fixtures alone are not sufficient.

## Flow

1. prepare: resolve confirmed `memberName`, render `member-m[0]` and `member-m[1]`, select materials, and write packet-ready refs.
2. deliver: send packet by native subagent prompt, custom-agent task prompt, tool/sidecar call, or mounted packet.
3. execute: host runtime/member does the work; Context Tree does not create a generic subagent runtime.
4. return: member answer becomes parent-visible.
5. writeback: Context Tree writes `MemberTaskRun` with packet refs, delivery evidence, result-return evidence, visibility buckets, and known losses.

## Delivery Strength

- native subagent prompt: preferred path when the runtime accepts exact child input bytes and records runtime/tool observation.
- custom-agent task prompt: native-equivalent path for runtimes that name custom agents instead of subagents.
- tool/sidecar: accepted fallback when it returns the member answer to the parent agent.
- mounted-only: weak/debug unless read/expand/runtime observation proves consumption.

## Parent Return

`returnedTo: parent-agent` is a product claim, not a storage claim. It requires parent-visible result evidence such as parent transcript, runtime wait result, tool return, or adapter parent-call record. A result file, Workbench render, retained artifact, or fixture can support traceability, but cannot by itself prove parent-agent return.

## Visibility Mapping

Delivery evidence can carry item-level visibility values:

- `intended-model-input`
- `runtime-input-observed`
- `provider-model-input-observed`
- `mounted`
- `searchable`
- `source-only`
- `unknown`

`MemberTaskRun.materials` must either preserve those item-level values or map them into aggregate buckets:

- `provider-model-input-observed`, `runtime-input-observed`, and accepted `intended-model-input` map to model-visible evidence refs.
- `mounted` maps to `mountedEvidenceRefs`.
- `searchable` maps to `searchableEvidenceRefs`.
- `source-only` and `unknown` map to `sourceOnlyRefs`.

Mounted-only visibility must not be promoted to model-visible without read, expand, or runtime observation proving consumption.
