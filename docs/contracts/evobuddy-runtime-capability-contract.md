# EvoBuddy Runtime Capability Contract

## Schema

- Capability schema: `evobuddy.runtime-capability.v1`
- Capability version: `1`
- Continuation kinds: `exact-resume`, `heuristic-resume`, `continue-with-context`, `fresh-session`, `unsupported`

## Rules

- Exact resume requires a validated provider conversation identity.
- If validated identity is absent, the resolver must fail closed.
- Heuristic resume is distinct from exact resume and must never be labeled as exact.
- Context continuation is distinct from both exact-resume and heuristic-resume.
- Unsupported capability must surface a reason instead of guessing.
- Fresh-session is allowed only when the runtime explicitly supports it.

## Prohibitions

- No exact-resume overclaim.
- No arbitrary shell behavior leaks into capability descriptors.
- No secret, raw auth token, env value, or command text is stored in the capability record.

## Decision meaning

- `exact-resume`: only with validated provider identity.
- `heuristic-resume`: a best-effort candidate exists, but not exact proof.
- `continue-with-context`: launch a new runtime session with TaskRoom context.
- `fresh-session`: open a new session without prior conversation continuity.
- `unsupported`: capability is unavailable or unsafe to claim.
