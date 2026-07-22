# Runtime Native Buddy Surface Proof Contract

This contract aligns **OpenCode**, **Claude Code**, and **Codex** around the **same product capability**: a normalized `runtime-native-subagent` Buddy proof boundary with observable parent → child → result return evidence.

## Core Boundary

- The release target is the same functionality across all three runtimes.
- `projection-only` evidence cannot pass.
- `adapter-only` evidence cannot pass.
- Codex is **required** and is not optional in the three-runtime proof surface.
- The Task 0 probe is discovery only. It must never claim proof, release pass, or runtime pass.

## Codex Surface Grounding

Current Codex surface vocabulary must stay explicit even when local primary-source files are unavailable in this workspace:

- `spawn_agent`
- `wait_agent`
- `SpawnAgentForkMode`
- `fork_turns`
- `SubAgentSource::thread_spawn`
- `SubAgentActivityEvent`
- parent / child linkage and result return observability

`spawn_agent` with `fork_turns` is part of the native mechanism vocabulary, but the proof still requires parent-observed child linkage and parent-observed result return.

## Release-Normalized Proof Shape

```json
{
  "proofKind": "runtime-native-buddy-surface-proof",
  "schemaVersion": "runtime-native-buddy-surface-proof-v1",
  "runtime": "opencode|claude|codex",
  "memberName": "skill-designer",
  "runtimeAgentName": "skill-designer|skill_designer|...",
  "actualSurface": "runtime-native-subagent",
  "runtimeSurface": "opencode-task|claude-subagent|codex-native-subagent",
  "baselineDigest": "sha256:...",
  "baselineDefinitionRef": "...",
  "baselineDefinitionDigest": "sha256:...",
  "parentSessionRef": "...",
  "childSessionRef": "...",
  "parentChildLink": {
    "kind": "runtime-parent-child-link",
    "parentId": "...",
    "childId": "..."
  },
  "invocationPromptRef": "...",
  "invocationPromptDigest": "sha256:...",
  "resultReturn": {
    "returnedTo": "parent-agent",
    "resultRef": "...",
    "resultDigest": "sha256:..."
  },
  "exporterManifestRef": "...",
  "exporterManifestDigest": "sha256:...",
  "sourceTranscriptRef": "...",
  "sourceTranscriptDigest": "sha256:...",
  "negativeControls": {
    "adapterOnly": false,
    "projectionOnly": false,
    "retainedOnly": false,
    "summaryOnly": false,
    "answerCanaryOnly": false,
    "selfClaimOnly": false
  },
  "knownLosses": []
}
```

Runtime-specific names are allowed only inside `runtimeSurface` / `runtimeEvidence`. Release status uses the same normalized fields for all three runtimes.

## Status Model

Task 0 discovery tracks separate layers per runtime:

- `baselineProjection`
- `nativeMechanism`
- `naturalUse`

Discovery uses `observed`, `blocked`, or `unsupported` only. It does not emit pass.

Later release gates may compute `baselineProjectionPass`, `nativeMechanismPass`, and `naturalUsePass`, but Task 0 must keep those as downstream proof concepts rather than probe outcomes. `nativeMechanismPass` and `naturalUsePass` require stronger evidence than discovery.

## Required Evidence Meaning

The accepted proof boundary is `runtime-native-subagent` with:

- a parent session reference,
- a child session reference,
- a parent/child runtime link,
- the real invocation prompt reference,
- exporter and transcript references,
- and a parent-observed child result return back to the parent agent.

Without parent / child / result return evidence, there is no native Buddy proof.
