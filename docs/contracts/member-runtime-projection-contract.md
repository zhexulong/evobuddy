# Member Runtime Projection Contract

Runtime projection turns a confirmed `TeamMemberProfile` into native runtime definition files. It is definition-only. A definition is not packet delivery and does not prove model-visible materials or result return evidence.

## Required Boundaries

- `memberName` remains the stable Context Tree identity.
- `memberName` maps to runtime names such as Codex `skill_designer`; each mapped `runtimeAgentName` is not a replacement for `memberName`.
- Generated definitions contain stable role/routing/return-to-parent/packet-use instructions.
- Generated definitions must not include task-local target materials, m[1] deltas, or evidence claims.
- Full invocation support requires separate `member-invocation-packet.json`, delivery evidence, result-return evidence, and `MemberTaskRun` writeback.

## Projection Inputs

A runtime projection consumes a validated `TeamMemberProfile`, the resolved stable `memberName`, a `generatorVersion`, and optional runtime-specific names. The profile remains the source of role identity; projection only maps it into host runtime definition formats.

## Projection Outputs

Projection output is a deterministic bundle with one definition for each supported runtime:

- Codex agent TOML definition.
- Claude agent Markdown definition.
- OpenCode subagent Markdown definition.

Each definition may carry stable references from the profile, such as standards and role memory refs, but those references are routing and preparation instructions only. They are not evidence that a task run delivered, displayed, mounted, or otherwise made any material available to a model.

The setup/sync/doctor installer report contract is defined separately in `docs/contracts/member-projection-installer-contract.md`. That contract owns filesystem projection status, digest-based ownership checks, and runtime discovery honesty for installed definition files.

## Non-Goals

This contract does not define packet delivery, invocation packet generation, result return evidence, memory writeback, Workbench behavior, CLI behavior, or `MemberTaskRun` persistence. Those capabilities require separate contracts and implementation tasks.
