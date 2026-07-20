# Implementation-first：Checkpoint Fork 实现与 E2E Eval 优先级

## 0. 当前修正

本文替代早期的 `context-bearing subagent/oracle API` 方案，也修正上一版“先做 AACR review-quality eval”的优先级。

早期方案的问题是把产品重心推向了：

```text
系统负责定位 host / 组装 context / 选择 Trellis adapter / spawnContextAgent
```

这不符合当前目标。当前目标应回到最初的问题：

```text
reviewer 能否尽可能从原 designer agent 的对话/checkpoint 上下文中派生，
并且在真实 review 场景中显著优于 doc-only reviewer？
```

但这个问题不应立即进入效果 eval。当前更紧迫的是先证明实现路径：

```text
agent 能声明 checkpoint / fork 候选；
系统能记录可追踪 node/session/fork metadata；
系统能从该 checkpoint 派生 reviewer/subagent；
reviewer 能获得该任务需要的上下文材料；
reviewer 结果能回流给主 agent。
```

也就是说，Context Tree 不是 Trellis 扩展，不是文档编译器，也不是外部系统替 agent 组装每次模型输入。当前阶段先做 **implementation + implementation e2e eval**；evidence/report 是 eval 目标，不是总目标本身。AACR/doc-only 对比只作为后续质量评估。

## 1. 要证明什么

需要分开证明三件事：

1. **能力证明**：平台是否能从 parent thread / checkpoint / session 派生 reviewer，并让 reviewer 看见足够多的原上下文。
2. **实现证明**：Context Tree 是否能把 checkpoint、fork/spawn、result return 串成可重复 e2e，并在 eval 中留下 evidence/report。
3. **质量证明**：在真实 review 场景中，checkpoint-fork reviewer 是否比 doc-only reviewer 发现更多 high-value issue，且没有更高噪声。
4. **效率证明**：checkpoint-fork 是否比“手动开新对话 + 写总结 / 写 design doc”成本更低，包含 token/cache/latency/用户操作成本。

当前已有的 Codex context-fork eval 只覆盖第一类的一部分：

```text
canary visibility through thread/fork, rollback, inject_items, compaction, native-spawn artifacts
```

它不是 Trellis/doc-set eval，也不是 review-quality eval。

其中 native spawn 还要再分清两种证据层级：

- `eval:codex:live` 通过 app-server surface 直接跑出来的能力证据；
- live parent agent 在 runtime 内完成真实 native spawn，再由 harness ingest retained artifact 的能力证据。

当前 Codex 实现只稳定覆盖第二种 native-spawn 证据。也就是说，V0 已经可以证明 native-spawn 路径的 implementation/report plumbing 与 retained artifact contract，但还不能宣称同一个 live app-server eval 进程本身就能直接触达 native spawn surface。

当前下一步应补的是第二类：实现级 e2e。只有 capability + implementation e2e 都稳定之后，才值得投入质量 eval。

## 2. 核心修正：上下文材料由任务决定

当前不应把问题简化成：

```text
agent context 好，doc 不好
```

或者：

```text
完整 transcript / 全量工具调用 / 全量会话记录越多越好
```

对很多 review/check/reflect 任务来说，真正有价值的可能只是：

- 用户明确说过什么；
- agent 给过什么承诺或判断；
- 哪些方案被接受、否定、搁置；
- 当前目标和约束；
- 目标 artifact / diff / plan；
- 少量关键工具结果。

大量工具调用、冗长日志、失败探索、重复读取文件，可能只是噪声。

因此 Context Tree 不应该规定派生 agent 必须看到一套固定材料。更准确的产品语义是：

```text
给当前 agent 一个在关键节点派生 helper/reviewer/reflector 的能力；
派生 agent 应获得“任务所需的上下文”；
这个上下文优先由平台 agent/runtime 自己的 DCP/prune/context selection 产生；
当平台选择不到较久但仍有意义的历史时，Context Tree 提供补充定位/添加/重组能力。
```

这意味着：

1. **native context / DCP prune 是优先路径**
   - 如果平台能把当前任务需要的对话、recap、文件、工具结果裁剪给子 agent，Context Tree 不重复组装。

2. **历史补充是能力，不是默认行为**
   - 如果重要上下文在较早历史里，当前 agent 可以请求从某个 checkpoint / session / turn boundary 添加或重组上下文。

3. **文档是可选材料，不是对立面**
   - design doc、implementation note、review note 可以作为上下文材料；
   - 但它们不是唯一材料，也不应被强制生成。

4. **工具调用不是天然高价值上下文**
   - tool call/result 只有在任务需要时才应进入派生 agent 的 model-visible context；
   - 否则更适合保留在可查阅记录或 evidence 中。

5. **agent 自主选择应优先于系统硬编码**
   - Context Tree 提供 checkpoint/fork/history refs 和可用恢复路径；
   - 由主 agent 或派生 agent 根据任务决定要看哪些材料。

## 3. doc baseline 从何而来

我们目前没有 Trellis/doc set，因此不能把 Trellis 当作现成 baseline。doc-only baseline 需要在 eval 中受控构造，且必须避免偷渡对话上下文。

doc-only reviewer 可以看到的材料应来自以下来源：

1. **任务公开输入**
   - PR title / description；
   - issue / problem statement；
   - source commit / target commit；
   - diff。

2. **仓库稳定材料**
   - README / CONTRIBUTING / AGENTS / CLAUDE / Codex instructions；
   - architecture docs；
   - package manifests；
   - 与 PR 触达模块相关的测试、接口文档、配置。

3. **目标代码材料**
   - changed files；
   - reviewer 明确需要的 neighboring files；
   - repo-level issue 需要的引用文件。

4. **designer 产出的正式文档**
   - design doc；
   - implementation plan；
   - review notes；
   - explicitly written exclusions / decisions。

关键约束：

```text
doc-only baseline 只能看到已经写成文档或公开输入的内容。
designer 对话中的临时偏好、排除路径、中间探索、口头纠偏，
只有在 designer 明确写进 design/review notes 时才能进入 baseline。
```

这不是因为这些内容不能文档化，而是因为我们要测量“是否值得 fork checkpoint”。如果 baseline 被允许事后把完整对话蒸馏成完美文档，比较会退化成“谁写文档更好”，而不是“native/context fork 是否有增益”。

## 4. checkpoint-fork 条件从何而来

checkpoint-fork reviewer 的来源是同一个 designer 会话在关键节点的派生：

```text
user/problem + repo exploration + design/review reasoning + excluded paths
→ designer reaches checkpoint
→ fork reviewer from that checkpoint
→ reviewer reviews target artifact/diff without oracle
```

这条路径要尽量复用 host 原生能力：

- Codex app-server thread/fork；
- Codex native spawn / subagent path；
- OpenCode session / DCP / persisted history 能力；
- Claude Code resume / subagent / transcript 能力；
- 其它平台的等价 session fork 或 child-agent 机制。

如果平台只能挂载完整会话记录，必须标为 `session-record-mounted`，不能宣称等价于 native context fork。

如果平台 compact/DCP 后只剩 recap，且把历史消息 prune 掉，fork reviewer 的保真度应按实际可见材料降级。不能承诺 compact 后仍保真。

## 5. 真实场景从何而来

本节保留为后续质量 eval 的候选来源，不是当前实现阶段的阻塞项。

### 5.1 主候选：AACR-Bench

已 clone 到：

```text
ref/aacr-bench
```

它是目前最适合主 eval 的候选，原因：

- 真实 GitHub PR；
- repository-level code review；
- 200 左右 PR；
- 多语言；
- 包含 source / target commit；
- 包含 expert-verified review comments；
- comments 标注了 `Diff Level` / `File Level` / `Repo Level`；
- 指标覆盖 precision / recall / line match / noise。

本地数据实际统计：

```text
PRs: 196
comments: 1505
Diff Level: 754
File Level: 518
Repo Level: 233
Code Defect: 709
Security Vulnerability: 53
Performance: 117
Maintainability and Readability: 626
```

AACR-Bench 适合回答：

```text
同一 PR 上，doc-only reviewer 与 checkpoint-fork reviewer
谁更能命中 expert reference comments？
```

它不直接提供 design doc 或 implementation doc。实际数据字段只有：

```text
category, change_line_count, project_main_language,
source_commit, target_commit, githubPrUrl, comments
```

PR title / description 也不是 dataset 内字段，而是 AACR runner 在执行时通过 GitHub API 拉取。

因此，AACR-Bench 只能提供“真实 PR + diff/source/target commit + expert review oracle”。如果我们要比较 doc-only 与 checkpoint-fork，design/implementation docs 必须由 eval 过程产生：

- `implementation` 的真实对象是 `source_commit..target_commit` 的 diff 和目标代码；
- `implementation doc` 只能是 eval harness 或 designer agent 根据 PR/diff 生成的实现说明；
- `design doc` 只能来自 designer session 在 checkpoint 前写出的 review/design notes；
- benchmark 自身不能证明“原作者设计文档足够/不足”，只能证明“由当前流程生成的 doc baseline 足够/不足”。

这意味着 AACR 适合做后续质量 eval，但不能单独证明完整方案。完整证明还需要同时记录 designer session、doc 生成过程、fork fidelity 和 cache/cost。

### 5.2 辅助候选：Code Review Arena

已 clone 到：

```text
ref/code-review-arena
```

它是 execution-backed seeded-bug benchmark：

- reviewer 输入是 blind diff + bounded relevant files；
- reviewer 输出 finding + optional patch；
- harness 应用 patch 并跑 tests / validators；
- 指标区分 detection 与 validated repair。

它适合做强 e2e repair eval，但不适合作为主结论来源：

- 场景是 seeded bug，不是自然 PR review；
- context 是 harness 预先 bounding 的 relevant files；
- 它更适合证明“review 发现的问题是否可执行修复”，而不是证明 checkpoint-fork 相比 doc-only 的上下文增益。

## 6. 后续质量 Eval 设计

### 6.1 分组

每个真实 PR 至少跑三组 reviewer：

| 组 | 输入 | 目的 |
|---|---|---|
| `doc-only` | 任务公开输入 + repo 稳定材料 + diff/必要文件 + designer 写出的正式文档 | Trellis-style / handoff summary baseline |
| `checkpoint-fork` | 从 designer checkpoint 派生 reviewer，目标材料为同一 PR/diff | Context Tree 主假设 |
| `fresh-thread-negative` | 只给最小 PR 输入或摘要 | 负控，确认 benchmark 不被 prompt/template 偶然通过 |

可选第四组：

| 组 | 输入 | 目的 |
|---|---|---|
| `full-doc-transcript` | 把 designer conversation 明确转成层次化专用文档后注入 | 测量“完美文档化”上限，但不作为现实 baseline |

### 6.2 Designer session

每个 PR 先生成一个 designer session：

```text
1. checkout source / target commits；
2. 读取 PR title / description / diff；
3. 探索相关文件和 repo docs；
4. 写出 review/design notes；
5. 在“准备交给 reviewer”处形成 checkpoint；
6. 不暴露 AACR reference comments。
```

designer 的职责不是解决 benchmark oracle，而是形成一个真实的设计/理解过程，让 checkpoint-fork 与 doc-only 有共同来源：

- doc-only 读取 designer 写出的 notes；
- checkpoint-fork 从 designer checkpoint 派生，保留未必写入 notes 的上下文。

### 6.3 Reviewer 输出

Reviewer 输出必须落到 AACR-Bench 可评测格式：

```text
<path>...</path>
<side>left|right</side>
<from>...</from>
<to>...</to>
<note>...</note>
<notesplit />
```

禁止 reviewer 访问：

- `positive_samples.json`；
- `negative_samples.json`；
- 已评测结果；
- 任何根据 reference comment 生成的提示。

### 6.4 指标

主指标：

- `positive_recall_rate`：命中 expert issue 的比例；
- `positive_match_rate`：生成评论中有效命中的比例；
- `positive_line_recall_rate`：定位命中比例；
- `unmatched_rate`：噪声比例。

分层指标：

- `Repo Level` comment recall；
- `File Level` comment recall；
- `Diff Level` comment recall；
- `Code Defect` / `Security Vulnerability` / `Performance` 分类 recall。

我们真正关心的是：

```text
checkpoint-fork 是否在 File/Repo Level、Code Defect/Security/Performance 上
比 doc-only 有稳定增益，同时 unmatched_rate 不明显恶化。
```

### 6.5 cache / 成本指标

质量之外必须记录效率：

- input token；
- output token；
- cached input token / prompt cache hit；
- latency；
- platform session/fork 操作耗时；
- 用户操作步数；
- 是否需要手写/生成中间文档。

如果 provider 不暴露 prompt-cache 指标，只能记录为 `unknown`，不能用 latency 或 token 总量假装证明 cache hit。

## 7. 当前阶段何时算实现可继续

当前先不以 review quality 作为继续/停止门槛，而以实现闭环作为门槛。

第一阶段是 implementation e2e：

```text
在 mock 和 live 两条路径上，
从 checkpoint 候选到 fork/spawn reviewer，
再到 result return，
都能形成可重复、可审计、可判定的 e2e artifact。
```

implementation e2e 的目标不是证明 reviewer 更聪明，而是发现硬失败：

- checkpoint / fork metadata 不能稳定记录；
- reviewer 实际没有收到任务所需上下文，或只能收到固定 summary；
- result return 只能靠人工复制，不能被父 agent/eval runner 收集；
- live evidence 不能证明 fork/spawn 真发生；
- mock pass 与 live pass 的语义不一致；
- 成本记录拿不到，cache hit 无法观测；
- summary-only / prompt-only 被误判成 context fork 成功。

第二阶段才是 3 个真实 PR 的质量 pilot：

```text
选择包含 File Level / Repo Level reference comments 的 3 个 AACR PR，
跑通 doc-only / checkpoint-fork / fresh-thread-negative 三组，
只用于确认质量 eval pipeline 可行，不作为产品门槛。
```

第三阶段才是扩样验证，且必须等实现 e2e 稳定后再做：

```text
在不少于 20 个 AACR PR 的确认样本上，
checkpoint-fork 在 high-value slice 上有稳定 recall 增益，
并且 precision/noise 不显著变差；
同时 fork/reviewer 的操作成本低于手动新会话 + 写总结。
```

后续 high-value slice 至少包括：

- `Repo Level`；
- `File Level`；
- `Code Defect`；
- `Security Vulnerability`；
- `Performance`。

如果结果是：

```text
doc-only ~= checkpoint-fork
```

且 doc-only 的成本可接受，那么 Context Tree 不应扩张到质量主张，只保留实现级 checkpoint/fork tooling。

如果结果是：

```text
checkpoint-fork > doc-only
```

尤其是在 repo-level / file-level / excluded-path-sensitive issues 上成立，下一步才值得设计：

- checkpoint 选择；
- session fork 适配；
- compact/DCP 保真边界；
- reviewer result 回流；
- cache/cost instrumentation。

## 8. 下一步实现边界

下一步不是写 `spawnContextAgent` API，也不是跑 AACR 效果 eval。进入具体实现前，先做一轮生态调研：

```text
有没有高 star agent framework / coding agent / harness
已经解决了“agent 根据任务自主选择上下文、DCP/prune、历史补充、subagent 派生”的问题？
```

调研结论记录在：

```text
architecture/09-ecosystem-context-selection-survey.md
```

如果调研显示已有项目已经稳定解决了“checkpoint-derived helper/reviewer + task-adaptive context + result return”，Context Tree 不应重复实现；应改为适配或补齐缺口。如果调研显示现有项目只覆盖 staged docs、memory/RAG、multi-agent orchestration 或上下文节流，则 Context Tree 的实现重点保持为：

```text
agent/runtime 负责决定任务需要什么上下文材料；
Context Tree 负责 checkpoint/session lineage、最高可用保真度派生、历史补充和结果回流。
```

调研完成后，再完成实现与实现级 e2e eval：

1. 定义最小 `checkpoint` / `spawn` / `return` manifest；
2. 把现有 Codex capability eval 接到这个 manifest；
3. mock e2e：证明 checkpoint → fork/spawn → reviewer answer → report 的完整链路；
4. live e2e：证明真实 Codex thread/fork 或 native spawn 能产出同等 evidence；
5. 明确区分 `native/session fork`、`session-record-mounted`、`summary-only`；
6. 支持 agent 指定或请求上下文选择策略：使用平台 DCP/prune、引用 checkpoint 历史、或补充特定较早上下文；
7. 记录 token / latency / cache 字段，拿不到则显式 `unknown`；
8. 产出 implementation e2e report。

只有 implementation e2e 稳定后，才恢复 AACR 3-PR quality pilot；只有质量 pilot 有信号后，才扩到 20+ PR。
