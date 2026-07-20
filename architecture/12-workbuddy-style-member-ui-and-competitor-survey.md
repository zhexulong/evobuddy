# WorkBuddy-style member UI 与开源竞品替代性调研

## 0. 结论摘要

本轮结论可以先直接说清：

1. **应当吸收 WorkBuddy-style / coworker-style 的默认表层心智，但不应把 Context Tree 做成完整 AI workforce platform。**
2. **100+ star 开源项目里，没有一个已经完整替代 Context Tree 当前最重要的 context-bearing team member 边界；但已经有多个项目分别覆盖了 UI 层、role/profile 层、runtime 层、workspace/memory 层。**
3. **Context Tree 的最小不可替代产品边界，是一套可复用的 context-bearing team member：用户看到稳定 member，工程上则记录一次 `MemberTaskRun` 到底基于哪些 context sources、哪些材料真正进入模型或可检索、fidelity 是什么、known losses 是什么、结果如何回流主 agent。**

更具体地说：

- **UI 心智** 上，WorkBuddy、Alook、Poco、Markus、Claude Agent Teams 都证明了“用户首先看到 team/member/coworker，而不是 lineage graph”更容易理解；
- **但 provenance / fidelity / known losses** 在这些产品里基本都不是第一层产品对象，最多是 trace、playback、history、audit trail；
- 因此 Context Tree 更合适的定位不是“再做一个 AI workforce shell”，也不是“只做后台证据 ledger”，而是：

```text
context-bearing team member product
+ member-centric surface
+ context-bearing task-run evidence layer
+ host-runtime-native compatibility
```

本轮建议：

- **默认视图可以收窄为 member roster；**
- **graph/tree 只保留为可展开 provenance 层；**
- **V0 不做完整 workforce orchestration，不做完整 agent runtime，不做全能 PM/kanban/productivity suite；**
- **优先实现 member registry + MemberTaskRun record + evidence drawer + runtime adapter compatibility。**其中 member registry / roster 是用户理解和复用 specialist members 的主入口；evidence drawer 是让这些 member 可信成立的底座。

## 1. 我们当前的产品假设

根据仓库当前架构文档，Context Tree 的产品定位已经从“session tree / checkpoint fork 工具”收敛为：

```text
role-aware context graph + on-demand member task runs
```

也就是：

- 主 agent 在关键节点按需激活某个稳定职责 member；
- member 可以来自宿主 runtime 的 native subagent / teammate / fork；
- Context Tree 记录的是这次 `MemberTaskRun`：
  - activation point；
  - member identity；
  - context sources；
  - material selection mode；
  - fidelity；
  - known losses；
  - result return；
  - evidence refs。

这意味着我们真正要验证的假设不是“member roster UI 好不好看”，也不是“只要有 ledger 就够”，而是：

```text
如果把默认表层从 tree 改成 member/coworker，
会不会让用户更容易理解产品，
同时让 member 在工程上真正带有可恢复、可解释、可审计的上下文，
同时又不把 Context Tree 误导成另一个 AI workforce platform？
```

当前仓库已经给出的答案倾向于：

- **默认表层应 member-centric；**
- **完整 graph 应存在，但默认隐藏；**
- **tree 更适合作为 lineage / provenance 子图，而不是产品本体。**

这与本轮外部调研结论基本一致。

## 2. WorkBuddy / coworker UI 心智是否适合

### 2.1 适合的部分：member roster 是更自然的第一层心智

从 WorkBuddy 官方材料与相关竞品看，用户最容易理解的不是“上下文继承树”，而是：

```text
我有一组可复用的 AI coworkers / experts / agents；
我可以指派其中某个角色；
系统也可以自动挑一个合适角色；
最后给我一个完成结果。
```

这点有较强证据：

- **WorkBuddy** 官方页面直接采用 `Assistant / Experts / Skills / Connectors / Automations` 这种产品信息架构，`Experts` 明确是专家目录。[E1]
- **Alook** 把产品核心说成 “define the org chart”，UI 直接展示 org chart、email inbox、kanban、calendar。[E2]
- **Poco** 采用 persistent agents + channel collaboration + task drawer + shared files。[E3]
- **Claude Agent Teams** 采用 lead + teammates + shared task list + mailbox 的显式 team 心智。[E4]
- **Markus** 直接把自己定位成 AI workforce platform，默认界面是 dashboard / tasks / team / chat，而不是 lineage graph。[E5]

对 Context Tree 的启发是：

**用户第一眼更容易接受“这是我可复用的 specialist members 列表”，而不是“这是一个上下文树数据库”。**

### 2.2 不适合直接照搬的部分：多数 coworker 产品把“谁做了什么”讲清楚，但不把“它到底看见了什么”讲清楚

WorkBuddy-style 产品通常有：

- experts / roles / org chart；
- task queue / kanban / status；
- memory / connectors / inbox；
- artifacts / playback / history。

但它们普遍没有把以下问题做成产品主约束：

```text
这次 member task run 基于哪些源材料？
哪些真的进入模型上下文？
哪些只是可搜索或可挂载？
known losses 是什么？
与宿主 runtime 的 native subagent/fork 是什么关系？
```

这恰好就是 Context Tree 的差异点。

因此更准确的判断是：

- **适合借 member/coworker 作为默认表层；**
- **不适合照搬 “AI company / workforce platform” 作为产品本体。**

### 2.3 对题目中的 5 个重点判断

#### A. 默认 UI 是否应该是 member roster，而不是 tree / graph

**结论：应该。**

但要明确：

- 默认视图是 **member roster / member detail / task-run drawer**；
- lineage / provenance graph 仍然存在；
- graph 是 evidence layer，而不是首页。

#### B. 每个 member 是否应该有 profile、recent task runs、remembered corrections、available actions

**结论：应该。**

这是把“临时 subagent”提升为“可复用职责 member”的必要条件。

#### C. `MemberTaskRun` 是否应该以 timeline / task drawer 形式展示

**结论：应该。**

Poco 的 execution drawer、Alook 的 task/kanban、Claude Agent Teams 的 shared task list，都说明用户更容易理解“这次执行发生了什么”，而不是直接阅读原始 transcript。[E3][E4][E5]

#### D. context inheritance / provenance / fidelity / known losses 是否应该默认隐藏，只作为可展开 evidence 层

**结论：应该。**

这是本轮最重要的 UI 分层判断：

- 默认显示任务结果与 member 身份；
- 需要审计时再展开 provenance / context evidence；
- 不要把审计层压成用户第一视角。

#### E. 是否应该提供类似 team/coworker 的 direct message / continue previous member task 能力

**结论：应该提供，但不是 V0 核心闭环。**

原因：

- 用户会自然期待“继续让这个 member 看一下”；
- Claude Agent Teams、Alook、Poco 都鼓励持续 teammate identity；
- 但 Context Tree 的 V0 更重要的是把 task-run evidence 记录清楚，而不是先做一个完整 persistent chat suite。

## 3. 竞品矩阵

说明：

- stars 以 2026-07-07 当天 GitHub 页面可见数或 repo 页面显示数为准；部分为近似显示值；
- `proven / likely / unknown` 用于区分证据强度；
- “替代风险”不是指商业成功，而是指对 **Context Tree 当前边界** 的替代程度。

| 项目 | repo / URL | stars | license | 定位一句话 | 核心 UI 模型 | agent/member/team 模型 | memory/context 模型 | native coding-agent runtime | persistent member / role memory | task run evidence / replay / provenance | context source / fidelity / known losses 审计 | 对 Context Tree 替代风险 | 我们可借鉴点 | 不能替代我们的点 |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|---|
| WorkBuddy | workbuddy.ai / Tencent Cloud | N/A | closed | 面向业务工作的 AI expert workforce / workbench | Assistant + Experts + Skills + Connectors + Automations | expert roster + auto orchestration | likely: workspace + skill + connector state | unknown | likely | weak-proven: deliverable/task history, not deep provenance | unknown/weak | 中（UI 心智） | expert center、skills/connectors IA、自然语言分派 | 闭源；未证明 native runtime 旁路记录；未证明 fidelity/known losses [E1][E6][E7] |
| Claude Agent Teams | docs.anthropic.com | N/A | proprietary docs | 多 Claude 会话 team 协作 | lead + teammates + shared task list + mailbox | teammates / subagents / team lead | session-level, not role-memory-first | proven: Claude Code native | partial/proven: subagent definitions, not full productized role memory | proven: task list, mailbox, session transcripts | weak: no productized context-source/fidelity audit | 中（runtime mental model） | teammate naming、mailbox、task list、direct teammate messaging | 仅限 Claude runtime；不记录跨-runtime context evidence [E4] |
| poco-ai/poco-claw | github.com/poco-ai/poco-claw | 1.3k | MIT | Claude Code-based cloud coworker / OpenClaw alternative | channel/chat + drawer + shared files + project settings | persistent agents in servers/channels | mem0 + project defaults + uploaded files | proven: Claude Code-based；likely not Codex/OpenCode-native first | proven | proven: playback view, artifacts view, drawer | weak: playback ≠ context source/fidelity audit | 中高（UI+runtime product shell） | execution drawer、artifact grouping、persistent agent collaboration | 仍主要是 runtime shell；未证明 model-visible context provenance [E3] |
| alookai/alook | github.com/alookai/alook | 779 | Apache-2.0 | 本地 coding agents 的协作 workforce 层 | org chart + email + kanban + calendar | roles + email identities + org chart | self-learning memory, task trace | proven: Claude Code/Codex/OpenCode | likely-proven | proven: traceable instructions/decisions/replies | weak: traceability not equal to fidelity/losses | 中高（UI+orchestration） | org chart、email-native agents、BYO runtime | 更像 team OS；不是 context-bearing task-run record system [E2] |
| melandlabs/openloomi | github.com/melandlabs/openloomi | 605 | Apache-2.0 | local-first AI coworker workspace with holistic context | desktop workspace + connectors + automation | coworker/workspace, not roster-first team board | strong-proven: short/mid/long-term memory + context graph | likely: skills can integrate Claude/Codex/OpenClaw | likely | proven: auditable access, source evidence language | partial-proven: source evidence yes, fidelity/losses no | 中（memory/workspace layer） | local-first holistic context、connector graph、auditable access | 不是 host-runtime-native member task run ledger；偏 workspace memory [E8] |
| MervinPraison/PraisonAI | github.com/MervinPraison/PraisonAI | 100+ (high, exact page not fetched) | MIT | AI workforce framework + dashboard + visual flow + UI | dashboard / flow builder / claw UI / clean chat | agent teams + handoffs + external agents | memory, graph memory, sessions, compaction | proven: Claude Code/Codex/Gemini external agents | likely-proven | partial-proven: telemetry/langfuse, checkpoints | weak-partial: checkpoints exist but not native runtime context audit | 中（framework/runtime layer） | external agents support、handoff、background tasks、graph memory | 自己是大框架；不能直接回答 member task run 基于什么材料 [E9] |
| simstudioai/sim | github.com/simstudioai/sim | 100+ (high, exact page not fetched) | Apache-2.0 | build/deploy/manage AI agents and workflows workspace | chat + visual workflow builder + tables/files/knowledge/tasks | workflow/agent workspace | files + knowledge + tables + scheduled tasks | unknown for Claude Code/Codex native | unknown | likely: run logs/workflow activity | unknown/weak | 低到中（workflow UI） | visual builder、workspace surfaces、monitoring panels | 更像 workflow platform，不是 native subagent evidence layer [E10] |
| mindsdb/anton | github.com/mindsdb/anton | 100+ (high, exact page not fetched) | MIT | self-improving doing-agent / Cowork backend | Cowork app + CLI | default agent inside Cowork, not member roster first | multi-layer memory + continuous learning | unknown for native coding-agent runtime; standalone harness proven | likely | weak-partial | weak | 低到中 | outcome-first doing-agent framing、workspace memory | 更偏通用 doing agent，不是 member task provenance [E11] |
| saadnvd1/agent-os | github.com/saadnvd1/agent-os | 100+ (repo page not fetched here) | MIT | mobile-first web UI for AI coding sessions | multi-pane session manager | sessions + conductor/worker orchestration | session management, not role memory | proven: Claude Code/Codex/OpenCode/Aider/Gemini CLI | weak | weak | none | 低（UI shell） | mobile-first session UI、multi-pane、runtime compatibility matrix | 管的是 sessions，不是 members/task-run evidence [E12] |
| victordibia/autogen-ui | github.com/victordibia/autogen-ui | 100+ | likely MIT/AutoGen-adjacent (README未直接写明) | AutoGen AgentChat demo UI | simple chat UI | predefined agent team | minimal team config / history idea | no native Claude/Codex/OpenCode focus | weak | weak | none | 低 | “predefined team + simple UI” 最小样例 | 只是 demo，不是产品级替代 [E13] |
| AIOSAI/AIPass | github.com/AIOSAI/AIPass | 232 | MIT | CLI-native persistent agent workspace scaffold | no full web UI; terminal + scaffold | persistent named agents + router + mailbox | strong-proven: identity + memory + local mailbox + shared workspace | proven: Claude Code, experimental Codex | proven | partial: dispatch/history, not evidence drawer | weak: no fidelity/losses model | 中（role/profile + persistent agent infra） | identity/memory/mailbox/scaffold、use existing subscription | 强在 persistent agent infra，弱在 UI 与 context-fidelity evidence [E14] |
| markus-global/markus | github.com/markus-global/markus | 100+ (repo page not fetched here) | AGPL-3.0 / commercial | full AI workforce platform with own runtime | dashboard + tasks + chat + builder + mobile | complete AI teams with built-in runtime | three-layer memory + audit trail | explicitly not BYO CLI; own runtime proven | proven | proven: audit trail, execution timeline | partial: audit trail yes, but not host-runtime context-source/fidelity | 中高（whole-product shell） | governance、roles、review gates、mobile dashboard | 自己拥有 runtime，不是旁路宿主 native runtime 的 evidence layer；AGPL 也限制直接借代码 [E5] |
| jnMetaCode/agency-agents-zh | github.com/jnMetaCode/agency-agents-zh | 100+ (repo description proves distribution, exact page not fetched) | unknown from sampled data | 266 个即插即用专家角色 + orchestrator | role library first | reusable experts / orchestrator | likely role prompt memory, not task-run evidence | proven mentions Claude Code/Cursor/Copilot/Hermes support | partial | weak | none | 低到中（role/profile layer） | agent definitions、role catalog、activation descriptions | 更像 role library，不是 task-run provenance system [E15] |

## 4. 替代性分析

题目要求区分四类替代。下面直接按四层判断。

### 4.1 UI 替代

**结论：存在局部替代，但不是完整替代。**

最强的 UI 参考 / 局部替代候选是：

- **Poco**：chat/channel/drawer/artifacts/playback 很成熟；
- **Alook**：org chart + email + kanban + calendar 非常完整；
- **Markus**：dashboard/task/governance/mobile 管理面完整；
- **AgentOS**：多 session 管理、移动端、runtime 控制台强；
- **WorkBuddy**：Experts / Skills / Connectors 的 IA 很适合做 surface 参考。

但这些产品的 UI 默认都在表达：

- 一套 runtime/workspace；
- 一套 workforce/team/productivity product；
- 或一个 general AI company shell。

**它们没有直接表达 Context Tree 要表达的 “这次 member task run 的 context-evidence contract”。**

所以结论是：

- **可替代我们的一部分界面形态；**
- **不能替代我们的产品语义边界。**

### 4.2 role/profile 替代

**结论：有较多可替代部分。**

可明显借鉴甚至部分复用思路的有：

- **Claude subagent definitions**：`name + description + tools + model` 的路由定义；
- **agency-agents-zh**：大规模角色库与触发语义；
- **AIPass**：persistent identity + memory + mailbox；
- **Poco/Alook**：preset / org-role / persistent agent identity。

所以对 Context Tree 而言，**TeamMemberProfile 不是最强护城河**。

我们真正应避免重复造轮子的点是：

- 角色描述写法；
- 路由 hints；
- skills / preset / profile 组织方式；
- persistent member identity 的基本模型。

### 4.3 runtime 替代

**结论：有很多产品在 runtime 层比我们更重，但这不等于替代。**

例如：

- Markus 明确拥有自己的完整 runtime；
- PraisonAI 是完整框架；
- Anton 是 doing-agent harness；
- Poco 是 Claude Code-based product shell；
- Alook 是 BYO runtime orchestration layer。

但 Context Tree 当前最重要的判断本来就不是“自建 runtime”，而是：

```text
复用宿主 runtime 的 native subagent/team/fork，
在旁边记录 context-bearing member task run。
```

所以 runtime 越重的产品，越说明它们和我们的目标不是同一层。

### 4.4 context/evidence 替代

**结论：本轮没有看到强替代者。**

最接近的外部方向是：

- **OpenLoomi**：强调 holistic context、auditable access、source evidence；
- **Poco**：有 playback/artifacts/execution drawer；
- **Markus**：有 full audit trail；
- **PraisonAI**：有 telemetry/checkpoints/compaction；
- **AIPass**：有 persistent identity/memory/mailbox。

但它们都没有清楚提供下面这个合同：

```text
for one member task run:
- source materials
- model-visible subset
- selection mode
- fidelity class
- known losses
- result return anchor
```

这也是为什么当前假设仍然成立：

> Context Tree 不是又一个 AI workforce platform；它是 host runtime 旁边的 context/evidence layer。

## 5. 可借鉴 UI 模式

### 5.1 WorkBuddy：Experts / Skills / Connectors / Automations 四分层

最值得借鉴的是信息架构，而不是整个业务定位。

可转译为 Context Tree：

- **Members**：可复用 specialist members；
- **Task Runs**：最近执行；
- **Policies / Skills / Standards**：member 能力与约束来源；
- **Context Sources**：项目记忆、历史记录、目标材料、searchable history；
- **Automations（后置）**：未来再考虑自动触发。

### 5.2 Alook：org chart / role-first / BYO runtime

值得借鉴：

- 可视化 member 结构；
- “你定义组织结构，runtime 只是执行器”；
- 适合表达 reusable member identities。

### 5.3 Poco：task drawer / artifacts / playback

值得借鉴：

- **drawer 作为一次 run 的容器；**
- **artifacts grouped by agent；**
- **playback 作为二级证据视图。**

这与 `MemberTaskRun drawer` 非常契合。

### 5.4 Claude Agent Teams：lead / teammate / mailbox

值得借鉴：

- teammate naming；
- shared task list；
- direct message to teammate；
- lead 协调、teammate 执行。

### 5.5 OpenLoomi：context as workspace, not only docs

值得借鉴：

- 人、项目、决策、后续事项都属于 context；
- 审计与 memory 不应只等价于 transcript；
- source evidence 应可见。

## 6. 不应照搬的模式

### 6.1 不应照搬完整 workforce platform

Markus / WorkBuddy / Alook 的一个共同风险是：

```text
平台很自然会膨胀到：
runtime + communication + PM + dashboard + governance + scheduling + CRM-like shell
```

这对 Context Tree 是危险的范围扩张。

### 6.2 不应照搬“traceable = enough”

很多产品说自己 traceable / auditable，但通常意味着：

- task status；
- messages；
- execution logs；
- final artifacts。

这不足以回答：

- 哪些 context 真的进入模型；
- 哪些只是可访问资源；
- 为什么这次结果会缺某些判断。

### 6.3 不应照搬“memory = context solved”

OpenLoomi、AIPass、Anton、PraisonAI 都说明 memory 很重要；
但 **memory 系统并不自动等于 task-run evidence 系统。**

### 6.4 不应照搬自有 runtime 作为前提

Markus/PraisonAI/Anton 这类产品可以通过“拥有 runtime”获得更完整控制；
但 Context Tree 当前恰恰要验证的是：

```text
不拥有 runtime，
仍然能在 host native runtime 旁边建立清晰 evidence boundary。
```

## 7. 推荐 UX 信息架构

### 7.1 A. Member roster 默认视图

默认卡片字段建议：

```text
memberName
role / description
status: idle / running / needs-input / failed / archived
recent task runs (last 3)
remembered corrections (count + latest summary)
available task kinds: consult / review / check / plan / diagnose
runtime compatibility: Claude Code / Codex / OpenCode / unknown
confidence / routing hints
```

说明：

- `memberName` 是主标签；
- `status` 是运行态；
- `recent task runs` 让用户看到“这是活的 member”；
- `remembered corrections` 体现它不是一次性 subagent；
- `runtime compatibility` 对我们很关键，因为这是 host-runtime-adjacent 产品。

### 7.2 B. Member detail

应展示：

```text
profile
role memory
standards refs
known bad patterns
recent task runs
runtime compatibility
tools/model/context policy
```

补充建议：

- `routing description`：什么时候应委派给它；
- `negative activation hints`：什么时候不该委派；
- `evidence expectations`：这个 member 的结果通常需要哪些 evidence。

### 7.3 C. MemberTaskRun drawer

应展示：

```text
task kind / question / target refs
requester / activation point
runtimeAgentId / runtimeAgentType
contextSources
materialSelectionMode
fidelity
knownLosses
result summary / full output
evidence refs
```

建议 UI 分三层：

1. **Summary tab**
   - task kind
   - question
   - member
   - result summary
   - status

2. **Evidence tab**
   - contextSources
   - materialSelectionMode
   - fidelity
   - knownLosses
   - evidence refs

3. **Runtime tab**
   - runtimeAgentId
   - runtimeAgentType
   - return anchor
   - raw transcript / playback link（若有）

### 7.4 D. Graph/provenance 可展开层

默认隐藏，按需展开的边：

```text
member identity edge
runtime lineage edge
context source edge
work-product dependency edge
role/authority edge
result return edge
```

默认建议：

- **默认显示**：member identity、result return、最近 task-run 列表；
- **二级显示**：runtime lineage、work-product dependency；
- **展开证据层**：context source、role/authority、known losses。

### 7.5 E. 用户操作（5 个流程）

#### 1. 显式让某个 member review

```text
用户打开 member roster
→ 选择 architecture-reviewer
→ 输入 review 目标
→ 创建 MemberTaskRun
→ 查看结果摘要
→ 需要时展开 evidence
```

#### 2. 主 agent 自动选择 member

```text
主 agent 到达 activation point
→ 根据 routing hints 选择 member
→ 执行 native subagent / teammate / fork
→ Context Tree 记录 run
→ 用户看到“why this member”与结果摘要
```

#### 3. 用户继续和某个 member 对话

```text
用户进入 member detail
→ 选择 recent task run
→ continue with this member
→ 新建或续接一个 MemberTaskRun
→ 保留 previous run reference
```

#### 4. 用户查看某次 task run 的 evidence

```text
用户在 recent task runs 中点开一项
→ 打开 drawer
→ 默认看到 summary
→ 切换到 evidence tab
→ 查看 fidelity / known losses / context sources
```

#### 5. 用户修正 member 的行为并让它下次记住

```text
用户在 run drawer 中给出 correction
→ 系统记录 correction 到 role history
→ member detail 中 remembered corrections +1
→ 下次 activation 时作为 roleMemoryRefs 之一进入候选材料
```

## 8. 推荐实现边界

### 8.1 我们不应该先做什么

当前不建议优先做：

- 完整 workforce 平台；
- 完整 PM/kanban/calendar/email 套件；
- 自有 agent runtime；
- 通用图数据库可视化产品；
- 只做 marketing-style member roster，没有 evidence drawer。

### 8.2 我们应该先做什么

优先路径应是：

```text
member registry
→ MemberTaskRun record
→ runtime compatibility adapters
→ evidence drawer
→ minimal web UI / report surface
```

换句话说，题目给出的几个边界选择里，更推荐：

- **先实现 member registry + task run record，再决定 UI；**
- 同时做一个 **轻量 web UI**，但它只是 evidence-aware viewer，不是完整 workforce app；
- CLI/report 仍然要保留；
- 不建议一开始作为 WorkBuddy/Poco/Alook/OpenLoomi 插件去寄生开发。

### 8.3 V0 推荐路径

#### V0 推荐路径

```text
1. member registry
2. create/record MemberTaskRun primitive
3. runtime compatibility fielding (Claude Code / Codex / OpenCode)
4. evidence model: contextSources / fidelity / knownLosses
5. minimal member roster web UI
6. MemberTaskRun drawer
```

#### V0 非目标

```text
- full org chart editor
- shared kanban/calendar/email suite
- full persistent DM product
- own LLM runtime
- generalized workflow automation platform
- “AI company” dashboard KPI layer
```

## 9. 未解决问题与下一步调研

### 9.1 未解决问题

1. **native runtime 下，哪些平台能稳定暴露 enough evidence 来支撑 fidelity 判断？**
2. **member correction / role memory 应该如何 materialize，才不会退化成普通 notes？**
3. **continue previous member task 在不同 runtime 下是 resume、new run with inherited refs，还是其它模式？**
4. **Poco / Alook / OpenLoomi 是否在源码层已经有更强的 provenance hooks，只是 README 未明确写出？**
5. **如果以后接 `context-mode` / Magic Context 类 backend，evidence 模型如何兼容 searchable history vs model-visible context 的差异？**

### 9.2 下一步调研建议

- 深读 Poco 的 playback / drawer / shared files 源码，判断能否借 UI pattern；
- 深读 Alook 的 org chart / email / task routing 设计，判断 member-centric surface 的最小抽象；
- 深读 OpenLoomi 的 memory/source evidence 文档，判断它的“auditable”是否能细到 material path；
- 深读 Claude Agent Teams 的 teammate naming / mailbox / task list 行为，作为 runtime mental model 基线；
- 选 1 个本地 runtime（优先 Claude Code 或 OpenCode）做 `MemberTaskRun evidence drawer` 的最小原型。

## 10. 三个必须回答的问题

### 1. 我们是否应该把用户心智从 Context Tree 改成 WorkBuddy-style member/coworker？

**答案：应该把默认表层改成 member/coworker-style，但不应把产品本体改成 AI workforce platform。**

更准确地说：

- **surface 改成 WorkBuddy-style；**
- **core 仍然是 context-bearing member task runs；**
- **tree/graph 降为可展开 provenance layer。**

### 2. 是否存在 100+ star 开源项目已经足以替代我们？如果有，是替代哪一层？

**答案：存在多个项目可替代局部层，但没有看到项目能完整替代我们的 context/evidence layer。**

可替代层举例：

- **UI 层**：Poco、Alook、Markus、AgentOS；
- **role/profile 层**：agency-agents-zh、AIPass、Claude subagent definitions；
- **runtime / orchestration 层**：Markus、PraisonAI、Anton、Alook；
- **memory / workspace 层**：OpenLoomi、AIPass、Anton。

**但 context-bearing team member 这一整层仍未看到强替代者。**单独的 roster、role profile、runtime、memory 或 task UI 都已有强参考；尚未被替代的是把这些组合成“稳定 member 每次基于正确上下文完成任务，并可解释其材料路径与结果回流”的完整机制。

### 3. 如果不被替代，我们最小不可替代产品边界是什么？

**答案：最小不可替代边界是 context-bearing team member，而它至少需要：**

```text
member registry
+ MemberTaskRun record
+ contextSources / materialSelectionMode / fidelity / knownLosses contract
+ result return anchor
+ host runtime compatibility metadata
```

一句话概括：

> Team member 是 Context Tree 的用户价值主体；不可替代的不是泛化的 agents / members / memory / task UI，而是 context-bearing team member：一个稳定 member 每次承接任务时，系统能清楚说明它基于什么上下文、哪些材料进入模型或可检索、丢了什么、结果怎样回到主 agent。

---

## 证据来源

- [E1] WorkBuddy 官方站与主页 IA（`Assistant / Experts / Skills / Connectors / Automations`）
- [E2] `alookai/alook` README 与 GitHub repo 页面
- [E3] `poco-ai/poco-claw` README 与 GitHub repo 页面
- [E4] Anthropic Claude Code 官方文档：subagents / agent teams
- [E5] `markus-global/markus` README
- [E6] 腾讯云 WorkBuddy 官方材料
- [E7] 第三方 WorkBuddy 评测与 Forbes 报道（作为辅助，不作为唯一依据）
- [E8] `melandlabs/openloomi` README 与 GitHub repo 页面
- [E9] `MervinPraison/PraisonAI` README
- [E10] `simstudioai/sim` README
- [E11] `mindsdb/anton` README
- [E12] `saadnvd1/agent-os` README
- [E13] `victordibia/autogen-ui` README
- [E14] `AIOSAI/AIPass` README 与 GitHub repo 页面
- [E15] `jnMetaCode/agency-agents-zh` repo 描述与 GitHub metadata
