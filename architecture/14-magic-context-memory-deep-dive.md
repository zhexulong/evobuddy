# Magic Context memory 深入调研：先理解机制，再决定 Context Tree 怎么做

> 本文是设计前置调研，不是 Context Tree 的最终设计。目的不是立刻定义 `MemberMemoryEntry` 或 `MemberCorrection`，而是先把 Magic Context 的 memory / recall / injection 机制吃透，再判断我们应该复用哪些思想、避开什么坑。

## 0. 结论摘要

Magic Context 的 memory 不是“把用户纠正写成一条 note”这么简单。它至少包含三层：

1. **session experience layer**：把旧对话切成 compartments，并为同一段经历生成 P1/P2/P3/P4 四级衰减表达；这是“发生过什么”的记忆。
2. **durable fact layer**：从经历里提取跨 session 仍成立的 facts，进入 project memory；这是“这个项目是什么/应该怎么做”的记忆。
3. **maintenance / recall layer**：Dreamer 后台做去重、验证、分类、回顾；运行时通过 m[0]/m[1] cache-stable 注入，通过 `ctx_search`/`ctx_expand` 按需找回。

因此，对 Context Tree / member 系统的直接启发是：

- 不应该做一个狭义 `MemberCorrection` 顶层对象；纠正只是信号来源之一。
- 更接近的对象是 **member-scoped role context / member memory maintenance**：某个 member 长期如何工作、哪些规则/禁忌/判断标准/成功样例应该保留。
- 需要区分 **事实型记忆**、**经历型记忆**、**用户/主 agent 反馈信号**，以及 **下一次 task run 实际可见的材料**。
- 不能把 memory 当成 append-only 文档；Magic Context 的核心是可编辑、可验证、可裁剪、可展开。

## 1. Magic Context 的 memory 到底存什么？

### 1.1 durable project memory：五类 facts

Magic Context v2 让 agent 写入的 project memory 只有五类：

- `PROJECT_RULES`
- `ARCHITECTURE`
- `CONSTRAINTS`
- `CONFIG_VALUES`
- `NAMING`

源码里旧的 9 类仍可读，但新写入被限制为上述五类；这是为了避免 taxonomy 发散。`constants.ts` 明确说 v2 category enum 用于 schema 校验，新写入只接受五类。[E1]

这五类不是“标签越多越好”，而是强约束分类：

- `PROJECT_RULES`：以后开发/agent 工作要遵守的 recurring 行为规则。
- `ARCHITECTURE`：解释系统为什么这样设计的 load-bearing decision。
- `CONSTRAINTS`：外部系统强加、我们不能直接改掉的限制。
- `CONFIG_VALUES`：稳定路径、阈值、默认值、schema 常量。
- `NAMING`：命名约定、改名、canonical name，不是当前名字清单。

Historian prompt 对这些类别有非常严格的负例和判定问题，例如 `ARCHITECTURE` 不是“系统当前做了什么”，而是“为什么系统必须这样组织”；`CONSTRAINTS` 必须是外部系统限制，不是自己代码里的 bug；`CONFIG_VALUES` 不能收 test count、版本号、benchmark 数字这类快照。[E2]

### 1.2 session compartments：经历，不是 facts

Magic Context 会把旧 raw messages 交给 historian，输出一个或多个 `<compartment>`。每个 compartment 表示一个连续工作 arc，并带有：

- `title`
- `episode_type`
- `importance`
- P1/P2/P3/P4 四级 paraphrase
- 可选 events / user observations / primer candidates

这个层面记录的是“发生过什么”，不是稳定世界知识。Historian prompt 明确区分：

```text
World knowledge -> <facts>
Experience -> <compartments> / <events>
```

这点对我们很重要：用户反馈、某次失败、某次 review、某次路线调整，不应该默认变成一条永恒规则。它可能只是 compartment 里的经历，也可能经过 gate 后成为 durable fact。[E3]

### 1.3 events：稀疏的锚点，而不是每个纠正都入库

Magic Context 的 events 只有少量高价值锚点，默认是 zero events。主要两类：

- `causal_incident`：外部系统限制带来的 durable surprise。
- `trajectory_correction`：有真实投入后被推翻/重排的方向改变。

Historian prompt 明确说 routine implementation、自己代码 bug fix、普通讨论中的参数微调，都不要 emit event；false positive 会污染 event channel。[E4]

这直接反驳“某次 MemberTaskRun 被用户纠正 = MemberCorrection 顶层对象”的路子：Magic Context 的 correction 只有在构成 trajectory correction、recurring friction、或 durable project rule 时才提升；否则只留在经历层。

## 2. 存储 schema：不是一条 markdown，而是带生命周期的事实池

Magic Context 用 SQLite `memories` 表存 project-scoped durable facts。关键字段包括：

- `project_path`
- `category`
- `content`
- `normalized_hash`
- `importance`
- `scope`
- `shareable`
- `source_session_id`
- `source_type`
- `seen_count`
- `retrieval_count`
- `status`
- `expires_at`
- `verification_status`
- `verified_at`
- `classified_at`
- `superseded_by_memory_id`
- `merged_from`
- `metadata_json`

同时有：

- `memory_embeddings`：memory 向量。
- `memory_verifications`：memory 到 backing file 的验证映射。
- `memory_mutation_log`：update/archive/superseded 等改动的增量日志。
- `project_state.project_memory_epoch`：外部变更触发硬折叠。
- `workspaces` / `workspace_members`：跨项目共享 memory 的边界和可共享类别。[E5]

这里的核心不是字段多，而是：

1. **memory 可编辑**：不是 append-only。
2. **memory 有来源**：`source_type = historian | agent | dreamer | user`。
3. **memory 有使用反馈**：`seen_count` / `retrieval_count` 会影响注入优先级。
4. **memory 有生命周期**：active/permanent/archived、expires、superseded、merged。
5. **memory 有验证状态**：不是写进去就永远真。

## 3. 写入路径：自动提升 + 显式工具写入

### 3.1 Historian 自动提升 facts

Historian 在 compartment publish 时会把 `<facts>` 中 promotable category 的事实提升为 project memory。实现上：

- 非法/空 fact 跳过。
- category 不在 promotable set 跳过。
- 用 `computeNormalizedHash(content)` 去重。
- 已存在则只增加 `seen_count`。
- 新 fact 插入 memory，`source_type="historian"`。
- embedding 在事务提交后 best-effort 生成。[E6]

这说明 Magic Context 不要求 primary agent 每次手动“记住”；它把历史压缩的副产物提升成 durable memory。

### 3.2 `ctx_memory` 显式写入/更新/归档/合并

Primary agent 可用的 `ctx_memory` 动作是：

- `write`
- `archive`
- `update`
- `merge`

`list` 是 dreamer-only。工具层还做了权限和可见性限制：primary agent 只能修改自己项目可见的 memory；workspace foreign memory 只有共享类别可见/可改；sidekick 禁用 `ctx_memory`。[E7]

`ctx_memory write` 要求“一条独立 fact + category”，并按 normalized hash 去重。`update` 会重置 shareable/classified/embedding，因为新内容可能改变隐私和重要度判断。`merge` 拒绝跨 category 合并，因为“一条 fact 只能属于一个 category”；跨类别相似通常意味着误分类而非重复。[E8]

这给我们的启发是：如果未来做 member memory，写入工具也不能只是 `appendCorrection(text)`；至少需要有：

- 写入 gate；
- 去重；
- 更新/归档/合并；
- 可见性边界；
- 写后重新分类/验证。

但这只是启发，不是现在就确定 schema。

## 4. Dreamer：防污染、防过期、防重复的关键

Magic Context 真正避免 memory 污染的部分在 Dreamer，而不在初始写入。

### 4.1 curate：假设准确，只管质量

Curate prompt 明确说：memory pool 已假设准确；verify 任务检查 correctness。curate 只做质量：去重、改写低质量表述、归档低价值项。它要求：

- 一条 memory 只表达一个 fact。
- 当前事实用 present tense，不写历史叙述。
- 不 mint new facts；新增只用于 split compound memory。
- archive stale / low-value / redundant / solved own-code bug / transient measurement。
- keep constraint/rule/WHY/external limit/path with context/retrieved memory。[E9]

### 4.2 verify：读代码验证，默认保留

Verify prompt 让 read-only agent 对每条 memory 的 backing files 做三选一：

- `VERIFIED`
- `UPDATE`
- `ARCHIVE`

它非常保守：无法确认、找不到代码、不确定时都默认 `VERIFIED`，因为错误归档真实 memory 是最坏失败模式。agent 只输出 XML manifest，host 解析并应用 DB 写入，agent 不直接 mutate。[E10]

### 4.3 classify：重要度、scope、shareability

Classify 是 zero-tool 单轮 transform，给每条 memory 标：

- `importance` 1-100
- `scope` = project / ecosystem / universe
- `shareable` true/false

重要度不是“这条事实为真”，而是“漏掉会不会导致错误、浪费、违反约束”。shareability 关注 exposure：同项目 teammate 是否适合看到，是否包含个人/本机/敏感信息。host 对 secret/personal path fail closed。[E11]

### 4.4 retrospective：从 recurring friction 中学习，而不是记录每次纠正

Retrospective 只从重复用户 friction 学：用户纠正、重复解释、要求恢复等。规则要求：

- 必须是 recurring pattern，不是一条 annoyed message。
- 提炼 root cause + future correction。
- 不引用用户原话、不保留愤怒措辞。
- 输出 route=`memory` 或 route=`observation` 的 XML，host 再应用。[E12]

这正是我们之前“MemberCorrection”思路不对的原因：用户纠正只是 retrospective learning 的候选输入，不是产品主对象。

## 5. Recall / retrieval：不是只注入 memory，还能搜索和展开原始历史

Magic Context 的 recall 有三条路线：

1. **默认注入**：m[0]/m[1] 中注入 `<project-memory>`、`<user-profile>`、`<session-history>`、`<session-history-since>`。
2. **搜索**：`ctx_search` 同时搜 memory、raw message history、compartment chunks、git commits、primers、notes。
3. **展开**：`ctx_expand` 可按 range 或单个 message ordinal 恢复压缩前原文/工具输入输出。

### 5.1 `ctx_search` 的关键设计

`ctx_search` 不是只搜 memories。它的 unified search source 包括：

- `memory`
- `message`
- `git_commit`
- `primer`
- `note`
- compartment chunks 作为 message-like results

并且它会 hard-filter 已经显示在 `<session-history>` 里的 memory ids，避免重复返回 agent 已经看见的 memory，把 token 预算让给更有价值的 raw-history hit。[E13]

这说明 Magic Context 不认为 durable memory 能替代 raw history；它保留 “找回原对话细节” 的路径。

### 5.2 `ctx_expand` 的关键设计

`ctx_expand` 能：

- 展开一个 message ordinal range；
- verbose 模式逐条列出消息和 tool call/output size；
- 按单个 message ordinal 完整恢复一个 message，包括 text part 和 tool call 完整输入/输出；
- 避免展开 live tail，因为 live tail 已经在当前上下文中。[E14]

这点非常关键：Magic Context 的压缩不是不可逆摘要。它允许 agent 先看 tiered summary，再按需回到 raw records。

## 6. Prompt 注入：m[0]/m[1] cache-stable，而不是每轮随意拼接

Magic Context 的运行时 transform 每轮改写 message array，但严格分成：

- `m[0]`：稳定 baseline，包含 project docs、user profile baseline、decayed session-history、project-memory。
- `m[1]`：volatile delta，包含 new compartments、new memories、memory-updates、new-user-profile。

它特别强调：新 memory、新 compartment、新 user profile 不触发 m[0] hard fold，而是先进 m[1]，等自然 hard bust 时再折入 m[0]。[E15]

Memory 注入也有预算和排序：

- permanent 优先；
- 被实际检索过的 memory 优先；
- 带 must/never/always 等约束词的 memory 优先；
- seen count 高优先；
- 短内容优先；
- deterministic id tiebreaker 保持 cache stability。[E16]

这说明“有选择、有层次地构造模型真正该看到的上下文”在 Magic Context 中确实存在，但它不是由业务流程手工拼文档，而是在 runtime transform、watermark、cache boundary 下实现。

## 7. Subagent 限制：Magic Context 不等于所有子 agent 自动继承完整上下文

Architecture 文档明确区分 primary / subagent 模式：

- primary session 有 historian / compartments / decay / m[0]/m[1]；
- subagent 模式没有完整 historian/compartment/m[0]/m[1] 机制，只保留较轻的 tag / `ctx_reduce` / nudges 等能力；
- hidden child sessions 也会被系统 prompt injection 跳过。[E17]

所以 Magic Context 本身不直接解决我们最初关心的 “让某个 reviewer/spec oracle/member 在需要时获得足够相关上下文” 的全部问题。它提供的是一个非常强的 memory / prune / recall 机制参考，但并不自动等于 “member task run 的上下文可证明足够”。

## 8. 对 Context Tree 后续设计的启发，但不是设计结论

### 8.1 我们应该先吸收的原则

1. **不要顶层化 correction。** correction/friction/review feedback 只是输入信号；只有通过 gate 后才成为 durable member memory。
2. **区分 facts 与 experience。** member 长期规则/禁忌/判断标准是 facts；某次 task run、某次失败、某次 review 是 experience。
3. **保留 raw-history recovery path。** 只做 curated memory 会丢失 reviewer/spec oracle 可能需要的语境。
4. **memory 必须可维护。** write 只是开始；update/archive/merge/classify/verify/retrospective 才是防污染核心。
5. **下一次 task run 的可见材料需要可审计。** Magic Context 会记录 visible memory ids、watermark、rendered memory block；我们也需要知道某个 member run 实际看见了哪些 role context / target material。
6. **注入要有预算和优先级。** 如果 member context 长期增长，必须有 importance、retrieval feedback、hard rules 优先级，而不是全量塞入。

### 8.2 暂时不应该直接照搬的部分

1. **不直接照搬完整 SQLite + Dreamer V2。** 那是成熟 runtime plugin 的复杂实现；我们当前应先明确产品对象和最小可证明链路。
2. **不直接把 project memory taxonomy 套到 member memory。** 五类 taxonomy 很适合项目事实，但 member role context 可能还需要 role standard、rejected pattern、preferred evidence、review rubric、failure mode、golden example 等；这需要后续设计，不在本文定。
3. **不假设 Magic Context 能替代 member 系统。** 它对 primary session 很强，但 subagent/member activation 的上下文继承、结果回流、per-run evidence 仍是我们的问题空间。
4. **不先做 `MemberCorrection`。** 如果要记录用户反馈，也应先作为 retrospective/friction signal，等待 gate 决定进入 memory、observation、experience 或不持久化。

## 9. 下一步建议

下一步不应直接写 schema。建议先做一个窄调研/设计桥接文档：

```text
architecture/15-member-memory-requirements-from-magic-context.md
```

它只回答四个问题：

1. 对 stable team member 来说，哪些信息属于 durable member memory，哪些只属于某次 MemberTaskRun experience？
2. member 下次执行 task 时，哪些材料应该默认注入，哪些应该通过 search/expand 按需找回？
3. 用户反馈、主 agent 评价、review result、失败 eval、成功样例分别如何进入候选池，经过什么 gate 才能持久化？
4. V0 在不实现完整 Dreamer 的前提下，最小可验证的 write / retrieve / evidence loop 是什么？

只有回答完这些，再定义具体数据结构和实现计划。

## 10. 代码路径核对：它到底如何“知道上下文”、压缩、写入、再注入？

本节只追 Magic Context 自己的代码路径，避免把我们的 member 设想混进去。

### 10.1 Raw history 来源：不是模型上下文快照，而是 runtime / session store 的原始消息

Magic Context 不直接读取“模型请求里最终看到的上下文快照”作为历史真源。它主要从两类来源取 raw messages：

1. **OpenCode session SQLite DB**：`readRawSessionMessagesFromDb()` 从 `message` 和 `part` 表按创建时间读取消息与 parts，再组装成带 ordinal 的 `RawMessage[]`。它会过滤 Magic Context 自己注入的 compaction summary message，避免 historian / FTS / `ctx_expand` 把这些 synthetic boundary 当成真实对话。[E18]
2. **registered raw-message provider / in-memory tail**：`readRawSessionMessages()` 会优先使用 provider；transform hot path 可用 `primeInMemoryTailRawMessageCache()` 把当前 transform 收到的 tail 直接注册进去，避免每轮读整库。[E19]

这说明：Magic Context 的“上下文材料”基础是 **可观测的会话记录与 parts**，不是 provider 内部不可见 KV cache 或模型实际 request byte-for-byte dump。

对我们当前问题的含义是：如果借鉴 Magic Context，不能简单说“保存 agent context”。更准确是：保存/读取 agent runtime 可观测的 conversation record，然后用规则决定哪些进入模型请求、哪些可搜索展开。

### 10.2 Historian chunk：不是把所有历史喂给压缩器，而是选 eligible older tail

`readSessionChunk(sessionId, tokenBudget, offset, eligibleEndOrdinal)` 把 raw messages 格式化成 historian 输入。它做了几件关键事：[E20]

- 按 absolute ordinal 读取，从 `offset` 到 `eligibleEndOrdinal` 前。
- 合并连续同角色 block。
- 对无文本消息提取 tool-call summaries，而不是把全部 tool I/O 原样塞给 historian。
- 过滤无意义 user/system notification，但保留有工具结果摘要的 user-role message。
- 标记 pure tool-only ranges，让 validator 能吸收工具噪声导致的 gap。
- 受 token budget 限制，返回 `hasMore`、start/end ordinal、message ids、commit cluster count。

所以 historian 看到的不是完整 transcript，而是 **为压缩目的格式化过的 raw-history slice**。这也是 Magic Context 防止 tool 调用噪声污染 memory 的第一道 gate：工具细节通常只成为 `TC:` 摘要，除非后续 `ctx_expand(message=N)` 显式恢复单条完整消息。

### 10.3 Historian prompt：带 bounded references 和 project memory，而不是无界状态 dump

`runCompartmentAgent()` 在真正调用 historian 前构造 prompt：[E21]

- 读取本 session 之前的 compartments，生成 bounded references：cross-project seeds + last recent compartments。
- 读取当前 project active/permanent memories，渲染 `<project-memory>`，供 historian 做 fact dedup。
- 把 `readSessionChunk()` 的结果作为 `Messages start-end` 输入。
- 调用 `runValidatedHistorianPass()`。

这点很重要：Magic Context 的 historian 不是“全知压缩器”。它只看：

```text
bounded examples + bounded session references + current project memory + current raw chunk
```

这解释了它如何控制污染和成本：压缩 agent 的输入本身就是经过选择和上限控制的。

### 10.4 Parser / validation：LLM 输出不能直接入库

`parseCompartmentOutput()` 只接受可解析的 XML-like 输出：[E22]

- 从 `<compartment ...>` 解析 start/end/title/episode/importance。
- 优先解析 P1-P4 四级 tier，缺失中间 tier 时向更详细 tier fallback。
- 只在 `<facts>` block 内解析 category facts，避免把 compartment/event 文本里的 category-shaped tag 误读成 facts。
- 解析 `unprocessed_from`、`user_observations`、`primer_candidates`。

实际 publish 前还通过 `validateHistorianOutput()`；失败会走 repair/fallback 模型，而不是直接写库。[E23]

所以 Magic Context 的可靠性不是“相信模型会总结好”，而是：

```text
prompt contract → parser → validator → repair/fallback → publish
```

### 10.5 Publish transaction：compartment、fact promotion、events、drop queue 是原子边界

`runCompartmentAgent()` 在通过验证后才进入 publish：[E24]

1. 可能执行 discard-last boundary healing：如果最后一个 compartment 没有足够 lookahead，就丢掉尾部 provisional compartment，下次用 raw history 重新推导。
2. 弱边界时跳过 unanchored promotion：避免把可能属于丢弃尾部的 facts 重复提升。
3. `BEGIN IMMEDIATE` 后检查 lease 是否仍持有。
4. `appendCompartments()` 只追加新 compartments，不重写旧 compartments。
5. 如果 `memory.enabled` 且 `auto_promote` 开启，调用 `promoteSessionFactsDurable()` 在同一事务内把 facts 提升为 project memory。
6. 插入 events；events 失败只 log，不 abort facts/boundary。
7. `queueDropsForCompartmentalizedMessages()`：把已经 compartmentalized 的 raw messages 排队为可 drop/marker 覆盖范围。
8. 记录 publication floor / pending compaction marker。

这个事务边界是 load-bearing：**不能让 compaction boundary 前进但 facts 没有成功入库**。因此 facts promotion 和 boundary publication 在一个事务内。

### 10.6 Memory promotion：自动提升但仍然去重、跳过、可失败回滚

`promoteSessionFactsDurable()` 的行为很窄：[E6]

- 空 fact / malformed fact 跳过。
- 非 promotable category 跳过。
- `(projectPath, category, normalizedHash)` 去重。
- 已存在只增加 `seen_count`。
- 新建 memory 的 `source_type` 是 `historian`。
- 如果存储失败，异常向外传播，让 enclosing publish 回滚。

这说明 Magic Context 的 auto memory 并不是把 historian 输出无条件 append。它承认 LLM 输出可能混乱，并把 durability gate 放在 category、hash、事务边界上。

### 10.7 Injection：memory 不是一写入就重建大上下文

Magic Context 的 m[0]/m[1] 机制让 memory 变更按 cache boundary 消化：[E15]

- m[0] 是稳定 baseline：`<project-docs>`、`<user-profile>`、`<session-history>`、`<project-memory>`。
- m[1] 是增量：`<memory-updates>`、`<new-compartments>`、`<new-memories>`、`<new-user-profile>`。
- 新 compartments / new memories / user-profile additions 不触发 m[0] hard fold；先进入 m[1]。
- destructive memory mutation 通过 `memory_mutation_log` 渲染 `<memory-updates>`，提示 agent “snapshot 里的 memory 已变化，以这里为准”。[E25]

这点可以避免一个误解：Magic Context 不是每轮“重新拼一份完整上下文文档”。它非常在意 provider prompt cache，所以新增信息通过水位线进入 m[1]，到自然 hard bust 才折入 m[0]。

### 10.8 Retrieval：默认注入不足时，agent 自己 search/expand

默认注入不是完整历史。Magic Context 通过工具补足 recall：[E13][E14]

- `ctx_search` 搜 memory、raw message FTS、compartment chunks、git commits、primers、notes。
- 对 message/compartment hit，返回 ordinal/range，并提示 `ctx_expand(start,end)`。
- `ctx_expand(message=N)` 可以恢复单条 message 的完整 text parts 和 tool call input/output。
- `ctx_expand(start,end)` 会 clamp 到 last compartment boundary，避免重复读取 live tail。

所以 Magic Context 的完整 recall 模型是：

```text
默认可见：curated memory + decayed compartments + recent live tail
按需找回：search hits + raw range/message expansion
```

它不是“全部文档化后注入”，也不是“完全依赖 native context”。它是 runtime 维护的 layered memory + searchable raw record。

### 10.9 Subagent：为什么 Magic Context 不能直接替代我们的 member 问题

Magic Context 明确要识别 subagent。`resolveIsSubagentFromOpenCodeDb()` 会直接读 OpenCode `session.parent_id`，避免 child session 第一轮被误判为 primary；注释说明如果误判，会错误注入 §N§ prefixes、adjunct blocks、primary-mode gates，并破坏 prompt cache。[E26]

Architecture 还说明 primary 与 subagent 能力不同：primary 有 historian / compartments / decay / m[0]/m[1]；subagent 没有完整 historian 机制。[E17]

这不是小细节，而是边界结论：

- Magic Context 的 strongest path 发生在 primary session runtime transform。
- Subagent/member activation 是否能得到足够上下文，不由 Magic Context 自动保证。
- 如果我们的产品目标是 stable team member / reviewer / consultant，那么仍需要定义 member run 的材料来源、可见性证明、结果回流；Magic Context 只能作为 memory/prune/recall 机制参考。

### 10.10 对“用户纠正会不会被记住”的代码路径答案

按 Magic Context 的代码，单次用户纠正可能走四条路线：

1. **只进 raw history**：保存在 OpenCode DB / provider raw messages，可被 `ctx_search`/`ctx_expand` 找回。
2. **进 compartment narrative**：historian 把它写进某个 P1/P2/P3/P4 compartment；随时间衰减。
3. **成为 event**：只有满足 `trajectory_correction` 等 gate 时，作为 sparse event 存储。
4. **成为 durable memory**：只有当它表达稳定 project fact，或 retrospective 认定为 recurring friction learning 时，才进入 memories / user profile。

不会发生的是：

```text
用户纠正一次 → 无条件生成 correction object → 下次默认注入
```

这就是我们后续设计必须参考 Magic Context 的地方：**信号进入候选池，经过分层/gate/维护，最后才决定是否成为默认上下文。**

## 11. 本轮调研后的约束：现在仍不能下的结论

即使补完上述代码路径，也仍然不能直接下这些结论：

1. 不能说 Context Tree 应该实现 Magic Context 的完整 SQLite/Dreamer 架构。
2. 不能说 member memory taxonomy 就是 Magic Context 的五类 project memory。
3. 不能说只要有 memory/search/expand，就能替代 native-spawn/member-run evidence。
4. 不能说用户反馈都应该持久化；Magic Context 的默认答案恰恰是否定的。
5. 不能说 subagent/member 自动获得 primary session 的 strongest memory path；Magic Context 源码明确对 subagent 降级。

目前可以安全带走的只是机制原则：

```text
raw record 保留
→ bounded extraction
→ parser/validator
→ facts vs experience 分层
→ durable memory 可维护
→ 默认注入有预算
→ search/expand 补足
→ per-run 可见性需要证据
```

## Evidence

- [E1] `ref/magic-context/packages/plugin/src/features/magic-context/memory/constants.ts`：v2 memory categories、promotable categories、category priority、TTL。
- [E2] `ref/magic-context/packages/plugin/src/hooks/magic-context/historian-prompt.source.md`：facts 五类 taxonomy、正负例、category-routing test。
- [E3] `ref/magic-context/packages/plugin/src/hooks/magic-context/historian-prompt.source.md`：world / experience split、compartment/facts/events/user_observations 输出定义。
- [E4] `ref/magic-context/packages/plugin/src/hooks/magic-context/historian-prompt.source.md`：events、trajectory_correction、extraction gates。
- [E5] `ref/magic-context/packages/plugin/src/features/magic-context/storage-db.ts` 与 `memory/types.ts`：memories、memory_embeddings、memory_verifications、memory_mutation_log、project_state、workspaces schema。
- [E6] `ref/magic-context/packages/plugin/src/features/magic-context/memory/promotion.ts`：historian facts promotion、dedup、seen_count、embedding。
- [E7] `ref/magic-context/packages/plugin/src/tools/ctx-memory/types.ts` 与 `tools.ts`：primary vs dreamer actions、tool visibility、sidekick 禁用。
- [E8] `ref/magic-context/packages/plugin/src/tools/ctx-memory/tools.ts` 与 `storage-memory.ts`：write/update/merge/archive 行为、shareable/classified/embedding invalidation、跨 category merge reject。
- [E9] `ref/magic-context/packages/plugin/src/features/magic-context/dreamer/task-prompts.ts`：curate prompt、pool hygiene、archive/keep rules。
- [E10] `ref/magic-context/packages/plugin/src/features/magic-context/dreamer/verify-prompt.ts`：read-only verify、default verified、host applies manifest。
- [E11] `ref/magic-context/packages/plugin/src/features/magic-context/dreamer/classify-prompt.ts`：importance/scope/shareability 分类。
- [E12] `ref/magic-context/packages/plugin/src/features/magic-context/dreamer/task-prompts.ts`：retrospective friction gate / learning prompt。
- [E13] `ref/magic-context/packages/plugin/src/features/magic-context/search.ts` 与 `tools/ctx-search/tools.ts`：unified search sources、visible memory filter、message/compartment search。
- [E14] `ref/magic-context/packages/plugin/src/tools/ctx-expand/tools.ts`：range/message recovery、verbose expansion、live-tail clamp。
- [E15] `ref/magic-context/ARCHITECTURE.md` 与 `hooks/magic-context/inject-compartments.ts`：m[0]/m[1] cache layout、new memories/new compartments as m[1] deltas。
- [E16] `ref/magic-context/packages/plugin/src/hooks/magic-context/inject-compartments.ts`：memory trim priority、budgeted render、rendered memory ids。
- [E17] `ref/magic-context/ARCHITECTURE.md`：primary/subagent capability split、system prompt injection skipped for hidden child sessions。
- [E18] `ref/magic-context/packages/plugin/src/hooks/magic-context/read-session-raw.ts`：从 OpenCode `message`/`part` 表读取 raw messages，并过滤 Magic Context compaction summary。
- [E19] `ref/magic-context/packages/plugin/src/hooks/magic-context/read-session-chunk.ts`：raw-message provider、tail cache、in-memory tail cache。
- [E20] `ref/magic-context/packages/plugin/src/hooks/magic-context/read-session-chunk.ts`：`readSessionChunk()` 格式化 eligible raw-history slice，提取 tool summaries，维护 ordinal/range/token metadata。
- [E21] `ref/magic-context/packages/plugin/src/hooks/magic-context/compartment-runner-incremental.ts`：构造 historian prompt 的 bounded references、project memory、current chunk。
- [E22] `ref/magic-context/packages/plugin/src/hooks/magic-context/compartment-parser.ts`：解析 compartments、facts、user observations、primer candidates。
- [E23] `ref/magic-context/packages/plugin/src/hooks/magic-context/compartment-runner-historian.ts`：`runValidatedHistorianPass()`、validation、repair/fallback。
- [E24] `ref/magic-context/packages/plugin/src/hooks/magic-context/compartment-runner-incremental.ts`：validated pass 后的 discard-last、atomic publish、fact promotion、events、drop queue、compaction marker。
- [E25] `ref/magic-context/packages/plugin/src/features/magic-context/storage-memory-mutation-log.ts` 与 `hooks/magic-context/inject-compartments.ts`：memory mutation log 和 `<memory-updates>` 渲染。
- [E26] `ref/magic-context/packages/plugin/src/features/magic-context/resolve-subagent-fallback.ts`：通过 OpenCode `session.parent_id` 识别 subagent，避免 primary-mode 注入误用。
