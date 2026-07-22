# Team Member Profile Contract

This contract is for creating or validating a `TeamMemberProfile`. A profile defines a reusable specialist member identity, not a one-off runtime instance.

## Boundary

Profile files are user/member identity inputs. They describe what a member is responsible for and what materials inform its role. They are **not** evidence that a spawned member actually saw those materials during a task run. That evidence lives in `MemberTaskRun.contextSources` and `MemberTaskRun.materials`.

```text
TeamMemberProfile: user-curated member identity
  -> defines role, responsibilities, standards, memory refs, activation rules
  -> used by prepareMemberTask to resolve member context
  -> does NOT certify that any runtime instance received these materials

MemberTaskRun: runtime evidence that a member received and completed a task
  -> records contextSources, materials, fidelity, knownLosses
  -> profile refs may appear as contextSources but only MemberTaskRun proves consumption
```

## Required Fields

| Field | Type | Rule |
|---|---|---|
| `name` | string | Stable kebab-case slug. Unique within registry scope. Expresses a reusable **responsibility**, not a one-off task, date, session, checkpoint, or model. Example: `skill-designer`, not `review-current-skill`. |
| `description` | string | Routing/trigger language. Must describe **when** to activate this member, not a generic capability advertisement. Example: `Use when writing or reviewing Context Tree skills, especially trigger rules, rule/skill separation, and Superpowers compatibility.` Do not write: `An expert skill designer that knows everything about skills.` |
| `role` | string | Human-readable role label. Example: `Skill Designer`, `Live Eval Checker`, `Architecture Reviewer`. |
| `responsibilities` | string[] | Concrete duties this member performs. Each item must be actionable and scoped. |
| `standardsRefs` | string[] | References to standards, conventions, or rules this member must follow. |
| `roleMemoryRefs` | string[] | References to role memory artifacts: past corrections, successful outputs, review conclusions, failure patterns. |
| `activationHints` | string[] | Positive routing cues. Topics, task descriptions, or trigger phrases that suggest this member should be activated. |
| `negativeActivationHints` | string[] | Negative routing cues. Topics, task descriptions, or trigger phrases that suggest this member should NOT be activated. |

## Name Rules

1. `name` MUST use stable kebab-case: lowercase letters, digits, and hyphens only (`[a-z][a-z0-9-]*`).
2. `name` MUST express a reusable responsibility, not a one-time task or transient action. Use `skill-designer`, not `review-current-skill`.
3. `name` MUST NOT contain runtime state: no dates, session IDs, checkpoint IDs, model names, or user temporary goals.
4. `name` MUST be unique within its registry scope. If two scopes permit the same name, the scope precedence must be defined.
5. Renaming is a registry migration, not an inline edit. Old names enter `aliases`; old activation records keep their original `memberName`.

## Member Name vs Runtime Agent ID

A `TeamMemberProfile` defines a **stable user-facing member identity** (`memberName`). It is distinct from:

- `runtimeAgentId`: The ephemeral runtime identifier assigned by the host platform (Codex, Claude Code, OpenCode) to a specific spawned/resumed agent instance. A single `memberName` can map to many `runtimeAgentId` values across different task runs.
- `resolvedMemberId`: An optional internal immutable storage key. It exists only for registry operations (rename, merge, migration). It MUST NOT be the primary agent-facing parameter.

```text
memberName: stable kebab-case responsibility identity (user/agent-facing)
runtimeAgentId: ephemeral host-platform instance id (runtime-facing)
resolvedMemberId: internal storage surrogate (registry-facing, optional)
```

These three identifiers serve different layers and MUST NOT be conflated.

## Post-Hoc Member Relabeling Prohibition

Post-hoc relabeling of `memberName` in a `MemberTaskRun` record without a corresponding `memberTaskRequestRef` or equivalent runtime/provider evidence is forbidden.

If a member was renamed:

1. The original `memberName` in historical `MemberTaskRun` records MUST remain as-is.
2. A new activation with the new `memberName` MUST reference the profile migration via `aliases`.
3. Relabeling a historical run record to a different `memberName` without the original `memberTaskRequestRef` or equivalent runtime/provider evidence that proves which member was actually activated constitutes fabrication and is prohibited.

## Routing Rules

1. Explicit `memberName` invocation takes priority over automatic routing.
2. Automatic routing uses `description`, `responsibilities`, `activationHints`, and `negativeActivationHints` to match against the current task.
3. `description` MUST be written as a trigger condition (when to activate), not as a capability advertisement.
4. When multiple members match, prefer the more specific member. If still ambiguous, surface candidates to the caller rather than silently picking one.
5. `negativeActivationHints` serve as exclusion filters: if a task matches a negative hint, that member MUST NOT be auto-activated for that task.
6. If no member matches, do not force activation.

## Profile vs Evidence

A `TeamMemberProfile` is a declaration of intent: what this member is supposed to know and follow. It is NOT proof that a runtime agent instance received, read, or applied these materials.

Proof that materials reached a specific task run lives in:
- `MemberTaskRun.contextSources`: which sources were selected
- `MemberTaskRun.materials`: which materials were model-visible, mounted, searchable, or source-only
- `MemberTaskRun.fidelity`: the actual context recovery fidelity achieved
- `MemberTaskRun.knownLosses`: what was unavailable or degraded

Do not treat profile presence as evidence of material consumption.

## Confirmed Profile vs MemberProfileCandidate

A confirmed profile is a `TeamMemberProfile` that is present in the confirmed registry and may become a default Expert through registry/projection flows. A `MemberProfileCandidate` is a suggested Expert (建议的 Expert), not a confirmed profile and not a default Expert.

```ts
type MemberProfileCandidate = {
  memberName: string
  role: string
  routingDescription: string
  evidenceRefs: string[]
  confidence: number
  status: "candidate" | "confirmed" | "rejected" | "merged"
  defaultExpert: false
}
```

Unconfirmed candidates must keep `defaultExpert: false` and must not create a default Expert, active role memory, or `member-m[0]` entry. V0 setup/import actions are `Confirm / Rename / Add to existing Expert / Discard`; only Confirm may create a confirmed profile, Rename changes the candidate identity before confirmation, Add to existing Expert records candidate evidence on an existing member, and Discard rejects the suggestion while retaining evidence.

## Example

```json
{
  "name": "skill-designer",
  "description": "Use when writing or reviewing Context Tree skills, especially trigger rules, rule/skill separation, and Superpowers compatibility.",
  "role": "Skill Designer",
  "responsibilities": [
    "Write skill design and implementation plans",
    "Review skills against Superpowers writing-skills rules",
    "Ensure skill trigger conditions are symptom-driven"
  ],
  "standardsRefs": [
    "docs/skills/context-tree-skill-rules.md",
    ".superpowers/skills/writing-skills/SKILL.md"
  ],
  "roleMemoryRefs": [
    "docs/role-memory/skill-designer-corrections.md",
    "docs/role-memory/skill-designer-successful-outputs.md"
  ],
  "activationHints": [
    "skill design",
    "skill rules",
    "Superpowers writing-skills",
    "trigger conditions",
    "rule/skill separation"
  ],
  "negativeActivationHints": [
    "runtime implementation",
    "native spawn debugging",
    "eval runner scripting"
  ]
}
```

## Contract Compliance

A `TeamMemberProfile` is contract-compliant only when:

1. All required fields (`name`, `description`, `role`, `responsibilities`, `standardsRefs`, `roleMemoryRefs`, `activationHints`, `negativeActivationHints`) are present.
2. `name` is valid kebab-case and expresses a reusable responsibility.
3. `description` is routing/trigger language, not a capability advertisement.
4. The profile does not claim to be evidence of material consumption by any runtime instance.
5. The profile clearly distinguishes `memberName` (stable user-facing identity) from `runtimeAgentId` (ephemeral host-platform instance id).
6. Post-hoc member relabeling without `memberTaskRequestRef` or equivalent runtime/provider evidence is explicitly forbidden.
7. Confirmed profiles are distinct from `MemberProfileCandidate` suggested Experts; unconfirmed candidates keep `defaultExpert: false` and must not become default Experts without a host-applied confirmation mutation.
