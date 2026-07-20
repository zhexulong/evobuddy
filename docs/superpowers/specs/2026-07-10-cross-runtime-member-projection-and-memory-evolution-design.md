# Cross-Runtime Member Projection 与 Memory Evolution 设计

## 0. 结论

Context Tree 的产品主线应从早期的 “context tree / checkpoint fork” 收敛为：

```text
跨 runtime 的 stable member / expert system。
```

用户面对的是一组可复用专家，例如 `skill-designer`、`live-eval-checker`、`architecture-reviewer`。主 agent 在需要时调用某个 member；runtime 用自己的 subagent/custom agent/task 机制执行；Context Tree 负责 member identity、任务上下文、结果回流、记忆维护和 Workbench 审计。

这不是替代 Claude Code / OpenCode / Codex 的 subagent，而是把稳定 member identity 投影到这些 runtime 的原生 agent 定义上，并补足它们缺少的跨 runtime member memory、run ledger、context visibility 和 Workbench surface。

## 1. 目标

### 1.1 用户体验目标

用户应能形成这样的预期：

```text
我有一组专家。
这些专家不是一次性 prompt，而是长期可复用的职责身份。
我或主 agent 可以在需要时调用它们。
它们会带着该职责相关的上下文工作。
它们的结果会回到主 agent。
它们会从真实使用反馈中逐步改善。
```

示例：

```text
skill-designer 下次写 skill 时，会记得：
- trigger 不能假设当前 agent 知道自己是 loop-controller；
- rule 与 skill 内容需要分开；
- contract 指针只应在实现/调用 writeback entrypoint 时加载；
- Superpowers skill description 应偏 symptom-driven。
```

V1 不要求用户手工理解 runtime child id、session id 或 evidence artifact 才能使用 member。首批 member 可以来自项目模板、用户显式确认的 profile、已有 artifact 中的明确 profile/import 记录，或从用户 session history 中提取并经 host 验证的 member lifecycle bootstrap。项目文档可以作为 supporting evidence，但系统不单独提供“从文档自动推导 roster”的第二层产品路径。

### 1.2 工程目标

1. **Native projection**：V1 三端都做 projection，生成 Claude Code / OpenCode / Codex 的原生 subagent/custom agent 定义。
2. **Stable identity**：`memberName` 是稳定职责身份，不等于 runtime child id、session id 或一次性 task。
3. **Task-conditioned context**：每次 member run 都有本次 task 的 m[1] delta，同时复用稳定 member baseline。
4. **Result return**：member answer 必须回到 parent agent，这是产品主路径之一。
5. **Memory hygiene**：用户反馈、agent 观察和 run 结果可以经由主 agent 发起 durable 变更，但不能静默污染长期 memory；必须保留 source refs、mutation log 和可撤销/可整理路径。
6. **Auditable run ledger**：每次 run 记录 visible materials、context render、input/output digest、returnedTo、trace refs。
7. **Workbench first-level UX**：用户第一层看到 Experts、Tasks、Result、Used Context；eval/proof taxonomy 留在 Trace。
8. **Packet delivery**：runtime agent definition 只定义稳定身份；每次调用的 task packet / memory packet / target materials 必须通过明确 invocation adapter 送达并记录证据。
9. **Agent-first operation**：主窗口始终是用户正在使用的 agent；Context Tree 不引入第二套审批 UI，只提供可见调用、结构化写入工具、记录和回滚/归档能力。

## 2. 非目标

1. 不实现新的通用 subagent runtime。
2. 不把 skill 当作 member identity。Skill 是可复用流程；member 是稳定专家身份。
3. 不把 plugin 当作 member identity。Plugin 可以分发 installer、skills、MCP config、agent definitions，但不是专家本身。
4. 不把 runtime native memory 作为跨 runtime 真源。Context Tree 管理 member memory，runtime memory 只是辅助载体。
5. 不引入独立“授权边界”作为产品概念。member 调用应和 runtime subagent 调用语义一致：用户可知、runtime 可见、结果返回 parent；危险 side effect 继续交给宿主 runtime 的 permission model。
6. 不承诺 natural autonomous native spawn 已经可用。显式 member 调用是 V1 主路径。
7. 不把主 agent 当成唯一 memory classifier，也不禁止主 agent 发起 durable member/profile/memory 变更。主 agent 可以在正常对话中提出、解释、执行变更；Context Tree 记录来源与证据，并提供后续整理/撤销能力。
8. 不把 Magic Context 作为强运行时依赖。
9. 不把 docs-only roster discovery 作为产品路径或 V1 成功条件。用户 session history 可以驱动 member lifecycle bootstrap，但文档材料只能服务于显式 profile 创建、import/migration、真实 run 后 retrospective，不能单独自动生成默认 Experts 或 baseline memory。

## 3. 产品对象

### 3.1 Member / Expert

稳定专家身份。工程上对应 `TeamMemberProfile.name` / `memberName`。

示例：

```text
memberName: skill-designer
displayName: Skill Designer
role: Skill workflow design
description: Use when writing or reviewing Context Tree skills, especially trigger rules, rule/skill separation, and Superpowers compatibility.
```

规则：

- `memberName` 使用稳定 kebab-case。
- 名字表达复用职责，不表达一次性任务。
- runtime-specific agent name 可以不同，但必须有 registry mapping。
- rename 是 registry migration；历史 run 保留原 `memberName`。

### 3.2 Runtime Agent Definition

member 在具体 runtime 中的投影。

| Runtime | Projection |
|---|---|
| Claude Code | `.claude/agents/<member>.md` |
| OpenCode | `agents/<member>.md` 或 config agents，`mode: "subagent"` |
| Codex | `.codex/agents/<member>.toml` |

投影内容包含：

- member 身份与职责；
- 何时适合调用该 member；
- 如何返回结果给 parent agent；
- 如何使用 Context Tree 提供的 task packet / memory packet / recall tools；
- 不应包含每次任务变化的材料。

投影中的 routing / description / skill 约束写法不是 Context Tree 自创规则，应固定参考两类已验证实践：

1. **Claude Code subagent definitions**：`description` 是 runtime 决定何时 delegate 的主要信号；frontmatter 放 `name`、`description`、`tools`、`model` 等能力约束，body 才放执行 instructions。Claude Code 也用同一 subagent definition 作为 agent team teammate role。
2. **Superpowers writing-skills / Anthropic skill authoring best practices**：description 应偏触发条件和症状语言，避免把完整流程塞进 description；正文用 progressive disclosure，只在需要时加载重 reference / contract；约束应通过 pressure scenarios / subagent tests 验证，而不是靠作者主观觉得清楚。

因此 Context Tree 生成的 runtime definition / skill guide 应遵守：

- `description` 写“何时该调用这个 member”，不写整套操作流程；
- body 写 member 的职责边界、返回 parent 的要求、如何消费 invocation packet、何时说明 durable 变更；
- 对 durable member/profile/memory 变更，写成 agent 行为纪律：在主 agent 对话中说明 intended durable change；当用户明确请求或同意后执行；不同意则不做；
- 不把 skill 写成隐藏审批系统，不要求 agent 调另一个 UI 获批；
- 不在 skill 中承诺它一定会被 runtime 自动调用。skill / definition 只是 routing 与行为引导，是否调用取决于宿主 agent/runtime。

投影不是证据。某个 agent definition 存在，不证明某次 run 看到过其 role memory 或 target materials。

投影也不是 packet delivery。`.claude/agents/*.md`、`agents/*.md` 或 `.codex/agents/*.toml` 只能让 runtime 认识这个 member；本次 task 的 m[1]、target materials、selected memory、writeback refs 仍必须由 invocation adapter 在调用时传入，并由 `MemberTaskRun` / `MemberContextRender` 记录。

### 3.3 MemberTaskRun

一次 member 被调用并执行任务的记录。用户理解为“某个 expert 承接的一件事”。

需要记录：

- `memberName`；
- requester / parent agent / activation point；
- runtime surface；
- context render refs；
- selected materials；
- result / returnedTo；
- trace / evidence refs；
- known losses。

### 3.4 Workbench

Workbench 是用户查看和继续工作的表层，不是 proof dashboard。

第一层展示：

```text
Experts | Tasks | Selected Expert | Task Result | Used Context
```

Trace 展示：

```text
parent invocation
runtime observation
context render digest
material visibility
artifact refs
fixture/live/source classification
known losses
```

`MemberProfileCandidate` 应进入 Workbench 的 setup/import 页面，UI 上称为“建议的 Expert”。CLI/report 可以作为安装与 eval 输出，但不是唯一产品表层。setup/import 页面至少展示 candidate name、role/routing、evidence refs、confidence、source kind，并在 V0 一次性支持 `Confirm / Rename / Add to existing Expert / Discard`：

- **Confirm**：candidate -> confirmed/default Expert。
- **Rename**：修改 candidate 的 `memberName` / `displayName` 后确认或保留 pending。
- **Add to existing Expert**：底层 mutation kind 是 `merge_candidate_into_member`。仅支持 `MemberProfileCandidate -> existing member`，把候选 evidence / responsibilities / memory candidates 归并到已有 member；V0 不支持 existing member -> existing member 的复杂合并。
- **Discard**：candidate -> rejected，保留 evidence refs 和 discard reason，不删除 raw source。

`merge_candidate_into_member` 不是 Magic Context 意义上的 memory-level merge，也不是正式 member identity merge。它只做 candidate 去重/归并：candidate 状态变为 `merged`，target member 追加 candidate evidence/provenance，候选 responsibilities / negative hints 进入 pending profile edits 或 candidate notes，候选 role memory 仍保持 candidate/searchable，不自动 active，不立即重排 `member-m[0]`。

Workbench setup/import 与主 agent 对话不是两套通路。它们必须共用同一个 durable mutation API 和 mutation log：

```text
agent path:
main agent explains intended durable change -> Context Tree tool -> mutation log

workbench path:
user chooses Confirm/Rename/Add to existing Expert/Discard -> same Context Tree mutation API -> same mutation log
```

mutation log 至少记录 `source`、`mutationKind`、`sourceRefs`、`reason`、`actorSurface`。Workbench 只是管理和回看的表层，不替代主 agent 工作窗口。`merge_candidate_into_member` 必须额外记录 `sourceCandidateId` 与 `targetMemberName`。

## 4. Runtime Projection 设计

### 4.1 生成原则

Context Tree 应从一个 canonical member registry 生成 runtime-specific definitions。V1 明确要求三端都生成：Claude Code、OpenCode、Codex。单端缺失不是完整 V1 projection；但 projection 通过仍只证明 runtime 认识 member，不证明 packet delivery 或 result return。

```text
TeamMemberProfile
  -> Claude agent markdown
  -> OpenCode agent definition
  -> Codex custom agent TOML
```

生成必须 deterministic。同一 profile version、同一 generator version，应生成 byte-stable 输出，除非 runtime schema 要求变化。

### 4.2 Codex 投影

Codex custom agent 使用 `.codex/agents/*.toml`。

定义至少包含：

```toml
name = "skill_designer"
description = "Use when writing or reviewing Context Tree skills, especially trigger rules, rule/skill separation, and Superpowers compatibility."
developer_instructions = "..."
```

注意：

- Codex runtime name 可能需要 snake_case；Context Tree registry 保留 `memberName: skill-designer` 到 `runtimeAgentName: skill_designer` 的映射。
- Codex 可能只在用户明确要求 subagents/parallel agent work 时使用 subagent。产品不能依赖自然触发作为 V1 成功条件。
- Codex plugin 可以分发 installer/generator，但 plugin 本身不是 agent definition layer。

### 4.3 Claude Code 投影

Claude Code 支持 reusable teammate role 的 subagent definitions。

Context Tree 应生成 `.claude/agents/<member>.md`：

- frontmatter 放 name / description / tools 等 runtime fields；
- body 放 member identity、routing、return-to-parent、Context Tree packet 使用规则。

### 4.4 OpenCode 投影

OpenCode 支持 agent definitions / config agents。

Context Tree 应生成：

- `agents/<member>.md`，或
- config `agents` entry，`mode: "subagent"`。

Magic Context 若存在，可以作为 memory/search/compaction 的参考或辅助，但不是 Context Tree 的强依赖。

### 4.5 Runtime Projection Installer

Runtime projection installer 参考 Magic Context 的 setup / doctor / migrate 心智，而不是只生成文件让用户手工搬运。installer 不是 member runtime，也不是权限系统；它负责把 confirmed registry 投影到宿主 runtime，并证明 runtime 能发现这些 definitions。

首个发布形态应与 Magic Context 的 setup/doctor 心智保持一致，但不要把 CLI 形态放进产品主路径。CLI 可以存在于 installer、doctor、migration、debug、eval 或 legacy harness 中；真实用户入口应优先使用宿主 runtime 的自然机制：agent-facing skill、runtime-specific command surface、plugin action、subagent/team definition 或当前 parent-agent 的自然语言请求。Context Tree core 定义 setup、sync、doctor、discovery、dream、invoke、status 的语义；每个 runtime adapter 决定具体拼写和呈现方式。不要在 spec、skill 或 eval 中把某个命令名字当成唯一产品入口。

如果保留 CLI wrapper，应放在 legacy/debug/eval 边界内，不能作为 native/natural product proof，也不能让实现者以为用户需要退出 agent shell 才能完成 member discovery 或 member invocation。

installer 需要满足：

- 检测当前 repo / workspace 和可用 runtime；
- 从 canonical registry 生成三端 definitions；
- 安装必要的 skills / instructions / commands / plugin metadata；
- 验证 runtime 是否能发现 definitions；
- 写 install report，明确 installed / skipped / failed / unsupported；
- runtime-specific adapter 保持薄，核心 registry/generator/validation 独立。

配置错误不能静默成功。若某 runtime 未安装或当前版本不支持对应 discovery path，应在 report 中标为 `unsupported` 或 `blocked`，不能假装 projection 完成。

### 4.6 Invocation Adapter / Packet Delivery

V1 必须把 stable definition 与 per-call packet delivery 分开：

```text
Runtime Agent Definition
  = stable identity / routing / behavior instructions

Member Invocation Packet
  = this run's task, target materials, m[0]/m[1] refs, recall/writeback refs
```

一次实际调用至少需要以下边界：

1. **prepare**：解析 `memberName`，读取确认后的 `TeamMemberProfile`，生成 `MemberContextRender` 和 material selection report。
2. **deliver**：通过 runtime 支持的方式把 invocation packet 送到 member：native subagent prompt、custom agent task prompt、tool/sidecar call、或可审计的 mounted packet。
3. **execute**：runtime 执行 member。Context Tree 不替代 runtime 的 subagent 执行。
4. **return**：member answer 以 runtime/tool/adapter 可观察方式回到 parent agent。
5. **writeback**：写入 `MemberTaskRun`，记录 packet refs、visibility bucket、result refs、known losses。

如果某 runtime 只能安装 agent definition，但无法可靠传入 per-call packet 或取回 result，V1 不能把它标为完整 invocation 支持；最多标为 definition projection 支持。

V1 的 packet delivery 优先级固定为：

1. **native subagent prompt**：parent agent 调用宿主 runtime 的原生 subagent/custom agent，并把 invocation packet 直接放入本次 subagent prompt。这是首选路径，因为它最贴近 Claude Code / Codex / OpenCode 的真实 agent 使用方式。
2. **tool/sidecar call**：当 runtime 不能直接把 packet 交给 native subagent 时，由 Context Tree tool/sidecar 准备 packet、调用 executor 或把结果作为 tool result 返回 parent agent。这是可控 fallback，evidence 较强，但不能冒充 runtime-native spawn。
3. **mounted packet**：Context Tree 写出 packet artifact，member 被要求读取该 artifact。这只作为弱证据/调试路径；除非有 read/expand/runtime observation 证明读取，否则只能证明 packet 存在，不能证明 member 看到。

## 5. Member Context Layout

Context Tree 不应把所有文档、历史和反馈无差别塞给 member。应采用 task-conditioned layered context：

```text
member-m[0] = stable member baseline
member-m[1] = current activation delta
search/expand = non-default historical material
```

### 5.1 member-m[0]

稳定 baseline，尽量 byte-stable、cache-friendly。

包含：

- member profile 的稳定渲染；
- durable role memory；
- 高优先级 rejected patterns；
- role standards / rubrics；
- 少量 golden examples 或摘要；
- member-specific long-term constraints。

不包含：

- 当前 task target；
- parent agent 的临时请求；
- 本次 search/expand 结果；
- 低置信反馈；
- 未提升的候选。

### 5.2 member-m[1]

本次 activation delta。

包含：

- parent agent 对 member 的具体请求；
- target materials；
- activation point；
- 当前用户约束；
- newly promoted memory updates；
- 本次相关 recent run experience；
- 已选择并 mount 的 search/expand 摘要。

### 5.3 searchable / expandable material

默认不注入，但可搜索或展开：

- 历史 MemberTaskRuns；
- 用户反馈窗口；
- eval reports；
- provider/runtime artifacts；
- raw output；
- low-confidence observations；
- full transcript snippets。

search result 只是“可找回”。只有被 mount/inject 或 runtime evidence 证明读取，才能标为 model-visible。

### 5.4 MemberContextRender

每次 member run 应生成 `MemberContextRender` artifact，至少记录：

```text
renderId
memberName
profileRef
activationPoint
renderSchemaVersion
baselineVersion
baselineDigest
baselineReuseStatus
deltaDigest
m0Refs
m1Refs
searchableRegistryRef
selectionReportRef
knownLosses
```

`baselineDigest` 只能证明渲染稳定，不能证明 provider cache hit。只有 runtime/provider evidence 存在时，才能声明 `provider-cache-hit`；否则最多是 `deterministic-reuse`。

## 6. Memory Evolution 设计

### 6.1 基本原则

主窗口一定是 agent。Context Tree 不应把 durable memory / member 变更做成另一个审批系统，也不应阻止 agent 在正常任务流程中维护 member。正确边界是：

```text
agent notices a durable member/profile/memory need
  -> explains intended durable change in the main agent conversation
  -> proceeds when the user requested it or agrees
  -> writes structured mutation with source refs
  -> maintenance / retrospective later verifies, curates, archives, or supersedes
```

这里“用户同意”不是 Context Tree 自己要强证明的授权对象。实际产品中我们通常拿不到一个独立的、密码学意义上的 consent artifact；拿得到的是主 agent 对话、tool call、source refs 和 mutation log。因此 V1 采取 **agent-mediated durable mutation discipline**：一定程度上相信 agent，但要求 agent 把长期影响说清楚，并留下可回看、可撤销、可整理的记录。

Magic Context 的参考点不是“每次 memory 变更要用户审批”，也不是“不可见后台 worker 可以随时改 durable state”，而是：

- raw history / user friction / repeated signals 可以进入 retrospective；
- memory 变更走结构化 storage 和 mutation log；
- additive / update / archive / merge 不直接打乱稳定 baseline，而是先经 delta / mutation log，再在后续 materialization 中合入；
- Dreamer/maintenance 有可配置触发、可观察状态、可检查输出，并且 host apply 仍保留边界。

Context Tree 对应到 member memory 时，主 agent 可以发起写入，maintenance 负责长期卫生，但 maintenance 必须来自项目/runtime 已启用的可解释触发来源，并留下用户可见状态。不能做的是静默把一次性反馈、模糊情绪或 docs-only 猜测塞进 `member-m[0]`。

### 6.1.1 Runtime-owned memory triggering

Retrospective / dream / curate / verify / classify 不是 Context Tree 私下运行的全局后台进程。它们必须由用户选择的 runtime/project 触发来源启动，并能被当前 agent 或 Workbench 解释。

触发所在的 parent conversation 不应承担 heavy dream 的执行上下文。更合适的形态是：parent agent 发现需要 cold start / discovery / retrospective，向 runtime 发起一次 maintenance subagent / member run；该派生 run 读取 session corpus、ledger、event stream 和现有 member state，输出 proposals/manifest/status；parent agent 只接收摘要、候选和下一步建议。这样既保持用户当前讨论会话干净，也避免把 dream scan 的大量材料塞进正在做设计/实现的主上下文。某些 runtime 会把派生 run 存成 child session，但产品概念是 subagent/member run，不是“开一个普通新 session”。

允许触发形态：

- 用户自然语言请求当前 agent 刷新 member memory、整理候选或诊断 routing；
- runtime-specific command surface 或 plugin action；
- installed skill 或 agent definition 在 wrap-up、plan-complete、review-complete 等可见边界提示 agent 运行；
- 用户启用的 threshold/scheduled policy，例如 unread events、new root sessions、member runs、correction count；
- Workbench setup/import 或 memory management 页面中的显式动作。

禁止形态：

- 没有用户配置、没有 runtime-visible source 的自动后台 candidate generation；
- 没有 parent-agent/status 可见性的 silent durable mutation；
- 因为存在 CLI wrapper 就把它当成真实用户入口；
- 把 trigger 名称写死成唯一命令，导致 Claude/OpenCode/Codex 无法按各自机制映射。

每次触发至少记录：trigger kind、runtime、requesting parent session、execution member/subagent run、source/session refs、event watermark、safe frontier、input coverage、产生的 candidates/mutations、是否 active、以及 parent-agent 可报告的简短状态。Magic Context 的 `/ctx-dream` 可作为“用户可手动触发 maintenance”的参考，但 Context Tree 的 core contract 是这些语义，不是命令名。

### 6.2 Raw Evidence 来源

Member Retrospective 的输入来自可观测材料：

- parent conversation；
- MemberTaskRun input/output；
- member result returned-to-parent 后的用户反馈；
- Workbench review notes；
- eval correction loop；
- target material revisions；
- artifact/result digest refs。

未跟踪文件不是 context；只有被引用、读取、mount、记录或进入 artifact 的材料才是 evidence source。

### 6.3 Feedback Window

系统应识别与 member run 相关的反馈窗口，而不是要求主 agent 手工打标签。

触发信号包括：

- 用户在某次 member result 后指出不对、不够、方向错误；
- 用户重复解释某条标准；
- 用户要求按另一个参考 repo / skill / runtime convention 改写；
- 用户认可某个输出可作为未来样例；
- eval->纠错->重新 eval 循环中修复了某类 member 判断错误。

非触发信号：

- 普通新任务；
- 用户临时改变目标；
- 一次性措辞偏好；
- 没有 member 归因证据的泛泛评价；
- 纯 runtime/test failure 且没有 role learning。

### 6.4 Retrospective Learning

Retrospective agent 在被项目/runtime 的可见触发来源启动后，读取 bounded feedback window、相关 run summary、现有 role memory，必要时 search/expand 历史。它可以异步运行，但必须有可见触发来源、可检查输出和 host apply 记录；不能作为无人知道的常驻后台写入者。

Retrospective learning 的含义是：从已经发生过的对话、member run、用户反馈、eval correction loop 中提炼未来可复用的 member role memory。它不是保存用户原话，也不是把一次性“用户不喜欢 X”写进记忆，而是把反馈转成可归因、可维护、能指导下次 member run 的 role rule。

这一机制可以重点参考 Magic Context Dreamer，必要时复制/改写其中的任务组织和 prompt 思路，但不能把 Magic Context 作为强运行时依赖，也不能照搬其 project/user memory 目标。

可参考/可复制改写：

- retrospective task：从 raw user messages / friction 中提炼 learning；
- Dreamer task registry、schedule、conflict-domain lease；
- agent 输出 manifest，host parse/apply；
- memory mutation log；
- classify / verify / curate maintenance；
- m[0]/m[1] 中 memory update 先进 delta，后续自然 fold。

必须改写：

- 输出目标从 project/user memory 改成 per-member role memory / member experience / user observation；
- evidence refs 必须能绑定 MemberTaskRun、parent conversation、runtime session 或 eval correction artifacts；
- subagent/member 是 Context Tree 的主路径，不能接受 Magic Context 对 subagent 的降级模式作为最终产品边界。

是否直接进入 active memory 也参考 Magic Context 的维护边界：不要把所有 retrospective learning 默认变成 active baseline。默认策略是 **candidate / m[1] / searchable first**；只有用户明确要求记住、import/migration 已确认、eval correction loop 形成强证据，或 maintenance verifier/classifier 给出高置信 manifest 时，才允许自动提升为 active member memory。无论是否 active，都必须写 mutation log，后续仍可 verify / archive / supersede。

Magic-Context-style manifest 至少应表达：

```text
learning
memberName
sourceRefs
evidenceCoverage
confidence
importance
scope
defaultVisibility
mutationKind
reason
negativeSignals
```

Retrospective / maintenance negative controls 至少覆盖：

- 一次性措辞偏好不能 active；
- 没有 member 归因不能 active；
- docs-only 不能 active；
- 用户原话长引用不能 active；
- 与已有 memory 冲突不能直接 active；
- 错归到另一个 member 不能 active；
- 没有 source refs 不能 active；
- eval correction 没有 before/after 证据不能 active。

实现策略是：能在 license 和工程边界允许下复制/改写 Magic Context 的任务组织、prompt 片段、manifest parsing、mutation-log 思路就复制/改写；如果某块与 OpenCode transform、project memory schema、subagent 降级假设强绑定，则只复用架构模式并重写实现。

它输出的是 distilled learning，不是用户原话：

```text
For skill trigger design, write triggers from an ordinary agent-work perspective.
Do not assume the runtime agent knows it is a loop-controller.
```

不允许输出：

- 用户原句长引用；
- 日期/会话局部上下文；
- 愤怒或责备语气；
- 没有 root cause 的 “user dislikes X”；
- 无法归因到 member 或用户 profile 的模糊偏好。

### 6.5 Route

Retrospective learning 应路由到四类之一：

1. **durable member memory**：稳定职责规则、禁忌、rubric、成功样例。
2. **member experience**：某次 run 的经验，searchable，但默认不进 baseline。
3. **user observation**：跨项目、跨 member 的用户工作偏好。
4. **discard**：一次性、低置信、不可归因、重复或污染风险高。

### 6.6 Durable mutation 入口

`RoleMemoryCandidate` / `MemberProfileCandidate` 可以作为生命周期中间记录，但它们不是用户必须手工处理的默认产品对象。V1 允许主 agent 通过 Context Tree tool/adapter 发起 durable mutation，只要满足 agent-facing discipline：

1. **用户明确请求**：例如“以后 skill-designer 记住这一点”“创建一个 skill-designer member”。agent 可以直接执行，并记录 `source: user-requested`。
2. **agent 建议后执行**：agent 认为某条反馈应成为 durable member/profile/memory 时，应在主窗口说明 intended durable change；用户同意或没有反对且上下文允许继续时，agent 可以执行，并记录 `source: agent-mediated`。
3. **retrospective / maintenance**：由项目/runtime 的可见触发来源启动的 retrospective、curate、verify、classify 产生 manifest；host apply 后写入 candidate、active memory、archive 或 supersede 记录。
4. **import/migration**：从已有 confirmed profile、retained run ledger、人工导入材料或其它 workspace 导入，必须标注来源和置信度。
5. **eval correction loop**：eval->纠错->重新 eval 产生了可定位的 member role learning，且有失败/修复 evidence refs。

写入记录至少包含：

- `source`: `user-requested` | `agent-mediated` | `retrospective` | `maintenance` | `import` | `eval-correction`；
- source refs / digest；
- memberName / scope；
- mutation kind: add / update / archive / merge / supersede；
- confidence / reason；
- whether it is active baseline material or only candidate/searchable material。

禁止的是静默污染：

- 无 source refs 的偏好摘录；
- 从一次性情绪或模糊评价直接生成 active member memory；
- 把 docs-only draft learning 当作 active memory；
- 把未确认 profile candidate 自动放进默认 Experts；
- 把用户未同意的删除/大幅改写包装成 maintenance。

Candidate 可以进入 `m1`、searchable 或 review queue。Active memory 也不必马上重排 `member-m[0]`；参考 Magic Context，add/update/archive/merge 应先经 mutation log / delta，后续自然 materialization 再合入 baseline。

### 6.7 Maintenance

后续维护参考 Magic Context 的 Dreamer 思路，但不强依赖其 runtime：

- **curate**：合并重复、改写低质量表述、归档低价值 memory。
- **verify**：只读检查 memory 是否仍被 evidence 支撑；agent 产 manifest，host apply。
- **classify**：计算 importance、scope、default visibility、confidence。
- **retrospective**：从新反馈窗口提炼 learning。

Memory store 必须可编辑、可归档、可 supersede、可 merge；不能是 append-only markdown。

## 7. Cold Start：从用户 session 启动 member lifecycle

### 7.1 结论

Context Tree 的 cold start 不是从项目文档自动发现 roster，也不是只从空白 confirmed profile 开始。正确形态应参考 Magic Context：按 repo / workspace 聚合多条用户 session / raw message history / prior run ledger，从跨 session 反复出现的 role signal、用户反馈、成功/失败样例和任务委派中提取候选，再经过 host 验证进入 member lifecycle。

这里的关键是 **workspace-session-derived lifecycle bootstrap**：用户和 agent 已经在同一 repo / workspace 的多次真实对话里形成了某类专业工作模式，系统可以从这些 sessions 中整理出 member/profile/memory 候选；但候选必须有 session evidence、去重、分类、验证和提升边界，不能由 docs-only 扫描直接变成默认 Expert。

因此原先的“第二层”被拆掉：项目文档不是独立 source of truth，只是 supporting evidence；第三层扩展为 cold-start 主路径，包含从用户 session 中发现和启动 member lifecycle。

### 7.2 Cold-start 输入

冷启动可以读取：

- 已有 MemberTaskRun ledger；
- Workbench artifacts；
- eval correction loop artifacts；
- 多条用户 session / runtime transcript / parent conversation records，按 repo/workspace identity 归集；
- 用户明确反馈、纠正、偏好强化、接受样例、反例；
- 项目文档、plans、contracts、eval reports 作为 supporting evidence；
- 已有 role-memory 或 profile 草稿。

evidence 入口优先级固定为：

1. **已有 Context Tree artifacts**：MemberTaskRun、ContextRender、Workbench、eval correction artifacts。它们最强，但 cold start 早期通常很少。
2. **宿主 runtime session history**：Codex session records、Claude Code transcripts / session storage、OpenCode DB / session records。这是一般情况下的实际第一入口。
3. **明确 import/migration 材料**：已有 confirmed profile、retained run ledger、人工维护材料、其它 Context Tree workspace。
4. **项目 docs/plans/eval reports**：只能作为 supporting evidence，不能单独创建默认 Expert 或 active memory。

这接近 Magic Context 的 retrospective：先从某个 project 的 root sessions 中读取 raw user messages / session history，找 friction、repeated delegation 或 stable preference，再通过受限 child / verifier 输出结构化 learning，由 host apply。区别是 Context Tree 的输出目标不是 project memory，而是 per-member profile / role memory / experience。

Magic Context 的几个边界应直接借鉴：

- **project/workspace identity**：先确定 session 属于哪个 repo/workspace，而不是手工挑一个 session；
- **root sessions only**：默认排除 subagent / dreamer / hidden child sessions，因为它们的“user”多是 agent-authored task prompt，会污染 role signal；
- **bounded scan**：限制每次扫描的 session 数、每 session message 数、全 run message 数，避免第一次运行扫完整历史；
- **watermark + overlap**：记录已扫描时间水位，并读取水位前少量 user messages 作为 overlap，避免跨 run 的纠错/反馈被切断；
- **truncation frontier**：如果某 session 或全局读取被 cap 截断，不能把 watermark 推过未读区域；
- **raw source retained**：候选必须能回指 session id、message ordinal/time、source digest，便于纠错后对同一 corpus rerun。

### 7.3 Cold-start 输出

Cold start 输出不是 docs-derived `MemberRosterDraft`，而是一组 lifecycle records：

```text
SessionRoleSignal
  - project/workspace identity
  - source session / turn / message refs
  - candidate memberName or role label
  - signal kind: repeated delegation | correction | accepted example | rejected pattern | recurring review standard
  - confidence
  - supporting docs/run/eval refs

MemberProfileCandidate
  - proposed memberName
  - role / routing description
  - responsibilities / negative hints
  - evidenceRefs
  - status: candidate | confirmed | rejected | merged

RoleMemoryCandidate
  - memberName
  - distilled learning
  - evidenceRefs
  - source: session-retrospective | import | eval-correction
  - status: candidate | active | rejected | superseded
```

这些候选默认不进入 `member-m[0]`。只有 host-applied confirmation / promotion 后，profile 才能成为 default Expert，memory 才能成为 active baseline material。

### 7.4 允许进入默认 Experts 的来源

允许进入默认 Experts 的 member 来源是：

1. **项目模板**：产品内置或 workspace 明确安装的模板，例如 `skill-designer`、`live-eval-checker`。
2. **用户显式创建/确认的 profile**：用户或 parent agent 明确要求创建某个 member，并确认其 name、role、routing、standards。
3. **import/migration**：从已有 confirmed profile、retained run ledger、人工维护材料或其它 Context Tree workspace 导入，必须有 provenance 和 confidence。
4. **workspace-session-derived lifecycle bootstrap**：从同一 repo/workspace 的用户 session corpus 中提取的 `MemberProfileCandidate` 被 host 验证并确认后成为 profile。
5. **真实 run 后形成**：某个 member 被显式调用、产生 `MemberTaskRun`、结果回到 parent agent，后续 retrospective/maintenance 再提炼 role memory。

### 7.5 禁止的路径

禁止：

- 扫描 docs 后自动把章节、模块、topic、eval lane 变成默认 Expert；
- 生成 docs-derived `MemberRosterDraft` 并把它当作产品主路径；
- 把文档中抽出的 `initialRoleMemoryDrafts` 当作 active role memory；
- 把未被用户确认、未被 import 记录接受、未经过 session-derived host confirmation 或真实 run 的 member 放进默认 Experts；
- 把文档主题当作 memberName 的唯一依据。
- 让 parent agent 在没有说明长期影响、没有 source refs、没有用户请求/同意语境的情况下静默写 active durable member memory。

### 7.6 用户体验

第一次使用时，产品可以提供少量模板 member，也可以从用户 session history 给出可审查的 candidate：

```text
Context Tree 找到一个可能的 member：skill-designer
依据：在这个 workspace 的多条用户 session 中，你多次要求审查 skill trigger、rule/skill 分离、Superpowers description；并多次纠正“agent 不知道自己是 controller”。
操作：Confirm / Rename / Add to existing Expert / Discard
```

或者用户/parent agent 可以显式说：

```text
创建一个 skill-designer member，以后负责 skill / trigger / Superpowers 兼容设计。
```

系统随后可以用用户 session、历史 run、项目文档帮助填充 `MemberProfileCandidate`。UI 上可以称为“建议的 Expert”，避免把它误解成已经生效的 profile。关键呈现不是“系统从文档发现了一个 member”，而是“系统从你的实际对话/使用历史中发现了一个可确认的职责模式”。

未确认 candidate 不能进入默认 Experts。它可以留在 candidate/review queue 或 searchable history。

如果主 agent 在正常任务中建议创建或修改 member，它应在主窗口直接说明建议，例如：

```text
我建议把这条长期规则写入 skill-designer：trigger 要从普通 agent 视角描述，不假设 agent 知道自己是 controller。你同意的话我会记录到该 member 的 role memory。
```

Context Tree 不需要额外弹窗确认这句话；它只记录 agent-mediated mutation、source refs 和后续 maintenance 状态。

### 7.7 与 Magic Context 的对应关系

可直接借鉴 Magic Context 的原则：

- raw session history 可搜索/展开，不默认全塞进 prompt；
- cold start 默认扫描 repo/workspace session corpus，而不是单个 session；
- root sessions 优先，subagent/hidden child sessions 默认排除；
- watermark、overlap、cap 和 frontier 必须显式记录；
- retrospective 从 user friction / repeated signals 中学习，而不是抄用户原话；
- agent 产 manifest，host apply mutation；
- candidate 先进入 m[1] / searchable / review queue，promotion 后才进 m[0]；
- triggered maintenance 不强迫 prompt cache bust，变更随下一次自然 materialization 合入。

不同点：Magic Context 维护 project/user memory；Context Tree cold start 维护 per-member profile 与 role memory。

## 8. Invocation Flow

### 8.1 显式调用主路径

V1 主路径是显式 member 调用：

```text
parent agent / user selects memberName
  -> resolve TeamMemberProfile
  -> render member-m[0]
  -> assemble member-m[1]
  -> deliver invocation packet through runtime/adapter
  -> invoke runtime native subagent/custom agent where available
  -> member returns answer to parent agent
  -> write MemberTaskRun + ContextRender + trace
  -> Workbench displays task/result/used context
```

“显式”不等于用户每次手打 CLI。它可以是 parent agent 在正常任务流程中决定调用已知 member，但产品不要求模型自然触发未知 native spawn。

### 8.2 自动路由后置

自动路由可以存在，但必须满足：

- 可解释为什么选某 member；
- explicit invocation 优先；
- 不强行匹配；
- ambiguous 时返回候选；
- 不作为 V1 成功标准。

### 8.3 Result Return

member 结果应进入 parent agent 的可用上下文，而不是只落盘。

最小返回：

```text
member answer summary
key recommendations / blockers
refs to detailed artifacts
whether result was returnedTo parent-agent
```

Workbench 是审计与继续工作表层，不替代 parent agent result channel。

`returnedTo: parent-agent` 只有在以下至少一种证据存在时才能声明：

- parent turn / transcript 中能观察到 member answer 或其 summary；
- runtime child-result / wait API 的返回值被 parent agent 接收；
- tool / sidecar call 将 member answer 作为调用结果返回给 parent agent；
- adapter 写出的 parent-call record 能把 invocation、executor output、parent-visible result 关联起来。

仅写入文件、Workbench 可见、或 retained artifact 存在，不等于结果回到了 parent agent。此类路径应标为 `returnedTo: file`、`manual`、`eval-runner` 或 `unknown`，不能冒充 parent-agent result return。

## 9. Evidence 与 Workbench

### 9.1 Evidence 边界

产品语言不应把 `authorized-*`、`MECHANISM PASS`、`PRODUCT PASS` 放到用户第一层。

但 trace 必须诚实记录：

- live run / retained run / fixture / source-derived；
- explicit member route / native subagent route / sidecar route；
- parent transcript 是否真实 observed；
- result 是否 returnedTo parent-agent；
- context materials 是否 model-visible / mounted / searchable / source-only；
- known losses。

### 9.2 Workbench 第一层

Workbench 第一层应使用工作语义：

```text
Expert
Task
Status: Assigned | Working | Returned | Applied | Needs input | Blocked | Failed
Run kind: Live run | Local harness | Test run | Retained run
Returned to: parent-agent
Result
Used context
```

### 9.3 Trace

Trace 展示底层证明和调试材料：

- parent invocation source；
- runtime observation；
- material selection report；
- context render digest；
- input/output digest；
- acceptance/eval verdict；
- retained/source/live classification。

## 10. 行为评估

### 10.1 Initial member creation eval

这是显式创建/import 边界 eval，不是自动 discovery eval。

输入：用户或 parent agent 明确要求创建 `skill-designer`，并允许系统参考本项目已有 docs、plans、eval artifacts 和 run ledger 填充 `MemberProfileCandidate`。

期望：系统只为被请求的 `skill-designer` 生成可确认 profile；profile 带 evidence refs、routing description、standards refs，但不会扫描并自动创建其它默认 Experts，也不会把文档摘录直接写入 active role memory。

失败信号：

- 未经请求自动生成多个 Experts；
- 为一次性任务或文档章节生成 member；
- 没有 evidence refs；
- 把 runtime instance id 当 memberName；
- 未确认 profile 或文档摘录直接进入 durable baseline。

### 10.2 Session-derived cold start eval

这是 cold start 的核心 eval。它分成 retained/hermetic 与 live 两层：retained eval 验证 schema、gate 和 negative controls；live eval 验证系统能从真实/导出的用户 session 中提取 member lifecycle 候选，并在失败时进入 eval->纠错->重新 eval loop。两层都必须证明 docs-only 不能越权。

输入：一组 retained session records，包含用户多次围绕 skill trigger / rule-skill separation / Superpowers description 与 agent 讨论，并纠正“agent 未必知道自己是 controller”；同时提供只含项目 docs/plans/eval reports、但没有 session/import/run evidence 的 docs-only negative fixture。

期望：

- 输出 `session-role-signals.json`，至少包含一个与 skill design 相关的 repeated delegation / correction signal；
- 输出 `member-profile-candidates.json`，包含 `skill-designer` candidate，带 session refs、signal kinds、confidence、supporting docs/run refs；
- 如输出 `role-memory-candidates.json`，其 learning 必须是 distilled，不是用户原话；
- candidate 默认不进入 default Experts；
- candidate memory 默认不进入 `member-m[0]` 或 active role memory；
- docs-only negative fixture 不生成 default Expert、active memory 或 profile candidate。
- agent-mediated durable mutation 必须带 source refs、mutation source 和长期影响说明；不能无声写入 active baseline。

失败信号：

- 只能从 docs topic 生成 member，缺少 session refs；
- 把候选直接标为 confirmed/default Expert；
- 把用户原话长引用写进 role memory；
- docs-only fixture 生成 member；
- parent agent 无 source refs、无说明、无用户请求/同意语境地静默创建 active durable memory。

live eval 要求：

- 输入必须是真实 runtime observer export 或真实 session-store export；retained fixture 不能冒充 live pass；
- live report 必须记录 input source digest、attempt artifacts、issues 和 correctionLoop 状态；
- 如果缺少 live/exported session source，结果只能是 `blocked`，不能 pass；
- 如果 live extraction 失败，必须保留失败证据，写 regression，修正 extractor/validator/reporting，再对同一个 live input rerun；
- 直到 live pass、明确 blocked、或达到 correction attempt 上限，不能声称 product/live cold-start proof closed。

### 10.3 Runtime projection eval

输入：一个确认后的 `skill-designer` profile。

期望：生成 Claude/OpenCode/Codex definitions，且：

- names 符合各 runtime 约束；
- description 是 trigger/routing 语言；
- developer/body instructions 指向 Context Tree packet；
- 不嵌入本次 task target；
- registry 记录 `memberName -> runtimeAgentName` mapping。

该 eval 只证明 definition projection，不证明 invocation packet delivery 或 member result return。

### 10.3 Invocation packet delivery eval

输入：一个确认后的 `skill-designer` profile、一个 parent task、target materials、以及 runtime/adapter 配置。

期望：

- 生成 `MemberContextRender` 与 material selection report；
- invocation packet 包含 task question、m[0]/m[1] refs、target material refs、writeback/result-return refs；
- packet 通过 runtime/adapter 的可观察路径送达 member；
- `MemberTaskRun` 记录 packet ref、delivery evidence、known losses；
- 如果 runtime 只安装 definition 而未送达 packet，报告为 definition-only，不算完整 invocation 支持。

### 10.4 Explicit member invocation eval

输入：parent agent 请求 `skill-designer` 审查一个 SKILL.md trigger 设计。

期望：

- member run 创建；
- member-m[0]/m[1] render artifact 存在；
- 对 reviewer/checker 类任务，target material 必须 model-visible，或有 runtime read/expand evidence；mounted-only 只能算弱证据，不能单独证明 reviewer 看过目标；
- member result returnedTo parent-agent；
- Workbench 显示 task/result/used context；
- Trace 显示 evidence。

### 10.5 Feedback-to-memory eval

输入：用户在 member result 后反馈：trigger 不能写成 loop-controller，因为 agent 未必知道自己是 controller。

期望：

- 系统形成 feedback window；
- retrospective 输出 distilled learning；
- 不保存用户原话；
- learning 被路由到 `skill-designer` durable memory 或 pending review；
- 下一次 `skill-designer` run 可见该 memory；
- Workbench/trace 能证明该 memory 是否 model-visible。

### 10.6 Negative eval

输入：普通一次性请求或没有 member 归因的泛泛评价。

期望：不生成 durable member memory；最多进入 searchable history。

## 11. 实施分解建议

这份 spec 后续应拆成多个 implementation plan，而不是一次性实现。

建议顺序：

1. **Member Registry + Runtime Projection V0**
   - canonical profile；
   - Claude/OpenCode/Codex generator（三端都是 V1 projection 目标）；
   - registry mapping；
   - deterministic output tests；
   - installer / doctor / install report V0。

2. **Invocation Packet + Member Context Render V0**
   - invocation packet shape；
   - m[0]/m[1] render；
   - material selection report；
   - context render artifact；
   - visibility buckets；
   - packet delivery evidence；
   - native subagent prompt first path；
   - tool/sidecar fallback；
   - mounted packet weak-path labeling。

3. **Explicit Member Invocation Integration**
   - parent call -> member packet -> runtime/adapter -> returned answer；
   - ledger write；
   - Workbench integration。

4. **Member Retrospective Memory V0**
   - feedback window detector；
   - retrospective prompt（参考 Magic Context Dreamer，但输出 per-member role memory）；
   - parser/validator；
   - route to memory/experience/user observation/discard；
   - feedback-to-memory eval。

5. **Maintenance Tasks**
   - curate/verify/classify；
   - mutation log；
   - baseline fold。

6. **Profile Import / Explicit Creation Support**
   - for a user-requested or imported memberName, collect supporting docs/run ledger/conversation artifacts；
   - generate a confirmable `MemberProfileCandidate` / UI “建议的 Expert” for that member only；
   - surface it in Workbench setup/import, not only CLI/report；
   - keep all extracted learnings out of active role memory until retrospective/import validation promotes them。

## 12. 实施计划需要细化的问题

这些不再是架构方向待决项，而是 implementation plan 需要落 schema、测试和实现顺序的事项：

1. 三端 packet delivery 的首批 runtime-specific product proof 顺序。架构上已确定三端都做，且 native subagent prompt 是首选路径；实现计划应选择最容易获得真实 parent-result-return + session evidence 的 runtime 先闭环。
2. Retrospective 高置信自动 active 的 manifest 字段、阈值和 negative controls。架构上已确定参考 Magic Context classifier/verifier/manifest/host-apply discipline，默认 candidate/m[1]/searchable first。
3. Workbench setup/import 的 action-to-mutation schema 和测试。架构上已确定 V0 支持 Confirm/Rename/Add to existing Expert/Discard，且与 agent path 共用 durable mutation API；Add to existing Expert 对应 `merge_candidate_into_member`，只支持 candidate -> existing member。

## 13. 设计不变量

1. `memberName` 是稳定职责身份，不是 runtime instance。
2. Runtime projection 是入口，不是 evidence。
3. Member memory 由 Context Tree 管理，runtime memory 只是辅助。
4. 用户反馈、agent 观察和 run 结果必须带 source refs / mutation log，不能静默污染 durable baseline。
5. 主 agent 可以发起 durable member/profile/memory 变更，但不是唯一 classifier；长期 memory 仍要经过后续 verify/curate/classify/retrospective 维护。
6. member-m[0] 不被 task-local 材料污染。
7. member result 必须能回到 parent agent。
8. Workbench 第一层展示工作状态和结果，不展示 eval taxonomy。
9. Trace 必须保留证明边界，不能把 fixture/source-derived 误称 live/native。
10. Runtime agent definition 不等于 packet delivery；完整 invocation 必须有 delivery/result-return/writeback evidence。
11. 不存在 docs-only cold-start roster draft；只有确认 profile、import record、session-derived host-confirmed candidate、或真实 run lifecycle 能创建默认 Expert 或 durable baseline。
