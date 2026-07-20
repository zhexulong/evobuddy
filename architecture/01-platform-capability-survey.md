# 平台能力调研：如何尽可能恢复高保真上下文

## 1. 调研目标

本调研不问“平台是否提供一个完全符合 Context Tree 理想模型的 API”。这通常不会发生。

本调研问的是：

> 在 Codex / OpenCode / Claude Code 等现有 agent 工具中，如何利用原生 fork、rewind、resume、subagent、会话数据库、rollout、hook、命令和存储文件，尽可能把一个历史上下文点恢复给另一个 agent 使用？

Context Tree 的 v0 设计必须从这些实际能力反推，而不是先假设存在完美的 `checkpoint` / `spawnFrom`。

## 2. 术语边界

### 模型上下文

模型实际收到并用于推理的上下文。通常由平台根据历史消息、工具结果、系统/开发者指令、compact recap、权限、cwd、模型设置、工具/MCP schema、hook 注入内容、skill/command 展开内容等组装。

模型上下文不等于完整 transcript，也不等于文件系统状态。

更严格地说：

```text
模型输入 = 会话记录 + prompt assembly + execution envelope + transform layers
```

因此两个可见 transcript 完全相同的会话，也可能因为 cwd、项目规则、全局记忆、工具 schema、hook 输出、压缩/裁剪状态或模型配置不同，而向模型发送不同请求。Context Tree 的高保真恢复目标应是**在稳定 turn 边界复现平台自己的 model-message 构造结果**，而不是宣称恢复隐藏 KV/cache 或 vendor 内部 system prompt。

### 会话记录

平台持久化的消息、事件、工具调用、工具结果、compact 记录、rollback/fork marker、turn metadata 等。它是恢复模型上下文的材料。

### 工作区状态

文件内容、git diff、snapshot、未跟踪文件、运行时进程等。它会影响任务结果，但不属于模型上下文本体。只有当目标任务需要时才作为目标材料或环境恢复材料使用。

### checkpoint 调用

在 Context Tree 里，agent 调用 checkpoint 通常不应理解为“保存一个静态记录”这么弱。

更准确地说，它是：

```text
当前 agent 认为自己处在一个可复用/可分叉的上下文点，
于是调用一个具有该上下文的 subagent / forked agent / restored agent，
让这个新 agent 基于同一上下文点执行审查、规划或指导。
```

也就是说，checkpoint 的核心是**创建一个可被另一个 agent 使用的上下文锚点**，而不只是写 metadata。

## 3. 高保真恢复策略梯度

实际系统应始终尝试最高可行 fidelity。这个原则是默认行为，不需要在调用 schema 里暴露成 `strongest-available` 字段。

优先级：

1. **原生上下文 fork**：平台直接把当前/历史 thread history fork 给新 agent。
2. **原生 session fork + 新 prompt**：平台复制会话历史，然后向 forked session 追加任务 prompt。
3. **编译上下文包**：读取平台持久化会话记录、prompt assembly 规则、compact/DCP/prune 状态，物化派生 agent 应见的上下文。
4. **会话历史重放**：读取平台持久化会话记录，按平台语义重建可提交给模型的 history。
5. **会话记录挂载**：新 agent 不能直接继承 history，但可以读取完整会话记录资源。
6. **摘要/任务包**：最后兜底；不算 Context Tree 的核心成功路径。

重点：如果只能做第 6 档，Context Tree 的价值会退化成普通 handoff；如果只能做第 5 档，则只是可用但低保真的会话记录挂载。

这里的第 3 档不是普通文档化。它更接近一个 context compiler：

```text
session record + prompt assembly recipe + transform layers
→ compiled context packet
```

如果该 packet 可以作为目标 agent 的 model-visible messages / structured input 注入，并且 eval 证明它和平台 native-current-context 在目标边界上等价，则它是强路径；如果只能作为可读附件让 agent 自行查阅，则降级为 `session-record-mounted`。

## 4. Codex 能力

### 4.1 可利用能力

Codex 仍是目前最接近 Context Tree 目标的平台，但“接近”指的是它有 thread/rollout 级别的原生 history fork 与 rollback，而不是能复制模型 KV/cache 或任意时刻的内部推理状态。

本地源码和 app-server 文档显示：

- `thread/fork` 可以从已有 thread 创建新 thread，并复制 stored history；app-server/TUI 路径默认以 interrupted snapshot 处理。
- `thread/rollback` 可以丢弃最后 N 个 turn，并让后续 resume 看到被裁剪后的 history；实现上是 flush/load persisted history 后 replay/reconstruct。
- MultiAgent v1 的 `spawn_agent(fork_context=true)` 会走 `SpawnAgentForkMode::FullHistory`。
- MultiAgent v2 已不接受 `fork_context`，改用 `fork_turns: "all" | "none" | <positive-int>`；缺省通常是 `all`，但 full-history fork 会继承/锁定部分 parent agent 配置，不能随意 override。
- `spawn_subagent` / forked thread 会读取 parent rollout/store 并过滤成 initial history；它是 stored-history fork，不是 live model-state fork。
- Codex rewind/backtrack 走 `thread_rollback`，不是恢复模型 KV/cache，而是从 persisted thread history replay 出新的 in-memory history。

本地证据：

- `/home/prosumer/agent/codex/codex-rs/app-server/README.md`
  - `thread/fork`：复制 stored history，返回 forked thread。
  - `thread/rollback`：drop last N turns from agent in-memory context，并持久化 rollback marker。
- `/home/prosumer/agent/codex/codex-rs/core/src/tools/handlers/multi_agents_spec.rs`
  - `fork_context` 字段说明 fork current thread history into the new agent。
- `/home/prosumer/agent/codex/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs`
  - v2 拒绝 `fork_context`，要求使用 `fork_turns`。
- `/home/prosumer/agent/codex/codex-rs/core/src/agent/control.rs`
  - `SpawnAgentForkMode::{FullHistory, LastNTurns}`；`keep_forked_rollout_item` 会过滤 rollout items。
- `/home/prosumer/agent/codex/codex-rs/core/src/thread_manager.rs`
  - `spawn_subagent` 从 parent thread 读取 stored history，转成 initial history。
  - `fork_thread_from_history` / `fork_thread_with_initial_history` 执行 history-based fork。
  - `ForkSnapshot::Interrupted` 与 `TruncateBeforeNthUserMessage` 暗示可用边界，不是任意模型内部时刻。
- `/home/prosumer/agent/codex/codex-rs/core/src/session/handlers.rs`
  - `thread_rollback` flush/load persisted history，追加 rollback marker，重建 history。
- `/home/prosumer/agent/codex/codex-rs/core/src/session/rollout_reconstruction.rs`
  - replay rollout，处理 compaction replacement history、TurnContext、rollback marker。

### 4.2 Codex rewind/rollback 暗示的上下文需求

Codex 的 rollback 机制说明，高保真上下文恢复至少需要：

- user / assistant response items；
- turn 边界；
- `TurnContext`；
- previous turn settings；
- reference context item；
- compaction replacement history / compact summary；
- rollback markers；
- 被 rollback 裁剪后的 pre-turn context updates；
- token usage 重算。

因此 Context Tree 不能只保存 transcript 文本。它应尽可能引用或复制 Codex rollout / thread-store 中的结构化 history。

同时要接受一个重要边界：Codex fork 给新 agent 的并不是 rollout 原样全量。`keep_forked_rollout_item` 会保留 system/developer/user、final-answer assistant、compacted item、event/session meta 等，但会丢弃 reasoning、工具调用与工具结果、`TurnContext`、非 final-answer assistant message、部分 search/web/image/custom tool items。也就是说，Codex 的“full history fork”在产品语义上很强，但在模型输入层面仍是**经过平台过滤后的 stored-history fork**。

### 4.3 Codex 可行路径

Codex v0 仍应优先做，但要把 “fork” 的语义写窄：它是 Codex rollout/thread store 的**过滤后 stored-history fork**，不是模型 KV/cache 或任意内部推理状态 fork。

```text
Context Tree node -> Codex thread id / rollout path / optional turn boundary
current checkpoint -> MultiAgent v1 spawn_agent(fork_context=true)
                   -> 或 MultiAgent v2 spawn_agent(fork_turns="all")
historical checkpoint -> fork/source thread history + turn/start(reviewer/planner prompt)
base selection -> stable user-turn boundary, rollback reconstruction, or explicit fork snapshot
result -> attach child thread id + CaptureManifest(knownLosses)
```

最强路径仍是：

```text
从某个 ContextNode 指向的 Codex thread/rollout history fork 新 thread，
然后把 reviewer/planner prompt 作为新 turn 发送给 forked thread。
```

但这里的 “history” 必须按 Codex 自己的 `keep_forked_rollout_item` 和 compaction/rollback 语义解释。对于当前 agent 的上下文点，直接调用 `spawn_agent` / forked subagent 可以登记为 checkpoint，但只有在所用接口明确启用父历史 fork 时才成立：

- MultiAgent v1：`fork_context=true`；
- MultiAgent v2：`fork_turns="all"` 或明确的 last-N turns；
- app-server / TUI `thread/fork`：更接近 interrupted snapshot 语义，适合 thread 分支，但不是任意 live-turn 复制。

因此，Codex adapter 需要同时记录：接口版本、fork 模式、source thread/rollout、边界类型、以及被平台过滤掉的 item 类型。

### 4.4 Codex 风险

- **Full-history fork 不是 live model fork**：源码显示复制/重建的是 stored rollout / initial history，不是 KV/cache、provider prompt cache 或采样中的模型状态。
- **“full history” 会被平台过滤**：`keep_forked_rollout_item` 会丢弃 reasoning、工具调用/工具结果、`TurnContext`、非 final-answer assistant message，以及部分 search/web/image/custom tool items。Context Tree 不能把它等同于完整 transcript replay。
- **API 版本有语义漂移**：MultiAgent v1 使用 `fork_context`；MultiAgent v2 拒绝 `fork_context`，改用 `fork_turns`。full-history fork 还可能继承并锁定 parent agent type / model / reasoning effort，导致某些 overrides 被拒绝。
- **compaction 是硬 fidelity 边界**：rollback reconstruction 遇到 `Compacted` / `replacement_history` 会把 replacement history 作为新 base；legacy compaction 可能只能从 user messages + compact summary 重建，不能保证恢复 raw pre-compaction history。
- **mid-turn fork 不是任意时刻快照**：`ForkSnapshot::Interrupted` 会追加 interrupted/aborted boundary；源码 TODO 也承认目前没有 non-interrupting live-turn snapshot。
- **rollback 是 persisted-history reconstruction**：`thread_rollback` 会 flush/load/replay/recompute token usage；它不是模型状态回滚，而且 app-server/core 对 turn 计数单位的理解可能不同，需要 adapter 明确边界单位。
- **TUI `/fork` 控制面较弱**：TUI 走 app-server client 的 `ThreadFork`，更适合作为用户功能；Context Tree 应优先使用 app-server/tool/core 可观测接口，并记录 fork 参数与结果 thread id。

## 5. OpenCode 能力

### 5.1 可利用能力

OpenCode 也有可利用的会话存储和 fork/revert 能力，但语义与 Codex 不同：它更像 message/part 记录复制，然后再走 OpenCode prompt construction，而不是 thread/rollout 级语义 fork。

本地源码显示：

- session 数据存放在 sqlite table：`session`、`message`、`part`、`session_entry` 等；part 类型覆盖 text、tool、file、reasoning、compaction、subtask、snapshot、patch、agent、retry、step-start/finish 等。
- `Session.fork` 创建新 session，并复制源 session 的 messages/parts；可传 `messageID`，只复制该 message 之前的历史，同时 remap message/part id 和 assistant `parentID`。
- `session.revert` / undo 不是 thread rollback；它基于 message/part 边界设置 `session.revert`，并用 snapshot 恢复/回滚文件变更。
- 下一次 prompt 前会 cleanup 被 revert 的消息或 part，使后续模型调用不再看到被 revert 的后缀。
- prompt loop 先执行 revert cleanup，再使用 `MessageV2.filterCompactedEffect(sessionID)` 生成上下文，经 reminders、overflow/compaction 检查和 plugin transform 后，再由 `MessageV2.toModelMessagesEffect(...)` 转成模型消息。
- compaction 作为 message part 存在，并影响后续上下文构造；native prune 会保留 raw output，但在模型请求层用 placeholder 替换旧 tool output。
- `TaskTool.execute` 会创建一个 `parentID = ctx.sessionID` 的新 session，并把 task prompt 发送给这个新 session；它不会复制父 session messages/parts，因此 OpenCode subtask 不是 context fork。
- ACP `loadSession` / `unstable_forkSession` 在源码中会把 stored messages replay 成 ACP `sessionUpdate`，并通过 SDK fork 创建 forked session；README 中 “不恢复 actual conversation history” 更应理解为不恢复 live runtime/model state，而不是完全没有 stored-history replay。
- OpenCode core 中没有 DCP 关键词；opencode-dynamic-context-pruning 属于外部/plugin 层，最可能挂在 `experimental.chat.messages.transform` 这类 hook 上。

本地证据：

- `/home/prosumer/agent/opencode/packages/opencode/src/session/session.sql.ts`
  - `SessionTable`、`MessageTable`、`PartTable`、`SessionEntryTable`。
- `/home/prosumer/agent/opencode/packages/opencode/src/session/session.ts`
  - `Session.fork` 复制 messages/parts，支持 `messageID` 截断和 id remap。
- `/home/prosumer/agent/opencode/packages/opencode/src/session/revert.ts`
  - `SessionRevert.revert` / `unrevert` / `cleanup`。
- `/home/prosumer/agent/opencode/packages/opencode/src/session/prompt.ts`
  - prompt loop 使用 filtered compacted messages、reminders、plugin transform 构造模型调用。
- `/home/prosumer/agent/opencode/packages/opencode/src/session/message-v2.ts`
  - `filterCompacted` / `toModelMessagesEffect` 决定 stored messages 如何变成 model-visible messages。
- `/home/prosumer/agent/opencode/packages/opencode/src/session/compaction.ts`
  - native prune 标记 `part.state.time.compacted`，而不是删除 raw output。
- `/home/prosumer/agent/opencode/packages/opencode/src/tool/task.ts`
  - task/subtask 创建 fresh child session，不复制父历史。
- `/home/prosumer/agent/opencode/packages/opencode/src/acp/agent.ts`
  - ACP load/fork replay stored messages as session updates，但不是 live runtime 恢复。
- `/home/prosumer/agent/opencode/packages/opencode/src/snapshot/index.ts`
  - snapshot restore 是工作区状态恢复。

### 5.2 OpenCode 可行路径

OpenCode v0 的可行高保真路径是 session message/part fork + 原生 prompt loop，而不是 subtask：

```text
ContextNode -> OpenCode sessionID + optional messageID
checkpoint/fork -> Session.fork({ sessionID, messageID })
spawn target agent -> 在 forked session 上发送 reviewer/planner prompt
历史点恢复 -> 利用 messageID 做 message-boundary prefix copy
manifest -> 记录 transformLayers 与 target fidelity
```

这比“挂载 transcript”强，因为它复制的是 OpenCode 自己的 message/part 结构，后续 prompt loop 会按 OpenCode 原生逻辑转成模型消息。

但 OpenCode `TaskTool` / subtask 已经可以判定**不是**父上下文 fork：它创建 fresh child session，只发送 task prompt，不复制父 session history。Context Tree 可以把这种调用建模为独立 child node：

```ts
type OpenCodeSubtaskNode = {
  parentID: string
  childSessionID: string
  freshContext: true
  inheritsHistory: false
  resultOnly: true
  childTranscriptRef?: string
}
```

也就是说，OpenCode 的 “spawn a context-bearing agent” 应优先走 `Session.fork(...) + prompt`，而不是 task/subtask 工具。

### 5.3 OpenCode 风险

- **`Session.fork` 是 persisted JSON clone**：它复制/remap message/part 记录，不复制 live runtime state、model KV/cache、provider prompt cache、正在执行的 tool 状态或 plugin 内存状态。
- **`messageID` 是 message-boundary，不是 part-boundary**：如果一个 message 内有多个 parts，OpenCode fork 不能自然表达 “message 内部某个 part 之后” 的历史点。
- **stored clone 不等于 model request**：fork 后下一轮模型输入还会经过 `MessageV2.filterCompactedEffect`、`toModelMessagesEffect`、reminders、overflow/auto-compaction、`experimental.chat.messages.transform` 等层。必须测试 forked session 的 actual model messages，而不是只比较 DB rows。
- **`session.revert` 不是 context fork 核心**：它同时做 message/part suffix cleanup 和 workspace snapshot restore。文件 snapshot 属于 workspace/environment state，不能混进模型上下文 fidelity。
- **ACP 名称有误导风险**：本地源码比 README 乐观，说明 load/fork 会 replay stored messages；但 ACP `session/fork` 仍是 unstable/draft，`session/resume` 也可能只 reconnect 而不暴露 loaded history。adapter 不能只看 API 名字。
- **fork + compaction 有已知上游风险**：上游 issue #26707 指出长会话 compact 后 fork 可能继承 full uncompressed pre-compaction history 并立即超上下文。近期 `tail_start_id` remap / serialization 修复解决引用问题，但不等于提供 summary-only fork 模式。
- **OpenCode 变化很快**：session fork、HTTP API、ACP、compaction tail persistence 在 2026 Q2 有多次变更；实现时必须 pin local/upstream commit 或版本，并把 evidence refs 写入 manifest。

### 5.4 DCP / pruning 对恢复性的影响

OpenCode 原生 compaction prune 和 opencode-dynamic-context-pruning 这类插件都会让“当前模型请求”看不到一部分旧消息或工具输出，但它们不一定破坏原始会话记录。

需要分三种情况看：

1. **OpenCode 原生 `compaction.prune`**
   - `SessionCompaction.prune` 会给旧 tool part 设置 `part.state.time.compacted = Date.now()`。
   - `MessageV2.toModelMessagesEffect` 在构造模型消息时，如果看到 `time.compacted`，会把 tool output 替换成 `[Old tool result content cleared]`，并去掉 attachments。
   - 原始 `part.state.output` 仍在 message/part 数据里；只是模型上下文构造时不再发送。
   - 因此，如果 Context Tree 读取的是 session DB 原始 message/part，理论上可拿到比当前模型请求更多的 raw content；但如果目标是复现 native-current-context，则应保留 placeholder/drop-attachment 语义。

2. **OpenCode compaction summary / tail filtering**
   - `filterCompacted` 会在 compaction summary 之后保留 summary + `tail_start_id` 之后的 tail，旧消息可能仍在 DB 中，但不再进入 model-visible messages。
   - fork 时需要确认 `tail_start_id` 是否随 remapped message ids 正确更新；近期上游修复说明这里曾经是风险点。
   - 因此 model-visible current context 可能是 “summary + tail”，不是 raw session record prefix。

3. **opencode-dynamic-context-pruning / DCP**
   - DCP 不是 OpenCode core 能力；core 中没有 DCP 关键词。它应作为外部 plugin/transform layer 处理，不能把 plugin README 结论当成 core guarantee。
   - DCP README 明确写道：session history 不会被修改；DCP 在发送给 LLM 前用 placeholder / summary 替换被 prune 的内容。
   - `lib/messages/prune.ts` 会在内存中的 messages 数组上过滤 compressed ranges、替换 tool outputs / errored inputs。
   - `lib/commands/decompress.ts` 可以把 compression block 标记为 inactive / deactivatedByUser，然后重新同步 block state，使原消息重新进入 active context。
   - 这解释了“原生体验似乎可以恢复”：因为原始 session history 还在，DCP 只是维护一层 active compression/pruning state。

4. **破坏性 pruning**
   - 如果某插件或平台真的物理删除 message/part/output，或只保留摘要而丢掉 raw content，则无法从该平台恢复完整内容。
   - 这种情况必须在 `knownLosses` 中标记，不能声称高保真 fork。

对 Context Tree 的推论：

- 不能只记录“模型当前看到什么”，还要知道是否有 DCP/compaction 层在改变模型请求。
- 每次恢复都应声明目标 fidelity：

```text
native-current-context = 复现平台当前会发送给模型的 summary/placeholder/tail 结果
max-raw-record        = 尽可能读取底层 session/plugin state 中仍存在的 raw content
```

- 对 OpenCode，最高 fidelity 的恢复路径可能不是直接走当前 prompt 构造，而是：

```text
读取原始 session message/part
+ 读取 compaction summary/tail ids
+ 读取 DCP/plugin state / compression blocks
+ 根据目标 fidelity 决定尊重 prune layer、临时 decompress、或使用 raw record
+ 再 fork 或构造模型请求
```

- 如果目标是“恢复原生体验中的当前上下文”，应尊重 native prune/DCP 当前 active compression state。
- 如果目标是“从历史节点尽可能恢复完整上下文”，可以绕过或反向应用 prune state，但不能把 raw 内容静默升级成 model-visible 内容：这既可能泄露原模型没有看到的 secret，也会改变任务语义。

这意味着 Context Tree 的 `CaptureManifest` 需要能记录 context transformation layer：

```ts
type ContextTransformLayer =
  | "opencode-native-compaction-prune"
  | "opencode-compaction-summary-tail"
  | "opencode-dcp-active-compression"
  | "codex-compaction-replacement-history"
  | string

type CaptureManifest = {
  platform: string
  recoveryMethod: string
  sourceRefs: ResourceRef[]
  transformLayers?: ContextTransformLayer[]
  targetFidelity?: "native-current-context" | "max-raw-record"
  knownLosses: string[]
}
```

这里的关键不是“pruned 了就不能恢复”，而是：

```text
pruned content 是否仍存在于平台会话存储或插件状态可反解的原始记录中，
以及目标恢复是复现平台当前模型输入，还是最大化恢复 raw evidence。
```

如果还在，就可以恢复；如果只是模型请求层被替换，则 Context Tree 可以利用底层 session store 获得更多证据，但必须在 manifest 里标明这不是平台当时的 model-visible context。

## 6. Claude Code 能力

### 6.1 已知能力面

Claude Code 的能力面比原先判断更强，但分成两类：interactive fork 能力较强，programmatic/historical fork 仍不等价于 Codex thread fork。

已确认/需纳入 adapter 的能力包括：

- `/fork` 与 `--fork-session`：文档描述为 full-history branch / new session id 路径；`--continue` / `--resume` 可配合 `--fork-session` 创建新 session，而不是复用原 session。
- ordinary subagents：有独立 context window 和自己的 system prompt/task prompt/tool set；默认不继承父 conversation history。
- skills / slash commands：可展开 prompt、选择 agent/model、配置 `context: fork` 等，但 `context: fork` 更像 isolated subagent execution，不等于父历史 fork。
- hooks：如 `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`SubagentStart`、`SubagentStop`、`PreCompact`、`PostCompact` 等，通常可见 `session_id`、`transcript_path`、`cwd`、`permission_mode` 等字段；部分事件可注入 `additionalContext`。
- transcript/session record：默认 JSONL 路径形如 `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`；subagent transcript 可能位于 parent session 下的 subagents 目录。
- export/script/SDK 接口：`/export`、`claude -p --output-format json`、`--resume <session-id>`、Agent SDK 等可以作为 replay/capture 辅助接口。

官方文档参考：

- Claude Code subagents: https://docs.anthropic.com/en/docs/claude-code/sub-agents
- Claude Code hooks: https://docs.anthropic.com/en/docs/claude-code/hooks
- Claude Code slash commands / skills: https://docs.anthropic.com/en/docs/claude-code/slash-commands

### 6.2 可行路径

Claude Code 的 Context Tree 路径应分层，而不是简单归为 “research track”。

**Tier A：interactive/latest-session branch**

```text
ContextNode -> Claude session id / transcript ref / cwd envelope
checkpoint branch -> /fork 或 claude --resume <session-id> --fork-session
spawn target -> forked Claude session + reviewer/planner prompt
result -> attach new session id + transcript ref + manifest
```

这是 Claude Code 最接近 native context fork 的路线，适合用户在交互式 Claude Code 环境里从当前/最近 session 分支。但它仍需要验证具体版本、可自动化程度、以及是否能选任意历史边界。

**Tier B：programmatic capture/replay**

```text
hooks capture session_id / transcript_path / cwd / compact events
+ durable copy or reference to JSONL/session records
+ optional SDK/resume/script interface
+ explicit prompt to replay/reconstruct target work
```

这条路线可自动化，但 fidelity 应低于 Codex thread fork：目前没有证据显示 hook/skill/subagent 能从任意历史点启动一个 Codex-style full-context background fork。

**Tier C：isolated subagent / skill `context: fork`**

```text
parent ContextNode -> child task node
inheritsHistory: false
freshContext: true
resultOnly: true
childTranscriptRef?: string
```

ordinary subagents 和 `context: fork` skills 适合做 isolated worker，不应被标成 parent-history fork。若需要父上下文，必须显式注入/mount transcript 或摘要，并把 fidelity 降级。

### 6.3 风险

- **ordinary subagent 默认隔离**：它不继承父 conversation history、父 tool results、父 system prompt、已读文件内容或已加载 skill 内容，除非平台/配置显式提供。不能从 “有 subagent” 推出 “有 context fork”。
- **`context: fork` skill 不是父历史 fork**：它更像在 isolated subagent 中运行 skill prompt；适合作为 child node，不适合作为高保真 checkpoint。
- **hooks 是 capture/injection surface，不是 equivalence proof**：hook payload 可提供 `session_id`、`transcript_path`、`cwd`、`permission_mode` 等，也可在部分事件注入 `additionalContext`；但 hook 注入、transcript path、Stop flush 时序、worktree/login path、多个 hook rewrite 的顺序都有已知 bug/竞态风险。
- **JSONL transcript 是内部格式**：官方建议避免直接依赖未稳定字段；记录 retention 约 30 天，且可能被 `CLAUDE_CODE_SKIP_PROMPT_HISTORY` 或 `--no-session-persistence` 禁用。
- **compaction 会改变 prompt assembly**：path-scoped/nested `CLAUDE.md` 规则可能在 compact 后丢失，直到相关文件再次读取；skill reinjection 也可能有 token cap。Context Tree 必须记录 compact boundary 与重新注入规则。
- **resume/fork 不等于任意历史节点**：`--resume` 是 continuation，`--fork-session` 是创建新 session branch；它们不天然支持任意 turn/part 边界的 historical fork。
- **subagent transcript 与 parent transcript 分离**：不能把 child 内部 reads/tool outputs 自动并入 parent model context；parent通常只看到 child 返回结果。
- **cwd/workspace 强耦合**：session lookup、project memory、path rules、transcript path、worktree 行为都依赖 cwd/project root，必须进入 execution/workspace envelope。

## 7. 跨平台设计推论

### 7.1 ContextNode 应存 platform-native references

节点不应只存 markdown summary。至少需要：

```ts
type ContextNode = {
  id: string
  platform: string
  sessionRef: string
  messageRef?: string
  turnRef?: string
  rolloutRef?: string
  storageRef?: string
  label: string
  createdAt: string
}
```

`sessionRef` 是最低要求；`messageRef` / `turnRef` 用来表示历史分叉点。

### 7.2 CaptureManifest 应记录恢复路径，而不是复制所有内容

高保真恢复需要显式区分这些层：

```text
sessionRecord          = 平台持久化的 message/event/part/rollout/transcript
modelVisibleMessages   = 平台当轮实际发给模型的 messages/items
promptAssembly         = system/developer/project/user memory/skills/commands/tool schemas/hook context
executionEnvelope      = model/provider/reasoning/cwd/permission/sandbox/network/profile/agent settings
transformLayers        = compaction/prune/redaction/summary/replacement/tail filtering
workspaceEnvelope      = git/worktree/files/diff/runtime target state
```

因此 `CaptureManifest` 应表达“如何恢复”和“恢复到哪一层”，而不是幻想所有平台都有同一种 checkpoint：

```ts
type CaptureManifest = {
  platform: string
  recoveryMethod:
    | "native-thread-fork"
    | "native-session-fork"
    | "compiled-context-packet"
    | "message-prefix-fork"
    | "rollout-replay"
    | "session-db-copy"
    | "mounted-session-record"
    | "interactive-session-fork"
    | "programmatic-replay"
    | "summary-only"
  sourceRefs: ResourceRef[]
  boundaryRef?: string
  promptAssembly?: PromptAssemblyManifest
  executionEnvelope?: ExecutionEnvelope
  transformLayers?: ContextTransformLayer[]
  toolResultVisibility?: ToolResultVisibility[]
  attachments?: AttachmentManifest[]
  mcpState?: MCPStateManifest[]
  hookPluginState?: HookPluginManifest[]
  recordAvailability?: RecordAvailability
  workspaceEnvelope?: WorkspaceEnvelope
  evidenceRefs?: ResourceRef[]
  knownLosses: string[]
}
```

重点是让 adapter 知道如何恢复，而不是把所有 context 文档化。`knownLosses` 不只是错误处理字段，而是 Context Tree 防止“summary 冒充 context”的核心语义。

### 7.3 spawn/checkpoint 不是“保存后再启动”

v0 应支持两种等价入口：

```text
A. 当前 agent 显式声明这里可 checkpoint，然后 Context Tree 记录 node。
B. 当前 agent 直接调用一个 forked/subagent；Context Tree 将该调用本身登记为 checkpoint/spawn。
```

用户指出的“agent 调用 checkpoint 一般指调用具有对应上下文的 subagent”更接近 B。也就是说，checkpoint 的产品形态可以是：

```text
spawn a context-bearing agent from here
```

而不是：

```text
save a checkpoint file
```

但 B 只有在平台真的创建了 context-bearing agent 时才是高保真 checkpoint。Codex full-history fork、OpenCode `Session.fork + prompt`、Claude `/fork` 可以作为候选；OpenCode task/subtask、Claude ordinary subagent、summary-only handoff 只能登记为 lower-fidelity child task。

### 7.4 工作区状态单独处理

文件 snapshot、git diff、未跟踪文件不是 context 本体。

但某些恢复路径需要它们：

- OpenCode revert 要恢复文件 snapshot；
- Codex fork 后的 reviewer 可能需要当前 diff 作为审查目标；
- Claude Code 的 cwd/project root 影响 transcript lookup、memory、path-scoped rules；
- implementation 分支可能需要 worktree 隔离。

因此文档和 schema 应把它们叫做 `targetRefs` / `environmentRefs` / `workspaceEnvelope`，不要叫 context。

### 7.5 非目标与证据优先级

Context Tree v0 不应承诺恢复：

- hidden vendor system prompt、provider KV/cache、provider prompt cache；
- exact shell/process/tmux/runtime state；
- 未捕获字节的 pixel-perfect media/attachment 表示；
- 外部 MCP/resource/world state 的历史真值，除非已捕获具体 bytes/hash；
- human-readable export/share/summary 与 native model context 的等价性。

为避免 summary poisoning / authority inversion，派生 agent 继承事实时应按证据优先级解释：

```text
raw platform record / rollout / DB
> model-visible tool outputs and model-message captures
> platform compact summaries / replacement histories
> human or agent-written recap / handoff summary
```

关键事实如果只来自 summary，应带 provenance 和降级标记。

## 8. v0 推荐路线

### Codex-first prototype

优先实现 Codex，因为它已有最接近 Context Tree 的 native thread/rollout fork 与 rollback reconstruction，但要把 fidelity 说清楚：这是 filtered stored-history fork。

```text
ContextNode -> Codex thread id / rollout path / optional stable turn boundary
checkpoint-by-spawn -> v1 spawn_agent(fork_context=true)
                   -> 或 v2 spawn_agent(fork_turns="all")
historical fork -> app-server/core thread fork + turn/start(prompt)
base selection -> fork from upstream ContextNode, rollback boundary, or explicit fork snapshot
result -> attach spawned thread id + fork mode + knownLosses to tree edge
```

必须记录：v1/v2 接口、fork_turns/fork_context、是否 app-server/TUI interrupted snapshot、compaction replacement history、以及被过滤掉的 rollout item 类型。

### OpenCode second

OpenCode 路线应基于 session message/part fork，而不是 task/subtask：

```text
ContextNode -> sessionID + optional messageID
fork -> Session.fork({ sessionID, messageID })
spawn -> forked session + reviewer/planner prompt
transform choice -> native-current-context 或 max-raw-record
undo/revert -> only for message/file rollback, not context fork core
```

adapter 需要比较 forked session 经过 `filterCompactedEffect` / `toModelMessagesEffect` 后的 actual model messages，而不是只比较复制出来的 DB rows。

### Claude Code split track

Claude Code 不再只是“弱研究轨”，而应拆成三条：

```text
interactive branch -> /fork 或 --resume <session-id> --fork-session
programmatic replay -> hooks + transcript/session refs + SDK/script resume, lower fidelity
isolated work -> ordinary subagent / skill context: fork, child node only
```

如果产品目标允许交互式/latest-session 分支，Claude `/fork` 是候选 native path；如果目标是自动化任意历史节点恢复，则必须先以 hooks/transcript/SDK replay 作为 lower-fidelity adapter，并等待实测证明。

## 9. 需要实测的问题

### Codex acceptance matrix

1. v1 `spawn_agent(fork_context=true)` 与 v2 `spawn_agent(fork_turns="all")` 的 actual model request 是否符合预期？默认值和 override restrictions 如何影响 adapter？
2. forked agent 是否确实丢弃 reasoning、tool outputs、`TurnContext`、non-final assistant、search/web/image/custom tool items？用 canary item 验证。
3. `thread/fork + turn/start` 从历史 thread 继续时，请求体与原 thread 在同一 stable boundary 继续是否等价？
4. `thread_rollback` 的 turn 单位、rollback marker、token usage recompute 是否与 ContextNode boundary 一致？
5. rollback / fork 穿过 compaction 后，`replacement_history` / legacy compact summary 是否构成明确 known loss？
6. mid-turn app-server/TUI fork 是否总是 interrupted snapshot？有没有 non-interrupting live-turn boundary 可用？

### OpenCode acceptance matrix

1. `Session.fork({ sessionID, messageID })` 后，下一轮 `filterCompactedEffect` / `toModelMessagesEffect` 生成的 model messages 是否与源 session prefix 等价？
2. `messageID` 截断是否只能在 message boundary 生效？message 内 part boundary 如何表示或降级？
3. native `compaction.prune` 后，raw `part.state.output`、model-visible placeholder、attachments drop 是否能被 adapter 分别捕获？
4. compaction summary / `tail_start_id` 在 fork 后是否正确 remap；fork compacted long session 是否还会触发 #26707 类 full raw history 超窗问题？
5. DCP/plugin active compression state 是否能稳定映射到 message IDs，并在 fork 后复用、decompress 或标记 known loss？
6. `SessionRevert` 的 workspace snapshot restore 与 message suffix cleanup 能否完全分离进 `workspaceEnvelope`？
7. `TaskTool` / subtask 是否确认不继承父 history？父只看到 result 的边界如何写入 tree edge？
8. REST/ACP fork+prompt 是否能稳定暴露 forked session id、stored messages replay 与 actual model call？

### Claude Code acceptance matrix

1. `/fork` 与 `--fork-session` 在目标版本中是否继承 full conversation、system prompt、tools、model、message history？能否自动取得 new session id？
2. `--resume <session-id> --fork-session` 是 latest/full-session branch，还是可指定任意历史 boundary？
3. JSONL transcript 是否包含 tool calls/results、attachments、compact events、subagent refs；字段是否足够稳定，retention/disabled-persistence 如何检测？
4. ordinary subagent 与 skill `context: fork` 是否都为 isolated context；父历史、已读文件、已加载 skills 是否进入 child？
5. hooks 的 `session_id`、`transcript_path`、`cwd`、`permission_mode`、`agent_id` 字段是否在 worktree/login/subagent 场景稳定？Stop hook 是否可能早于 transcript flush？
6. `additionalContext` 注入在 SessionStart/UserPromptSubmit/PreToolUse 等事件是否可靠；多个 hooks 改写 input 时是否存在 last-wins/race？
7. compaction 后 path-scoped/nested instructions、skill reinjection、tool results 如何进入下一次 model-visible prompt？
8. cwd/project root/worktree 差异是否改变 session lookup、memory、rules 与 transcript path？

### Cross-platform canaries

1. instruction canary：global/user/project/path rules 是否在 fork/replay 后仍然可见？
2. tool-output canary：raw stored、model-visible truncated/redacted/placeholdered、export-visible 三者是否被区分？
3. attachment canary：图片/PDF/file path 的原始 bytes、平台转换、model-visible representation 是否可追踪？
4. MCP canary：tool schema/resource content/hash 变化是否会改变 replay 行为？
5. config/cwd canary：model/provider/reasoning/permission/sandbox/cwd/profile 变化是否触发 fidelity downgrade？
6. summary-poisoning canary：当 compact summary 与 raw record 冲突时，派生 agent 是否优先 raw evidence 并标记 summary provenance？

## 10. 当前结论

Context Tree 的下一步不应实现通用文档化 checkpoint，也不应把 summary 当成上下文本体。

但它应实现或验证一个专用 `compiled-context-packet` 后端：这不是让 agent 写总结，而是按平台会话记录、prompt assembly、compact/DCP/prune 语义编译派生 agent 应见的上下文。

下一步应该实现或验证：

```text
在一个明确的 stable context boundary，
优先用平台原生 session/thread fork、copy 或 replay 方式，
启动一个真正带有该 boundary 上下文的 agent，
并同时用 compiled-context packet 做可审计对照，
并记录 CaptureManifest / fidelity / knownLosses。
```

Codex 仍是 v0 最强起点，但结论要带 caveat：`fork_context=true` / `fork_turns="all"` 和 `thread/fork` 是 filtered stored-history fork，不是 KV/cache、完整 transcript 或任意 mid-turn 模型状态 fork。

OpenCode 有可用的 session message/part 复制路径，适合第二阶段；但必须处理 `filterCompactedEffect`、`toModelMessagesEffect`、native prune、DCP/plugin transform、compaction summary/tail，以及明确排除 task/subtask 作为 history fork。

Claude Code 的 interactive `/fork` / `--fork-session` 可以作为 native branch 候选；但 programmatic historical recovery 目前应降级为 hooks/transcript/SDK replay track，ordinary subagents 和 `context: fork` skills 只能作为 isolated child nodes。

因此 v0 设计应以“平台原生会话历史 fork / copy / replay + 专用上下文编译 + manifest 化的 fidelity 边界”为核心，而不是以 summary、设计文档或外部文件快照为核心。
