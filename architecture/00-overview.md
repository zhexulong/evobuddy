# Context Tree 架构

## 0. 当前架构结论

截至 `2026-07-07`，项目定位已进一步修正为：

```text
Implementation-first Context Tree
→ context-bearing team member / on-demand consultant layer
```

也就是：

```text
先把 consultant activation / context material path / result return 的实现链路跑通，
再考虑 reviewer 或 specialist member 质量是否优于 doc-only / fresh-thread baseline。
```

但这里的 `checkpoint / fork-spawn` 不应被理解成“Context Tree 自己组装一包固定上下文”，也不应被限制为“从 parentSession 派生 reviewer”。当前更准确的产品定位是：

```text
主 agent 在需要专业判断或专门产出时，
按需激活一个 context-bearing team member / consultant；
这个 member 可以从 parent checkpoint 派生，也可以从角色长期上下文、项目记忆、目标材料和 searchable history 中恢复；
Context Tree 负责 activation 谱系、材料路径、fidelity / known losses、结果回流和可观测 evidence。
```

这里需要明确分层：**team member 是用户价值主体**，不是附属 UI。用户真正感知到的是一组可复用的 `skill-designer`、`live-eval-checker`、`architecture-reviewer`，它们能被主 agent 或用户按需调用，并且越来越懂项目约束、用户偏好和本职责的判断标准。`MemberTaskRun`、context source、material path、fidelity / known losses 是让这些 member 不退化成 fresh subagent + profile prompt 的工程底座。

因此，Context Tree 的差异化不应表述为“不是 team member，而是 evidence ledger”。更准确的说法是：

```text
Context Tree = context-bearing team member system
MemberTaskRun evidence ledger = 支撑 team member 可信、可复用、可审计的底座
```

roster、org chart、task drawer、memory 都是重要的用户表层或组件；它们单独不足以构成不可替代性，因为 Claude subagents、WorkBuddy、Alook、Poco、AIPass、OpenLoomi 等都覆盖了其中一部分。不可替代点是 **context-bearing team member**：每次 member 被调用时，系统能解释它基于哪些任务上下文、角色历史、目标材料和 runtime/source path 做判断，并让结果回到主 agent 当前 loop。

因此，核心问题已经不再是简单的：

```text
agent context vs doc
```

而是：

```text
对某个具体任务，应该委派给哪个 member；
这个 member 应该看到哪些任务上下文、角色上下文和目标材料；
这些材料能否从 parent checkpoint、role history、project memory、runtime fork、searchable history 或 staged docs 中以最高有效路径获得；
结果能否自然回到主 agent 的当前 loop。
```

这里不应把 `activateMember` 作为核心 agent-facing primitive。我们是 subagent-native 模式：主 agent 应直接使用宿主 runtime 的 native subagent / teammate / fork / SendMessage。Context Tree 记录的是一次 `MemberTaskRun`：某个稳定职责 member 在某个 activation point 承接了 consult、review、check、plan、reflect、guide、diagnose 或其它 task，并把结果回到主 agent。

member 命名和路由参考 Claude Code subagent / agent team：可复用职责用稳定 `name` 标识，`description` 写明什么时候应该委派；运行中的 teammate / subagent 实例另有 runtime agent ID。Context Tree 因此对 agent-facing API 使用 `memberName`，内部可解析为 `resolvedMemberId` 和 runtime instance ID。

产品内部仍需要完整 graph：member identity、activation point、runtime/context lineage、context source、work-product dependency、role/authority relation、result return 都应可追踪。但默认呈现应是 member-centric：用户看到的是一个持续复用的 `skill-designer` / `live-eval-checker` / `architecture-reviewer`，而不是每次 activation 的 context 继承细节。上下文继承和 fidelity evidence 应作为可展开 provenance 层，默认可以隐藏。

因此，`tree` 更适合作为历史名称或 run-lineage 子图，而不是完整产品本体。完整模型更接近：

```text
role-aware context graph + on-demand member task runs
```

最新设计见：

- `architecture/08-context-bearing-subagent-api-design.md`
- `architecture/09-ecosystem-context-selection-survey.md`
- `architecture/10-v0-concrete-design.md`
- `architecture/11-context-bearing-team-member-design.md`

旧的 Context Tree / checkpoint packet 表述仍有参考价值，但应作为 team-member task run 的一种 source，而不是全部模型。当前阶段不先做完整 tree database，不做通用 context 文档化，也不设计 `spawnContextAgent` 这类系统组装上下文的 API。它先做实现与实现级 e2e eval，证明从 activation point 到宿主 runtime 的 native subagent/team/fork 执行，再到结果回流主 agent 的链路真实可用。evidence/report 是 eval 与可观测性要求，不是总目标本身。AACR / doc-only 对比后置为质量 eval。

## 1. 历史定位

Context Tree 是一个面向编程智能体的**上下文谱系工具链（context-lineage harness）**。

它的职责是保存并利用智能体会话的树形结构：

```text
哪个会话/上下文来自哪个上游上下文，
当前智能体在树中的位置，
以及何时应该从更早的上下文分叉新智能体，而非从当前上下文。
```

它不是通用文档系统、任务管理器、知识库或向量/图谱检索层。它也不是替代平台的“每轮 prompt 组装器”。

如果 implementation e2e 证明 checkpoint-fork 路线可实现，Context Tree 后续可以考虑一个**节点级上下文恢复/审计后端**：尽可能复用平台自己的会话记录、compact/recap 状态、上下文组装线索和 searchable history，为派生 agent 提供任务有效材料。这个后端不只是 native fork 不可用时的兜底；在 review/check/reflect 这类任务中，它可能比 noisy fork 更有效。

核心赌注已从“单次 reviewer fork”扩展为：

> 当工作流变为线性且所有事情都由同一个临时 agent 处理时，专业判断和历史纠正会大量流失。更好的形态是让主 agent 能按需激活负责某类工作的 member，例如 skill designer、hook implementer、live-eval checker、architecture reviewer。member 不一定常驻，也不一定是同一个 runtime session，但每次被调用时都应恢复它的职责上下文和本次任务上下文。

这里的“保留”不是指无条件带上最多历史。对很多审查和专业产出任务，用户约束、assistant 承诺、排除项、关键纠正、角色标准和历史失败路径比完整工具轨迹更重要。因此，当前研究对象不是"将上下文总结为普通设计文档"，而是**让当前 agent 能在需要时激活一个带合适上下文的 consultant，并把结果用于当前 loop**。实现级 e2e 必须能观测这条链路，但观测不是产品目的本身。native fork、平台 DCP/prune、Magic Context 风格 search/expand、role memory、searchable history、staged docs 都是材料路径候选，不能先把其中任意一种当成产品本体。

## 2. 非目标

Context Tree 不应成为：

- Trellis 风格的强文档/任务工具链；
- 设计文档生成器；
- 人工摘要式上下文文档化或通用知识蒸馏系统；
- 扁平化的转录归档；
- 通用的文件系统协调协议；
- Codex / Claude Code / OpenCode 原生会话的替代品；
- 自动语义分支建议引擎。

普通文档可以作为产出物、标签或 doc-only baseline 存在；它们能承载上下文，但需要 agent/human 主动写入。当前比较先不进入效果层面，而是先证明平台内的模型上下文/会话上下文能否被派生 reviewer 真实继承、调用并把结果回流给主 agent。只有实现级 e2e 稳定后，才继续比较它与文档 baseline 的质量/成本差异。

更重要的是，答案不应预设为“agent context 一定比 doc 好”。对 review 任务来说，最有价值的上下文可能只是用户说了什么、agent 回答了什么、哪些决定被接受或排除；工具调用、长日志、重复探索可能是噪声。Context Tree 不应规定固定材料集合，而应支持 agent/runtime 根据任务选择和裁剪上下文。

V0 的精髓应是：

```text
主 agent 在关键节点需要帮助
→ 复用平台已有 context / DCP / prune / spawn 能力
→ 让派生 agent 获得“该任务所需的上下文”
→ 派生 agent 的结果回到主 agent 当前 loop
```

如果 agent 自己的 DCP/prune 能产生足够上下文，Context Tree 不应重复组装。如果 agent 看不到较久但仍有意义的历史，Context Tree 才考虑提供补充：定位、挂载、添加或重组这些历史材料。这个补充也应尽量由 agent 根据任务自主决定，而不是由 Context Tree 硬编码。

这意味着 Context Tree 可能“比不过”`context-mode` 的上下文材料选择，尤其是在长历史检索和 compact 后恢复场景。这不是失败边界，而是设计边界：Context Tree 负责 tree/checkpoint/subagent/result-return；`context-mode` 风格 capture/search 可以成为最优材料后端。

## 3. 问题

现代智能体工作流已经以某种形式支持隔离式工作：

- Codex 提供 `/fork`、`/side`、subagents、skills、hooks 和 app-server 线程 API。
- Claude Code 提供 skills、类似 slash command 的调用、hooks 和 subagents。
- OpenCode 提供 commands、plugins 和类子任务执行。
- Superpowers / Trellis / CCG 展示了工作流阶段边界和 hook 驱动的状态注入。

但这些系统通常缺少以下一项或多项：

1. **树位置** — 当前智能体通常不知道它属于哪个上下文节点。
2. **分叉基选择** — 当下游分支需要审查或指导时，正确的基可能是一个上游设计上下文，而不是当前已被污染的实施方案上下文。
3. **模型上下文连续性** — 普通子智能体 prompt 通常只传递摘要/任务包，这既不是完整会话记录，也不是模型实际上下文。
4. **阶段边界时机** — 最有价值的分叉通常发生在*阶段之间*，即下一个阶段污染或提交上下文之前。
5. **跨平台能力边界清晰性** — 原生上下文分叉、会话记录重放、摘要交接是不同能力，不能等同对待。

## 4. 核心用例

重要的拓扑关系不是"子节点控制父节点"，而是：

```text
父/设计上下文 P
  └─ 下游上下文 C

C 到达需要审查/指导的节点。
工具链从 P 派生 R，而不是从 C。
R 审查/指导 C。
```

展开后：

```text
P  设计/上游上下文
│
└─ C  下游实施方案/规划上下文

C 请求或工作流到达边界：

P ──fork/spawn── R  审查者/规划者/指导者
                 │
                 └── 审查/指导目标 C
```

这要求派生操作能够区分：

- **基节点**：要从中分叉的上下文；
- **请求节点**：需要帮助的当前智能体/节点；
- **目标节点**：被审查或指导的节点/产出物；
- **派生节点**：从基节点创建的新智能体。

这些不总是同一个节点。

## 5. 上下文保真度是产品边界

Context Tree 只有在试图保留前置**模型上下文/会话上下文**时才有意义。

需要区分三个概念：

1. **模型上下文**：模型本轮实际可见并参与推理的上下文。它可能包含平台注入的系统信息、历史消息、工具结果、压缩 recap 等。
2. **会话完整记录**：平台保存的 transcript、工具调用、工具结果、消息流、事件流等。这是会话记录，不自动等于模型上下文。
3. **外部环境状态**：工作区文件、git diff、未跟踪文件、运行时状态等。它们会影响任务，但不应被混称为 context。需要时可作为目标材料或环境快照引用。

因此，旧称 `full-transcript-mounted` 容易误导；更准确的名字是 `session-record-mounted`：完整会话记录被挂载给新 agent 查阅，但不能声称恢复了原模型上下文。它是 fallback，不是等价 fork。

### 保真度级别

```ts
type ContextFidelity =
  | "native-context-fork"
  | "native-session-fork"
  | "model-context-replay"
  | "compiled-context-packet"
  | "session-record-mounted"
  | "partial-session-record"
  | "summary-only";
```

含义：

| 级别 | 含义 | 产品状态 |
|---|---|---|
| `native-context-fork` | 平台原生从已有上下文分叉，最大程度保留模型可见上下文。 | 目标路径。 |
| `native-session-fork` | 平台原生分叉/恢复实际会话或线程；是否等同模型上下文取决于平台实现。 | 强路径，需要实测。 |
| `model-context-replay` | 平台允许把历史消息/工具结果按模型上下文形式重新注入。 | 强 fallback，需要验证 token 与注入规则。 |
| `compiled-context-packet` | Context Tree 按平台 prompt assembly / compact / prune 规则，从会话记录编译出派生 agent 应见的上下文包。 | 强 fallback / 可审计路径；需要证明等价性。 |
| `session-record-mounted` | 完整会话记录以可读资源挂载；新 agent 可查阅，但不会自动进入模型上下文。 | 可用 fallback，但必须标明不是模型上下文恢复。 |
| `partial-session-record` | 只能获得部分会话记录。 | 已降级；必须可见。 |
| `summary-only` | 只传递摘要/任务简报/设计文档。 | 不算 Context Tree 的有效分叉；只能作为兼容兜底。 |

工具链必须记录实际使用了哪个级别。它不得将 `session-record-mounted` 或 `summary-only` 宣称为完整模型上下文分叉。

### 专用上下文包不是普通文档

“文档化”如果指人工写 design doc 或 handoff summary，仍然不是 Context Tree 的核心路径。

但如果指把平台上下文组装过程的产物物化为一个专用上下文包，则它是 Context Tree 的重要后端：

```text
平台会话记录 / rollout / DB / transcript
+ turn/message boundary
+ system/developer/project rules
+ tool schema / MCP references
+ compact / recap / replacement history
+ DCP / prune / placeholder / tail state
+ 当前派生目的和目标材料
→ compiled context packet
→ reviewer/planner/guide agent
```

这个上下文包应保留：

- 消息顺序；
- role / authority 边界；
- 哪些内容是当时模型可见的；
- 哪些内容只是底层 raw record 中仍可恢复；
- compact / prune / DCP 对上下文的变换；
- source refs 与 known losses。

因此 Context Tree 的实现不应是“写更多 markdown”，而应是：

```text
优先 native runtime fork；
需要历史恢复、跨平台、可审计或 native fork 不可用时，
使用 compiled-context backend。
```

### 可恢复材料

优先级应当是：

1. 平台原生上下文/会话 fork；
2. 平台保存的完整会话记录；
3. 已暴露的历史消息、工具调用、工具结果、compact/recap/title；
4. 当前 agent 显式提供的分叉原因、目标和约束；
5. 必要时引用目标文件、diff 或产出物作为审查对象。

工具调用和工具结果通常已经被 Codex / Claude Code / OpenCode 等 agent 工具记录在会话记录中。Context Tree 不应重复发明一套“工具日志真源”，而应优先复用平台记录；只有平台不暴露或暴露不完整时，才考虑旁路捕获。

未跟踪文件、仓库状态、diff 等属于工作区/环境状态，不属于模型上下文本身。它们可以作为目标材料或环境快照进入 spawn 任务，但不应混入“完整上下文”的定义。

某些状态在物理上可能无法访问：

- 模型隐藏状态 / KV 缓存；
- 隐藏的系统 prompt；
- 平台私有的上下文裁剪、排序或 recap 策略；
- 平台未暴露的工具或附件。

当前阶段不应预设哪些平台一定无法完全恢复。需要先调研和实测 Codex / Claude Code / OpenCode 的真实 fork、resume、subagent、session 记录能力，再决定 fallback 边界。

### 从 rewind / rollback 反推上下文需求

设计 Context Tree 之前，需要先看 agent 工具自己的 rewind 如何恢复上下文。

Codex 本地实现给出的重要线索是：rewind/backtrack 不是恢复模型 KV/cache，而是走 `thread_rollback`：

```text
1. 要求存在 persisted thread history；
2. flush 当前 thread 持久化记录；
3. load persisted history；
4. 追加 ThreadRolledBack marker；
5. 从 rollout replay 重建 agent in-memory history；
6. drop 最后 N 个用户 turn；
7. 重算 token usage；
8. 后续 turn 基于被裁剪后的 history 继续。
```

这个机制说明：至少对 Codex 而言，“可恢复上下文”的关键不是文件系统快照，而是平台持久化的、可重放的会话历史。该历史中不仅有普通消息，还包括：

- Response items / user 与 assistant 消息；
- `TurnContext`，用于恢复模型、工作目录、权限、协作模式等 turn 级上下文；
- compaction replacement history / compact summary；
- rollback markers，用来在 replay 时裁剪后续 turn；
- pre-turn context updates，并且 rollback 会裁剪被回滚 turn 上方的上下文更新，避免后续请求混入被回滚上下文。

OpenCode 的对应能力更像 `session.revert` / undo：它会基于 message/part 边界设置 `session.revert`，用 snapshot 恢复或回滚文件变更，并在下一次 prompt 前 cleanup 被 revert 的消息。这说明它同时处理“消息可见性”和“文件变更恢复”，但文件快照仍然是工作区状态恢复，不等于模型上下文恢复。

因此 Context Tree 的 checkpoint/fork 需求应从这些机制反推：

- 需要能引用或复制平台会话历史，而不是只保存摘要；
- 需要保留 turn 边界，而不仅是扁平 transcript；
- 需要保留 compact/recap/replacement-history 语义；
- 需要保留 turn-level context metadata；
- 需要知道回滚/分叉点之前哪些 context updates 仍然生效；
- 工作区 snapshot/diff 可以作为环境恢复或目标材料，但不是 context 本体。

## 6. 检查点与分叉时机

核心产品问题不是分支命令是否存在，而是**谁在何时声明这里值得成为分叉点**。

Context Tree 不应自己武断地“对设计节点创建检查点”。检查点应由当前 agent / 工作流在现场判断后创建：

```text
当前 agent 认为：
这里的上下文已经形成一个稳定判断、阶段成果或可复用分叉基；
后续继续推进会引入新假设、实现噪音或上下文污染；
因此这里可以 checkpoint，并可能从这里 fork 另一个 agent。
```

设计完成、进入 implementation plan 之前，是 v0 最重要的候选点，但它不是硬编码唯一规则。更准确的表达是：

```text
agent 判断 design 已稳定/已获得用户认可
→ agent 在进入 implementation plan 之前声明 checkpoint 候选
→ Context Tree 记录该节点与当前会话引用
→ 如需要，Context Tree 从该节点派生 reviewer/planner/guide
→ 结果反馈给当前工作流
→ 当前 agent 再决定是否进入 writing-plans
```

对于 Superpowers，这个候选点通常出现在：

```text
brainstorming/design 完成
→ 用户批准设计/规格
→ agent 准备调用 writing-plans
→ agent 先调用 Context Tree 创建 checkpoint / fork 候选
→ 派生 agent 基于该上下文审查或指导下一步
→ writing-plans 继续
```

对于 Trellis / CCG 风格的工作流，类似候选点可能是：

```text
research -> plan
spec/design -> implementation plan
implementation plan -> execution
execution -> review/fix loop
```

v0 不依赖模型自发提出“branch suggestion”。更可行的路径是：在明确的 workflow transition 附近，让当前 agent 通过工具显式声明“这里可 checkpoint / 可从这里分叉”。

## 7. 面向智能体的控制模型

主要 UX 不应要求用户退出智能体 UI 并运行 shell 命令。

但主要 UX 也不一定是一个用户 slash command，比如 `/ctree review-from-parent`。

期望的模型是：

```text
智能体/工作流知道当前树位置
当前 agent 判断已到达可 checkpoint / 可分叉的位置
智能体调用 Context Tree 原语
Context Tree 选择基节点，并总是使用当前平台可实现的最强分叉/恢复方式
派生的智能体以最强可用上下文连续性运行
结果附加回当前节点/工作流
```

智能体可调用的原语：

```ts
ctree.where(): TreePosition

ctree.checkpoint(input: {
  label?: string
  phase: string
  sessionRef: SessionRef
}): ContextNode

ctree.spawnFrom(input: {
  baseNodeId: string
  requesterNodeId: string
  targetNodeId: string
  purpose: string
  prompt: string
}): SpawnResult

ctree.attachResult(input: {
  fromNodeId: string
  toNodeId: string
  resultRef: string
  fidelity: ContextFidelity
}): void
```

Slash commands 作为显式的用户控制界面仍然有用：

```text
/ctree where
/ctree checkpoint
/ctree fork-current
```

但关键路径应当是在阶段边界处由工作流集成进行的调用。

## 8. 最小数据模型

不要过度本体化节点。一个节点主要是一个会话/上下文引用加上谱系。

```ts
type ContextNode = {
  id: string
  platform: "codex" | "claude-code" | "opencode" | string
  sessionRef: string
  label: string
  recap?: string
  createdAt: string
  capture?: CaptureManifest
}
```

`label` 应优先使用用户提供的标签。若用户没有显式命名，再使用平台提供的 recap/title。降级顺序：

1. 用户提供的标签；
2. 平台 recap / 会话标题；
3. 首个/当前用户 prompt 衍生的短标题；
4. 生成的短标签。

除非后续的会话管理或交接功能需要，否则不要向核心节点添加 `role`、`status`、`forkMode` 或 `returnRef`。

拓扑关系属于边：

```ts
type ContextEdge = {
  id: string
  kind:
    | "forked-from"
    | "checkpoint-of"
    | "spawned-from"
    | "reviews"
    | "guides"
    | "targets"
  fromNodeId: string
  toNodeId: string
  createdAt: string
  metadata?: Record<string, unknown>
}
```

这样就可以通过一次操作表达：

```text
R spawned-from P
R reviews C
C requested R
```

而不用假装父子关系本身就足以描述真实的工作流。

## 9. 捕获清单

检查点应当记录实际捕获了什么，而不仅仅是检查点存在。

```ts
type CaptureManifest = {
  fidelity: ContextFidelity
  sessionRecord?: ResourceRef
  visibleMessages?: ResourceRef
  compiledContextPacket?: ResourceRef
  toolEvents?: ResourceRef
  recap?: string
  phase?: string
  treePosition: TreePosition
  promptAssemblyRecipe?: ResourceRef
  transformLayers?: string[]
  targetFidelity?: "native-current-context" | "max-raw-record"
  targetRefs?: ResourceRef[]
  environmentRefs?: ResourceRef[]
  unavailable?: string[]
}
```

清单不是模型上下文本身，而是审计记录：它说明本次 checkpoint 能恢复到什么程度，以及哪些会话记录、目标材料或环境快照可被适配器挂载/注入。

如果使用 `compiled-context-packet`，清单必须说明它是：

- `native-current-context`：复现平台当前会发送给模型的 compact/pruned/tail 结果；
- 还是 `max-raw-record`：尽可能从底层会话记录恢复更多 raw 内容。

二者不能静默混用。后者可能让派生 agent 看到 parent 当时模型并未看到的信息。

## 10. 适配器策略

Context Tree 核心应当是平台无关的。保真度由适配器提供。

每个平台适配器都应尽量提供三个后端：

1. **native-fork backend**
   ```text
   复用平台原生 fork / spawn / resume / session fork。
   ```

2. **compiled-context backend**
   ```text
   读取平台会话记录与上下文变换状态，
   按该平台 prompt assembly 语义编译专用上下文包。
   ```

3. **searchable-history backend**
   ```text
   持久化 session events / compact snapshot /关键消息，
   让派生 agent 按任务检索，而不是默认注入全量历史。
   ```

对于当前 live boundary，同平台 native fork 是强候选。对于历史节点、可审计 eval、跨平台派生、DCP/compact 控制，compiled-context 或 searchable-history backend 可能更可靠。对于 review/check/reflect，searchable-history 甚至可能比 native fork 更好，因为它更容易只召回用户约束、agent 承诺和排除项，而不是整段工具噪声。

### Codex 适配器

首选路径：

```text
原生线程/会话分叉
```

Codex 在 CLI 中暴露 `/fork`，并通过 app-server 风格的 API 暴露 `thread/fork`。当 Context Tree 控制或集成到该层时，`native-context-fork` / `native-session-fork` 是目标，具体保真度需要通过实测确认。

如果在普通 TUI 中运行，内置的 `/fork` 无法被拦截或替换，则 Context Tree 不应假设可以覆盖原生命令。它应当改为提供：

- 用于 `ctree.where/checkpoint/spawnFrom` 的 MCP/工具原语；
- 尽可能在会话/子智能体启动时捕获的 hooks；
- 用于工作流阶段边界的 skill/command 包装器。

### Claude Code 适配器

Claude 风格的子智能体可能不会继承完整的对话历史。除非原生 resume/fork API 证明可行，否则将它们视为独立执行。

降级路径：

```text
获取平台暴露的完整会话记录
将会话记录挂载或按平台允许的方式注入到派生智能体
明确告知派生智能体：这可能是会话记录重放，不等于原模型上下文
```

### OpenCode 适配器

在可用的地方使用 commands/plugins/subtask 执行。优先考虑插件级别的集成，用于：

- 当前会话注册；
- 命令触发的 checkpoint/spawn；
- 挂载的会话记录/资源注入；
- 向智能体暴露树位置。

### Trellis / CCG / Superpowers 集成

这些不是核心，但它们是良好的集成目标，因为它们有明确的工作流阶段边界。

Context Tree 应当包装或扩展阶段转换，例如：

```text
在 writing-plans 之前
在实施执行之前
在最终审查之前
```

集成应当调用 Context Tree 原语，而不是将 Context Tree 变成 Trellis/CCG。

## 11. 派生协议

被派生的智能体应当收到一个明确说明保真度的协议。

当原生分叉不可用时，强降级方案的示例：

```md
你是由 Context Tree 派生的。

基上下文节点：<P>
请求节点：<C>
目标节点：<C>
保真度：session-record-mounted

在回答之前，按以下顺序读取挂载的上下文资源：
1. 平台会话记录 / transcript
2. 工具调用与工具结果事件
3. compact/recap/title 等平台暴露信息
4. 当前树位置与分叉原因
5. 被审查或指导的目标材料

不要将下面的简短 prompt 视为完整上下文；也不要把挂载的会话记录声称为原模型上下文。它只是尽力恢复材料和任务入口。
```

简短 prompt 不是交接内容，而是指向挂载的完整上下文的索引。

如果保真度仅为 `summary-only`，则应当告知被派生的智能体这是降级模式，不应声称已从完整先前上下文中进行了审查。

## 12. 分支时机规则

v0 应支持 agent 在以下候选边界显式声明 checkpoint / fork：

### 最重要的首个候选点

```text
design-complete -> before-implementation-plan
```

理由：此时上游设计上下文仍相对稳定，审查者/规划者的独立性最有价值。但是否创建 checkpoint 应由当前 agent 根据现场状态声明，而不是 Context Tree 后台自动决定。

### 可选的后续候选点

```text
implementation-plan-complete -> before-execution
major-decision-made -> before-continuation
implementation-complete -> before-final-review
compact-imminent -> before-context-loss
agent-declared-branch-point -> anytime
manual-user-request -> anytime
```

自动语义分支建议不在 v0 范围内。v0 关注 agent 在明确流程边界附近通过工具显式声明分叉点。

## 13. 成功标准

Context Tree 成功的证明是其能够展示：

1. **保真度**：派生的智能体能够获得平台能提供的最强上下文连续性；若只是会话记录挂载或摘要，必须明确标注。
2. **时机**：agent 在下一阶段污染上下文之前声明 checkpoint / fork 候选。
3. **树感知**：智能体能够知道当前节点、基节点、请求节点和目标节点。
4. **更好的审查/规划**：分叉的审查者/规划者发现了线性延续所遗漏的问题或指导。
5. **低 UX 摩擦**：用户无需退出智能体 UI 即可触发主要流程。
6. **诚实的降级**：降级模式是可见的，不会被宣传为完整的上下文分叉。

## 14. 开放的设计问题

1. Codex / Claude Code / OpenCode 的原生 fork/resume/subagent 到底保留了哪些模型可见上下文？
2. 哪些平台暴露完整会话记录、工具调用和工具结果？这些记录能否重新注入为模型上下文，还是只能挂载查阅？
3. Codex 内置的 `/fork` 是否只能通过 app-server/client 控制来包装，还是也可以通过 plugin/skill 层面？
4. 智能体知道其当前树节点位置的最小可靠方式是什么？
5. 当前 agent 如何可靠声明“这里是 checkpoint / 可分叉点”，而不依赖不可靠的自动 branch suggestion？
6. 什么证据能够证明，对于本项目的工作流，真实上下文分叉优于手动"打开新聊天 + 粘贴摘要"？

## 15. 当前架构立场

下一个设计应当优化这条路径：

```text
当前 agent 判断这里是 checkpoint / 可分叉点
→ Context Tree 记录当前会话引用和树位置
→ 选择上游基节点
→ 根据任务选择 native fork / platform prune / searchable history / staged docs 等材料路径
→ 记录 materialSelectionMode、fidelity 和 known losses
→ 派生的智能体审查/指导目标
→ 结果附加到树中
→ 当前 agent 决定如何继续
```

任何仅产生简短摘要/任务包的东西都是兼容性兜底，不是核心产品。当前阶段需要先跑通实现链路，并把 native fork 与 `context-mode` 风格 searchable history 都作为候选材料路径记录和比较。
