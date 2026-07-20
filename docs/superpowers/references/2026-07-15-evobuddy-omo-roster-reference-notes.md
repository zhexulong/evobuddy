# EvoBuddy OMO/Trellis/GenericAgent Roster Reference Notes

## Source Availability

- `/home/prosumer/agent/oh-my-openagent`: present, inspected files: `README.md`, `docs/guide/agent-model-matching.md`. Local README names Sisyphus, Hephaestus, Prometheus, Oracle, Librarian, Explore, Momus, and Sisyphus-Junior roles; the model-matching guide distinguishes utility runners (`Explore`, `Librarian`, `Sisyphus-Junior`) from high-reasoning consultants (`Oracle`, `Momus`) and from orchestrator/planner roles.
- `/home/prosumer/agent/Trellis`: present, inspected files: `README.md`, `.opencode/agents/research.md`, `.claude/agents/research.md`, `packages/cli/src/templates/codex/agents/research.toml`. Local sources show multi-platform projection over shared repo-local structure and explicit read-only research agent permissions.
- `/tmp/GenericAgent-ref`: present, inspected files: `README.md`, `memory/memory_management_sop.md`, `memory/subagent.md`, `assets/insight_fixed_structure_en.txt`, `assets/global_mem_insight_template_en.txt`. Local sources show compact layered memory pointers, action-verified writes, and subagent delegation as a bounded mechanism.

## Lessons Adopted

- OMO role decomposition adopted as Buddy roster candidates, not fixed parent prompt.
- Trellis projection pattern adopted: generated runtime files are projections over shared source.
- GenericAgent memory lesson adopted: compact pointers first, action-verified durable updates only.
- Read-only specialist boundaries are useful for codebase exploration and reference research.

## Lessons Rejected

- No mandatory Sisyphus-high parent orchestrator.
- No Prometheus hidden active subagent.
- No Trellis workflow taxonomy or `.evobuddy/workflows/` root.
- No GenericAgent raw-session durable store under `.evobuddy/`.

## V0 Roster Decisions

| Candidate | Decision | Source family | Exposure | Reason |
| --- | --- | --- | --- | --- |
| evolution-buddy | active | evobuddy-native | buddy | Owns source-backed evolution proposals and update summaries. |
| explore | active | omo-derived | buddy | Read-only codebase exploration benefits from independent context. |
| librarian | active | omo-derived | buddy | External docs/reference research benefits from independent context. |
| sisyphus-junior | active | omo-derived | buddy | Generic execution/debugging route; debugging benchmark may naturally select this. |
| oracle | available | omo-derived | buddy | Expensive high-reasoning consultant; useful but not default. |
| momus | available | omo-derived | buddy | Plan/check reviewer; useful by explicit request or scenario-specific routing. |
| atlas | archived | omo-derived | knowledge-or-skill-exposure | Too close to parent execution workflow for V0 default. |
| metis | available | omo-derived | buddy | Planning consultant only if concise definition proves distinct from oracle/momus. |
| hephaestus | archived | omo-derived | legacy-not-adopted | Deep autonomous mode needs later runtime-policy proof. |
| prometheus | archived | omo-derived | knowledge-or-skill-exposure | Human-facing planning/interview; not a hidden active subagent. |
| sisyphus-high | archived | omo-derived | legacy-not-adopted | Parent-orchestrator persona; not default EvoBuddy dependency. |
| debugging-investigator | archived | internal-eval | legacy-not-adopted | Do not force when natural routing selects sisyphus-junior. |
| skill-designer | internal | internal-eval | buddy | Product-authoring/eval support only. |

## Open Human Decisions

- None for V0 active roster unless later live eval shows active roster is too noisy.
