# EvoBuddy Knowledge / Buddy / Skill Reference Notes

## Verified Trellis Lessons
- Repo-local markdown is the durable source: Trellis stores shared project rules in `.trellis/spec/`, task context in `.trellis/tasks/`, and workflow guidance in `.trellis/workflow.md`.
- Index files point to detailed docs; generated platform surfaces are projections. The README shows one `.trellis/` core projected into Claude Code, Cursor, OpenCode, Codex, Gemini, GitHub Copilot, and other runtime-specific files.
- Compact index injection is useful; fixed workflow harness adoption is not required. Trellis's `workflow.md` contains mandatory plan/implement/check/debug-style process guidance, but EvoBuddy should reuse the index/projection pattern without copying the harness as product core.
- Session recording and spec updates are explicit outcome-bound commands. `/record-session` is only for after human testing and commit; `/update-spec` is for learned implementation contracts, patterns, gotchas, and conventions.
- Do not copy Trellis workflow taxonomy, plan/implement/check/debug phase chain, or `.trellis/` directory names into EvoBuddy.

## Verified GenericAgent Lessons
- L1 is a minimal insight index: existence pointers only, no how-to dump. `memory_management_sop.md`, `memory_cleanup_sop.md`, and `assets/global_mem_insight_template_en.txt` all keep L1 short and pointer-oriented.
- L2 stores stable facts; volatile state is rejected. GenericAgent explicitly forbids current timestamps, temporary session IDs, running PIDs, and similar high-churn facts.
- L3 stores reusable task SOPs/Skills from verified work. The README describes self-evolution as crystallizing solved execution paths into reusable Skills; memory SOPs describe L3 SOP/script records for future reuse.
- No Execution, No Memory: durable updates must come from verified action/results, not model guesses or passive prompt mentions.
- Minimum Sufficient Pointer: higher layers point to lower layers without duplicating details; L1 uses existence coding so the agent can discover deeper SOPs on demand.

## EvoBuddy Mapping
- `.evobuddy/knowledge/index.md` maps to L1-style insight index and is discovery memory, not execution surface.
- `.evobuddy/knowledge/facts.md` maps to L2-style stable project facts.
- `.evobuddy/knowledge/sops/*.md` maps to L3-style reusable SOP/skill knowledge. Skills and Buddies reference SOPs when they depend on reusable how-to.
- `.evobuddy/evidence/`, `.evobuddy/knowledge/evidence/`, and `.evobuddy/mutations.jsonl` are not durable roots. Source support is recorded as minimal pointers/digests in changed Markdown and concise recent-update summaries.
- Trellis uses task/session context jsonl files and repo-local markdown/templates, not a mutation log as durable memory. GenericAgent uses layered memory/SOP markdown and raw session mining inputs, not `mutations.jsonl`.
- `.evobuddy/buddies/` stores project Buddy definitions/overlays.
- `.evobuddy/skills/` stores project Skill definitions.

## Repo Baseline
- Current target kinds include legacy Buddy-specific and skill/practice kinds.
- Current durable store can write top-level `.evobuddy/skills/` and `.evobuddy/practices/` paths.
- This plan keeps `.evobuddy/skills/` as a real project Skill surface, rejects `.evobuddy/practices/` as a V0 root, and removes the self-invented `.evobuddy/library/` material root.

## Local Reference Sources Re-Checked
- `/home/prosumer/agent/Trellis/README.md`
- `/home/prosumer/agent/Trellis/.trellis/workflow.md`
- `/home/prosumer/agent/Trellis/.cursor/commands/trellis-update-spec.md`
- `/home/prosumer/agent/Trellis/.cursor/commands/trellis-record-session.md`
- `/tmp/GenericAgent-ref/README.md`
- `/tmp/GenericAgent-ref/assets/tools_schema.json`
- `/tmp/GenericAgent-ref/assets/insight_fixed_structure_en.txt`
- `/tmp/GenericAgent-ref/assets/global_mem_insight_template_en.txt`
- `/tmp/GenericAgent-ref/memory/memory_management_sop.md`
- `/tmp/GenericAgent-ref/memory/memory_cleanup_sop.md`
- `/tmp/GenericAgent-ref/memory/L4_raw_sessions/salient_mining_sop.md`
- `src/core/evolution-durable-store.mjs`
- `src/core/evobuddy-project-state.mjs`
