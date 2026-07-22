# 调研任务：AACR review-quality eval

> 状态：deferred。
>
> 当前阶段暂不做效果 eval。先完成 Context Tree 的实现与实现级 e2e eval：
> checkpoint / fork-spawn / result return / evidence report。AACR 保留为后续质量
> eval 的候选 benchmark。

本任务的正式设计已整理到：

- `architecture/08-context-bearing-subagent-api-design.md`

## 目标

验证当前核心假设：

```text
从原 designer agent 的对话/checkpoint 上下文派生 reviewer，
是否比 doc-only reviewer 在真实代码审查任务中更有效、更便宜。
```

## 主要数据源

使用已 clone 的：

- `ref/aacr-bench`

优先抽样包含 `Repo Level` / `File Level` comments 的 PR，因为这些更可能暴露上下文差异。

注意：AACR-Bench 不提供 design doc 或 implementation doc。它只提供真实 PR URL、source/target commit 和 expert review comments。PR title / description 需要运行时从 GitHub API 拉取；实现对象是 commit diff 本身。

因此第一波 pilot 必须显式产出两类 doc baseline 材料：

- `design/review notes`：由 designer session 在 checkpoint 前写出；
- `implementation summary`：由 eval harness 或 designer agent 根据 PR diff/目标代码生成。

这些文档是本 eval 的受控输入，不是 AACR 原生数据。

辅助数据源：

- `ref/code-review-arena`

仅用于后续 execution-backed repair eval，不作为本轮主结论来源。

## 必须比较的三组

1. `doc-only`
   - PR title / description；
   - source / target commit；
   - diff；
   - repo 稳定材料；
   - changed files / relevant files；
   - designer 明确写出的 review/design notes。

2. `checkpoint-fork`
   - 从同一 designer session 的 checkpoint 派生 reviewer；
   - reviewer 审查同一 PR/diff；
   - 不允许访问 AACR reference comments。

3. `fresh-thread-negative`
   - 只给最小 PR 输入或摘要；
   - 用作负控。

## 需要记录

- AACR evaluator 指标；
- 按 context level / category 分层的 recall；
- unmatched/noise；
- input/output token；
- cached input token / prompt cache hit，如 provider 暴露；
- latency；
- fork/session 操作成本；
- doc-only baseline 的文档生成成本。

## 第一波 pilot

第一波只跑 3 个 AACR PR。

目标不是统计显著性，而是证明 eval 闭环可行：

- 能构造 designer session；
- 能分离 `doc-only` 与 `checkpoint-fork` 输入；
- reviewer 输出能被 AACR evaluator 消费；
- 能记录 token / latency / cache hit 相关字段；
- 不暴露 AACR reference comments。

## 扩样门槛

只有 3 个 PR pilot 跑通，并且 `checkpoint-fork` 出现质量或效率增益信号后，才扩到不少于 20 个 AACR PR 的确认样本。

确认样本中：

- `checkpoint-fork` 在 high-value slice 上有稳定 recall 增益；
- precision/noise 不明显恶化；
- 操作成本低于手动新会话 + 写总结。

如果不能达到这个门槛，不应继续设计 Context Tree 产品 API。
