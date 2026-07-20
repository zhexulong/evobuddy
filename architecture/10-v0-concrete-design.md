# V0 具体设计：从 Checkpoint-derived Helper 到 Team Member Activation

> 更新：`checkpoint-derived helper` 是 V0 的最小实现切片，但不再代表完整产品定位。完整定位见 `architecture/11-context-bearing-team-member-design.md`：Context Tree 应发展为按需激活 context-bearing team member / consultant 的层。parent checkpoint reviewer 是基础 oracle/spec-review 场景，不是唯一上下文来源。

## 0. 目标

V0 先做一个最窄闭环：

```text
loop agent 在 activation point 声明可恢复锚点
→ 后续从该锚点派生 helper/reviewer/reflector 或激活对应 consultant
→ 派生 agent 获得本任务最有效、且来源正确的上下文材料
→ 派生 agent 的结果回到主 agent / eval runner
→ manifest 记录实际 materialSelectionMode、fidelity 和 known losses
```

这里的 activation point 可以是 parent checkpoint，也可以是任务/职责交接点。V0 为了实现收敛，仍优先证明 parent checkpoint reviewer；但 schema 和文档不应把 parentSession 写死为唯一模型。

V0 不承诺 reviewer 或 specialist member 质量优于 doc-only，也不实现通用文档化系统。

## 1. 核心原则

### 1.1 任务有效性优先，不把 native fork 绝对化

平台原生 fork 是重要候选，但不是天然最优答案。如果本次任务需要的是从长历史、compact/prune 后的会话里找到少量关键约束，`context-mode` 风格的 searchable history 可能比 native fork 更有效、更便宜，也更少噪声。

因此 V0 的选择原则是：

```text
先由任务决定需要什么材料，
再从 checkpoint/session lineage、role history、project memory、target materials 中选择来源正确的最高有效路径，
最后记录实际使用的 fidelity 与损失。
```

如果平台能做 session/thread fork，应作为强候选：

- OpenCode: `Session.fork({ sessionID, messageID })`；
- Codex: 已有 app-server thread/fork 或 native spawn 能力继续实测；
- Letta-style backend: fork conversation；
- 其它平台：按真实能力降级。

但 Context Tree 不应默认把 transcript 编译成 prompt，也不应默认把 forked session 的全部历史视为最佳材料。`history.search` / searchable history 不是低等 fallback；当任务更需要精准召回而不是上下文连续性时，它可以是首选材料路径。

### 1.2 上下文材料由任务决定

派生 agent / consultant 看到的材料分四类：

1. **平台原生/运行时选择的上下文**
   - forked session 的 model-visible history；
   - runtime compaction/prune/DCP 后的上下文；
   - subagent 自身 prompt。

2. **历史补充**
   - checkpoint capture 中的 session events；
   - compact snapshot；
   - searchable history directive；
   - message/turn boundary 前后的扩展。

3. **目标材料**
   - diff；
   - plan/design/doc；
   - target files；
   - reviewer 要审查的 artifact。

4. **角色长期上下文**
   - member profile；
   - 该职责上的用户纠正；
   - 过去成功/失败的输出和 review 结论；
   - 参考规范，例如 Superpowers skill 写法、Magic Context transform 规则、live eval 证据标准。

Context Tree 提供材料入口和谱系，不替 agent 预判“全部都该看”。

### 1.3 helper 的身份必须明确

借鉴 Letta 的 fork reminder 和 Claude Agent Teams 的 teammate 分工，派生 agent / consultant 必须知道：

```text
你从某个 checkpoint/session 派生；
或你作为某个固定职责 member 被激活；
继承/恢复的上下文只是为了完成当前 helper/reviewer/reflector/specialist 任务；
不要继续 parent 当时正在做的旧任务；
你的结果会返回 caller；
你的工具权限可能不同于 parent。
```

这比“把上下文塞进去”更重要，否则 forked agent 可能把自己误认为主 agent。

## 2. 最小数据模型

### 2.1 ContextNode

```ts
type ContextNode = {
  id: string
  platform: "codex" | "opencode" | "claude-code" | "letta" | string
  sessionRef: string
  label: string
  createdAt: string
  recap?: string
}
```

节点只表示一个可引用的 session/context 位置。不要在 V0 加 `role/status/forkMode/returnRef`。

### 2.1.1 TeamMemberProfile

V0 可以不完整实现 member registry，但数据模型应预留这个概念，否则会把产品锁死在 parent-session reviewer。

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
  knownBadPatterns?: string[]
  activationHints?: string[]
  negativeActivationHints?: string[]
}
```

`name` 是 agent-facing canonical handle，例如 `skill-designer`。`id` 只在实现需要不可变存储键时使用，不应作为 agent 默认调用参数。若发生重命名，用 `aliases` 或 registry migration 兼容旧 activation。

命名和路由参考 Claude Code subagent / agent team：可复用职责用 definition 的 `name` 标识，用 `description` 告诉 Claude 什么时候委派；运行中的 teammate 另有 runtime agent ID。V0 应采用同样分层：`memberName` 是职责名，`resolvedMemberId` 是内部存储键，runtime agent ID 是本次激活实例。

V0 规则：

1. `name` 使用稳定 kebab-case slug，只含小写字母、数字和 hyphen。
2. `name` 表达职责，不表达一次任务、日期、session、checkpoint 或模型。
3. `description` 写成触发条件，而不是能力广告。
4. 自动路由时用 `description` / `responsibilities` / `activationHints` / `negativeActivationHints` 匹配任务。
5. 显式 `memberName` 优先；多个候选都匹配时优先更具体者，不确定时让主 agent 暴露候选而不是静默随机选。

例如：

- `skill-designer`：负责根据 Superpowers / local skill rules 写 skill design 和 implementation plan；
- `hook-implementer`：负责 agent runtime hook / plugin / sidecar 代码；
- `live-eval-checker`：负责 capability matrix、provider log、acceptance proof、negative controls；
- `architecture-reviewer`：负责判断产品边界和 overclaim。

这些 member 不要求永远是同一个 runtime session。可复用性来自 role profile + role history + 本次 invocation context。

### 2.2 Checkpoint

```ts
type Checkpoint = {
  id: string
  nodeId: string
  sessionRef: string
  anchor: {
    messageId?: string
    turnIndex?: number
    checkpointId?: string
    createdAt: string
  }
  label: string
  purpose: string
  capture: CaptureManifest
}
```

`anchor` 是关键：它定义“从哪里浅复制/恢复”，而不是只说“当前会话”。

Checkpoint 是 activation source 的一种，不是唯一 source。对 oracle/spec review，checkpoint 往往是最强 source；对 skill designer 这类固定职责 member，role history 可能比 parent checkpoint 更重要。

### 2.3 CaptureManifest

```ts
type CaptureManifest = {
  platform: string
  sessionRecordRef?: string
  checkpointRecordRef?: string
  compactStateRef?: string
  searchableHistoryRef?: string
  targetRefs?: string[]
  observedRuntime?: {
    supportsNativeFork?: boolean
    supportsMessageBoundaryFork?: boolean
    supportsSubagentReturn?: boolean
    supportsCompactionHook?: boolean
  }
  knownLosses?: string[]
}
```

这不是模型上下文本身，只是“未来能恢复/补充什么”的审计记录。

### 2.4 SpawnRun

```ts
type SpawnRun = {
  id: string
  baseCheckpointId: string
  requesterNodeId: string
  targetNodeId?: string
  childNodeId?: string
  task: {
    kind: "review" | "check" | "reflect" | "guide" | "plan" | string
    prompt: string
    targetRefs?: string[]
  }
  materialSelectionMode:
    | "native-fork"
    | "native-session-fork"
    | "platform-selected-context"
    | "searchable-history"
    | "history-supplemented"
    | "staged-docs"
    | "summary-only"
  fidelity: ContextFidelity
  result?: SpawnResult
  knownLosses?: string[]
}
```

### 2.4.1 MemberTaskRun

后续应把 `SpawnRun` 泛化为 `MemberTaskRun`：

```ts
type MemberTaskRun = {
  id: string
  memberName?: string
  resolvedMemberId?: string
  baseCheckpointId?: string
  requesterNodeId: string
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
    targetRefs?: string[]
  }
  contextSources: ContextSourceRef[]
  materialSelectionMode: string
  fidelity: ContextFidelity
  result?: SpawnResult
  knownLosses?: string[]
}
```

这解释了为什么 `boundary` 这个词需要保留但要改义：它不是 parentSession 边界，而是稳定 activation point / 工作交接点。

`MemberTaskRun` 表达的是“某个 member 承接并完成了一次任务”的运行记录，不是 Context Tree 自己执行 spawn 的动作。一次 task run 的 `task.kind` 可以是 consult、review、check、plan、reflect、guide、diagnose 或其它专业动作。同一个 member 可以在不同 task run 中执行不同动作，不能因为 action 不同就拆成多个 member。

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

### 2.5 SpawnResult

```ts
type SpawnResult = {
  resultRef: string
  returnedTo: "parent-agent" | "eval-runner" | "file" | "manual"
  summary?: string
  fullOutputRef?: string
  usage?: {
    inputTokens?: number | "unknown"
    outputTokens?: number | "unknown"
    cacheReadTokens?: number | "unknown"
    latencyMs?: number | "unknown"
  }
}
```

## 3. Agent-callable 原语

V0 提供低层原语，不提供 `spawnContextAgent` 这类“系统替你组装上下文”的高层 API，也不把 `activateMember` 做成核心 agent-facing primitive。我们是 subagent-native 模式：真正执行应由宿主 runtime 的 native subagent / teammate / fork / SendMessage 完成。Context Tree 负责准备 member task 所需的上下文约束，并记录 task run 的材料路径和结果。

```ts
ctree.where(): TreePosition

ctree.checkpoint(input: {
  label?: string
  purpose: string
  targetRefs?: string[]
  anchor?: "latest-turn" | { messageId: string } | { checkpointId: string }
}): Checkpoint

ctree.spawnFrom(input: {
  baseCheckpointId: string
  requesterNodeId?: string
  targetNodeId?: string
  kind: "review" | "check" | "reflect" | "guide" | "plan" | string
  prompt: string
  targetRefs?: string[]
}): SpawnRun

ctree.prepareMemberTask(input: {
  memberName: string
  requesterNodeId?: string
  baseCheckpointId?: string
  kind?: "consult" | "review" | "check" | "plan" | "reflect" | "guide" | "diagnose" | string
  question: string
  targetRefs?: string[]
  contextHints?: string[]
}): PreparedMemberTask

// 主 agent 随后调用宿主 runtime 的 native subagent / teammate / fork / SendMessage。

ctree.recordMemberTaskRun(input: {
  preparedTaskId?: string
  memberName: string
  runtimeAgentId?: string
  runtimeAgentType?: string
  resultRef: string
  summary?: string
  materialSelectionMode: string
  fidelity: ContextFidelity
  knownLosses?: string[]
}): MemberTaskRun

ctree.attachResult(input: {
  spawnRunId: string
  resultRef: string
  summary?: string
}): SpawnRun
```

`prepareMemberTask` 不执行 spawn。它只是解析 `memberName`、读取 profile / role history、生成给宿主 runtime subagent 的任务说明、记录 expected context sources / result contract。真正执行发生在宿主 runtime。`recordMemberTaskRun` 记录这次 native subagent/team/fork 调用的结果、runtime agent identity、material path 和 known losses。

如果某个平台 adapter 处在真实 runtime 内且能调用 native spawn/wait/sendMessage，可以提供 convenience wrapper `activateMember`，但它只能是 `prepareMemberTask + native runtime call + recordMemberTaskRun` 的封装，不是核心架构原语。

可选但不作为首批阻塞：

```ts
ctree.history.search(input: {
  checkpointId: string
  query: string
  mode?: "fts" | "semantic" | "hybrid"
  limit?: number
}): HistorySearchResult[]
```

`history.search` 借鉴 `context-mode` / Letta recall：历史补充由 helper agent 按任务查询，而不是 Context Tree 自动注入全量历史。

## 4. V0 执行流程

### 4.1 创建 checkpoint

```text
主 agent 判断当前 loop 到达关键边界
→ 调用 ctree.checkpoint
→ adapter 记录 sessionRef + anchor
→ capture manifest 记录当前平台可用恢复能力
```

checkpoint 不要求用户退出 agent UI，不要求写 design doc。

这里的“关键边界”应读作 activation point：一个稳定的职责调用点。它可能是阶段切换，也可能只是主 agent 发现“这件事应该交给 skill-designer / live-eval-checker / architecture-reviewer”。

### 4.2 派生 helper/reviewer

```text
主 agent 调用 ctree.spawnFrom(baseCheckpointId, task, targetRefs)
→ adapter 选择本任务最有效且来源正确的材料路径
→ 创建 child session / forked session / subagent
→ 注入 helper identity reminder + task prompt + target refs
→ child 执行
```

### 4.2.1 委派固定职责 member task 并记录

```text
主 agent 调用 ctree.prepareMemberTask(memberName, question, targetRefs, optional checkpoint)
→ Context Tree 读取 member profile / role history，并返回 task prompt / context source refs / result contract
→ 主 agent 调用宿主 runtime 的 native subagent / teammate / fork / SendMessage
→ member 在宿主 runtime 中执行并返回结果
→ 主 agent 或 adapter 调用 ctree.recordMemberTaskRun 记录结果和 material path
```

示例：

```text
memberName = skill-designer
question = 根据当前讨论和 Superpowers writing-skills 规范，制定 context-tree skill 的 design/implementation plan
targetRefs = docs/skills/context-tree-*/SKILL.md, docs/skills/context-tree-skill-rules.md
contextSources = member-profile + role-history + current parent discussion + target files
```

内部 manifest 应记录完整 graph：member identity、activation point、runtime lineage、context sources、result return。用户界面或 agent-facing 输出则默认呈现一个稳定 member，而不是把每个 context source 都显示成不同节点。runtime/context 继承关系应可展开查看，但默认可以隐藏；否则用户会把“同一个 member 的不同激活材料”误读成多个不同 agent。

这类 member 不一定需要从 parent checkpoint 完整 fork。它需要的是：本次任务要求 + 角色历史 + 目标材料 + 必要的当前讨论。若 runtime native fork 会带入大量无关工具输出，Magic Context / context-mode 风格的 fork-prune/search-expand 可能更好。

适配器候选路径：

1. `native-fork`：平台可从 checkpoint anchor 原生 fork。
2. `native-session-fork`：平台可复制 session 到 message boundary。
3. `platform-selected-context`：平台 subagent/spawn 自己选择上下文。
4. `searchable-history`：child agent 通过 checkpoint 或 role history 绑定的历史索引按任务查询。
5. `history-supplemented`：native/platform context 不足时，额外补充历史查询入口、role history 或片段。
6. `staged-docs`：只注入 docs/task artifacts。
7. `summary-only`：负控/降级，不算成功路径。

这不是固定优先级。对需要连续执行状态的任务，native fork 可能最好；对 review/reflect 这类只需要少量关键决策和排除项的任务，`searchable-history` 可能优于 noisy fork；对固定专业职责任务，role history 可能比 parent checkpoint 更重要。V0 必须把选择结果写进 manifest，而不是把任一路径包装成“完整上下文”。

注意：当前实现枚举尚未包含 `role-memory-supplemented`。在更新 `src/core/context-tree-manifest.mjs` 前，role memory 应通过 `materialSelectionMode: "history-supplemented"` 加 `contextSources.kind = "role-history"` 表达，避免 contract 与实现漂移。

### 4.3 结果回流

优先参考 OpenCode TaskTool：

```text
foreground:
  parent 等待 child 完成
  spawnFrom 返回 <task_result>

background:
  child 完成后写 fullOutputRef
  向 parent 注入 synthetic task notification
  attachResult 记录 resultRef
```

Codex live eval 可以先由 eval runner 收集结果；产品路径后续再接父 agent 可见消息。

## 5. 平台适配策略

### 5.1 Codex-first

继续沿用当前仓库已有 Codex eval：

- app-server thread/fork；
- native spawn artifact；
- persisted rollout/session evidence；
- canary positive/negative。

V0 要补的不是更多 canary，而是统一 manifest：

```text
checkpoint manifest
spawn manifest
result manifest
fidelity/knownLosses
```

### 5.2 OpenCode adapter

OpenCode 是最清晰的实现参考：

- checkpoint anchor 对应 `sessionID + messageID`；
- spawnFrom 可以用 `Session.fork({ sessionID, messageID })`；
- child session 用 Task/subagent 执行；
- result return 用 synthetic `<task>` 或 task notification。

如果先不直接嵌入 OpenCode runtime，可先在调研/测试中模拟该路径，作为目标 adapter 设计。

### 5.3 Context-mode-inspired capture backend

不要把 `context-mode` 当依赖先接进来，但要把它作为一等参考 backend，而不是简单 fallback。先借鉴结构：

- durable session event store；
- searchable history index；
- compact/resume directive；
- raw events 不直接注入。

后续如果确认可复用，再考虑集成。若 implementation e2e 或后续质量 eval 显示 searchable history 在 review/check/reflect 上优于 native fork，Context Tree 应收敛为：

```text
tree/checkpoint/subagent/result layer
+ context-mode-style capture/search material backend
```

而不是坚持 native fork 作为唯一主路径。

### 5.4 Magic-Context-inspired fork-prune / role memory backend

Magic Context 的正确启发不是“直接依赖它”，而是：上下文管理应尽量发生在 runtime message/system transform 层，带有 tag、protected tail、search/expand、cache-aware mutation 和 historian compartment。

Context Tree 可以借鉴这类机制实现：

```text
parent/runtime context + role profile + role history + target materials
→ fork-prune / search-expand / compact-aware materialization
→ consultant initial context
```

但 Magic Context / Dreams 只能作为可选 backend 或优化器，不能替代 Context Tree 的 activation、lineage、result return 和 material-path evidence。

### 5.5 llm-context-viz-inspired observability

`ref/llm-context-viz` 的 JSONL parser 和 calibration proxy 适合作为观测参考：

- JSONL parser：帮助估算 session / turn / context category；
- provider proxy：帮助捕获真实 model request，证明 consultant 实际看到什么；
- monitor/UI：帮助发现上下文污染、compaction reset、material path 差异。

它不应作为产品上下文组装器。离线日志估算不是 runtime prompt assembly。

## 6. Implementation E2E 通过标准

V0 e2e 不测 review 质量，只测链路。

必须证明：

1. checkpoint 有可审计 anchor。
2. spawnRun / activation 记录 base/requester/target/member。
3. child agent 不是 fresh-thread 伪装。
4. child agent 能看到 checkpoint 前的关键 user/assistant 决策。
5. child agent / consultant 收到身份提醒，不会继续 parent 旧任务。
6. result 回到 parent 或 eval runner。
7. report 区分 fidelity、materialSelectionMode、knownLosses。
8. native fork、searchable history、staged docs、summary-only/fresh-thread 的差异能被 report 表达。
9. summary-only/fresh-thread negative 不能 pass。
10. 对固定职责 member，role profile / role history 能作为明确 context source 进入 activation manifest。

建议第一个 live case：

```text
parent session:
  user 给出一个非公开偏好/排除项
  assistant 确认设计方向
  ctree.checkpoint

requester:
  产生一个需要 review 的 target note/diff
  ctree.spawnFrom(checkpoint)

reviewer:
  必须引用 checkpoint 前的偏好/排除项
  必须审查 target
  不得声称自己是 parent agent

assert:
  result returned
  fidelity recorded
  fresh-thread negative fail
```

## 7. 当前不做

- 不做自动 branch suggestion。
- 不做通用 doc set / Trellis 替代品。
- 不做自己组装每轮 model request。
- 不做完整 RAG/memory 平台。
- 不把 tool logs 当成默认高价值上下文。
- 不承诺 compact 后仍完整保真。
- 不先做 AACR 质量扩样。

## 8. 下一步

下一步写 implementation plan，范围只包括：

1. manifest 类型和文件落盘；
2. Codex eval runner 接入 checkpoint/spawn/result manifest；
3. positive/negative live e2e；
4. 最小 history supplementation stub；
5. 报告里输出 adapter path、fidelity、known losses；
6. 预留 member/profile/activation/source refs，但实现可以先只覆盖 checkpoint reviewer。

OpenCode adapter 作为第二阶段。context-mode / Magic Context 风格 capture/search/fork-prune 不阻塞 Codex-first V0 的第一条链路，但应作为第一批对比材料路径进入后续 e2e，而不是等到质量 eval 才考虑。固定职责 team member 场景建议以 `skill-designer` 作为首个非-reviewer scenario，因为它最能暴露 role history 是否真的带来价值。
