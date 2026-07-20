# Harness 上下文构造调研：Trellis 与高 star 项目

> 状态：本文保留为早期 harness/context-engineering 调研记录。其 Trellis
> 判断未覆盖 upstream 后续确认的 `trellis channel` runtime、`trellis mem`
> session extraction、OpenCode/Pi subagent injection 等实现细节。当前 Trellis
> 对比与产品结论以 `architecture/08-context-bearing-subagent-api-design.md`
> 为准。

## 1. 调研问题

本调研只回答一个问题：

> “有选择、有层次地构造模型真正该看到的上下文”是否已经是 Trellis 或其它高 star harness / agent framework 的做法？

结论：

```text
是。主流方向已经不是把所有历史塞进 prompt，
而是把上下文拆成 specs / task state / memory / graph state / retrieval / compaction / tool schema，
并在每次 agent 调用或阶段转换时选择性注入。
```

但这些项目多数解决的是“当前任务如何获得足够上下文”，而不是 Context Tree 的核心问题：

```text
从上下文树中的某个上游 checkpoint 派生一个 reviewer/planner，
并尽可能复现该 checkpoint 的 runtime-visible context。
```

因此它们证明了 `compiled-context backend` 的方向合理，但不能替代 Context Tree 的 native fork / checkpoint lineage。

## 2. Trellis

本地参考：

- `/home/prosumer/agent/Trellis/README.md`
- `/home/prosumer/agent/Trellis/.trellis/workflow.md`
- `/home/prosumer/agent/Trellis/.trellis/scripts/common/session_context.py`
- `/home/prosumer/agent/Trellis/.trellis/scripts/common/packages_context.py`

Tavily 搜索结果显示 `mindfold-ai/Trellis` 是高 star agent harness，README 宣称它通过 `.trellis/spec/`、`.trellis/tasks/`、`.trellis/workspace/` 组织 specs、任务 PRD、workspace memory，并支持多平台。

Trellis 的实际上下文策略：

```text
.trellis/spec/       项目标准、分层规范、guides
.trellis/tasks/      task.json / prd.md / 当前任务
.trellis/workspace/  developer journal / session continuity
get_context.py       汇总 developer、git、active task、journal、packages
packages_context.py  根据 package / spec layer 生成应读索引
```

这就是一种强文档式、分层上下文构造：

- specs 不是单个大 CLAUDE.md，而是按 package/layer 拆分；
- task PRD 和 current task 决定当前上下文范围；
- workspace journal 提供跨 session continuity；
- startup hook / slash command 把相关 context 注入 agent；
- `get_context.py --mode packages` 给 agent 提供“先读哪些 spec index”的路由。

它能解决：

- 新 session 从零开始；
- 多平台共享项目规范；
- 当前任务应读取哪些设计/实现约束；
- session 结束后把结果记录到 workspace journal。

它不能完全解决 Context Tree 的目标：

- 它不尝试 fork parent runtime context；
- 它不表达 `P spawned R reviews C` 这种树谱系；
- 它不证明 reviewer 拿到的是某个 checkpoint 的 model-visible context；
- 它更像 staged context delivery / project memory，而不是 checkpoint-native context fork。

对 Context Tree 的启发：

```text
compiled-context packet 可以借鉴 Trellis：
  - 分层材料；
  - task/phase 路由；
  - workspace journal；
  - package/layer scope；
  - hooks 自动注入；
但 packet 必须额外记录：
  - source ContextNode；
  - turn/message boundary；
  - runtime-visible vs raw-record；
  - transform layers；
  - known losses；
  - fork/review edge。
```

## 3. LangGraph / LangChain

Tavily 结果与 LangChain 文章显示，LangGraph 把 context engineering 明确拆成：

- write context；
- select context；
- compress context；
- isolate context。

关键模式是 state object：

```text
graph state 中有多个字段；
messages 字段每轮暴露给 LLM；
其它字段可以保存工具结果、中间状态或记忆，
直到某个 node 决定把它们选择性放入 LLM context。
```

这说明“模型真正该看到的上下文”不是 transcript 全量，而是每个 node 根据 state、memory、retrieval 和 tool schema 组装的输入。

与 Context Tree 的关系：

- LangGraph 强在 runtime state / checkpoint / node-level context selection；
- 它支持我们把 compiled-context backend 建模为“从 checkpoint state 编译 reviewer node 的输入”；
- 但 LangGraph 的 checkpoint 是应用图状态，不是 Codex/Claude/OpenCode 原生 coding-agent 会话历史 fork。

## 4. LlamaIndex

Tavily 结果显示 LlamaIndex 是高 star RAG / agent 框架，常见上下文构造模式包括：

- RAG retrieval；
- chat memory；
- vector memory；
- structured/entity memory；
- agent workflow；
- artifact/memory block；
- 控制保留多少 chat history，多少 token 给 system prompt 和 memory block。

它证明了另一种分层方法：

```text
不要保留完整聊天历史；
把任务关键状态抽成 artifact / memory block；
每轮把 artifact + 少量 history + retrieval 拼成输入。
```

与 Context Tree 的关系：

- 对长任务效率很有价值；
- 适合作为 `compiled-context packet` 中的 memory/artifact 层；
- 但如果它丢弃原始 turn lineage，就不够证明“从某个 checkpoint 派生 reviewer”。

## 5. AutoGen / Microsoft Agent Framework 方向

Tavily 结果显示 AutoGen 讨论中反复出现：

- multi-turn message history；
- save_state / load_state；
- memory module；
- selective historical messages；
- group chat / selector prompt 中显式传入 `{history}`。

AutoGen 目前进入 maintenance mode，并推荐迁移到 Microsoft Agent Framework。它的价值主要是说明：多 agent 框架通常把“agent 能看到什么”暴露为可配置 state / memory / history，而不是默认共享完整父上下文。

对 Context Tree 的意义：

- 不应把“有 subagent / multi-agent”误认为“有 parent context fork”；
- 大多数框架需要显式设计 context sharing；
- compiled-context backend 是必要能力，而不是 edge case。

## 6. Anthropic Context Engineering 方向

Anthropic 的 “Effective context engineering for AI agents” 把 context engineering 定义为：

```text
curating and maintaining the optimal set of tokens during LLM inference
```

并把 context 从 prompt 扩展到：

- system instructions；
- tools；
- MCP；
- external data；
- message history；
- examples；
- runtime retrieval。

这直接支持 Context Tree 的修正：

```text
上下文不是普通文档；
上下文是每次 inference 时进入模型的有限 token 配置。
```

因此 Context Tree 的 compiled-context backend 也不应生成“好看的总结”，而应生成能进入 reviewer/planner inference 的高信号上下文配置。

## 7. 对 Context Tree 的设计结论

### 7.1 文档化可以成立，但必须是上下文编译

可接受：

```text
runtime/session records + assembly recipe + transform layers
→ compiled context packet
```

不可接受：

```text
agent 写一份 design doc
→ 假装 reviewer 获得完整 context
```

### 7.2 Native fork 与 compiled context 是互补后端

```text
当前 live 同平台边界：
  native runtime fork 优先。

历史 checkpoint / 跨平台 / 可审计 / compact-DCP 控制：
  compiled context packet 必须存在。

只能传 summary：
  低保真 handoff，不是 Context Tree 核心能力。
```

### 7.3 Trellis 能达到部分效果，但不是完整替代

Trellis 的强文档式系统能让独立 agent 拿到项目规范、任务 PRD、workspace journal 和当前任务状态。它可以显著提高 review interface 的质量。

但它没有证明：

```text
reviewer 基于某个 parent checkpoint 的完整 runtime-visible context；
reviewer 与 parent/child 在 tree 中有明确 fork/review lineage；
compact/prune/tool-result 的可见性与原 runtime 等价。
```

所以 Context Tree 可以借鉴 Trellis 的分层 context delivery，但不应退化成 Trellis。

## 8. V0 eval 影响

后续 eval 应新增一组：

```text
A. native spawn reviewer
B. thread/session fork reviewer
C. compiled-context packet reviewer
D. Trellis-style docs/task/spec reviewer
E. summary-only reviewer
F. fresh reviewer
```

评估重点：

- user-message canary；
- assistant-final decision；
- tool-result visibility；
- compact/DCP 后的 current-visible summary；
- 已排除方案；
- 用户临时偏好；
- 是否发现 high/critical design issue；
- 是否产生 invented context。

只有 C 明显优于 D/E，才说明 Context Tree 的 compiled-context backend 不只是“强文档 workflow”的重复。

## 9. 参考

- Trellis GitHub: https://github.com/mindfold-ai/Trellis
- Trellis docs: https://docs.trytrellis.app/
- LangChain context engineering: https://www.langchain.com/blog/context-engineering-for-agents
- Anthropic effective context engineering: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- LlamaIndex GitHub: https://github.com/run-llama/llama_index
- AutoGen GitHub: https://github.com/microsoft/autogen
- Tavily 搜索结果：`mindfold-ai/Trellis`、`awesome-agent-harness`、`awesome-harness-engineering`、`LangGraph`、`LlamaIndex`、`AutoGen`。
