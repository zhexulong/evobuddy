# EvoBuddy Native Session Contract

## Schema

- Descriptor schema: `evobuddy.native-session.v1`
- Descriptor version: `1`
- Required fields: `descriptorId`, `roomId`, `agentInstanceId`, `runtime`, `workspace`, `terminalSubstrate`, `terminalSessionRef`, `launchCommandRef`, `runtimeCapabilityRef`, `lifecycle`, `createdAt`, `safetyMode`, `evidenceRefs`, `recoveryPolicy`, `digest`
- Optional nullable fields: `providerConversationRef`, `lastAttachedAt`, `contextPacketRef`

## Invariants

- `launchCommandRef` and `runtimeCapabilityRef` are opaque registry references, not executable text.
- No secrets are serialized. Descriptors contain no command text, argv, env values, raw auth tokens, passwords, API keys, or transcript captures.
- No arbitrary shell is allowed. Shell executables or shell command strings are rejected rather than normalized.
- TaskRoom identity is never derived from terminal session ids. `roomId` is a durable TaskRoom identifier, and tmux/session names are only liveness/display facets.
- Exact-resume overclaim is prohibited. Descriptor presence alone does not imply provider-backed exact resume.
- Terminal output or idleness is not completion proof.
- Lifecycle values are exactly: `creating`, `attachable`, `attached`, `detached`, `stale`, `failed`, `terminated`.

## Rejection rules

- Reject unknown fields.
- Reject `launchCommand`, `argv`, `args`, `env`, `environment`, `token`, `authToken`, and secret-bearing values.
- Reject session-derived `roomId` values.
- Reject invalid lifecycle transitions.

## Continuation boundary

This contract stores ownership and recovery metadata only. It does not claim that an existing terminal session proves result return, handoff completion, or provider conversation continuity.
