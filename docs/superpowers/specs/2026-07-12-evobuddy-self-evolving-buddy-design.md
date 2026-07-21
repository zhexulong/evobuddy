# Evobuddy 自进化 Buddy 设计

## 0. 结论

Product preset authority: bundled Buddy behavior lives in
`src/presets/buddies/<buddy>/BUDDY.md`, with preset registry metadata in
`src/presets/buddies/registry.json`. Fixtures remain retained test data only;
they are not authoritative product definitions.

Context Tree 当前主线应收敛为 **Evobuddy**：面向现有 coding agent runtime 的自进化专家伙伴层。

Evobuddy 不是 open-ended 自动发现专家，也不是另一个 agent shell。它的核心是：

```text
预设 buddy roster
  -> runtime-native subagent/member 调用
  -> 记录 BuddyRun
  -> 从真实 run / 用户反馈 / 失败修正中生成 evolution patch
  -> 更新 buddy 的 skill / profile / routing / memory
  -> 下次调用变得更贴合项目和用户
```

换言之，V1 不再把“从历史中发现新 member”作为主产品路线，而是把重点放在：**已有 buddy 如何在项目里越用越懂你。**

## 1. 背景判断

### 1.1 WorkBuddy-style 产品给了 UI 心智，不给自进化闭环

WorkBuddy / coworker-style 产品证明用户更容易理解：

```text
我有一组 experts / coworkers / agents；
我可以指派它们；
系统也可以建议使用它们；
最后我看到任务结果。
```

这适合作为 Evobuddy 的 surface：`Buddies / Tasks / Skills / Memory / Activity`。

但现有 WorkBuddy-style 调研没有证明它们有产品级的 expert/skill 自进化机制。它们通常有 roster、task history、connectors、memory、automation，但没有清楚证明：某个 expert 的 skill/profile/routing 会基于真实任务和反馈产生可审查 patch，并在下次调用中生效。

### 1.2 GenericAgent 给了 skill 自进化参考

GenericAgent 的公开描述是 “don't preload skills, evolve them”，并称每次解决新任务后会把执行路径自动固化为可复用 Skill。

更精确地看，它不是用户每次显式要求“保存成 Skill”，也不是 runtime 每个任务结束后无条件写入。它是 **agent-mediated automatic**：runtime 暴露 `start_long_term_update` 这类长期记忆更新动作，tool description 要求 agent 在发现可复用经验或长任务完成时主动调用；写入前读取 memory management SOP；只保存行动验证成功、未来可复用的信息。

Evobuddy 应借鉴这个机制，但不要把长期更新做成一个普通工具函数。对应动作应由一个预设 buddy 执行，例如 `evolution-buddy` 或 `buddy-evolution-reviewer`。它和其它 buddy 一样有 skill/profile/routing/memory，被 parent agent 调用，产出 `EvolutionPatch`，并且它自身也可以通过同一套 BuddyRun / EvolutionPatch 机制继续进化。

### 1.3 Magic Context 给了 memory 维护参考

Magic Context 的价值在于 memory 维护：dreamer、verify、curate、classify、dedup、retrieval count、mutation log、m[0]/m[1] 分层。

Evobuddy 应借鉴它的维护纪律，但不能把目标限定为 project memory。Evobuddy 维护的是：

- buddy skill；
- buddy profile；
- routing / anti-routing；
- per-buddy role memory；
- successful / failed run examples；
- evidence expectations；
- return contract。

## 2. 产品定位

### 2.1 一句话

```text
Evobuddy: self-evolving expert teammates for coding agents.
```

### 2.2 用户第一层心智

用户看到的不是 context tree，而是：

```text
Buddies
  skill-designer
  eval-proof-reviewer
  memory-maintainer
  runtime-integration-checker

每个 buddy 都有：
  skill / profile / routing / memory / recent runs / pending evolution patches
```

用户在正常 Codex / Claude Code / OpenCode 会话里工作。主 agent 可以调用 buddy；Workbench/TUI 只是查看、管理、审计和回滚。

### 2.3 不可替代点

如果只做 “skill + session extractor”，不可替代性很弱。Evobuddy 的不可替代点必须是：

1. **Preset buddy roster**：buddy 不是临时生成的专家，而是预设或用户确认的可复用职责身份。
2. **Runtime-native subagent use**：buddy 最终投影到 Claude/OpenCode/Codex 的 subagent / team member / skill / command surface。
3. **BuddyRun ledger**：每次 buddy 做了什么、看了什么、结果是否回到 parent agent，都有记录。
4. **Evolution patch**：从 run / feedback / correction / repeated success 中产生可审查 patch，更新 buddy 的 skill/profile/routing/memory。
5. **Versioned rollback**：buddy 进化不是覆盖文本，而是有版本、source refs、diff、回滚。

## 3. 核心对象

### 3.1 Buddy

稳定专家身份。对应原来的 `memberName` / `TeamMemberProfile`，但产品 copy 使用 `Buddy`。

字段：

```text
buddyName
displayName
role
skillRef
profileRef
routingRules
antiRoutingRules
memoryRefs
returnContract
runtimeProjections
version
status
```

`buddyName` 是稳定 key，不是 runtime child id，也不是某次 session。

### 3.2 Buddy Skill

Buddy 的可执行行为说明。它可以投影为：

- Claude Code subagent definition / skill；
- OpenCode agent definition / skill；
- Codex skill / plugin / app-server action；
- Context Tree 内部 prompt template。

Buddy Skill 本质上是文本和引用集合，但它不是普通 prompt 文件；它有版本、source refs、test/eval、routing examples、negative examples。

### 3.3 Buddy Profile

用户和主 agent 理解 buddy 的表层定义：职责、边界、适用场景、输入材料、输出格式、不要做什么。

Profile 面向 routing 和 UI；Skill 面向执行。

### 3.4 Buddy Memory

该 buddy 在某项目中的长期上下文：

```text
member-m[0]: active baseline
member-m[1]: recent/project-specific delta
searchable: run history, feedback windows, examples, old patches
```

Memory 可以被 evolve，但默认不直接污染 `m[0]`。新 learning 先进入 candidate / m[1] / searchable；达到条件后再 promotion。

### 3.5 BuddyRun

一次 buddy 被 parent agent 调用后的执行记录。

字段：

```text
runId
buddyName
requestingParentRef
runtimeSurface
taskQuestion
targetRefs
contextRenderRef
resultRef
returnedToParent
feedbackWindowRefs
evolutionSignals
traceRefs
```

BuddyRun 是 evolution 的主要证据来源。

### 3.6 Evolution Patch

对 buddy 的可审查变更提议。它不是直接改文件。

字段：

```text
patchId
buddyName
targetKind: knowledge-item | workflow | ordinary-skill | buddy-skill | buddy-profile | buddy-routing | buddy-memory | buddy-return-contract | new-buddy | discard
patchKind: create | update | split | merge | retire | promote | demote | discard
source: user-requested | agent-mediated | retrospective | eval-correction | repeated-success | repeated-failure
sourceRefs
beforeRef
afterProposal
diffSummary
reason
confidence
riskLevel
validationPlan
status: proposed | accepted | applied | rejected | superseded | reverted
```

### 3.7 Evolution Buddy

`Evolution Buddy` 是专门负责 buddy 自进化的预设 buddy，而不是普通 helper function。

建议初始名称：

```text
evolution-buddy
```

职责：

- 读取某个 buddy 的 BuddyRun ledger、feedback windows、当前 skill/profile/routing/memory；
- 判断是否存在值得保存的可复用经验；
- 先判断这条经验应该写入 knowledge、workflow、普通 skill、现有 buddy capability，还是创建/合并/放弃 buddy；
- 生成 `EvolutionPatch`；
- 标注 patch 风险、证据、验证方式和是否可直接进入 m[1]/searchable；
- 发现过宽/错误 evolution 时建议回滚或收窄。

非职责：

- 不直接覆盖 active skill/profile/routing；
- 不从 docs-only 材料生成 active memory；
- 不替代用户/parent agent 的产品判断；
- 不把每个任务都强行沉淀成 patch。

`Evolution Buddy` 自己也是 buddy。它有自己的 skill、profile、routing、memory 和 BuddyRun。若它反复误判 patch、过度保存、漏掉高价值反馈，系统应给 `evolution-buddy` 自己生成 evolution patch。这样自进化机制不是一个不可审计的硬编码后台规则，而是一个可调用、可审查、可回滚、也能被改进的 buddy。

### 3.8 Evolution Target Decision

`evolution-buddy` 的第一步不是写 patch，而是判定改动落点。否则系统容易把通用工作流沉淀到某个 buddy，把事实偏好误写成 skill，或为每个可复用模式创建一个新 buddy。

判定输出：

```text
targetKind
targetRef
decisionReason
alternativeTargets
rejectReason
```

落点规则：

- `knowledge-item`：经验是事实、偏好、决策或踩坑，不定义执行流程或独立角色。
- `workflow`：经验是有顺序、有命令、有检查点或纠错 loop 的重复操作，但不需要独立 runtime-visible buddy。
- `ordinary-skill`：经验是跨 buddy、跨角色的通用操作方法，例如“写任何 skill 前先检查 trigger description 是否 symptom-driven”。它不依赖某个 buddy 的身份，也不改变 buddy roster。
- `buddy-skill`：经验改变某个 buddy 执行任务的内部步骤、检查顺序、证据要求或输出格式。例如 `skill-designer` 审查 SKILL.md 时必须先看 writing-skills 参考。
- `buddy-profile`：经验改变用户和 parent agent 如何理解这个 buddy 的职责边界，例如把“eval-runner”改名/收窄为“eval-proof-reviewer”。
- `buddy-routing`：经验改变什么时候该调用或不该调用这个 buddy，例如“implementation plan 涉及 skill trigger 时调用 skill-designer”，“typo-only 文档修正不要调用 skill-designer”。
- `buddy-memory`：经验是项目/用户/目标相关的长期事实，但不改变 buddy 的通用能力，例如“本项目 eval proof 必须区分 retained/live/product”。
- `buddy-return-contract`：经验改变 buddy 返回给 parent agent 的结构或证据层级，例如必须返回 blocker、evidence refs、residual risk。
- `new-buddy`：经验反复指向一个稳定职责，但 knowledge/workflow/ordinary skill/现有 buddy capability 都不足以承载，例如“runtime session exporter maintainer”长期独立于 eval reviewer 和 skill designer。
- `discard`：经验一次性、未验证、来源不干净、无明确 buddy 归因，或只说明这次任务怎么做而没有未来复用价值。

必要约束：

- 同一条 learning 只能有一个 primary target；其它可能落点进入 `alternativeTargets`。
- 若需要同时改普通 skill 和 buddy，必须拆成多个 `EvolutionPatch`，并显式说明依赖顺序。
- `new-buddy` 只能生成 proposed candidate，不能直接 active；它必须说明为什么不能由 knowledge item、workflow、ordinary skill、shared practice 或现有 buddy profile/routing/capability 修正解决。
- `discard` 也是正式判定结果，必须保留原因，避免下次重复提出同一类低价值 patch。

Buddy 是高成本 artifact，因为它会进入 parent agent 和 runtime 的选择面。V1 应保持 active Buddy roster 小而稳定；大多数学习应先落到 knowledge、workflow、ordinary skill、shared practice 或 existing Buddy capability。只有当独立上下文窗口、稳定职责边界和 parent-visible return contract 都成立时，才提出 new Buddy。

## 4. 生命周期

### 4.1 初始化

V1 buddy 来源：

1. 产品内置 preset buddy；
2. 用户明确创建；
3. 从已有 confirmed profile/import 迁移；
4. 从已有项目模板安装。

V1 不做 open-ended 自动发现新 buddy。历史扫描只用于给已知 buddy 填充项目内 specialization，例如 routing examples、user preferences、known bad patterns、project-specific memory。

### 4.2 调用

```text
parent agent sees task
  -> reads available buddies / routing rules
  -> invokes selected buddy as runtime-native subagent/member when possible
  -> buddy receives skill + profile + m[0]/m[1] + target materials
  -> buddy returns concise answer to parent agent
  -> system records BuddyRun
```

调用必须尽量 natural use：主 agent 在正常任务里调用 buddy，而不是 eval wrapper 强迫调用。

### 4.3 反馈捕获

可触发 evolution signal 的情况：

- 用户指出 buddy 结果不对、漏了、过度泛化；
- parent agent 应用结果时发现需要修正；
- eval->纠错->重新 eval 证明某个规则应加入 buddy；
- 多次 BuddyRun 出现同一类成功模式；
- 多次 BuddyRun 出现同一类失败或 over-trigger；
- 用户明确说“以后这个 buddy 记住 X”。

不可触发：

- 一次性任务偏好；
- 无 buddy 归因的泛泛评价；
- tool output / workflow wrapper；
- 未验证计划；
- docs-only 猜测。

### 4.4 Evolution Proposal

Evolution 由 `evolution-buddy` 执行，不由当前 parent agent 直接吞完整历史，也不由一个不可见后台 helper function 决定。

```text
parent agent notices evolution signal
  -> invokes evolution-buddy
  -> evolution-buddy reads BuddyRun ledger + feedback windows + current buddy state
  -> evolution-buddy decides targetKind and targetRef
  -> evolution-buddy proposes one or more EvolutionPatch records
  -> parent agent summarizes patch and asks/apply according to policy
```

某些 runtime 会把 `evolution-buddy` 的执行存成 child session，但产品概念是 buddy run。

若 target decision 是 `discard`，流程仍应写入轻量记录，说明为什么不进入 patch。这样能避免相同的低价值 signal 被反复重新处理。

### 4.5 Apply

Patch apply 规则：

- 用户明确要求的 patch 可直接 apply，但仍记录 diff 和 source refs。
- agent 建议的 patch 需要 parent agent 说明长期影响；用户同意或上下文允许继续后 apply。
- `evolution-buddy` 提出的 patch 默认进入 proposed/pending，除非 confidence 高、risk 低、且只进入 m[1]/searchable。
- skill/profile/routing 的 active 变更必须 versioned。
- 高风险变更必须有 negative controls 或 smoke eval。

### 4.6 Rollback

所有 active evolution 都必须能回滚：

```text
buddy version N
  -> patch applied
buddy version N+1
  -> issue found
revert patch
buddy version N+2 or restore N
```

Workbench 应显示 patch history 和 revert action。

## 5. Evolution 类型

### 5.1 Skill Evolution

修改 buddy 执行行为：

- 增加步骤；
- 加载必要 reference；
- 修改输出格式；
- 加入禁止事项；
- 增加验证步骤。

例子：

```text
skill-designer 的 SKILL.md review 时，必须检查 description 是否是 symptom-driven trigger language。
```

### 5.2 Profile Evolution

修改用户/agent 看到的职责描述：

- role 更准确；
- responsibilities 拆分；
- nonResponsibilities 增加；
- displayName / shortTitle 调整。

### 5.3 Routing Evolution

修改什么时候调用 buddy：

- 增加 trigger symptom；
- 增加 anti-trigger；
- 调窄过宽触发；
- 标记需要先问用户；
- 标记需要另一个 buddy。

### 5.4 Memory Evolution

更新 per-buddy role memory：

- active rule；
- pending candidate；
- rejected pattern；
- golden example；
- known bad example；
- project-specific note。

### 5.5 Return Contract Evolution

修改 buddy 返回给 parent agent 的格式和证据要求。

例如 eval buddy 必须区分：retained / hermetic / live / product / observed。

## 6. 用户体验

### 6.1 正常使用

```text
用户：审查这个 implementation plan。

parent agent：这涉及 skill trigger 和 proof boundary。
我会让 skill-designer 看 trigger wording，让 eval-proof-reviewer 看 eval proof。

buddy 返回结果。

parent agent：skill-designer 发现 2 个 blocker；我会先修 plan。
```

### 6.2 自进化建议

```text
parent agent：这次 skill-designer 又漏掉了 contract pointer 的加载边界。
我建议给 skill-designer 添加一条 routing/memory patch：
“contract refs 只在实现/调用 writeback entrypoint 时加载，普通 runtime use 不需要加载。”
是否应用？
```

### 6.3 Workbench

Workbench 展示：

```text
Buddies
Tasks
Evolution Patches
Memory
Trace
```

Buddy detail：

```text
Skill Designer
  Version: 7
  Recent runs: 14
  Pending patches: 2
  Active memory: 5
  Last evolution: routing anti-trigger tightened
```

Patch detail：

```text
Patch: skill-designer-routing-20260712-a
Target: buddy-routing / skill-designer
Kind: update
Reason: repeated over-trigger on typo-only docs edits
Source refs: BuddyRun 12, BuddyRun 15, user correction 2026-07-12
Diff: add anti-trigger "typo-only edits"
Status: proposed
Actions: Apply / Edit / Reject
```

## 7. 和普通 Skill + Session Extractor 的区别

普通 skill + session extractor：

```text
load skill
search/extract history
answer current task
```

Evobuddy：

```text
project has preset buddy
buddy is invoked as subagent/member
run is recorded
feedback is linked to run
evolution-buddy decides whether to update ordinary skill, buddy skill/profile/routing/memory, or create/discard buddy
evolution-buddy proposes patch
patch changes the chosen target
new version affects future invocations
rollback is possible
```

如果没有 evolution patch、versioning、rollback、runtime projection、BuddyRun evidence，Evobuddy 就会退化成普通 skill package。

## 8. 非目标

V1 不做：

- open-ended 自动发现任意新 buddy；
- 把 knowledge 当作 skill/workflow/buddy 的统一本体；
- 为每个可复用命令、流程或偏好创建新 buddy；
- 完整 workforce platform；
- 自建 agent runtime；
- 静默后台改 active skill；
- 每次任务结束无条件改 buddy；
- docs-only 生成 active memory；
- 用 CLI wrapper 冒充 natural product route。

## 9. Eval 设计

### 9.1 Natural Buddy Use Eval

目标：证明 parent agent 在真实任务中会调用已知 buddy。

输入：安装好的 preset buddy roster + 一个自然任务。

通过：observed parent transcript 中能看到 buddy invocation 和 returned result。

失败：需要 eval wrapper 强迫调用；结果只落盘未回 parent。

### 9.2 Evolution Patch Eval

目标：证明一次用户反馈或 eval correction 能产生 patch proposal。

输入：BuddyRun + feedback window。

通过：生成 `EvolutionPatch`，source refs 指向真实 run/feedback，patch 只改允许字段，不直接 active apply。

### 9.3 Evolution Target Decision Eval

目标：证明 `evolution-buddy` 能先判断应该改 knowledge、workflow、skill、现有 buddy，还是提出 new buddy，而不是把所有经验塞进同一种 memory/skill，也不是默认创建 buddy。

场景：

```text
事实/偏好/决策 -> targetKind=knowledge-item
有顺序的重复操作/命令/纠错 loop -> targetKind=workflow
通用写作流程改进 -> targetKind=ordinary-skill
某 buddy 审查步骤遗漏 -> targetKind=buddy-skill
某 buddy 触发过宽/过窄 -> targetKind=buddy-routing
某项目长期 proof 偏好 -> targetKind=buddy-memory
某类稳定职责无法归入 knowledge/workflow/skill/现有 buddy capability -> targetKind=new-buddy
一次性反馈或来源不干净 -> targetKind=discard
```

通过：每个场景都有 source refs、decisionReason、alternativeTargets；`new-buddy` 保持 proposed，且说明为什么 smaller artifacts 不足；`discard` 不生成 active patch。

### 9.4 Apply And Regression Eval

目标：证明 patch 应用后下次 buddy 行为改变。

流程：

```text
run A fails or misses criterion
feedback captured
patch proposed and applied
run B on similar task
buddy now follows new rule
```

通过：run B 的 buddy output 明确体现新 skill/profile/routing/memory。

### 9.5 Negative Eval

必须证明：

- 一次性偏好不生成 active patch；
- tool output 不进入 evidence；
- docs-only 不生成 active buddy memory；
- typo-only edits 不触发 skill-designer；
- rejected patch 不影响 future invocation；
- reverted patch 不继续出现在 active projection。
- buddy-specific learning 不写入 ordinary skill；
- cross-buddy learning 不写入单个 buddy memory。

### 9.6 Cross-Runtime Projection Eval

同一个 buddy version 投影到 Claude Code / OpenCode / Codex。

通过：三端定义包含相同 buddy identity、version、routing summary、skill pointer；runtime-specific 格式可以不同。

## 10. 实施建议

### Plan A: Buddy Registry + Projection

- `BuddyProfile` / `BuddySkill` / `BuddyVersion`；
- preset roster；
- Claude/OpenCode/Codex projection；
- no CLI product route。

### Plan B: BuddyRun + Natural Invocation

- parent agent 调用 buddy；
- result returned to parent；
- BuddyRun ledger；
- Workbench 显示。

### Plan C: Evolution Buddy + Patch V0

- feedback window；
- `evolution-buddy` preset；
- evolution-buddy BuddyRun；
- target decision: ordinary skill vs buddy skill/profile/routing/memory vs new/discard buddy；
- patch proposal schema；
- apply/reject/revert；
- versioned projection。

### Plan D: Evolution Eval Loop

- fail -> feedback -> patch -> apply -> rerun；
- live observed proof；
- negative controls。

### Plan E: Workbench Evolution Surface

- pending patches；
- buddy versions；
- memory changes；
- run-to-patch provenance；
- rollback。

## 11. 设计不变量

1. Buddy 是稳定职责身份，不是 runtime session。
2. Buddy 可以由 skill 初始化，但不能只等于静态 skill。
3. Evidence 是共同来源；knowledge 是 artifact 类型之一，不是所有 artifact 的本体。
4. Buddy 是高成本 artifact；new buddy 是最后选项，不是默认沉淀目标。
5. Evolution 必须基于真实 run / feedback / correction / verified success。
6. Evolution 输出是 patch，不是静默覆盖。
7. Active skill/profile/routing/memory 变更必须 versioned。
8. Parent agent 是用户入口，Workbench 是管理/审计面。
9. Heavy evolution 由 `evolution-buddy` 执行，不由 parent agent 吞完整历史，也不由不可见 helper function 静默决定。
10. CLI wrapper 只能是 installer/debug/eval/legacy，不是主产品入口。
11. Natural use 和 returned-to-parent 是产品证明边界。
10. Evobuddy 的价值是 buddy 会变好，而不只是能被调用。
