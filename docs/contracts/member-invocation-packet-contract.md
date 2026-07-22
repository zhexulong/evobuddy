# Member Invocation Packet Contract

This contract defines `member-invocation-packet.json`, the artifact handed to a member invocation after the parent has prepared a request, rendered member context, and produced a material selection report.

## Boundary

The packet is an invocation envelope. It references the activation authority and context layout artifacts:

```text
member-task-request.json
member-context-render.json
material-selection-report.json
-> member-invocation-packet.json
-> child/member execution input
```

The packet must reference `member-task-request.json`, `member-context-render.json`, and `material-selection-report.json`; it must not duplicate those records as authority. `preparedChildInput` and `preparedChildInputDigest` may be duplicated because they are the concrete deliverable bytes sent to the child/member.

Projection is not delivery. `member-invocation-packet.json` records what the parent prepared for invocation, but it is not result-return evidence and does not prove the member consumed material or returned output. There is no result-return evidence yet at packet creation time.

## Product Record: MemberInvocationPacket (member-invocation-packet.json)

```ts
{
  kind: 'member-invocation-packet'
  memberName: string
  memberTaskRequestRef: string
  memberContextRenderRef: string
  materialSelectionReportRef: string
  task: { kind: string, question: string, targetRefs: string[] }
  expectedResultReturn: string
  preparedChildInput: { kind: 'prompt-text', text: string }
  preparedChildInputDigest: string
  m0Refs: string[]
  m1Refs: string[]
  targetRefs: string[]
  writeback: { expectedResultReturn: string }
  invocationPacketDigest: string
}
```

## Required Meaning

| Field | Required | Meaning |
|---|---|---|
| `kind` | Yes | Always `member-invocation-packet`. |
| `memberName` | Yes | Resolved member receiving the invocation. |
| `memberTaskRequestRef` | Yes | Ref to matching `member-task-request.json`; the request remains activation authority. |
| `memberContextRenderRef` | Yes | Ref to matching `member-context-render.json`; render remains layout authority. |
| `materialSelectionReportRef` | Yes | Ref to matching `material-selection-report.json`; selection remains placement/accounting authority. |
| `task` | Yes | Task shape copied for convenient invocation context, not as separate authority. |
| `expectedResultReturn` | Yes | Where the member is expected to return the result, normally `parent-agent`. |
| `preparedChildInput` | Yes | Concrete child input bytes/object prepared by the parent. |
| `preparedChildInputDigest` | Yes | Digest of the prepared child input. |
| `m0Refs` | Yes | Stable baseline refs from the render artifact. |
| `m1Refs` | Yes | Activation delta refs from the render artifact. |
| `targetRefs` | Yes | Explicit target refs for this invocation. |
| `writeback.expectedResultReturn` | Yes | Returned-to gate for the child/member: return to the expected parent-agent, not to hidden storage. |
| `invocationPacketDigest` | Yes | Stable digest of invocation semantics excluding absolute artifact refs. |

## Digest Rules

`invocationPacketDigest` must cover the stable invocation semantics:

- `memberName`
- `task`
- `expectedResultReturn`
- `preparedChildInputDigest`
- `m0Refs`
- `m1Refs`
- `targetRefs`
- `writeback`

The digest must not include mutable self references or absolute artifact paths. Moving the same prepared lifecycle request to another output directory must not change the packet digest solely because `memberTaskRequestRef`, `memberContextRenderRef`, or `materialSelectionReportRef` changed.

## Visibility and Return Constraints

- `m0Refs` and `m1Refs` must preserve the render layout; the packet does not weaken material visibility or returned-to gates.
- Searchable or source-only material remains governed by `material-selection-report.json`; the packet must not promote it to visible material by implication.
- `writeback.expectedResultReturn` must match `expectedResultReturn` and must preserve the returned-to gate.
- The packet is not a memory write, Workbench artifact, roster suggestion, explicit product path gate, final eval, or result-return evidence.

## Contract Compliance

A `member-invocation-packet.json` record is contract-compliant only when:

1. It has `kind: 'member-invocation-packet'`.
2. It includes non-empty `memberTaskRequestRef`, `memberContextRenderRef`, and `materialSelectionReportRef`.
3. It includes `preparedChildInput` and `preparedChildInputDigest`.
4. It references request/render/selection artifacts rather than duplicating them as authority.
5. It preserves `m0Refs`, `m1Refs`, `targetRefs`, `expectedResultReturn`, and `writeback.expectedResultReturn`.
6. It makes clear that projection is not delivery and no result-return evidence exists yet.

## V2 Invocation Artifact Migration

Product records now use `schemaVersion: 'member-invocation-packet-v2'` with baseline/invocation-requested semantics:

```ts
{
  kind: 'member-invocation-packet'
  schemaVersion: 'member-invocation-packet-v2'
  memberName: string
  expectedBaselineDigest?: string
  baselineInstallReportRef?: string
  invocationPrompt: { kind: 'prompt-text', text: string }
  invocationPromptDigest: string
  parentSuppliedTaskContext: { targetRefs?: string[], requestedMaterialRefs?: string[], provenance?: string }
  expectedResultReturn: string
  targetRefs: string[]
  writeback: { expectedResultReturn: string }
  compatibility: {
    memberContextRenderRef?: string
    materialSelectionReportRef?: string
    preparedChildInputDigest?: string
    m0Refs?: string[]
    m1Refs?: string[]
  }
}
```

`m0Refs` and `m1Refs` are compatibility aliases, not product authority. They are deprecated aliases for one migration version and may be retained only under `compatibility` or as mirror fields for old readers. The product digest authority must cover `memberName`, `expectedBaselineDigest`, `baselineInstallReportRef`, `invocationPromptDigest`, `parentSuppliedTaskContext`, `targetRefs`, `expectedResultReturn`, and `writeback`; it must exclude compatibility aliases.

The invocation prompt is the parent/wrapper-supplied request. It must not require `member-m[1]`, `member-m[0]`, proof sections, or answer canary repetition. Answer canary repetition is not product proof. Projection-only baseline reports do not prove invocation/result return; result proof must come from runtime/input/delivery/result evidence in later artifacts.
