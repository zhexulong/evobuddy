# Context-bearing Team Member 设计：从 checkpoint reviewer 到按职责复用的 consultant

## 0. 当前修正

本设计修正 `checkpoint-derived helper` 的过窄表述。

Context Tree 不应只被理解为：

```text
从 parentSession 的某个 checkpoint fork 一个 reviewer
```

这仍然是基础场景，尤其适合 oracle / spec review / design review。但经过 Magic Context、Claude Agent Teams、Trellis/CCG、`llm-context-viz` 和当前 native spawn proof 的讨论，产品定位应更接近：

```text
按需激活的 context-bearing team member / consultant
```

也就是说，一个 agent 团队里可以有相对固定职责的成员：skill designer、hook implementer、live-eval checker、architecture reviewer、plan critic、debugger。它们不一定一直 active，也不一定必须是同一个 runtime session；但每次被调用时，都应尽可能获得该职责最需要的上下文，并在反复调用中积累更贴近用户和项目的判断。

这里的重点不是把 Context Tree 缩成一个后台 ledger。**team member 本身就是用户可感知的产品主体**：用户应该能理解、指定、继续使用并纠正某个稳定 member。ledger / evidence / material path 的作用，是保证这个 member 不只是一个名字或一段 profile prompt，而是真的在每次任务中带上正确上下文、留下可审计记录，并把结果回到主 agent。

所以产品边界应写成：

```text
用户价值主体：可复用的 context-bearing team member
工程支撑底座：MemberTaskRun + context sources + material path + result return
```

roster、org chart、task UI、memory 都可以增强这个主体，但它们单独只能证明“有 agents / coworkers / memory”，不能证明“这个 member 这次为什么能代表过去那个更懂本职责的成员做判断”。

核心目标从“复制 parent session”扩展为：

```text
当主 agent 需要某类专业判断、审查、规划、检查或其它专门产出时，能够激活一个对应职责的 member；
该 consultant 获得任务相关上下文、角色长期上下文、项目约束和目标材料；
consultant 的结果回到主 agent，并留下可审计的材料路径和 known losses。
```

这里的 `consultant` 是产品解释用词，不应被写死成 API 的唯一动作。更准确的产品语义是：

```text
native runtime delegates task to memberName
```

这次任务可以是 `consult`、`review`、`check`、`plan`、`reflect`、`guide`、`diagnose`，也可以是后续扩展出来的其它 action。`consult` 只是 task kind 之一，不是 member 的本体。

这里应优先使用 `memberName`，而不是 `memberId`。原因是 member 对 agent 和用户来说首先是一个可理解、可复用的职责身份，例如 `skill-designer`、`live-eval-checker`、`architecture-reviewer`。`memberId` 如果存在，应只是内部存储的不可变 surrogate key，用于处理重命名、迁移或跨 workspace 合并；它不应该成为 agent-facing API 的主要参数。

注意：`activateMember` 不应作为核心 agent-facing primitive。我们是 subagent-native 模式，实际执行应由宿主 runtime 的 subagent / teammate / fork / SendMessage 完成。Context Tree 记录的是“某个 member 接收并完成了一次任务”的事实，而不是拥有一个独立的 spawn runtime。

## 1. 为什么还需要 boundary / activation point

之前使用 `boundary` 容易误解成：

```text
只能在 parentSession 的阶段边界 checkpoint
```

这个理解太窄。更准确的概念是 **activation point**：一次需要另一个职责 agent 介入的稳定调用点。

保留这个概念仍然必要，原因不是 workflow 仪式，而是工程约束：

1. **上下文需要锚点**：consultant 到底基于哪个时刻的主 agent 意图、用户约束、目标 artifact 和历史状态判断，必须可追踪。
2. **结果需要回流位置**：consultant 的输出要回到哪个主 agent turn / task / plan，不能只是散落的文件。
3. **材料选择需要可解释**：用了 native fork、session history、role memory、staged docs、Magic Context search 还是 summary，必须绑定到一次具体调用。
4. **避免 mid-turn moving target**：没有稳定 activation point，context materializer 会在主 agent 继续行动时读到不断变化的状态，难以证明 consultant 看见了什么。

所以文档里可以继续说 boundary，但产品语义应改成：

```text
boundary = activation point / 工作交接点 / 职责调用点
```

它可以发生在：

- design -> implementation plan 前；
- implementation plan -> code 前；
- eval failure 后；
- 写 skill / hook / eval / docs 中任一专业任务启动时；
- 用户要求“让那个更懂 skill 的 agent 看一下”时；
- 主 agent 判断另一个职责 member 可能阻止、修改、收窄或重排下一步时。

它不要求一定有 parent checkpoint。parent session 只是最常见的上下文来源之一。

## 1.1 `parent` 需要拆成三种关系

当前产品已经不适合继续用单一 `parent` 表达所有关系。至少需要拆开：

1. **runtime parent / spawning run**：一次运行从另一次运行、session、checkpoint 或 message boundary 派生。这是上下文继承关系。
2. **work-product upstream**：architecture -> design -> implementation -> eval 这类工作产物依赖关系。这是任务/产物关系。
3. **role / authority upstream**：architect 约束 designer，designer 约束 implementer，checker 约束 release decision。这是职责和判断权关系。

原来的“design 是 implement 的 parent”通常说的是第 2 或第 3 种，不一定是第 1 种。只有第 1 种才意味着同一 role/session 的上下文继承。为了避免混淆，后续文档应优先使用：

```text
activationPoint
member
task.kind
contextSources
runtimeParent / spawningRun
upstreamArtifact
roleHistory
resultReturn
```

如果继续保留 `tree` 这个历史名称，应把 tree 限定为 run lineage / context source lineage，而不是完整产品模型。

## 2. Team member 不是同一个 session，而是可复用职责上下文

“固定某个人做某类事情”的关键，不在于 runtime 必须保持同一个 agent session 永远活着，而在于每次调用时能恢复这个 member 的职责上下文。

例如 `skill-designer` member 应该逐步知道：

- 用户对 skill 的触发条件、规则/skill 分离、不可取代意义的要求；
- Superpowers `writing-skills` 的实际规范；
- 哪些写法被用户否定过，例如抽象 description、把 contract 当默认阅读材料、把 helper 写成 helper function；
- 当前 repo 中 skill 文件和 eval 场景的约束；
- 之前成功或失败的 skill review 证据。

下一次再写 skill 时，不一定要恢复同一个 session，但必须让新的 `skill-designer` consultant 拿到这些职责上下文。否则它只是 fresh subagent，不是 team member。

因此 member 的可复用性来自四层材料：

1. **Role profile**：职责、标准、偏好、禁止事项、示例。
2. **Role history**：这个职责上过去的用户纠正、失败路径、成功输出、review 结论。
3. **Invocation context**：本次主 agent / requester 的当前目标、约束、最近讨论。
4. **Target materials**：本次要审查或生成的文件、diff、plan、eval report。

parentSession-derived context 是第 3 层的一种强路径，不是全部。

## 3. 和 Claude Agent Teams 的关系

Claude Agent Teams 的启发是：

```text
lead agent 负责协调；
teammates 负责各自任务；
共享 task/mailbox；
用户可以控制 agent team。
```

Context Tree 的差异是：

```text
team member 不一定常驻 active；
member 可以按需被 rehydrate / spawn / fork；
member 的上下文来源必须可记录 fidelity；
member 的长期职责上下文可以独立于某一次 parent session。
```

因此更准确的类比是：

```text
on-demand consultant team
```

主 agent 不需要知道所有实现细节，只需要能说：

```text
请 skill-designer member 根据当前要求和它过去学到的 skill 规范，写/审查这个 skill。
```

系统需要做的是为这个 member 准备任务有效材料，并让结果回到主 agent。

## 4. Magic Context / Dreams 能借鉴什么

Magic Context 不是我们的主产品依赖，但它证明了一个关键工程方向：

```text
上下文管理最好发生在 runtime message/system transform 层，
而不是事后读 transcript 再手工拼 prompt。
```

可借鉴点：

- tag message / tool output；
- agent-driven `ctx_reduce`；
- protected tail；
- historian compartment；
- `ctx_search` / `ctx_expand`；
- cache-aware deferred mutation；
- 区分 primary session 和 subagent session；
- 把 raw session history 留在可恢复/可展开层，而不是默认全塞进模型窗口。

但它不能直接替代本产品：

- Magic Context 主目标是长期主会话 continuity，不是 member task run / result return。
- 它对 subagent 默认是 reduced guidance，不是给任意业务 reviewer 继承 parent/member 上下文。
- Dreams 是异步记忆整理，适合优化 role history / user profile，不适合实时决定本次 consultant 应看什么。

正确关系应是：

```text
Magic Context / Dreams = 可选 context material backend / role-memory optimizer
Context Tree = consultant activation、lineage、material-path evidence、result return
```

## 5. `llm-context-viz` 能借鉴什么

`ref/llm-context-viz` 不是产品 assembler。它的价值在观测和 eval。

它有两类能力：

1. **JSONL pipeline**：扫描 Claude / Codex / OpenCode / Pi / OpenClaw 会话记录，按 turn 估算 token、分类 system/tool/user/assistant/subagent。这适合离线分析，不等于真实模型请求。
2. **calibration proxy**：通过代理/base-url 捕获真实 provider request/response。这更接近“模型实际看到了什么”，适合强 e2e proof。

可借鉴点：

- session parser / turn grouping；
- context category taxonomy；
- compaction reset detection；
- active session monitor；
- provider request capture 作为 eval 证据；
- 可视化帮助判断上下文污染和 material path 差异。

不建议直接依赖或复制代码：

- 它是 AGPL-3.0；
- 它偏可视化/分析工具；
- 离线估算路径不能作为产品上下文真实性来源。

更合理的是自己实现最小观测接口，并把 `llm-context-viz` 作为参考 repo 保留在 `ref/llm-context-viz`。

## 6. 推荐产品模型

### 6.1 TeamMemberProfile

```ts
type TeamMemberProfile = {
  name: string
  id?: string
  aliases?: string[]
  role: string
  description: string
  responsibilities: string[]
  standardsRefs: string[]
  roleMemoryRefs: string[]
  exampleRefs?: string[]
  knownBadPatterns?: string[]
  activationHints?: string[]
}
```

Profile 不等于普通 markdown 文档库。它是 member rehydration 的索引：告诉系统和 agent 这个 member 的职责上下文从哪里来。

`name` 是 agent-facing canonical handle，建议使用稳定 slug，例如 `skill-designer`。`id` 只在实现需要不可变数据库键时出现。若 member 重命名，应通过 `aliases` 或 registry migration 保持旧 activation 可解析，而不是要求 agent 记住 opaque id。

### 6.1.1 Member name 与路由规则

这里应参考 Claude Code 的 subagent / agent team 方案：

- 可复用职责由 subagent definition 定义，而不是写进临时 team config。
- definition 的 `name` 是唯一标识，使用 lowercase letters and hyphens；文件名不一定匹配。
- definition 的 `description` 描述“什么时候应该委派给这个 agent”，Claude 用它做自动路由判断。
- agent team 中运行中的 teammate 由 lead 分配一个 name；team config 记录 `name`、agent ID、agent type。
- 如果用户希望后续能稳定引用某个 teammate，应在 spawn 指令中明确告诉 lead 叫什么。

Context Tree 应采用同样分层：

```ts
type TeamMemberProfile = {
  name: string              // agent-facing canonical handle, e.g. "skill-designer"
  description: string       // routing description: when to activate this member
  id?: string               // internal immutable storage key, not normally shown to agent
  aliases?: string[]        // old names or user aliases
  role: string
  responsibilities: string[]
  activationHints?: string[]
  negativeActivationHints?: string[]
  standardsRefs: string[]
  roleMemoryRefs: string[]
  knownBadPatterns?: string[]
}
```

命名规则：

1. `name` 用稳定 kebab-case slug，只包含小写字母、数字和 hyphen。
2. `name` 应表达职责，不表达一次任务或临时动作。用 `skill-designer`，不要用 `review-current-skill`。
3. `name` 不应包含 runtime 状态、日期、session、checkpoint、模型名或用户临时目标。
4. 同一 registry scope 内 `name` 必须唯一；如果不同 scope 同名，应有明确优先级。
5. 重命名是 registry migration，不是直接改历史记录；旧名进入 `aliases`。

路由规则：

1. 首选显式调用：用户或主 agent 指定 `memberName` 时，直接解析该 member。
2. 自动选择时，使用 `description`、`responsibilities`、`activationHints`、`negativeActivationHints` 与当前 task 匹配。
3. `description` 必须写成触发语义，而不是抽象能力广告。例如：`Use when writing or reviewing Context Tree skills, especially trigger rules, rule/skill separation, and Superpowers compatibility.`
4. 如果两个 member 都匹配，优先选择更具体的 member；仍不确定时让主 agent 说明候选和理由，而不是静默随机选择。
5. 如果任务需要并行独立视角，可以激活多个 member；如果任务是顺序依赖或同文件高冲突，优先单 member 或 subagent。
6. 如果没有明确匹配，不应为了使用系统而强行激活 member。

运行时实例需要单独记录：

```ts
type MemberRuntimeInstance = {
  memberName: string
  resolvedMemberId?: string
  runtimeAgentId?: string
  runtimeAgentType?: string
  memberTaskRunId: string
}
```

这对应 Claude 的 `name + agent ID + agent type`：`memberName` 是人和 agent 可引用的职责名，`runtimeAgentId` 是某次实际 spawned/resumed agent 的实例标识，不能互相替代。

### 6.2 MemberTaskRun

```ts
type MemberTaskRun = {
  id: string
  memberName: string
  resolvedMemberId?: string
  requesterRef: string
  activationPoint: {
    createdAt: string
    sessionRef?: string
    turnId?: string
    messageId?: string
    checkpointId?: string
    taskRef?: string
  }
  task: {
    kind: "consult" | "review" | "check" | "plan" | "reflect" | "guide" | "diagnose" | string
    question: string
    targetRefs: string[]
  }
  contextSources: ContextSourceRef[]
  materialSelectionMode: string
  fidelity: string
  evidenceRefs: EvidenceRef[]
  knownLosses: string[]
}
```

`activationPoint` 取代之前狭义的 boundary。它可以绑定 parent session，也可以绑定一个 task artifact、role profile 更新、eval failure、用户消息或 checkpoint。

这个结构不应命名为 `MemberActivation`，因为重点不是“激活”这个动作，而是“某个 member 承接了一次有边界、有上下文来源、有结果回流的任务”。`MemberTaskRun` 更接近要表达的业务事实：一次 member task 的运行记录。

它也刻意不命名为 `ConsultRequest` 或 `ReviewRun`，因为同一个 member 可以被调用来做不同动作。例如 `skill-designer` 可以被调用来：

- `consult`：判断某个 skill 思路是否成立；
- `review`：审查现有 `SKILL.md` 是否满足规则；
- `plan`：写实现计划；
- `diagnose`：定位为什么某个 skill 在真实 agent 流程中没有触发。

这些都是同一个 member 的不同 task run，不应在 UI 或 schema 上表现为四个不同的人。

### 6.3 ContextSourceRef

```ts
type ContextSourceRef =
  | { kind: "parent-session"; sessionRef: string; anchor?: object }
  | { kind: "member-profile"; memberName: string; profileRef: string }
  | { kind: "role-history"; memberName: string; historyRef: string }
  | { kind: "project-memory"; memoryRef: string }
  | { kind: "target-material"; targetRef: string }
  | { kind: "runtime-native-fork"; runtimeRef: string }
  | { kind: "searchable-history"; searchRef: string }
  | { kind: "staged-docs"; docsRef: string }
```

这比 `parentSession` 更准确：parent session 是 source，不是产品本体。

### 6.4 Materializer

Materializer 的职责不是手写总结，而是选择和记录材料路径：

```text
consultant role + activation task + source refs
→ runtime-native fork if available and useful
→ Magic-Context-style fork/prune if runtime transform layer available
→ role memory / searchable history / staged docs supplement
→ consultant initial context / tools / search handles
→ activation manifest with fidelity and known losses
```

它应遵循：

- 对当前任务最高有效，而不是历史最多；
- 优先复用 runtime 自己的 prompt assembly / DCP / prune；
- 不把 full transcript 默认塞给 consultant；
- 允许 consultant 自己通过 search/expand 拉取较早历史；
- 记录哪些材料实际 model-visible，哪些只是 mounted/searchable。

### 6.5 内部完整 graph 与用户可折叠投影

系统内部应该保留一个完整 graph，而不是只存扁平 activation 记录。这个 graph 至少包含四类边：

1. **member identity edge**：多个 activation 属于同一个 member。
2. **runtime lineage edge**：某次 activation 是否从某个 session/checkpoint/message boundary 派生。
3. **context source edge**：本次 activation 使用了哪些 role history、project memory、target material、searchable history 或 staged docs。
4. **result return edge**：输出回到了哪个主 agent turn、task、artifact 或 eval runner。

但 UI/人类呈现不应默认暴露所有边。默认视图应该是 member-centric：

```text
Skill Designer
  - 上次用于：context-tree skill 规则修正
  - 当前可用：consult / review / plan / diagnose
  - 最近纠正：description 要 symptom-driven；contract 只在调用 writeback 时读取
  - 本次 activation：review docs/skills/context-tree-use-checkpoint/SKILL.md
```

上下文继承、source refs、fidelity、known losses、provider evidence 应作为可展开 provenance / evidence 层，而不是默认把每个上下文来源呈现成一个新的 member。对用户来说，“同一个 member 反复做同类事情并变得更懂”是稳定对象；对系统来说，每次 activation 的材料路径和继承关系仍然完整可审计。

## 7. 三种实现方案

### A. 继续 checkpoint-derived helper only

优点：实现最窄，当前 manifest/eval 已经接近。

缺点：会把产品锁死在 parentSession/reviewer 场景，无法解释 skill-designer、hook-implementer、live-eval-checker 这类“固定职责成员”的复用价值。

结论：保留为 V0 子集，但不应作为最终定位。

### B. Context-bearing team member，checkpoint 是一种 activation source

优点：覆盖 parent-derived oracle，也覆盖长期职责 consultant。能解释“同一个人反复做同类任务所以越来越懂”的产品价值，同时不要求 runtime 真有永活 agent。

缺点：数据模型要新增 member/profile/activation/source refs，implementation plan 需要从 checkpoint-only 扩展。

结论：推荐方向。

### C. 直接依赖 Magic Context / Dreams

优点：长期记忆、压缩、召回能力强。

缺点：产品语义会被降级成 memory plugin；无法保证 consultant activation、职责复用、结果回流和 material-path evidence；跨 Codex / Claude / OpenCode 的主线也会受限。

结论：只作为可选 backend，不作为主依赖。

## 8. 设计结论

Context Tree 的下一版定位应是：

```text
一个让主 agent 按需激活 context-bearing team member 的层。

它不替代 agent runtime，不替代 Magic Context，不替代 Trellis 文档树。
它负责把“谁来做这个专业判断、它应该带哪些职责上下文、从哪里获得本次任务上下文、结果回到哪里”变成可调用、可复用、可审计的机制。
```

因此，后续实现应从 `checkpoint-derived agent` 扩展为：

1. member/profile registry；
2. activation manifest；
3. source refs；
4. material path evidence；
5. result return；
6. role-memory update hook；
7. provider/log/proxy 观测用于 eval。

V0 可以仍然先跑 `reviewer from parent checkpoint`，但文档和 schema 不应再把它写成唯一模型。
