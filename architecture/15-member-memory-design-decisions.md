# Member Context Lifecycle 产品级设计：参考 Magic Context 的 Dreamer 与 m[0]/m[1]

> 本文是产品级架构设计，不是实现计划。它更新前一版“V0 只做显式 candidate + visibility proof”的保守结论：为了达到可发布的 stable team member 体验，Context Tree 最终需要 **Member Dreamer** 与 **member-m[0]/member-m[1] cache-aware context layout**。Magic Context 是固定架构参考，不是强运行时依赖。

## 0. 最终产品目标

Context Tree 的产品主体是：

```text
按需激活、可长期复用、带职责上下文的 stable team member
```

用户不应该只看到一个静态 role prompt 或一次性的 subagent。用户应该能逐步形成这样的预期：

```text
skill-designer 下次写 skill 时，会记得以前被纠正过的触发条件、rule/skill 分离、contract 加载边界；
live-eval-checker 下次看 eval 时，会记得哪些证据不能算 native spawn、哪些 negative control 必须存在；
architecture-reviewer 下次审设计时，会记得我们对 doc vs native context、member evidence、Magic Context 的取舍。
```

发布级系统必须同时满足四个目标：

1. **member continuity**：同一个 `memberName` 跨 task run 保持职责上下文连续。
2. **context hit / cache efficiency**：稳定 member baseline 不应每次随意重排，尽量支持 provider prompt cache / context hit。
3. **memory hygiene**：member 记忆不能靠无限追加 markdown；必须有候选、提升、整理、归档、验证机制。
4. **per-run proof**：每次 member run 必须证明本次实际看到什么、哪些只是可搜索、哪些缺失、结果回到哪里。

一句话：

```text
Context Tree = stable team member 的 context lifecycle system。
```

## 1. Magic Context 的引用方式

### 1.1 固定为 primary architectural reference

Magic Context 固定作为主要架构参考：

- repo：`https://github.com/cortexkit/magic-context.git`
- 本地参考：`ref/magic-context`
- 当前调研基准 commit：`c23c2c4ef9354f2369e98ff314621bf2f93a3082`
- license：MIT

我们参考的不是一个泛泛概念，而是明确参考这些机制：

1. historian compartment：experience 与 durable facts 分层。
2. Dreamer：curate / verify / classify / retrospective 的后台维护。
3. m[0]/m[1]：稳定 baseline + volatile delta 的 cache-aware 注入。
4. raw record + `ctx_search` / `ctx_expand`：默认上下文不足时按需找回。
5. visible memory / mutation log：默认可见材料与变更 delta 可审计。

### 1.2 不作为强运行时依赖

不要发布成：

```text
Context Tree requires Magic Context installed/running
```

原因：

- Magic Context 当前主要服务 OpenCode/Pi primary session continuity；
- 我们要支持 member activation，且跨 Codex/OpenCode/Claude Code 等 runtime；
- subagent/member 是我们的核心路径，而 Magic Context 对 subagent 明确降级；
- 强依赖会把 Context Tree 的兼容性和发布节奏绑定到另一个产品。

### 1.3 可以 vendoring / 改写小模块，但不 copy 整体 runtime

MIT 许可允许复制，但工程上应遵守：

- 可复制/改写：prompt 结构、importance/ranking 思路、baseline/delta layout、curate/verify/classify task pattern。
- 不复制：OpenCode-specific transform hook、完整 Dreamer scheduler/lease、完整 SQLite schema、primary-session assumptions。
- 若复制实质代码或 prompt，应保留 attribution 与 license note。


### 1.4 参考 repo 的实际模块映射

为了避免只引用概念，产品设计应固定到 Magic Context 的实际模块边界：

| Magic Context 实际模块 | 参考点 | Context Tree 对应产品层 |
|---|---|---|
| `hooks/magic-context/inject-compartments.ts` | `renderM0` / `renderM1` / `materializeM0` / `mustMaterialize` / `getVisibleMemoryIds` | `member-m[0]` / `member-m[1]` / baseline digest / visible material ids |
| `features/magic-context/dreamer/task-registry.ts` | canonical tasks、memory-domain lease、任务排序 | Member Dreamer task registry / per-member memory-domain serialization |
| `features/magic-context/dreamer/task-prompts.ts` | curate、retrospective、maintain-docs prompt 边界 | role-memory curate / retrospective learning / member-doc maintenance |
| `features/magic-context/dreamer/verify-prompt.ts` | read-only verify，host apply manifest | verify-role-memory：agent 只产 manifest，host 应用更新 |
| `features/magic-context/dreamer/classify-prompt.ts` | importance/scope/shareability 单轮分类 | classify-role-memory：importance/confidence/defaultVisibility |
| `features/magic-context/memory/types.ts` / `storage-memory.ts` | Memory status/source/verification/supersede/merge | MemberRoleMemory lifecycle 与 provenance |
| `features/magic-context/storage-memory-mutation-log.ts` | update/archive/superseded delta | role-memory mutation log / member-m[1] updates |
| `features/magic-context/search.ts` + `tools/ctx-search` | unified search + visible-memory filter | member run history / role memory / artifact search |
| `tools/ctx-expand/tools.ts` | range/message 展开 | expand MemberTaskRun raw artifacts / provider logs / outputs |
| `ARCHITECTURE.md` session modes | primary 有 historian/m[0]/m[1]，subagent 无 | 我们不能接受 subagent 降级为产品终点，必须在 member 层补足 |

这张表是产品设计的防漂移锚点：后续如果 Magic Context upstream 改变对应模块，`architecture/14` 与本文需要重新审查。

## 2. 发布级架构分层

最终架构应是四层：

```text
1. Member Identity Layer
2. Member Context Cache Layer
3. Member Memory Maintenance Layer
4. Member Run Evidence Layer
```

### 2.1 Member Identity Layer

已有 `TeamMemberProfile` 仍然成立：

- `memberName` 是稳定、用户/agent-facing 职责身份；
- profile 定义职责、routing、standards、negative hints；
- profile 不是材料可见性证据。

产品级要求：

- `memberName` 不能由 runtimeAgentId 替代；
- explicit member invocation 优先于自动路由；
- 自动路由必须可解释：为什么选这个 member、为什么没有选另一个；
- profile version / baseline digest 应进入 MemberTaskRun，用于证明 member-m[0] 版本。

### 2.2 Member Context Cache Layer

这是此前文档缺失的核心层。借鉴 Magic Context 的 m[0]/m[1]，但主体从 primary session 改为 stable member。

```text
member-m[0] = stable member baseline
member-m[1] = current activation delta
search/expand = non-default historical material
```

这里的重点不是两个名字，而是一个可验证的 render contract：同一个 member 在没有实质 baseline 变化时，应渲染出 byte-stable 的 baseline；task-local 材料只进入 delta 或 searchable，不得污染 baseline。

#### member-m[0]：稳定 baseline

尽量稳定、可缓存、少变。包含：

- TeamMemberProfile 的稳定渲染；
- standards refs 的稳定摘要/引用；
- durable role memory；
- 高重要度 rejected patterns；
- 高重要度 review rubrics；
- 少量 golden examples 或其稳定摘要；
- member-specific long-term constraints。

要求：

- 有 `baselineVersion` / `baselineDigest`；
- 排序稳定，字段顺序、分组顺序、memory 排序必须 deterministic；
- mutation 通过明确 mutation log 或 version bump 进入；
- 不因每次 task target、用户临时问题、search result 改变而重排；
- runtime 支持 provider prompt cache 时，应尽量让 member-m[0] 命中 cache；
- 未观察到 provider cache 证据时，只能声明 deterministic reuse，不能声明 provider cache hit。

#### member-m[1]：activation delta

本次调用相关、变化频繁。包含：

- 当前 task question；
- activation point 说明；
- target materials；
- 当前用户/主 agent 临时约束；
- 本次相关但非长期的 run experience；
- newly promoted role memory / memory updates；
- search/expand 结果摘要。

要求：

- 有 `deltaDigest`；
- 绑定 `activationPoint`；
- 可追踪 target refs；
- 不污染 member-m[0]；
- 进入 `MemberTaskRun.materials` 可见性分类；
- 可以在后续 hard fold 时被整理进 member-m[0]，但 fold 需要明确触发原因。

#### MemberContextRender contract

发布级应新增独立 artifact，而不是只把 digest 散落在 `MemberTaskRun` 字段里：

```ts
MemberContextRender = {
  renderId: string
  memberName: string
  profileRef: string
  activationPoint: ActivationPoint
  renderSchemaVersion: string

  baselineVersion: string
  baselineDigest: string
  baselineCacheKey: {
    provider?: string
    model?: string
    runtime?: string
    systemPromptDigest?: string
    toolSetDigest?: string
    renderSchemaVersion: string
  }
  baselineReuseStatus:
    | "provider-cache-hit"
    | "deterministic-reuse"
    | "re-rendered"
    | "unsupported"
    | "unknown"
  baselineReuseEvidenceRefs: string[]

  deltaDigest: string
  m0Refs: string[]
  m1Refs: string[]
  searchableRegistryRef?: string
  selectionReportRef: string
  foldReason?: string
  knownLosses: string[]
}
```

`baselineDigest` 只能证明输入和渲染稳定，不能证明 provider cache 命中。`baselineReuseStatus: "provider-cache-hit"` 必须有 runtime/provider 证据；没有证据时，即使渲染字节完全相同，也只能记为 `deterministic-reuse`。

#### cache-stable render 规则

发布级 renderer 必须满足：

1. 同一 `memberName + baselineVersion + renderSchemaVersion + baselineCacheKey` 产生 byte-identical m[0]。
2. explicit target、task question、activation context、search/expand result 不得进入 m[0]。
3. 新 candidate 默认进入 m[1] 或 searchable；只有 promotion 后才有资格进入 m[0]。
4. destructive mutation（update/archive/merge/supersede）先进入 mutation log / m[1] update block，等 hard fold 合入 m[0]。
5. SOFT 刷新不得重排 m[0]；需要重排就必须是 HARD fold，并记录 `foldReason`。
6. m[1] 可以有压力回折，但压力回折仍需记录原因，不能静默改变 baseline。

这对应 Magic Context 的 load-bearing invariant：defer pass 必须 byte-identical，mutation 要搭载已有 bust，而不是制造额外 bust。我们不复制它的 OpenCode transform hook，但产品 contract 要保留这个稳定性目标。

#### search/expand layer

不默认进入 m[0]/m[1] 的历史材料：

- all past MemberTaskRuns；
- raw outputs；
- eval reports；
- old feedback；
- low-confidence candidates；
- full artifacts / provider logs。

member 可按需 search/expand；但 search result 只是“可找回”，不是“模型已看到”。只有 expand 后被 mount/inject，或 runtime evidence 证明它被读取，才能进入更高可见性 bucket。

发布级 search result shape 至少包含：

```ts
MemberSearchResult = {
  ref: string
  source: "role-memory" | "member-run" | "artifact" | "eval-report" | "provider-log" | "profile" | string
  score?: number
  match?: "semantic" | "keyword" | "explicit" | "recency" | "link" | string
  preview: string
  visibility: "searchable" | "mounted" | "model-visible" | "source-only"
  expandHint?: string
}
```

`ctx_search` / `ctx_expand` 的思想可以复用：search 返回带 ref 的候选，expand 才恢复更大范围材料。区别是我们的 sources 面向 member role memory、run ledger、artifact/eval/provider evidence，而不是 Magic Context 的 primary session message history。

### 2.3 Member Memory Maintenance Layer

发布级需要 Member Dreamer，而不是只靠人工 markdown。

```text
Member Dreamer = 维护 member role memory 的后台系统
```

参考 Magic Context `CANONICAL_DREAM_TASKS`，Member Dreamer 不应是一个大而泛的“总结器”，而应拆成可调度、可审计的任务集。发布级至少包含这些任务类型：

1. **map-role-memory-sources**
   - 对齐 Magic Context `map-memories`。
   - 为每条 active role memory 记录 backing evidence：MemberTaskRun、profile/contract/doc、eval report、用户反馈位置。
   - 后续 verify 只检查有映射目标的 memory，避免全库猜测。

2. **verify-role-memory / verify-broad**
   - 对齐 Magic Context `verify` / `verify-broad`。
   - read-only agent 检查 memory 是否仍被当前 docs/contracts/code/eval evidence 支持；agent 只输出 manifest，host 应用 update/archive/verified。
   - 默认保守保留，避免错误归档真实规则。

3. **curate-role-memory**
   - 对齐 Magic Context `curate`。
   - 去重、改写为 present tense、拆分 compound memory、合并重复、归档低价值/一次性偏好。

4. **classify-role-memory**
   - 对齐 Magic Context `classify-memories`。
   - 标记 importance、confidence、member specificity、defaultVisibility、scope。
   - 应作为 zero-tool 或 read-only single-shot transform：agent 输出 manifest，host 应用字段更新。

5. **retrospective-learning**
   - 对齐 Magic Context `retrospective`。
   - 从重复 friction 中学习，而不是记录单次情绪或一次性纠正。

6. **promote-role-memory-candidates**
   - 对齐 Magic Context `promote-primers` 的“候选进入长期材料”思想。
   - 将高置信 candidate 提升为 active role memory；低置信保留 pending/searchable。

7. **refresh-member-primers / golden examples**
   - 对齐 Magic Context `refresh-primers`。
   - 对常见 member 问题维护少量稳定 answer/primer，例如“skill-designer 如何写 trigger description”。

8. **maintain-member-docs**
   - 对齐 Magic Context `maintain-docs`。
   - 维护 member profile/standards 摘要，但不得覆盖人工 protected region。

这就是我们扬弃 Magic Context Dreamer 的方式：

```text
Magic Context Dreamer 维护 project memory；
Context Tree Member Dreamer 维护 per-member role memory。
```

#### MemberDreamerRun contract

Member Dreamer 不能只是“后台任务列表”。每次维护都应留下 run record：

```ts
MemberDreamerRun = {
  id: string
  memberName: string
  taskName:
    | "map-role-memory-sources"
    | "verify-role-memory"
    | "verify-broad"
    | "curate-role-memory"
    | "classify-role-memory"
    | "retrospective-learning"
    | "promote-role-memory-candidates"
    | "refresh-member-primers"
    | "maintain-member-docs"
    | string
  trigger: "scheduled" | "manual" | "after-run" | "migration" | string
  leaseKey: string
  inputRefs: string[]
  manifestRef?: string
  appliedMutationRefs: string[]
  partialProgressRef?: string
  status: "success" | "partial" | "failed" | "skipped" | "blocked"
  failureReason?: string
  nextRetryAt?: string
}
```

调度和并发规则：

- memory-domain tasks 按 `memory:<memberName>` 串行；同一个 member 的 map/verify/curate/classify/promote 不并发。
- 不同 member 的 memory-domain 可以并行，除非共享同一个全局资源或 workspace policy。
- manual run 可以等待短时间 lease 释放；scheduled run 遇到 busy 应跳过并记录 skipped，而不是阻塞主流程。
- `lastRunAt` 只在 success 时推进；partial/failed 需要 retry/backoff。
- partial progress 应保留，例如 verify 已检查的 memory ids、curate 已处理的 batch。

host/agent 边界：

- verifier/classifier/mapper 类型任务默认 read-only 或 zero-tool；agent 只输出 manifest。
- archive/update/merge/promote 等 mutation 由 host apply，并写 mutation log。
- 错误 archive 是最危险失败；当证据不足时默认 keep/verified，而不是删除。
- agentic curate 可以提出 rewrite/merge/archive 建议，但仍由 host 校验并应用。

### 2.4 Member Run Evidence Layer

已有 `MemberTaskRun` 继续作为事实层。它必须记录：

- memberName；
- runtimeAgentId；
- activationPoint；
- task；
- member-m[0] baseline version/digest；
- member-m[1] delta digest；
- `MemberContextRender` ref；
- `MaterialSelectionReport` ref；
- contextSources；
- materials visibility buckets；
- materialSelectionMode；
- fidelity；
- knownLosses；
- result return。

关键原则：

```text
profile 不是 consumption proof；
roleMemoryRefs 不是 consumption proof；
selectionReport 不是 consumption proof；
只有 MemberTaskRun.materials + evidenceRefs 能证明本次 member 实际收到/可用什么。
```

#### MemberTaskRun contract drift

当前 `docs/contracts/member-task-run-record-contract.md` 还没有完整表达 member-m[0]/m[1]。后续应扩展或通过 evidence refs 引入这些字段：

```ts
MemberTaskRun additions = {
  memberContextRenderRef: string
  materialSelectionReportRef: string
  baselineVersion: string
  baselineDigest: string
  baselineReuseStatus: MemberContextRender["baselineReuseStatus"]
  baselineReuseEvidenceRefs: string[]
  deltaDigest: string
  memberMemoryMutationRefs?: string[]
}
```

如果为了兼容不直接加顶层字段，也必须通过 `evidenceRefs` 指向 `MemberContextRender` 与 `MaterialSelectionReport`，并在 contract 中声明这是发布级必需 evidence。不能只靠 `contextSources` 和 `materials` 自由解释。

## 3. 本次相关材料如何选择

发布级不应只是“人工挑几条 role memory”。材料选择应是可解释、可审计、可覆盖的 pipeline，并且每次输出 `MaterialSelectionReport`。

### 3.1 输入

```text
memberName
+ task.kind
+ task.question
+ targetRefs
+ activationPoint
+ requester context
+ explicit requested materials
+ current member-m[0] baseline refs
+ searchable registry
```

### 3.2 候选来源

候选材料来自：

1. member-m[0] baseline；
2. durable role memory pool；
3. target material resolver；
4. recent relevant MemberTaskRuns；
5. accepted/rejected outputs；
6. eval reports；
7. search over raw run records；
8. user/agent explicit refs。

### 3.3 排序规则

优先级：

1. **explicit user/requester refs**：用户或主 agent 点名材料最高优先级；除非 ref 无法解析，否则必须进入 report。
2. **hard rules / must-not / rejected patterns**：防止重复犯错。
3. **task-kind match**：review/plan/check/diagnose 对应不同 role memory。
4. **target-material match**：目标文件/文档/报告相关性。
5. **high-importance role memory**：经 Dreamer 分类高重要度。
6. **retrieval/use history**：过去多次被 search/使用的 memory。
7. **golden examples**：通常摘要或引用优先，必要时 expand。
8. **low-confidence / one-off signal**：默认 searchable，不默认 model-visible。

### 3.4 MaterialSelectionReport

materializer 输出必须是 artifact，而不是只返回拼好的 prompt：

```ts
MaterialSelectionReport = {
  reportId: string
  memberName: string
  activationPoint: ActivationPoint
  taskKind: string
  inputRefs: string[]
  explicitRequestedRefs: string[]
  budgets: {
    maxM0Tokens?: number
    maxM1Tokens?: number
    maxSearchableResults?: number
  }
  candidates: Array<{
    ref: string
    kind: "profile" | "role-memory" | "target" | "member-run" | "eval-report" | "artifact" | "provider-log" | string
    source: string
    explicit: boolean
    score?: number
    reasons: string[]
    selected: boolean
    placement: "m0" | "m1" | "mounted" | "searchable" | "source-only" | "rejected"
    rejectedReason?: string
  }>
  finalM0Refs: string[]
  finalM1Refs: string[]
  mountedRefs: string[]
  searchableRefs: string[]
  sourceOnlyRefs: string[]
  trimmingDecisions: string[]
}
```

selection report 的职责是解释“为什么选/为什么没选”。它仍不是 consumption proof；最终可见性仍由 `MemberTaskRun.materials` 和 runtime evidence 证明。

## 4. Member Role Memory taxonomy（产品级，不照搬 Magic Context 五类）

Magic Context 的五类 project memory 不适合作为 member memory taxonomy。member 需要 role-specific taxonomy。

建议产品级 taxonomy：

| 类型 | 含义 | 默认可见性倾向 |
|---|---|---|
| `role_rule` | member 必须遵守的职责规则 | m[0] |
| `rejected_pattern` | 明确不要再采用的写法/判断 | m[0] 高优先级 |
| `review_rubric` | 审查/判断标准 | m[0] |
| `golden_example` | 被接受的代表性输出或模式 | m[0] 摘要 + expandable |
| `failure_mode` | 常见失败方式及避免方法 | m[0] 或 m[1] |
| `workflow_preference` | 用户对该职责流程的偏好 | m[0] 若稳定，否则 searchable |
| `tool/runtime_constraint` | 与该 member 工作有关的外部限制 | m[0]/m[1] |
| `domain_note` | 仅某领域/目标相关的长期知识 | searchable 或 target-triggered |

### 4.1 MemberRoleMemory lifecycle fields

发布级 `MemberRoleMemory` 至少需要这些字段：

```ts
MemberRoleMemory = {
  id: string
  memberName: string
  type:
    | "role_rule"
    | "rejected_pattern"
    | "review_rubric"
    | "golden_example"
    | "failure_mode"
    | "workflow_preference"
    | "tool/runtime_constraint"
    | "domain_note"
    | string
  content: string
  sourceRefs: string[]
  status: "candidate" | "active" | "archived" | "rejected" | "stale" | "superseded"
  importance: number
  confidence: number
  defaultVisibility: "m0" | "m1" | "searchable" | "source-only"
  verificationStatus: "unverified" | "verified" | "needs-review" | "contradicted" | "unknown"
  sourceType: "user" | "member-run" | "eval" | "dreamer" | "manual" | string
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
  retrievalCount: number
  seenCount: number
  supersededBy?: string
  mergedFrom?: string[]
  metadata?: Record<string, unknown>
}
```

要求：

- 一条 memory 只表达一个 operational fact；
- 必须有 source run/evidence；
- 必须可 archive/update/merge/supersede；
- 有 importance/confidence/defaultVisibility；
- 不把一次性反馈直接提升为 `role_rule`；
- 每次 mutation 写入 `MemberRoleMemoryMutationLog`，并可在 m[1] 中展示 delta。

## 5. Candidate -> memory 的发布级 gate

### 5.1 Candidate 来源

候选可以来自：

- 用户明确说“记住/以后都这样”；
- 用户对 member 输出提出约束、偏好、反例或更正；
- 主 agent 明确评价 member 输出有问题；
- eval failure；
- eval success / accepted output；
- repeated friction；
- repeated retrieval；
- manual note。

这里不应专门建 `MemberCorrection` 作为核心产品概念。用户反馈不一定是纠正，也可能是偏好强化、边界收窄、标准补充、接受样例、反例或任务局部说明。统一入口应是 candidate，后续由 Dreamer classify/promote。

### 5.2 RoleMemoryCandidate

候选记录应包含：

```ts
RoleMemoryCandidate = {
  id: string
  memberName: string
  proposedType?: MemberRoleMemory["type"]
  content: string
  sourceRefs: string[]
  signalType: "explicit-remember" | "feedback" | "accepted-output" | "eval-failure" | "repeated-friction" | "manual" | string
  proposedDefaultVisibility?: "m0" | "m1" | "searchable" | "source-only"
  confidence: number
  createdAt: string
  status: "pending" | "promoted" | "rejected" | "merged" | "needs-review"
  decisionRef?: string
}
```

### 5.3 Promotion gate

进入 durable role memory 前必须回答：

1. 是否 member-specific？还是只是当前任务局部事实？
2. 是否 future-actionable？下次 member 会因此做不同选择吗？
3. 是否 durable？一周/月后仍有意义吗？
4. 是否有 source evidence？能追到哪个 run/feedback/eval？
5. 是否与已有 memory 重复/冲突？应 update/merge/archive 还是新增？
6. 默认进入 m[0] 是否会污染？是否应只 searchable？

promotion 结果必须是 host-applied manifest：

```text
promote -> create active memory
merge -> update existing memory + mergedFrom
reject -> keep candidate searchable or archive candidate
needs-review -> require manual or stronger evidence
```

### 5.4 状态

发布级状态至少需要：

```text
candidate -> active -> archived
candidate -> rejected
candidate -> merged
active -> updated
active -> superseded
active -> stale
```

V0 可以先用文件/JSONL 简化，但产品语义必须保留这些状态。

## 6. m[0]/m[1] 与 context hit 的产品要求

m[0]/m[1] 不是实现细节，而是产品级性能/稳定性要求。

### 6.1 为什么必须有 m[0]/m[1]

如果每次 member run 都重新拼接所有 profile、role memory、examples、target materials：

- prompt cache 命中差；
- 成本和延迟高；
- baseline 顺序/内容漂移；
- 难以判断 member 是否“同一个长期成员”；
- eval 难以复现。

所以发布级必须把稳定 member baseline 和本次 activation delta 分开。

### 6.2 适配不同 runtime

不同 runtime 支持不同：

- 有些支持 provider prompt cache；
- 有些只支持 mounted files；
- 有些只能通过 prompt 注入；
- 有些 subagent 不能继承完整 primary context。

因此产品 contract 不能承诺所有 runtime 都有真实 provider cache hit，但必须记录：

```text
baselineDigest
baselineReuseStatus
baselineReuseEvidenceRefs
deltaDigest
materialVisibility
knownLosses
```

如果 runtime 只能做到重新注入同一 baseline，也应记录为 `deterministic-reuse`，而不是谎称 native context/cache hit。

### 6.3 对齐 Magic Context 的触发/不触发原则

Magic Context 的关键不是只有两个槽位，而是明确什么变化会折叠 baseline、什么变化只进入 delta。Context Tree 应采用同类原则：

**应触发 member-m[0] 新版本：**

- TeamMemberProfile 或 standards 的稳定内容变化；
- active role memory 被 archive/update/merge/supersede；
- Member Dreamer 完成 curate/classify 后改变 default-visible memory set；
- runtime/model/provider cache key 变化导致旧 baseline 不可复用；
- baseline 渲染策略或 schema version 变化。

**不应触发 member-m[0] 新版本，只进入 member-m[1]：**

- 新 candidate 产生但尚未 promotion；
- 单次 task target 变化；
- 当前 activation context；
- newly promoted memory 在本次 run 的即时 delta 展示；
- search/expand 临时结果；
- 低置信或一次性 feedback。

这对应 Magic Context 的设计：new compartments / new memories 先作为 m[1] delta，destructive mutation 通过 mutation log 进入 `<memory-updates>`，到自然 hard fold 才进入 m[0]。我们的产品语言是：**baseline 只承载稳定 member 身份和长期职责上下文；任务局部变化绝不污染 baseline。**

## 7. 我们扬弃 Magic Context 的内容

### 7.1 保留 / 强化

1. Dreamer-like maintenance；
2. m[0]/m[1] baseline/delta；
3. raw record + search/expand；
4. facts vs experience 分层；
5. candidate gate；
6. importance / visibility / mutation log；
7. visible material evidence；
8. cache-aware stable render；
9. host-applied manifest；
10. read-only/zero-tool verifier/classifier。

### 7.2 改造

| Magic Context | Context Tree |
|---|---|
| primary session continuity | stable member continuity |
| project memory | member role memory |
| session m[0] | member-m[0] |
| session m[1] | member-m[1] |
| historian compartments | member run experience |
| Dreamer project maintenance | Member Dreamer role maintenance |
| ctx_search/expand session history | search/expand member run history/artifacts |
| provider cache layout in runtime hook | cross-runtime render/evidence contract |

### 7.3 不照搬

1. 不把 primary session 当唯一主体；
2. 不接受 subagent 降级作为产品终点；
3. 不直接使用 Magic Context 五类 project taxonomy；
4. 不强依赖 OpenCode plugin transform；
5. 不把 Magic Context 作为必装 runtime；
6. 不把所有历史默认注入 member；
7. 不把 deterministic render 夸大成 provider cache hit。

## 8. 发布级成功标准与 eval oracle

产品级成功不是“能写几个 artifact”。至少要证明：

1. **continuity**：同一 member 在第二次/第三次 run 中稳定使用过去形成的 role memory。
2. **cache/baseline stability**：member-m[0] digest 稳定；无关 task 不导致 baseline 重排。
3. **delta isolation**：单次 target/search/candidate 只进入 m[1] 或 searchable，不污染 m[0]。
4. **visibility proof**：MemberTaskRun 能区分 model-visible、mounted、searchable、source-only。
5. **result return**：member 输出稳定回到 requester。
6. **memory hygiene**：一次性反馈不会自动污染 m[0]；重复/高置信度规则会被提升。
7. **negative control**：fresh member 或未加载 memory 的 run 不能被误判为同等能力。
8. **runtime honesty**：无法 native context/cache hit 时明确 knownLosses。

发布级 eval matrix 应覆盖：

| Eval | Oracle |
|---|---|
| baseline stability | 两个无关 task 的 `baselineDigest` 相同，`deltaDigest` 不同 |
| hard fold | profile/memory/schema 变化后 baseline version bump 且 foldReason 存在 |
| delta isolation | target material/candidate/search result 不进入 m[0] |
| material selection | `MaterialSelectionReport` 解释 selected/rejected/placement，explicit refs 被处理 |
| visibility honesty | searchable/source-only 不被算作 model-visible |
| Dreamer verify | stale/wrong memory 在 host-applied manifest 中 update/archive；不确定项保守 keep |
| Dreamer classify | importance/confidence/defaultVisibility 有 manifest 且 host applied |
| promotion gate | 单次反馈不会直接进入 active m[0]；重复/明确高置信 candidate 可 promoted |
| fresh member negative control | 没有 role memory 的 member 不能回答依赖历史 memory 的问题 |
| runtime cache honesty | 没 provider evidence 时不能输出 `provider-cache-hit` |

## 9. 产品级 contract 汇总

本文把原来的 P0/P1 缺口固化为以下 contract 方向：

1. `MemberContextRender`：记录 member-m[0]/member-m[1]、digest、cache key、reuse status、known losses。
2. `MaterialSelectionReport`：记录候选、排序、选择/拒绝原因、最终 placement。
3. `MemberRoleMemory`：有 taxonomy、lifecycle fields、verification/status/defaultVisibility。
4. `RoleMemoryCandidate`：统一处理用户反馈、accepted output、eval failure、repeated friction，不专门建 correction 主模型。
5. `MemberDreamerRun`：记录 task registry、lease、trigger、manifest、host-applied mutations、partial progress。
6. `MemberTaskRun` 扩展：引用 render/report，记录 baseline/delta/cache reuse，不只依赖宽泛 `role-history`。
7. member-facing search/expand：可找回不等于已看到，expand/mount/inject 后才可提升 visibility。

## 10. 剩余实现前置

进入 implementation plan 前，不再需要另写 `architecture/16` 才能表达产品目标；本文已经是产品设计锚点。下一步应做窄化实现前置：

1. 更新 `docs/contracts/member-task-run-record-contract.md`，引入 `memberContextRenderRef`、`materialSelectionReportRef`、baseline/delta/cache reuse 字段或等价 evidence ref 规则。
2. 新增 `docs/contracts/member-context-render-contract.md`。
3. 新增 `docs/contracts/material-selection-report-contract.md`。
4. 新增 `docs/contracts/member-role-memory-contract.md`，包含 candidate、memory、mutation log、dreamer run。
5. 将现有 member surface/eval 从“只显示 runs/evidence”扩展到能展示 baseline version、active/pending/archived memory、selection report 与 runtime honesty。

在这些 contract 明确前，不建议实现新的 memory feature；否则容易把“人工 role-memory markdown + evidence drawer”误当成发布级 member memory。
