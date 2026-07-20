# 调研任务：生态中的任务自适应上下文选择

## 目标

在具体实现 Context Tree 之前，调研是否已有高 star repo 解决了类似问题：

```text
agent 根据任务自主选择 / 裁剪 / 补充上下文，
并在需要时派生 subagent / reviewer / reflector。
```

本调研优先使用 `tavily-hikari`。如果当前环境没有暴露该 MCP/CLI，则使用 GitHub API、官方文档、源码和本地 refs 作为 fallback，并在报告中标明限制。

## 关键问题

1. 有没有 repo 已经提供“任务自适应上下文选择”？
   - DCP / prune / trim / summarize；
   - agent 自主读取长期历史；
   - 按任务选择 docs / memory / transcript / tool results。

2. 有没有 repo 已经提供“checkpoint / history supplementation”？
   - 从旧 session / checkpoint / thread 恢复；
   - agent 请求补充较早但重要的历史；
   - 历史材料不默认进入 model context，而是按需注入或检索。

3. 有没有 repo 已经提供“subagent with inherited context”？
   - 原生 fork；
   - thread/session fork；
   - child agent 继承或读取 parent context；
   - result 回流给主 agent。

4. 这些 repo 的方案和 Context Tree 的差异是什么？
   - 它们是 framework state machine、coding agent、memory system、workflow harness，还是 eval harness？
   - 它们是否让 agent 自主决定上下文，还是由系统固定组装？
   - 它们是否有可观测 fidelity / known losses？

## 候选方向

优先检查高 star、真实使用广的项目：

- LangGraph / LangChain；
- AutoGen；
- CrewAI；
- LlamaIndex；
- Letta；
- OpenHands；
- Aider；
- OpenCode；
- Agno；
- Trellis / Superpowers / CCG 作为本地 workflow harness 对照。

## 输出

写入新的 architecture 调研报告，建议路径：

```text
architecture/09-ecosystem-context-selection-survey.md
```

报告必须包含：

- repo 名称、star 量、定位；
- 上下文选择机制；
- checkpoint/history 机制；
- subagent/context 机制；
- 与 Context Tree 的重叠；
- 我们是否应该借鉴、适配、或避免重复实现；
- 对下一步 implementation plan 的影响。

## 当前判断边界

本调研不回答 reviewer 效果是否更好，也不使用 AACR。它只回答：

```text
在我们实现 checkpoint / fork / return 前，
行业里是否已有可复用或必须避开的设计。
```
