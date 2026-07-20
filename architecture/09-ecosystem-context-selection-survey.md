# 生态调研：任务自适应上下文选择与 checkpoint 派生

## 0. 调研边界

本轮目标不是证明 reviewer 质量，也不是决定是否做 AACR。它只回答一个前置问题：

```text
在实现 Context Tree 之前，生态里是否已有高 star 项目
稳定解决了“loop agent 在关键节点派生带足够上下文的 helper/reviewer/reflector，
并把结果回到主 agent”的问题？
```

当前环境没有可用的 `tavily-hikari` / Tavily MCP / Tavily CLI。调研改用：

- GitHub raw README / docs；
- GitHub badge/shields star 约数；
- 本地已 clone 的 Trellis / CCG 源码；
- 已有 capability 调研结论。

GitHub repo metadata API 在本环境返回 403，所以 star 数只作为约数，不作为精确指标。

本轮源码已 shallow clone 到：

- `ref/context-mode`
- `ref/opencode`
- `ref/langgraph`
- `ref/letta-code`

后续讨论新增的本地参考：

- `ref/magic-context`
- `ref/llm-context-viz`

这两者不改变本轮大结论，但补强了两个关键点：

1. Magic Context 证明 runtime transform 层的 context management 比离线 handoff summary 更接近真实 agent 工作方式。
2. `llm-context-viz` 证明 JSONL/parser/proxy 可以作为强观测/eval 工具，但离线解析不等于实际 prompt assembly。

## 1. 当前结论

没有看到一个高 star 项目完整覆盖 Context Tree 当前目标。

当前目标也已从“checkpoint reviewer”扩展为：

```text
主 agent 按需激活 context-bearing team member / consultant，
让它基于职责长期上下文、本次任务上下文、目标材料和可恢复历史执行专业判断，
并把结果回流主 agent。
```

parent checkpoint reviewer 仍然是基础场景，但不是唯一模型。对 skill designer / hook implementer / live-eval checker 这类固定职责 member，role history 和 member profile 可能比 parentSession 更重要。

最接近的项目是 `mksglu/context-mode`：它明确认为大工具输出是上下文污染，用 MCP + hooks 把 raw data 留在沙箱/SQLite/FTS5 中，只按相关性恢复会话连续性。这和我们现在的判断高度一致：

```text
全量 transcript / 全量 tool results 不一定更好；
重要的是让 agent/runtime 按任务选择材料，并在需要时补充历史。
```

但 `context-mode` 主要解决：

- 工具输出不要污染 model context；
- compact 后 session continuity；
- 跨 coding-agent 的 hook / MCP 路由；
- 历史事件检索。

它没有直接解决：

- 从某个 designer checkpoint 派生 reviewer；
- 区分 base node / requester node / target node；
- reviewer 结果回流主 loop；
- 记录 fork fidelity 并做 implementation e2e 判定。

Trellis / CCG 则证明了另一件事：阶段化文档和 role-based context injection 是可行的，而且工程上很实用。但它们不是 checkpoint-derived context fork。它们把 `prd/design/implement/spec/context.jsonl` 注入 subagent prompt，本质是 staged docs / task artifacts 选择，不是从原 designer 会话上下文派生 reviewer。

因此，当前实现方向不应切换成 Trellis，也不应复用 Trellis 作为核心。更合理的是吸收三类设计：

1. 借鉴 `context-mode` 的 hook/MCP/session continuity/context pollution 处理。
2. 借鉴 Trellis/CCG 的阶段边界和 subagent prompt 注入工程细节。
3. 保留 Context Tree 自己的差异点：checkpoint/session lineage、从正确上游派生 helper/reviewer、任务有效材料选择、result return。

## 2. 对比矩阵

| 项目 | star 约数 | 定位 | 上下文选择 | checkpoint/history | subagent 派生 | 与 Context Tree 的关系 |
|---|---:|---|---|---|---|---|
| `mksglu/context-mode` | 19k | coding agent 上下文优化 MCP/hooks | 强：沙箱工具输出、FTS5/BM25 按需检索、PreCompact/SessionStart | 强：SQLite session continuity、compact 恢复 | 弱：不是 reviewer/checkpoint fork 产品 | 最接近上下文材料选择理念，应重点借鉴 |
| `langchain-ai/langgraph` | 37k | stateful agent orchestration | 中：memory/state 由应用定义 | 强：durable execution、state resume | 中：subgraph/Deep Agents | 框架级，不是现成 coding-agent context fork |
| `letta-ai/letta` | 24k | stateful agents / advanced memory | 强：长期 memory/persona/human state | 中：agent session resume | 中：Letta Code 有 skills/subagents | memory agent 路线，适合参考持久状态，不替代 checkpoint fork |
| `All-Hands-AI/OpenHands` | 79k | agent server / developer control center | 中：多 backend 和自动化，README 未证明任务自适应 prune | 中：agent server 长跑会话 | 中：可运行 OpenHands/Claude/Codex/Gemini/ACP agents | 更像 agent control plane，不直接解决派生上下文保真 |
| `aider-ai/aider` | 47k | terminal pair programming agent | 中：repo map、显式加入文件、聊天上下文 | 中：聊天/undo/git 流程 | 弱：不是多 subagent framework | 证明代码上下文选择很重要，但不覆盖 loop reviewer 派生 |
| `anomalyco/opencode` | 183k badge | open source coding agent | 中：agent/subagent/plugin/session 能力 | 中：session/revert/DCP 需继续实测 | 强：内置 `general` subagent、plugin hook | 重要适配目标，不是我们的上层语义 |
| `microsoft/autogen` | 60k | multi-agent framework | 弱到中：agent/tool/message 由开发者组装 | 中：runtime/message passing | 强：AgentTool/group chat | 多 agent 编排成熟，但已 maintenance mode，且不处理 coding-agent checkpoint context |
| `crewAIInc/crewAI` | 55k | multi-agent automation + flows | 中：agents/tasks/context/memory/checkpointing | 中：flows state/checkpointing | 强：crews/flows/delegation | 适合参考 role/task orchestration，不解决原会话派生 |
| `run-llama/llama_index` | 51k | data/RAG/agentic apps | 强：retrieval/index/query context | 中：storage/index persistence | 中：agents/workflows | 文档/知识上下文强，不是会话 checkpoint fork |
| `deepset-ai/haystack` | 26k | RAG/pipeline orchestration | 强：retrieval/pipelines | 中：pipeline state 由应用负责 | 弱到中 | 文档检索基建，不是 loop-agent 派生 |
| Trellis | 本地参考 | staged docs workflow harness | 强：按 phase/role 注入 docs/task artifacts | 中：session runtime active task | 中：subagent prompt injection | 是 doc baseline / workflow boundary 参考，不是 Context Tree 核心 |
| CCG Workflow | 本地参考 | Claude/Codex/Gemini workflow + team hooks | 强：role-based context.jsonl/spec/task 注入 | 中：active task/session hooks | 强：Agent/team spawn prompt rewrite | 工程注入方式值得借鉴，但上下文来源是文档树 |
| Magic Context | 本地参考 | OpenCode/Pi context manager + memory | 强：runtime transform、ctx_reduce、ctx_search、ctx_expand、historian、dreamer | 强：session history / compartments / memory store | 中：内部 historian/dreamer/sidekick 子会话；业务 subagent 默认 reduced | 重要 backend 参考，不应成为主产品语义 |
| llm-context-viz | 本地参考 | 会话上下文可视化 / eval 观测 | 中：JSONL 重建估算 + calibration proxy 捕获真实 request | 中：扫描本地 session records | 弱：不派生业务 subagent | 适合观测/eval，不适合做产品 assembler |

## 3. 关键项目分析

### 3.1 Context Mode

`context-mode` 的 README 明确提出：

- MCP 工具 raw output 会吞掉上下文窗口；
- Playwright snapshot、GitHub issues、access log 等应进入沙箱处理；
- 不把所有数据灌回 context，而是记录到 SQLite；
- compact 后通过 FTS5/BM25 检索相关事件恢复 session continuity；
- PreCompact / SessionStart / PreToolUse / PostToolUse 等 hooks 用于捕获和路由；
- 支持 Claude Code、Gemini CLI、OpenCode、Codex CLI 等多个 coding-agent；
- 不强制最终回答风格，只控制数据进入何处。

这直接支持我们的一个修正：

```text
review/check/reflect 任务不应默认看到全部工具调用和工具结果。
上下文材料应该按任务选择；raw data 可以留在可检索/可挂载记录中。
```

对 Context Tree 的影响：

- 不要实现“全量 transcript 默认注入”。
- checkpoint capture 应记录 session events、compact/recap、可检索索引和 known losses。
- 派生 agent 可以拿到“按任务选择后的 model-visible context”，也可以按需查询历史记录。
- implementation e2e 要区分“子 agent 确实看到任务相关 canary/决策”与“只是挂了一个可搜索历史库”。
- `context-mode` 风格的 searchable history 可能在 review/check/reflect 上优于 native fork，因为它能避免把大量无关工具结果和探索过程重新放进模型上下文。

仍缺的部分：

- 没有 tree lineage；
- 没有从 P 派生 R 去 review C 的拓扑语义；
- 没有 result return 作为产品目标；
- 没有 fidelity 分级。

### 3.2 Trellis

Trellis 的 OpenCode 插件在 `tool.execute.before` 上拦截 Task tool：

- 识别 `trellis-implement` / `trellis-check` / `trellis-research`；
- 根据当前 session runtime 或 prompt hint 找 active task；
- 对 implement/check 注入 `prd.md`、`design.md`、`implement.md` 和对应 JSONL；
- 对 research 注入 spec 目录结构和搜索提示；
- 直接改写 Task tool 的 `args.prompt`，让子 agent 出生时就带有这些上下文。

这说明 Trellis 的“分层”主要是：

```text
workflow phase -> agent role -> task artifacts/spec docs -> prompt injection
```

它能达到的效果：

- 对规范明确、artifact 完整的任务很强；
- 能避免用户手动复制文档；
- 能在阶段切换处给 subagent 足够正式材料；
- 可以作为 doc-only / staged-doc baseline。

它不能证明：

- 原 designer 会话中未写入文档的排除项、纠偏、偏好能被 reviewer 继承；
- checkpoint 前后模型上下文边界能恢复；
- 从上游 P 而非当前 C 派生 reviewer；
- compact/prune 后历史是否还能按任务恢复。

所以 Trellis 不应替代 Context Tree。它证明的是“分层 docs 够好时可以很有用”，不是“docs 总是足够”，也不是“checkpoint fork 没必要”。

### 3.3 CCG Workflow

CCG 的 `subagent-context.js` 有一个值得直接借鉴的工程点：

```text
PreToolUse 的 additionalContext 只会到达 calling session，
not-yet-created subagent 看不到；
因此 Agent/team spawn 必须改写 spawned teammate 自己的 prompt。
```

它还支持 role-based filtering：

- 从 `context.jsonl` 读取 spec/context 条目；
- 根据 reviewer/research/debug/implement 等角色过滤；
- 注入 requirements/plan/research；
- 对长文档做截断。

这说明如果我们走“派生 agent prompt/material injection”路径，必须验证注入发生在子 agent 自己的初始输入，而不是只污染父 agent。

但 CCG 和 Trellis 一样，核心上下文来源是文档/任务目录，不是 designer checkpoint。

### 3.4 LangGraph / AutoGen / CrewAI

这三类框架证明 multi-agent/stateful workflow 已经是成熟方向：

- LangGraph 强在 durable execution、human-in-the-loop、short/long-term memory；
- AutoGen 强在 AgentTool、message passing、group chat，但当前 README 标记为 maintenance mode，并推荐 Microsoft Agent Framework；
- CrewAI 强在 Crews/Flows、role/task、memory、checkpointing、event-driven workflow。

它们解决的是应用开发者如何构建 agent 系统，不是“在 Codex/Claude/OpenCode 这类现成 coding-agent 内，从已有会话 checkpoint 派生 reviewer”。如果 Context Tree 未来成为独立 agent framework，可以参考它们；当前不应把它们作为 V0 依赖。

### 3.5 Letta / LlamaIndex / Haystack / Agno

这一类更偏 memory/RAG/control plane：

- Letta 强在可持续 agent memory、persona/human state、session resume、skills/subagents；
- LlamaIndex / Haystack 强在文档 ingestion、index、retrieval、query context；
- Agno 强在 agent platform、context providers、storage、observability、人审流程。

它们支持“上下文不必全部在模型窗口里，而可作为可检索外部材料存在”。但它们没有证明 coding-agent 原生会话上下文可被 fork 给 reviewer。

### 3.6 Magic Context

Magic Context 的源码和 README 显示，它不是简单的文档系统，而是在 OpenCode/Pi 的 message/system transform 层管理上下文：

- 给消息和工具输出打 tag；
- 允许 agent 用 `ctx_reduce` 标记可丢弃内容；
- 通过 historian compartment 压缩旧历史；
- 通过 `ctx_search` / `ctx_expand` 检索和展开旧会话；
- 注入 `<session-history>`、project memory、user profile；
- 以 cache-aware 方式延迟变更，避免 prompt cache thrash。

它直接支持我们对 fork-prune 的修正：

```text
如果要做 fork-prune，最好参考 runtime transform / protected tail / search-expand / compartment 的思路，
而不是离线读 transcript 后手工拼一个 summary prompt。
```

但 Magic Context 不应成为 Context Tree 主依赖：

- 它的核心目标是主会话长期 continuity，不是 consultant activation / result return；
- 它对 subagent 默认 reduced guidance，不是给业务 reviewer/member 自动继承完整主会话记忆；
- Dreams 是异步 memory maintenance，不适合实时替代 activation point 的上下文选择；
- 它目前更像 context material backend，而不是 team/member orchestration layer。

### 3.7 llm-context-viz

`llm-context-viz` 提供两条相关但不同的路径：

1. JSONL pipeline：扫描 Claude/Codex/OpenCode/Pi/OpenClaw 会话记录，按 turn 估算 token 和类别。这适合可视化、离线分析和发现上下文污染，但不等于 runtime 实际 prompt assembly。
2. calibration proxy：通过 proxy/base-url 捕获真实 provider request/response。这适合强 e2e proof，能帮助回答 consultant 实际看到什么。

对 Context Tree 的影响：

- 可以参考其 parser / turn grouping / category taxonomy / compaction reset detection；
- 可以借鉴 provider request capture 做 eval evidence；
- 不应把它当成产品上下文组装器；
- 不建议直接复制代码，许可证和产品定位都不合适。

## 4. 对 Context Tree 的设计影响

### 4.1 不要实现固定 context assembler

已有生态已经证明，固定把材料塞进 prompt 很容易退化成 doc harness 或 RAG harness。我们的边界应保持为：

```text
Context Tree 不决定任务最终需要哪些材料；
它提供 consultant activation、checkpoint/session lineage、member profile / role history refs、可恢复历史、fidelity 标注和 result return；
agent/runtime 根据任务选择材料。
```

这里的“最高可用”不应解释为“最高保真 fork 一定最好”。更准确的边界是：

```text
最高有效材料路径 = 对当前任务最有用、来源属于正确 checkpoint/tree lineage、
且实际 fidelity/known losses 可观测的材料路径。
```

因此 native/session fork、platform DCP/prune、Magic Context 风格 search/expand、`context-mode` 风格 searchable history、role history、staged docs 都是候选。哪一个更好需要由任务和 e2e 证据决定。

### 4.2 V0 应围绕 agent-callable primitive

V0 不应从用户 shell 命令开始，也不应要求用户退出 agent UI。

更合理的最小闭环是：

```text
loop agent 到达关键节点
→ 调用 ctree checkpoint / spawn / attach-result 类原语
→ 适配器使用当前平台最强可用方式派生 agent
→ 派生 agent 使用平台 DCP/prune/context selection 或按需查询 checkpoint 历史
→ 结果回到主 agent / eval runner
```

### 4.3 要借鉴 context-mode 的 capture 方式

尤其是：

- hooks 优先于纯 instructions；
- raw tool output 默认不进入 model context；
- session continuity 放在 SQLite/FTS 类本地存储；
- compact 前后要有显式 capture/restore；
- 不把输出风格控制和 context routing 混在一起；
- 多平台能力矩阵要记录真实 hook 能力。

### 4.4 要借鉴 CCG 的 subagent 注入位置判断

如果平台 subagent 是通过 Task/Agent tool 创建，必须验证：

```text
上下文是否进入了子 agent 自己的初始 prompt / model request，
而不是只进入父 agent 当前轮 additionalContext。
```

这直接影响 live e2e 的 oracle。

### 4.5 Trellis 是 baseline，不是替代

Trellis-style staged docs 足够强时，Context Tree 的增益会变小。这不是问题，而是后续质量 eval 应测的 baseline。

当前 implementation e2e 只需要证明：

- checkpoint lineage 能记录；
- 从 checkpoint 派生 agent 能运行；
- 派生 agent 能获得任务相关上下文材料；
- 结果能回主 loop；
- fidelity 和 known losses 可观测。

不要在这一步承诺 reviewer 比 Trellis/doc-only 更强。

## 5. 下一步建议

下一步不应直接做大实现。建议先做一个很窄的 V0 implementation plan：

1. 定义最小 manifest：
   - `checkpointRef`;
   - `baseSessionRef`;
   - `requesterSessionRef`;
   - `targetRef`;
   - `spawnRef`;
   - `fidelity`;
   - `materialSelectionMode`;
   - `resultRef`;
   - `knownLosses`;
   - `evidenceRefs`。
2. 在现有 Codex live eval 上接入这个 manifest。
3. 加一个 positive 场景：派生 reviewer 必须看到 checkpoint 前用户/agent 关键决策。
4. 加一个 negative 场景：fresh-thread/summary-only 不能被误判为 checkpoint-derived。
5. 明确区分三种材料路径：
   - native/platform-selected context；
   - checkpoint history supplementation；
   - staged docs / task artifacts。
6. 对 context-mode 做一次源码级专项调研，确认它的 session DB、PreCompact/SessionStart、Codex/OpenCode hooks 是否可作为我们 capture backend 的参考。

只有这些实现级问题跑通后，再讨论：

- 是否接入 context-mode 或采用类似 storage；
- 是否支持 Trellis/CCG workflow boundary；
- 是否做 AACR 3-PR quality pilot。

## 6. 源码级可参考设计

### 6.1 `context-mode`：事件库 + 搜索目录，而不是 raw 注入

可参考点：

1. **双层存储**
   - `SessionDB` 是按 project 持久化的 SQLite，会记录 hook 捕获到的 session events。
   - `ContentStore` 是临时 FTS5/BM25 index，用于按需搜索工具输出和 session events。
   - raw events 不直接注入模型上下文。

2. **compact/resume 恢复方式**
   - `PreCompact` 从 SessionDB 生成 resume snapshot。
   - snapshot 是“目录 + 查询入口”，不是完整历史展开。
   - `SessionStart` 在 compact/resume 时注入 routing block、session directive 和未消费的 resume snapshot。

3. **平台能力按真实 hook 建模**
   - Codex 有 `PreToolUse`、`PostToolUse`、`PreCompact`、`SessionStart`、`UserPromptSubmit`、`Stop`，但部分字段受版本限制。
   - OpenCode 没有 SessionStart，所以用 `experimental.chat.system.transform` 作为恢复注入点。

对 Context Tree 的影响：

```text
历史补充不应默认变成全量 transcript 注入；
更好的形态是：checkpoint capture 记录可搜索历史，派生 agent 按任务查询。
```

不要照搬：

- `context-mode` 没有 tree lineage、base/requester/target 区分、checkpoint fork 或 result return。
- 它的 session continuity 不能替代我们的 checkpoint-derived reviewer 语义。

### 6.2 `opencode`：session fork 与 subagent result return

可参考点：

1. **Session parentID**
   - session 表里有 `parent_id`，并提供 `children(parentID)`。
   - 这说明 coding agent 自身可以把 session 树作为一等结构。

2. **`Session.fork({ sessionID, messageID? })`**
   - fork 创建新 session；
   - 复制原 session 的 messages 和 parts；
   - 如果传 `messageID`，复制到该 message 之前；
   - 重写 message id、part id；
   - 对 compaction part 的 `tail_start_id` 也会重映射。

3. **Task 工具创建 child session**
   - `TaskTool` 创建带 `parentID` 的 child session；
   - 子 session 使用指定 agent/model；
   - foreground 模式等待结果并返回 `<task>`；
   - background 模式结束后把 synthetic task result 注入 parent session。

4. **Compaction 不是 transcript 全量**
   - compaction 选择 head/tail；
   - 可以通过 plugin 注入 compaction context 或替换 prompt；
   - 老工具输出会被 prune 标记，不再完整保留在模型可见上下文。

5. **Revert 语义**
   - revert 是消息/part 截断加文件 snapshot 恢复；
   - 它不是恢复模型 hidden state。

对 Context Tree 的影响：

```text
OpenCode 是最强的 V0 参考路径：
checkpoint = sessionID + anchor messageID；
fork = Session.fork 到 anchor；
helper/reviewer = forked session 上运行 subagent/task；
return = synthetic task result 回 parent。
```

不要照搬：

- OpenCode 的原生 Task child session 默认从当前 session 派生，不自动表达“从上游 P 派生 R 去 review C”。
- Context Tree 仍需要外部 manifest 记录 base/requester/target/fidelity。

### 6.3 `letta-code`：forked conversation + 明确身份提醒

可参考点：

1. **`fork: true` subagent 配置**
   - 当 subagent config 要求 fork 时，Letta 会 fork parent conversation；
   - 再把 parent agent 部署到 forked conversation 中；
   - forked conversation 可 hidden，避免污染主 conversation list。

2. **forked subagent system reminder**
   - 子 agent 被明确告知：
     - 你是从主 conversational thread fork 出来的；
     - inherited trajectory 只作为 reference；
     - 你不是 primary agent；
     - 不要继续主 agent 正在做的任务；
     - 你的 final message 会返回 caller。

3. **recall subagent**
   - recall 不是靠全量注入，而是通过 `letta messages search` 做 hybrid/vector/FTS 搜索；
   - 需要时再用 message id 扩展前后文。

4. **结果回流与审计**
   - background task 写 output file；
   - 完成后用 task notification 注入 parent message queue；
   - 大结果会截断，完整结果保留在文件。

对 Context Tree 的影响：

```text
派生 reviewer 必须收到身份边界：
继承上下文是为了审查/指导，不是为了继续执行 parent 的旧任务。
```

同时，history supplementation 可以做成 agent-callable recall/search，而不是系统预先塞满上下文。

不要照搬：

- Letta 的 memfs / self-improving memory 是长期 agent identity 方向，不是 V0 必需。
- 它的 fork 依赖 Letta backend conversation API，不能直接假设 Codex/OpenCode 都有同等能力。

### 6.4 `langgraph`：checkpoint 存储结构

可参考点：

1. **thread/checkpoint 分离**
   - `thread_id` 表示一串 checkpoint；
   - `checkpoint_id` 可以指定从 thread 中某点恢复。

2. **checkpoint tuple**
   - checkpoint 本体；
   - config；
   - metadata；
   - parent_config；
   - pending_writes。

3. **metadata.source**
   - 明确支持 `input`、`loop`、`update`、`fork`。

4. **SQLite schema**
   - `checkpoints(thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata)`；
   - `writes(thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, value)`。

对 Context Tree 的影响：

```text
我们可以借鉴 thread/checkpoint/parent_checkpoint_id/source=fork/pending_writes 的建模，
但不要引入完整 LangGraph state machine。
```

### 6.5 Trellis / CCG：子 agent prompt 注入位置

可参考点：

- Trellis 的 OpenCode plugin 在 `tool.execute.before` 中改写 Task tool 的 `args.prompt`，确保 context 进入子 agent 自己的 prompt。
- CCG 明确指出：`PreToolUse.additionalContext` 只到达 caller session，未创建的 subagent 看不到；Agent/team spawn 必须改写 spawned teammate 的 prompt。

对 Context Tree 的影响：

```text
如果 fallback 需要向派生 agent 注入 history directive / target refs，
必须证明它进入了 child agent 的 initial prompt/model request，
不能只进入 parent agent 的当前上下文。
```

## 7. 设计取舍

可参考并进入 V0：

- `context-mode` 的 SessionDB / searchable history / compact directive 思路；
- `opencode` 的 `Session.fork(messageID)`、child session、synthetic result return；
- `letta-code` 的 forked subagent 身份提醒和 recall/search 补充；
- `langgraph` 的 checkpoint tuple 与 parent checkpoint metadata；
- Trellis/CCG 的子 prompt 注入位置校验。

不进入 V0：

- 通用 RAG/doc harness；
- 自己重写 agent runtime prompt assembler；
- Letta-style 自进化 memory；
- LangGraph-style 完整 graph execution engine；
- 对 reviewer 质量的 AACR 扩样证明。
