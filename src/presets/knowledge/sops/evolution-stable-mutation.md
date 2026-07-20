# Evolution Stable Mutation SOP

## Purpose

Keep EvoBuddy evolution safe, source-backed, small, and reviewable.

## Rules

1. Prefer minimal diffs over full-file rewrites.
2. Preserve existing headings, examples, and source refs unless the proposal explains why they are obsolete.
3. Add or narrow before deleting.
4. Mark material as superseded before removing it when history matters.
5. Do not delete active definitions as part of a low-risk change.
6. Do not remove large sections, change authority boundaries, or change active roster status without high-risk review.
7. Split a large definition by first adding referenced SOP or knowledge material, then replacing inline detail with pointers in a later step.
8. Include previous digest or rollback note for every durable apply.
9. If the safe patch cannot be expressed as a small diff, leave a candidate proposal instead of applying.

## Low-Risk Examples

- Add a source-backed SOP note.
- Add a negative routing example.
- Refine return-contract wording without changing authority.
- Add a recent update summary.
- Add a candidate definition under `_candidates/` without activation.

## High-Risk Examples

- Change a TeamAgent's authority to edit, delete, or run destructive commands.
- Make coordinator mandatory.
- Change the default active roster.
- Change Evolution Agent itself.
- Create or activate a new primary TeamAgent.
- Broaden a read-only SubagentBuddy into mutation-capable behavior.
- Delete or archive an active definition.
