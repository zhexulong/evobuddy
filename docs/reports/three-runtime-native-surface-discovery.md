# Three-Runtime Native Surface Discovery

This report is discovery only and is not proof, pass, or release acceptance.

The target normalized proof kind is `runtime-native-buddy-surface-proof` over the shared `runtime-native-subagent` surface.

Required runtimes: opencode, claude, codex

## opencode

- baselineProjection: observed
- nativeMechanism: observed
- naturalUse: blocked
- runtimeSurface: opencode-task
- actualSurface: runtime-native-subagent
- proof note: discovery only, not proof

## claude

- baselineProjection: observed
- nativeMechanism: blocked
- naturalUse: blocked
- runtimeSurface: claude-subagent
- actualSurface: runtime-native-subagent
- proof note: discovery only, not proof

## codex

- baselineProjection: observed
- nativeMechanism: observed
- naturalUse: blocked
- runtimeSurface: codex-native-subagent
- actualSurface: runtime-native-subagent
- proof note: discovery only, not proof
- local Codex primary sources observed: yes
- codex child/agent identity evidence: new_thread_id, agent_path, new_agent_role observed
- codex role/runtime hook evidence: apply_role_to_config, apply_spawn_agent_runtime_overrides, apply_requested_spawn_agent_model_overrides, HOOK_EVENT_NAMES, PreToolUse, PostToolUse, HookEventAfterAgent observed
- codex normalization: SubAgentSource::thread_spawn normalized from Rust source symbol SubAgentSource::ThreadSpawn
- live signal visibility:
  - spawn_agent: observed
  - wait completion: observed
  - fork mode: observed
  - child result: observed
  - parent-observed result return: blocked (codex-live-native-surface-not-observed)
## Proof Fields Required Later

All three runtimes must eventually provide normalized proof fields for baseline definition lineage, parent/child linkage, invocation prompt lineage, exporter/source transcript references, negative controls, known losses, and parent-observed result return.

Local Codex primary sources observed locally in this environment.
Codex child/agent identity concepts are grounded by source refs for `new_thread_id`, `agent_path`, and `new_agent_role`. Codex role/application hook concepts are grounded by source refs for `apply_role_to_config`, `apply_spawn_agent_runtime_overrides`, `apply_requested_spawn_agent_model_overrides`, and hook declarations including `HOOK_EVENT_NAMES`, `PreToolUse`, `PostToolUse`, and `HookEventAfterAgent`. Discovery normalizes `SubAgentSource::ThreadSpawn` to `SubAgentSource::thread_spawn` for cross-runtime vocabulary alignment and retains the exact source symbol/ref for traceability. Current structured discovery shows `spawn_agent`, wait completion, fork mode, and child result as observed in runtime-observation code surfaces, while parent-observed result return remains blocked as `codex-live-native-surface-not-observed`.
