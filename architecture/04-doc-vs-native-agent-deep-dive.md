# Doc vs Native Agent 深入调研：分层文档能否替代 Context Tree

> 状态：本文保留为“文档化上下文 vs native agent 上下文”的历史分析。
> 当前结论已由 `architecture/08-context-bearing-subagent-api-design.md`
> 修正为 eval-first：先比较 designer checkpoint-fork reviewer 与 doc-only
> reviewer 的真实 review 质量和成本，再决定是否进入产品 API 设计。

## 1. 调研问题

本轮只回答两个问题：

1. **doc 还是 native agent？**
   - reviewer 应该依赖外部文档/上下文包，还是依赖 agent runtime 的 native fork/spawn？

2. **Trellis 等 harness 的“分层上下文”到底是什么？**
   - 如果这些分层足够强，是否已经达到 Context Tree 想要的效果？

结论先行：

```text
分层文档/上下文构造已经是高 star harness 和 agent framework 的主流方向。
native agent fork 不是行业唯一方向，甚至不是多数框架的默认能力。

如果 Trellis-style staged context 能在 eval 中达到 native fork reviewer 的审查水平，
Context Tree 不应做成独立大系统。

Context Tree 只有在“checkpoint 局部上下文、历史谱系、runtime-visible fidelity”
明显带来增益时才成立。
```

## 2. Doc vs Native Agent：不是二选一，而是三层

### 2.1 Native agent fork

```text
parent runtime context
→ native spawn/fork/resume
→ child reviewer
```

优点：

- 复用平台自己的 prompt assembly；
- role / authority / tool schema / model settings / compact 语义不容易手工弄错；
- 对当前 live boundary UX 最好；
- 不要求 agent 主动把所有临时上下文写进文档。

缺点：

- 黑盒；
- 跨平台不可移植；
- 很难审计 “child model request 到底看到了什么”；
- compaction / pruning / tool-result filtering 是平台内部语义；
- 可能携带大量无关历史和错误轨迹。

适合：

```text
当前 live agent 即将进入下一阶段；
同平台可以直接 spawn full-history reviewer；
用户不想退出 agent UI；
reviewer 需要尽量继承现场语境。
```

### 2.2 Staged docs / layered harness context

```text
specs + task PRD + design/implement artifacts + curated JSONL + workflow state
→ stage-specific reviewer / implementer / checker prompt
```

优点：

- 可审计；
- 可版本化；
- 可跨平台；
- 人和 agent 都能维护；
- 可以比 native history 更干净，因为只注入高信号材料。

缺点：

- 依赖 agent/human 持续正确归档；
- 临时偏好、排除路径、中间探索容易漏写；
- 普通文档很难表达 turn/message boundary、role authority、tool visibility；
- 如果为了不漏 context 而过度记录，会污染长期 specs。

适合：

```text
reviewer 主要需要稳定规范、需求、设计产物、代码 diff、已知约束；
task lifecycle 明确；
上下文可以被 agent 在阶段边界前整理成 task-local artifacts。
```

### 2.3 Compiled context packet

```text
session record / rollout / transcript
+ prompt assembly recipe
+ compact / DCP / prune state
+ tool result visibility
+ tree checkpoint boundary
→ node-local context packet
→ reviewer
```

这是 Context Tree 可能保留的独特点。

它不是普通 docs，也不是 native fork。它是把 runtime context 的可观测材料编译成一个 node-local artifact。

优点：

- 比 staged docs 更接近 checkpoint；
- 比 native fork 更可审计；
- 可以记录 source node、target node、known losses；
- 不污染长期 specs。

缺点：

- 实现复杂；
- 需要适配各平台 session store / compact / tool-result 语义；
- 若无法作为 model-visible messages 注入，只是挂载记录，则降级。

适合：

```text
reviewer 需要某个历史 checkpoint 的临时语境；
这个语境不适合写进长期 specs；
但又必须比 summary handoff 更强、更可审计。
```

## 3. Trellis 的分层具体是什么

本地代码与 docs 显示，Trellis 的“分层”不是单纯 `.trellis/spec/`。它至少有七层。

本地参考：

- `/home/prosumer/agent/Trellis/README.md`
- `/home/prosumer/agent/Trellis/.trellis/workflow.md`
- `/home/prosumer/agent/Trellis/.trellis/scripts/common/session_context.py`
- `/home/prosumer/agent/Trellis/.trellis/scripts/common/packages_context.py`
- `/home/prosumer/agent/Trellis/.trellis/scripts/common/task_context.py`
- `/home/prosumer/agent/Trellis/.claude/hooks/session-start.py`
- `/home/prosumer/agent/Trellis/.claude/hooks/inject-subagent-context.py`
- `/home/prosumer/agent/Trellis/.opencode/plugins/inject-subagent-context.js`
- `/home/prosumer/agent/Trellis/.codex/hooks/session-start.py`

### 3.1 项目工作流层

```text
.trellis/workflow.md
```

定义：

- session start；
- task lifecycle；
- before-dev；
- implement/check/finish；
- record-session；
- workflow-state。

Trellis 的 hook 只注入 workflow 的 section index，而不是全量 workflow，要求 agent 按需读取完整文件。这是 lazy-load context。

### 3.2 项目规范层

```text
.trellis/spec/
```

单仓结构：

```text
.trellis/spec/backend/index.md
.trellis/spec/frontend/index.md
.trellis/spec/guides/index.md
```

monorepo 结构：

```text
.trellis/spec/<package>/<layer>/index.md
.trellis/spec/guides/index.md
```

本地 Trellis 示例：

```text
.trellis/spec/cli/backend/index.md
.trellis/spec/cli/unit-test/index.md
.trellis/spec/docs-site/docs/index.md
.trellis/spec/guides/index.md
```

`index.md` 是路由页，列出 Pre-Development Checklist 和具体 spec 文件。agent 启动时通常只看到 index，然后按任务读取具体文件。

### 3.3 package / layer scope 层

Trellis 支持 `.trellis/config.yaml` 中的 monorepo packages：

```yaml
packages:
  cli:
    path: packages/cli
  docs-site:
    path: docs-site
    type: submodule
default_package: cli
```

`packages_context.py` 根据：

- active task package；
- default package；
- `spec_scope`；
- monorepo package 配置；

输出应读取的 package/layer index。

这说明 Trellis 的“分层”包含 scope filtering，不是所有 specs 全注入。

### 3.4 task artifact 层

每个 task 有自己的目录：

```text
.trellis/tasks/<task-id>/
  task.json
  prd.md
  design.md      # docs 中提到，复杂任务可有
  implement.md   # docs 中提到，复杂任务可有
  info.md        # 本地 hook 兼容读取
  research/
```

`task.json` 不只是标题：

- status；
- package；
- dev_type；
- current_phase；
- next_action；
- relatedFiles；
- parent / children；
- worktree_path；
- branch / PR refs；
- notes / meta。

这已经是一个轻量 workflow state machine。

### 3.5 per-agent JSONL context manifest 层

关键文件：

```text
implement.jsonl
check.jsonl
debug.jsonl
finish.jsonl
research.jsonl
spec.jsonl
```

每行是：

```json
{"file": ".trellis/spec/cli/backend/index.md", "reason": "Backend development guide"}
```

或目录：

```json
{"file": ".trellis/tasks/<id>/context/", "type": "directory", "reason": "..."}
```

`task_context.py` 支持：

- init-context；
- add-context；
- validate；
- list-context；
- monorepo package 校验；
- dev_type → 默认 spec entries。

这层非常接近 Context Tree 的 `compiled-context-packet` manifest，但它主要引用 specs/task artifacts，不引用 runtime transcript/checkpoint。

### 3.6 hook-push / pull-prelude / inline 三种注入层

Trellis docs 把平台分成三类：

1. **Hook-push sub-agent**
   ```text
   Claude Code / Cursor / OpenCode / CodeBuddy / Droid / Pi
   ```
   hook 在 subagent 启动前读取 JSONL、`prd.md`、`design.md`、`implement.md`，拼进 subagent prompt。

2. **Pull-prelude sub-agent**
   ```text
   Codex / Copilot / Gemini CLI / Qoder / Kiro
   ```
   subagent definition 告诉 agent 自己读取 active task、JSONL entries、task artifacts。

3. **Main-session skill flow**
   ```text
   Codex inline / Kilo / Antigravity / Devin
   ```
   主会话通过 skills 读取同样 artifacts。

这说明 Trellis 不要求所有平台都有 native subagent context fork。它用“同一套 task-local docs + 不同注入方式”实现跨平台。

### 3.7 workspace journal / session continuity 层

```text
.trellis/workspace/<developer>/journal-N.md
.trellis/workspace/<developer>/index.md
```

用于记录：

- session summary；
- branch；
- main changes；
- commits；
- testing；
- next steps。

这是长期 continuity，但不是 runtime transcript。

## 4. Trellis 分层能否达到 Context Tree 效果

### 4.1 能达到的部分

如果 reviewer 需要的是：

- 项目规范；
- task PRD；
- 设计文档；
- implementation plan；
- relevant source files；
- research context；
- quality checklist；
- package/layer scope；
- 当前 task status；

Trellis-style staged context 很可能足够，甚至优于 native full history。

原因：

```text
native history = 全量但噪音多、不可控；
staged context = 少量但高信号、可审计、可复用。
```

特别是代码审查、规范一致性、需求覆盖、实现计划检查这类任务，Trellis 的 per-agent JSONL + PRD + spec 注入已经很接近 “review interface”。

### 4.2 不能自然达到的部分

Trellis 默认不解决：

1. **checkpoint runtime-visible context**
   - 某一历史 turn 当时模型实际可见什么；
   - compact/DCP 后哪些内容仍 model-visible；
   - tool outputs 是否进入 child。

2. **上游节点派生**
   - `P = design node`
   - `C = implementation node`
   - `R should spawn from P and review C`

   Trellis 更多是 active task context，不是上下文谱系。

3. **role/authority fidelity**
   - JSONL 注入通常作为 prompt 文本；
   - 它无法自然保留原始 system/developer/user/tool role。

4. **未整理的临时语境**
   - 用户临时偏好；
   - 模糊语气中的优先级；
   - 中间探索；
   - 排除项；
   - designer 隐性判断。

   这些可以写入 `design.md` / `research/` / journal，但前提是 agent 真的写了。

5. **native fork 对照证明**
   - Trellis 的 claim 是“足够上下文注入”；
   - 不是“与 native runtime checkpoint 等价”。

### 4.3 如果 Trellis 做得足够好，它会变成什么

如果 Trellis 额外加入：

```text
node-local packet/
  source session ref
  turn/message boundary
  visible messages
  tool result refs
  compact/DCP state
  decisions/exclusions
  parent/child review edge
```

那它本质上就已经实现了 Context Tree 的 compiled-context backend。

这意味着：

```text
区别不在“文档 vs 非文档”，
而在是否有 checkpoint-local、runtime-aware、lineage-aware context packet。
```

## 5. 其它高 star harness / framework 的分层模式

### 5.1 LangGraph / LangChain

官方 docs 与文章强调：

- short-term memory = thread-scoped graph state / checkpoints；
- long-term memory = cross-thread store；
- state 中可以有 `messages` 供 LLM 看，也可以有其它字段隔离保存；
- 每个 node 可以选择要给 LLM 的 context；
- 可 trim / delete / summarize messages；
- system prompt 可以动态从 state/store/runtime context 生成。

这是 runtime-state 分层：

```text
state.messages          model-visible history
state.other_fields      hidden until selected
checkpointer            thread-scoped continuation
store                   long-term memory
runtime.context         static/run config
node prompt builder     per-call selection
```

它支持 Context Tree 的一个判断：

```text
“模型该看到什么”应该由 node/stage 决定，不应默认等于 transcript 全量。
```

### 5.2 LlamaIndex

LlamaIndex context engineering 方向强调：

- retrieval；
- chat memory；
- long-term memory blocks；
- vector memory；
- fact extraction；
- static memory；
- artifact / structured state；
- 不要把所有 context 都塞进窗口。

这是 retrieval/memory-block 分层：

```text
system prompt
task prompt
chat history slice
retrieved docs
memory blocks / artifacts
tool outputs
```

它证明强文档/强检索路径能在很多任务中替代原始会话历史。

### 5.3 Letta

Letta 明确提出 context hierarchy：

```text
memory blocks       always in context
files               partial in-context, open/search as needed
archival memory     out-of-context, searched by tools
external RAG        out-of-context, tool/MCP accessible
```

这比 Trellis 更明确地把“哪些信息常驻 context、哪些按需打开、哪些只能通过工具搜索”分层。

它说明：

```text
context 不只是 docs；
context 是有访问等级和可见性等级的层级结构。
```

### 5.4 AutoGen

AutoGen AgentChat docs 中 `AssistantAgent` 有 `model_context`：

- 默认 `UnboundedChatCompletionContext` 发送完整 conversation history；
- `BufferedChatCompletionContext` 只保留最近 N 条；
- `TokenLimitedChatCompletionContext` 按 token 限制；
- memory 通过 `update_context()` 在 inference 前更新 model context。

这是 model-context 策略分层：

```text
conversation state
model_context policy
memory update_context
team/group chat state
```

它再次说明：

```text
多 agent 框架默认关注“如何控制每次 LLM 调用看到什么”，
而不是默认共享完整父上下文。
```

### 5.5 CrewAI

CrewAI docs 将 agent 扩展分成：

- Tools / MCPs / Apps：行动能力；
- Skills / Knowledge：上下文能力；
- memory：short-term、long-term、entity、contextual。

这是 capability + memory 分层：

```text
agent role/backstory/goal
tools/MCP/apps
skills
knowledge sources
memory layers
task context
crew process
```

它适合任务编排和团队协作，但没有原生表达 “从某个历史 checkpoint fork reviewer”。

## 6. 行业共识判断

从 Trellis / LangGraph / LlamaIndex / Letta / AutoGen / CrewAI 看，较广泛接受的方向是：

```text
不要依赖一个不断增长的线性 transcript；
把 context 拆成层：
  stable instructions / specs
  task state
  short-term thread state
  long-term memory
  retrieval / files
  tool schemas and outputs
  workflow phase
  per-call selected messages
然后在每次 agent 调用前选择性组装。
```

因此：

- **doc/layered context 是主流可接受路径**；
- **native full-context fork 是 coding-agent 平台特有强能力，不是多数 agent framework 的默认共识**；
- **Context Tree 如果只追求 native fork，方向会太窄**；
- **Context Tree 如果只是做分层 docs，又会和 Trellis 重复**。

真正的空位是：

```text
checkpoint-local, runtime-aware, lineage-aware context packet
+ optional native fork reviewer
+ eval comparing against staged docs.
```

## 7. 判定标准：我们到底要不要做

不要再用概念争论。直接做判别 eval。

### 7.1 对照组

```text
A. Trellis-style staged docs reviewer
   specs + task PRD + design/implement artifacts + curated JSONL

B. native fork reviewer
   从 parent runtime spawn/fork

C. compiled context packet reviewer
   从 session record + boundary + transform layer 编译 packet

D. summary-only reviewer
   手动 summary / design doc only

E. fresh reviewer
   无上下文
```

### 7.2 任务类型

至少覆盖：

1. 稳定规范型问题  
   预期 Trellis A 应该接近 B/C。

2. 临时偏好/排除项问题  
   若未写入 docs，预期 B/C 可能强于 A。

3. 工具结果问题  
   检查 tool output 是否进入 staged docs / native fork / packet。

4. compact/DCP 问题  
   检查 current-visible summary 与 raw record 的差异。

5. 上游设计 review 下游 implementation 问题  
   检查是否需要从 P 而非 C 派生 reviewer。

### 7.3 决策门槛

如果：

```text
A ≈ B/C
```

结论：

```text
不做完整 Context Tree。
做 Trellis-style staged reviewer workflow。
```

如果：

```text
B/C 在临时偏好、排除项、tool result、checkpoint lineage 上明显强于 A
```

结论：

```text
做 Context Tree lite：
node-local context packet
+ native/compiled reviewer spawn
+ fidelity manifest
+ eval harness
```

如果：

```text
C ≈ B 且 C > A
```

说明 compiled-context backend 是核心，native fork 只是当前平台优化。

如果：

```text
B > C > A
```

说明 native runtime fork 是最强路径，但 packet 仍有 fallback/审计价值。

## 8. 当前建议

下一步不应继续扩大 Context Tree 架构。

应该先实现一个最小判别实验：

```text
Trellis-style staged docs reviewer
vs native fork reviewer
vs compiled packet reviewer
```

并让它回答：

```text
分层 docs 是否已经足够？
如果不足，不足的到底是哪类 context？
这些 context 是否适合写入 node-local packet？
native fork 是否只是更方便，还是实质上更强？
```

只有这个实验显示 Context Tree 有明确边际收益，才进入具体设计。

## 9. 参考来源

- Trellis GitHub: https://github.com/mindfold-ai/Trellis
- Trellis How It Works: https://docs.trytrellis.app/start/how-it-works
- Trellis Architecture Overview: https://docs.trytrellis.app/advanced/architecture
- Trellis Custom Hooks: https://docs.trytrellis.app/advanced/custom-hooks
- Trellis Custom Sub-agents: https://docs.trytrellis.app/advanced/custom-agents
- Trellis FAQ: https://docs.trytrellis.app/advanced/appendix-f
- LangChain Context Engineering: https://docs.langchain.com/oss/python/langchain/context-engineering
- LangGraph Memory / Persistence: https://docs.langchain.com/oss/python/langgraph/add-memory
- LangChain blog on context engineering: https://www.langchain.com/blog/context-engineering-for-agents
- LlamaIndex context engineering guide: https://www.llamaindex.ai/blog/context-engineering-what-it-is-and-techniques-to-consider
- Letta context hierarchy: https://docs.letta.com/guides/core-concepts/memory/context-hierarchy
- Letta memory blocks: https://docs.letta.com/guides/core-concepts/memory/memory-blocks
- AutoGen AgentChat agents/model context: https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/tutorial/agents.html
- AutoGen Memory and RAG: https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/memory.html
- CrewAI Knowledge: https://docs.crewai.com/v1.15.1/en/concepts/knowledge
