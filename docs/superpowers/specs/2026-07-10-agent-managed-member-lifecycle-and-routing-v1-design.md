# Agent-Managed Member Lifecycle 与 Routing V1 设计

## 0. 结论

Context Tree 的下一条产品主线不是让用户离开现有 agent，到 Context Tree TUI 中完成任务；也不是要求用户每次显式说“让某个 member 审查”。

V1 应收敛为：

```text
给现有 agent 一套可执行的 member/team lifecycle layer。
```

用户仍在 Codex、OpenCode、Claude Code 等正常 agent 会话中工作。Context Tree 提供：

- agent 可读取的 member roster 与 routing profile；
- agent 可执行的 member 创建/更新/删除/调用流程；
- plan-time member review point contract；
- execution-time member activation 与 returned-to-parent result；
- Workbench/TUI 作为审计、管理和辅助确认界面。

主路径是：

```text
agent 在正常任务中发现需要 member
  -> 搜索/读取现有 members
  -> 必要时向用户提出 member lifecycle action
  -> 用户在当前 agent 会话中确认
  -> Context Tree host apply mutation
  -> agent 在 plan 或 execution 中调用 member
  -> member answer 返回 parent agent
  -> Workbench 展示 roster / tasks / memory / trace
```

这使 Context Tree 更接近“现有 agent 的专家团队层”，而不是另一个 agent shell。

## 1. 目标

### 1.1 用户体验目标

用户应能形成这样的预期：

```text
我继续在平时用的 agent 里工作。
agent 会知道有哪些可复用专家。
agent 写计划时会说明哪些步骤需要哪个专家审查。
执行到对应步骤时，agent 会调用专家并拿回结果。
如果缺少合适专家，agent 会提议创建或更新，而不是静默乱建。
Workbench 可以让我查看、编辑、确认和审计这些专家与任务。
```

示例：

```text
用户：完成这个 skill 设计 plan。

agent：我会先写 implementation plan。这里涉及 skill trigger / description，
我会在实现前安排 skill-designer 审查触发条件和 rule/skill 分离。

计划中出现：
Review point: skill-designer reviews SKILL.md trigger wording before Task 2 implementation.

执行到 Task 2 前：
agent 调用 skill-designer，收到审查结果，把 blocker 反馈给用户并修正 plan。
```

### 1.2 工程目标

1. **Agent-managed lifecycle**：member 的创建、确认、更新、删除、禁用可以由 agent 在当前会话中发起，但必须有用户确认或 host-applied authority。
2. **Routing profile**：每个 member 有可被 agent 使用的职责、触发症状、反触发条件、输入材料和输出要求。
3. **Plan review points**：agent 写 plan 时能声明哪些步骤需要 member 审查，后续执行必须可追踪 fulfilled / missing / skipped。
4. **Execution activation**：执行到 review point 或 agent 主动判断需要 member 时，调用 explicit member activation 或 runtime subagent path。
5. **Returned result**：member answer 必须回到 parent agent，Workbench/文件存在不能替代 result return。
6. **TUI as secondary surface**：Workbench/TUI 支持管理和审计，但不是完成普通任务的主入口。
7. **Parallelizable delivery**：routing、plan review point、activation、Workbench 管理面可以并行实现，但共享同一组 contracts。

## 2. 非目标

1. 不把 Context Tree 做成新的统一 agent UI。
2. 不要求用户在 TUI 中启动、确认或完成每个任务。
3. 不要求用户每次显式点名 member。
4. 不依赖模型自然选择 native spawn 作为 V1 成功条件。
5. 不允许 agent 凭普通猜测直接创建 default Expert 或 durable memory。
6. 不把 plan 里写了 review point 当作 review 已经发生。
7. 不把 Workbench 展示、文件落盘、fixture 或 retained artifact 当作 parent-agent result return。
8. 不把 TUI 的编辑能力变成唯一管理入口；agent 会话中的确认流程必须同等一等。

## 3. 核心产品对象

### 3.1 Member Routing Profile

`Member Routing Profile` 是 agent 判断何时调用 member 的产品 contract。它从 `TeamMemberProfile` 派生，但面向 parent agent 使用。

字段建议：

```text
memberName
displayName
role
triggerSymptoms
antiTriggers
requiredInputs
outputContract
blockingPolicy
reviewPointTemplates
examples
status
version
evidenceRefs
```

示例：

```yaml
memberName: skill-designer
role: Skill workflow and trigger design reviewer
triggerSymptoms:
  - writing or editing SKILL.md descriptions
  - designing trigger rules for agent skills
  - separating global rules from skill-local workflow
  - referencing Superpowers skill conventions
  - avoiding controller-only assumptions in agent-facing text
antiTriggers:
  - typo-only edits
  - pure formatting changes
  - unrelated runtime adapter changes
requiredInputs:
  - proposed SKILL.md or plan section
  - relevant skill rules or references
  - user constraints that triggered the change
outputContract:
  - blocking findings first
  - concrete rewrite suggestions
  - say when no review is needed
blockingPolicy: important-findings-block-implementation
```

Routing profile 不应包含本次 task materials。它描述“什么时候应该找这个 member”，不是本次调用内容。

### 3.2 Member Lifecycle Action

agent 管理 member 时不直接改 durable state，而是提出 lifecycle action。

类型：

```text
propose-create-member
propose-confirm-candidate
propose-update-routing
propose-disable-member
propose-delete-member
propose-merge-members
propose-promote-memory
propose-reject-candidate
```

每个 action 必须包含：

```text
actionId
kind
memberName
reason
proposedChange
sourceEvidenceRefs
userConfirmationRequired
hostApplyStatus
mutationRef
```

### 3.3 Plan Review Point

`Plan Review Point` 是 agent 写计划时留下的 member 审查义务。它不是 eval artifact，也不是立即执行。

字段建议：

```text
reviewPointId
memberName
scope
when
why
requiredInputs
blockingPolicy
status: planned | ready | invoked | returned | applied | skipped | blocked | missing
memberTaskRunRef
resultSummary
skipReason
```

示例：

```markdown
Review point: skill-designer
- When: before implementing Task 2 skill trigger wording
- Why: this plan changes SKILL.md trigger semantics and Superpowers compatibility
- Inputs: draft SKILL.md, context-tree-skill-rules.md, relevant Superpowers writing-skills reference
- Blocking: Important findings must be resolved before implementation proceeds
- Evidence: MemberTaskRun returnedTo parent-agent and linked in Workbench trace
```

### 3.4 Member Activation Request

执行时由 agent 或 runtime adapter 创建。

字段建议：

```text
activationId
memberName
requesterRef
source: plan-review-point | agent-natural-trigger | user-explicit | workbench-action
taskQuestion
targetRefs
contextRenderRef
memberInvocationPacketRef
expectedReturn
writebackRefs
```

### 3.5 Workbench Management Surface

Workbench/TUI 是辅助面，支持：

- 查看 members、profiles、routing、status；
- 查看 lifecycle action queue；
- 确认/拒绝/编辑 candidate；
- 查看 plan review points fulfilled 状态；
- 查看 MemberTaskRun、result、used context、trace；
- 编辑 profile/routing/memory，但产生同样的 host-applied mutation record。

Workbench 不拥有普通任务执行流程。它可以发起管理操作，但不替代 agent 会话中的确认。

## 4. 系统边界

### 4.1 Agent 是主工作入口

用户继续在现有 agent 中描述任务、审查 plan、确认修改和接收 member answer。

Context Tree 提供工具/API/CLI/MCP-like entrypoints，供 agent 调用：

```text
listMembers
searchMembers
getMemberRoutingProfile
proposeMemberLifecycleAction
applyConfirmedMemberAction
recordPlanReviewPoints
activateMember
recordMemberTaskRun
listMemberTasks
```

名字可调整，但语义应保持：agent 能发现、提议、确认后应用、调用、记录。

这里的 entrypoint 名称不是用户体验契约。实际产品入口应映射到宿主 runtime 已有的可见机制：Claude Code 可以是 subagent definition、runtime command surface 或 natural-language instruction，OpenCode 可以是 command/plugin/Task tool，Codex 可以是 skill、app-server 或 collab surface。Context Tree 只定义语义：当前 agent 能看见 roster、触发 discovery/status、调用 member、把结果拿回 parent conversation。不要把某个固定命令拼写写成跨 runtime 的核心契约。

### 4.1.1 Agent-visible trigger surface

Member discovery、member dream、routing diagnose、member import 都必须有用户可见的触发面。它可以是：

- 用户在当前 agent 会话中自然语言请求；
- runtime-specific command surface，例如某些 runtime 的 slash command 或 plugin action；
- installed skill 或 agent definition 中的 routing instruction；
- 用户启用的 session-boundary / threshold / scheduled trigger；
- Workbench 中的显式管理动作。

这些触发面必须回到同一个产品语义：由用户选择在哪个 runtime/agent 中启用，由当前 agent 执行或调解，并把状态摘要返回给用户。隐藏的 Context Tree background worker 不能作为 V1 主路径，也不能静默创建 durable member、active memory 或 default Expert。

Discovery / dream / cold-start 不应该默认由当前讨论中的 parent agent 亲自执行。当前 agent 可以发现需要 refresh/discovery，向用户说明原因，然后通过 runtime 启动一个独立的 maintenance subagent / member run 来读取历史、ledger 和 event stream。这个派生 run 返回候选、manifest、诊断和简短摘要；parent agent 再决定是否展示、应用或继续询问用户。这一点和 member activation 类似：当前 agent 发起并接收结果，但 heavy context work 由专门的派生 member/subagent 承担。某些 runtime 会把这个派生 run 存成 child session，但 session 是实现细节，不是产品概念。

“可见触发来源”指 parent agent 或用户能解释“为什么现在跑这件事”的来源，例如：用户直接说“刷新一下 members”；某个 runtime action 表示“run member discovery”；plan 完成时 skill/agent definition 提醒需要 dream；未读 project events 超过阈值；Workbench 中用户点击 import/refresh；或一次 natural-use failure 需要诊断为什么没有调用 member。

触发后，agent 至少应能报告：

```text
trigger kind
runtime/source
requesting parent session
execution maintenance/member run
scanned watermark or coverage
candidate/member changes
whether anything became active
next action needed from user or agent
```

具体命令名由 adapter 决定。设计和 eval 应验证这些语义是否成立，而不是验证某个命令字符串是否存在。

### 4.2 Host Apply 是 durable mutation 边界

agent 可以生成提议，但 durable mutation 由 Context Tree host apply。

允许直接 host apply 的情况：

- 用户在当前 agent 会话明确确认；
- 用户在 Workbench 明确确认；
- import/migration 带明确来源和操作者；
- policy 允许的低风险非 durable 更新，例如 transient review point status。

禁止直接 host apply 的情况：

- agent 看到一次普通反馈就写 durable memory；
- agent 从 docs topic 猜出新 member 并设为 default Expert；
- agent 未展示 proposed change 就修改 routing；
- failed eval artifact 自动变成 member memory。

### 4.3 TUI 是 secondary surface

Workbench 可以管理 member，但不是唯一管理入口。

产品成功条件不能要求用户打开 TUI 才能：

- 确认创建 member；
- 接收 member answer；
- 继续 parent agent 任务；
- 完成 plan review point。

TUI 的价值是：

- 总览 team；
- 找到 run 和 trace；
- 批量管理 candidates；
- 编辑/禁用/合并；
- 作为 audit surface。

## 5. 并行实现关系

V1 可并行分成四条工作流，但必须共享 contracts。

### 5.1 Routing Profile Flow

产出：

- canonical `MemberRoutingProfile` schema；
- profile render 给 agent/runtime definitions；
- positive/negative routing examples；
- search/list/get tools。

依赖：已有 `TeamMemberProfile` 与 member registry。

不依赖：plan review point 或 Workbench 完成。

### 5.2 Plan Review Point Flow

产出：

- plan review point syntax / structured record；
- plan parser/recorder；
- fulfilled/missing/skipped 状态机；
- plan eval。

依赖：能解析 `memberName` 和 routing profile。

不依赖：真实 runtime activation 完成；可以先用 retained `MemberTaskRun` fixture 做 negative controls。

### 5.3 Execution Activation Flow

产出：

- `activateMember` product entrypoint；
- explicit member route wrapper；
- returned-to-parent result；
- `MemberTaskRun` + proof refs；
- plan review point fulfillment writeback。

依赖：已有 strict aggregate proof 和 explicit member product route。

不依赖：TUI 管理面完成。

### 5.4 Workbench Management Flow

产出：

- Experts / Tasks / Candidate Actions / Review Points / Trace views；
- confirm/reject/edit lifecycle actions；
- read-only first, mutation second。

依赖：lifecycle action record 和 roster/profile data。

不依赖：自然 agent trigger 准确率。

## 6. Agent 管理流程

### 6.1 搜索已有 member

当 agent 遇到需要专业审查或计划约束的节点时，先搜索已有 members。

输入：

```text
task description
current plan section
changed files / target refs
user constraints
```

输出：

```text
matching members
match reasons
anti-trigger notes
confidence
recommended action: use | ask-user | propose-create | no-member-needed
```

### 6.2 提议创建 member

如果没有匹配 member，agent 可以提议创建。

必须向用户展示：

- proposed `memberName`；
- role；
- trigger symptoms；
- anti-triggers；
- initial evidence；
- 是否成为 default Expert；
- 是否包含初始 memory candidate。

示例：

```text
我没有找到专门审查 skill trigger 的 member。
建议创建 skill-designer：以后负责 SKILL.md trigger、description、Superpowers 兼容性。
依据：本 workspace 中多次出现相关审查和纠正。
是否添加？我会先设为 confirmed profile，但不会把 session 摘录写入 active memory。
```

### 6.3 更新/删除/禁用 member

agent 可以提出更新：

- routing 太宽；
- anti-trigger 缺失；
- member 名称不准确；
- member 已不再使用；
- 两个 members 重叠。

用户确认后 host apply。

删除默认应软删除或 disable，保留历史 run。

### 6.4 Memory 变更

member memory 变更不走普通 lifecycle action 的直接写入路径。

agent 可以：

- 标记 feedback window；
- 通过当前 runtime 的可见触发面提议或执行 retrospective / dream / maintenance；
- 展示 retrospective candidate；
- 请求用户确认 promotion。

agent 不能：

- 直接把用户一句话写入 `member-m[0]`；
- 把未验证 candidate 作为 active baseline。

## 7. Plan Review Points

### 7.1 写计划时的行为

当 agent 写 implementation plan / design plan / migration plan 时，应检查 plan 是否触发已确认 member 的 routing profile。

触发时，plan 中应显式加入 review point。

示例：

```text
Task 2: Update SKILL.md trigger wording
Review point: skill-designer before implementation
Reason: this changes skill activation rules and user-facing agent behavior.
```

如果 agent 判断不需要 member，应能解释：

```text
No member review point added: this is a typo-only docs update and matches skill-designer anti-trigger.
```

### 7.2 执行计划时的行为

执行到 review point 前，agent 必须：

1. 收集 required inputs；
2. 调用 `activateMember`；
3. 等待 returned-to-parent answer；
4. 将 member findings 应用或解释不应用；
5. 更新 review point status。

如果不能调用，状态为 `blocked` 或 `skipped`，并写明原因。

### 7.3 Fulfillment 规则

review point fulfilled 需要满足：

- 有对应 `MemberTaskRun`；
- `memberName` 匹配；
- target/input refs 覆盖 review point required inputs；
- result returnedTo parent-agent；
- findings 被 applied、accepted、or explicitly dismissed with reason；
- Workbench trace 可追溯。

仅计划中出现 review point 不算 fulfilled。

仅生成文件或 Workbench 可见不算 fulfilled。

## 8. Natural Agent Trigger

V1 支持 agent 主动触发，但不把它作为唯一成功路径。

### 8.1 触发条件

agent 可以在普通任务中根据 routing profile 主动 consult member：

- 高风险设计决策；
- 用户反复纠正过的领域；
- plan 中遗漏但执行时发现的 member-relevant 工作；
- 需要独立 reviewer/checker/oracle 的边界；
- 实现前发现 target materials 与 member expertise 匹配。

### 8.2 反触发条件

不应触发：

- 纯机械编辑；
- 用户明确要求不要调用；
- member routing confidence 低且没有时间/风险理由；
- target materials 不足；
- 调用成本高于预期收益。

### 8.3 可解释性

agent 主动触发时应告诉用户或写入 trace：

```text
Triggered skill-designer because this task edits skill trigger semantics and matches profile triggerSymptoms[0].
```

无需把 eval taxonomy 暴露给用户。

### 8.4 Discovery / dream trigger 与 member activation 的区别

不要把“发现/维护 member”与“调用 member 完成当前任务”混成一个动作。

- **Discovery / dream trigger**：扫描 runtime session/event history、ledger、run evidence，产生 candidate、routing update、memory candidate 或诊断结论。它不直接完成当前任务，也不应自动把 candidate 变成 durable active member。
- **Member activation**：当前 parent agent 已经有一个具体任务或 review point，调用一个已知 member，并等待结果返回 parent agent。

用户可能通过同一个 runtime surface 触发两类动作，但 product record、evidence 和用户说明必须区分。比如“刷新一下这个项目的 members”是 discovery；“让 skill-designer 审查这个 plan”是 activation。

## 9. Workbench/TUI 设计边界

### 9.1 第一层信息架构

Workbench 第一层应展示工作语义：

```text
Experts
  - skill-designer
  - live-eval-checker

Tasks
  - Review SKILL.md trigger wording
  - Check live eval correction loop

Review Points
  - Planned
  - Returned
  - Missing

Selected Expert
  - profile
  - routing
  - recent tasks
  - memory candidates
```

### 9.2 管理动作

TUI 可以执行与 agent 会话相同的 lifecycle actions：

- confirm candidate；
- edit routing；
- disable member；
- reject memory candidate；
- merge duplicate members；
- view mutation log。

这些动作必须写同一类 host-applied mutation record，不能成为 TUI 私有状态。

### 9.3 Trace

Trace 仍展示：

- plan review point；
- activation request；
- parent invocation source；
- context render；
- material visibility；
- result return proof；
- proof refs；
- known losses。

## 10. Data Flow

### 10.1 Agent-managed create member

```text
agent detects missing member
  -> searchMembers returns no suitable result
  -> agent builds propose-create-member action
  -> user confirms in agent chat
  -> applyConfirmedMemberAction writes profile + routing + mutation log
  -> runtime projection generator updates definitions
  -> Workbench shows new Expert
```

### 10.2 Plan review point execution

```text
agent writes plan
  -> recordPlanReviewPoints
  -> execution reaches review point
  -> activateMember(memberName, inputs, reviewPointId)
  -> member answer returns to parent agent
  -> recordMemberTaskRun
  -> update reviewPoint status returned/applied
  -> Workbench shows task and trace
```

### 10.3 Natural trigger

```text
agent sees task matches routing profile
  -> optionally explains trigger
  -> activateMember(source=agent-natural-trigger)
  -> answer returns to parent agent
  -> run appears in Workbench
```

### 10.4 TUI management

```text
Workbench shows candidate/action
  -> user confirms/edits/rejects
  -> same host apply path
  -> agent-visible roster/profile updates on next read
```

## 11. Evidence 与审计

### 11.1 Required evidence

每次 meaningful member activation 应记录：

- `MemberActivationRequest`；
- `MemberContextRender`；
- material selection report；
- returned-to-parent evidence；
- `MemberTaskRun`；
- optional plan review point link；
- product proof refs when available。

### 11.2 Lifecycle mutation evidence

每次 member durable mutation 应记录：

- action proposal；
- user confirmation source；
- host apply result；
- before/after profile digest；
- mutation reason；
- source evidence refs。

### 11.3 状态不可混淆

必须区分：

```text
candidate vs confirmed
planned vs invoked vs returned vs applied
returnedTo parent-agent vs file/manual/eval-runner
live vs retained vs fixture
definition projection vs invocation delivery
```

## 12. 行为评估

### 12.1 Agent proposes missing member

输入：用户要求 agent 写一个 skill design plan；当前 roster 没有 `skill-designer`，但 session corpus 中有多次 skill trigger 纠正。

期望：agent 提议创建 `skill-designer`，展示 role、trigger、anti-trigger、evidence，不直接创建 default Expert。用户确认后，host apply profile。

失败信号：agent 静默创建、从 docs-only 创建、没有用户确认、把 session 原话写进 active memory。

### 12.2 Agent writes plan with review point

输入：confirmed `skill-designer` 存在；agent 写 plan，Task 2 修改 SKILL.md trigger wording。

期望：plan 包含 `skill-designer` review point，说明 when/why/inputs/blocking policy。

失败信号：计划未声明 review point；或对 typo-only change 强行添加 review point。

### 12.3 Execution fulfills review point

输入：计划包含 `skill-designer` review point；执行到 Task 2 前。

期望：agent 调用 member，member answer returnedTo parent-agent，`MemberTaskRun` 链接 review point，状态从 `planned` 变为 `returned/applied`。

失败信号：只写文件不返回 parent；只在 Workbench 出现；review point 状态 fulfilled 但没有 matching run；findings 未处理。

### 12.4 Agent natural trigger

输入：用户没有点名 member，但 task 涉及 Superpowers skill trigger 规则。

期望：agent 根据 routing profile 主动 consult `skill-designer`，或解释为何不 consult。

失败信号：agent 无理由频繁调用；低相关任务触发；高相关任务没有 review point 或 natural trigger。

### 12.5 TUI confirms candidate

输入：Workbench 显示 `skill-designer` candidate。

期望：用户在 TUI 确认后走同一 host apply mutation，agent 后续 `listMembers` 能看到 confirmed profile。

失败信号：TUI 私有状态；agent 看不到；没有 mutation log；未确认 candidate 进入 default Experts。

### 12.6 Delete/disable member

输入：用户要求删除 `skill-designer`。

期望：默认 disable/soft-delete，历史 `MemberTaskRun` 保留；routing 不再匹配 active calls；Workbench 可查看历史。

失败信号：硬删导致历史 run 不可解释；仍被自动触发；runtime projection 残留为 active member。

## 13. 实施分解建议

这份设计后续可以拆成并行 implementation plans。

### 13.1 Plan A: Member Routing + Lifecycle Actions

- `MemberRoutingProfile` schema；
- `MemberLifecycleAction` schema；
- search/list/get/propose/apply tools；
- user confirmation source model；
- mutation log；
- tests for candidate vs confirmed and no docs-only default Expert。

### 13.2 Plan B: Plan Review Points

- plan review point schema；
- recorder/parser；
- status machine；
- fulfillment validator；
- evals for planned/fulfilled/missing/skipped。

### 13.3 Plan C: Activation Product Entrypoint

- `activateMember` wrapper over existing explicit member route；
- returned-to-parent contract；
- plan review point linking；
- product proof refs；
- negative controls for file-only/Workbench-only/result-missing。

### 13.4 Plan D: Workbench Management V1

- Experts / Tasks / Review Points / Candidate Actions views；
- lifecycle action apply/reject/edit；
- trace links；
- no private TUI state。

### 13.5 Plan E: Natural Trigger Eval

- routing profile positive/negative examples；
- agent prompt/instruction pattern；
- live or retained eval showing agent adds review point or activates member without user naming it；
- guard against over-triggering。

## 14. 仍需决策的问题

1. V1 第一条真实入口优先做 OpenCode 还是 Codex？OpenCode 现在 product observed 与 session corpus proof 更完整；Codex 的 custom agent projection 仍有价值。
2. Agent-facing tools 是 MCP server、runtime plugin、skill/agent definition，还是三者共享同一 core API？CLI wrapper 如保留，应只属于 legacy/debug/eval 层。
3. 用户确认的 transcript evidence 首先支持 OpenCode DB，还是抽象成 runtime observer export？
4. Plan review point 在 markdown plan 中自由书写，还是必须同时生成结构化 sidecar artifact？
5. TUI V1 是否允许写操作，还是先只读展示 lifecycle action queue？
6. Natural trigger 是否进入 V1 acceptance gate，还是只作为 advisory eval？

## 15. 设计不变量

1. 用户主要在现有 agent 会话中工作，不被要求切到 Context Tree TUI 完成任务。
2. TUI 是辅助管理和审计面，不是唯一确认或执行入口。
3. Agent 可以管理 member，但 durable mutation 必须经过用户确认或 host-applied authority。
4. `memberName` 是稳定职责身份，不是 runtime instance 或一次性 task。
5. Routing profile 描述何时调用 member，不携带本次 task materials。
6. Plan review point 是计划义务，不是已完成审查。
7. Review point fulfilled 必须有 matching member run 和 returned-to-parent result。
8. Workbench/文件/fixture 不能替代 parent-agent result return。
9. 未确认 candidate 不能成为 default Expert。
10. Agent 不能把普通反馈直接写入 durable member memory。
11. Runtime projection 不是 invocation delivery evidence。
12. Natural trigger 可以增强体验，但 V1 主路径必须能通过 plan review point 和 explicit activation 稳定完成。
