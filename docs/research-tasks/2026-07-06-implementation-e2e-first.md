# 实现任务：Context Tree implementation e2e first

## 状态

当前优先级高于 AACR / review-quality eval。

但在进入具体实现前，先完成生态调研：

- `docs/research-tasks/2026-07-06-ecosystem-context-selection-survey.md`

目标是确认高 star agent framework / coding agent / harness 是否已经提供类似能力，避免过早实现一个已有模式的弱版本。

## 目标

先证明 Context Tree 的实现链路可跑：

```text
checkpoint candidate
→ fork/spawn reviewer
→ reviewer receives task-appropriate context
→ result returns to parent agent / eval runner
→ eval evidence records actual fidelity
```

本任务不评价 reviewer 是否比 doc-only 更聪明，只评价实现能力是否真实、可重复、可观测。结果回流给主 agent 是产品目标之一；evidence report 是 eval 目标。

## 已有入口

当前仓库已有：

```text
npm run eval:codex:mock
npm run eval:codex:live
```

这些应继续作为实现 e2e 的基础，而不是先引入 AACR 质量评测。

## 必须覆盖

1. `checkpoint`
   - 记录当前会话 / thread / rollout / boundary；
   - 记录调用目的和目标材料；
   - 不预设这是 design doc 或文档化上下文。

2. `fork/spawn`
   - 优先使用最强可用平台路径；
   - 记录实际 fidelity；
   - summary-only 只能是 negative / degraded path。
   - 不固定规定子 agent 必须看到全量 transcript / 全量工具结果。
   - 支持由 agent 根据任务选择平台 DCP/prune 后的上下文，或请求补充较早 checkpoint 历史。

3. `return`
   - reviewer 结果必须能回到父 agent 或 eval runner；
   - 不能依赖用户手动复制。

4. `evidence`
   - mock 与 live 都输出同一类 capability matrix；
   - live 必须包含能证明 fork/spawn 发生的 evidence；
   - cache/token/latency 可观测则记录，不可观测则写 `unknown`。
   - evidence 是 eval/readout，不是产品主要用户接口。

## 通过标准

- mock e2e 可稳定通过；
- live e2e 至少证明一种真实 context-bearing fork/spawn 路径；
- negative controls 能阻止 summary-only / fresh-thread 被误判为成功；
- report 能清楚区分 capability、known losses、inconclusive 和 failure；
- 不引入 doc-only 质量比较作为当前阻塞项。

## 后续

只有本任务稳定后，才恢复：

- AACR 3-PR quality pilot；
- doc-only vs checkpoint-fork 对比；
- 20+ PR 扩样验证。
