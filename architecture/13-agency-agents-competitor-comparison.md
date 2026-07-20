# agency-agents 对比短调研：member correction V0 不可替代边界

## 0. 结论摘要

先给直接结论：

1. **`agency-agents` 的 agent definition 本质上是“YAML frontmatter + markdown prompt body”的静态角色定义，不是运行时 agent schema。**[E1][E2]
2. **它没有内建的 per-member correction、role-history writeback、或确定性的 memory update 机制。**最接近的是 NEXUS 风格的 QA→Dev 文字模板循环，以及可选外接 MCP memory。[E3][E4][E5]
3. **它没有我们要的 per-run evidence / material visibility / result return contract。**它能要求 agent 产出带 `Evidence` 字段的文本模板，但不能证明某个 member 这次到底看见了什么材料、哪些真的进了模型、结果回到了哪里。[E3][E6][E7]
4. **因此它能替代的主要是 `TeamMemberProfile` / role catalog 层，不能替代 `member correction V0`。**如果我们的 V0 只做静态 member profile，也会被它覆盖；如果我们的 V0 把重点放在 correction-bearing `MemberTaskRun`，它就替代不了。[E8][E9][E10]

一句话概括：

```text
agency-agents = static role library
Context Tree member correction V0 = correction-bearing member task run system
```

## 1. `agency-agents` 的 agent definition 具体字段是什么？

本次调研的 canonical 项目是：

- `msitarzewski/agency-agents`（MIT，230+ agents）；
- 我们之前在 `architecture/12` 里提到的 `agency-agents-zh` 更像中文分发/镜像，不应作为 schema 主依据。[E1][E11]

它的每个 agent 都是一个 `.md` 文件，结构为：

```text
YAML frontmatter
+ markdown body
```

### 1.1 frontmatter 字段

根据项目的 `CONTRIBUTING.md` 和 `scripts/lint-agents.sh`，核心字段是：[E1][E2]

| 字段 | 必填 | 含义 |
|---|---|---|
| `name` | 是 | agent 显示名称 |
| `description` | 是 | 一行描述 |
| `color` | 是 | 颜色名或十六进制颜色 |
| `emoji` | 否 | 图标 |
| `vibe` | 否 | personality/vibe 钩子 |
| `services` | 否 | 外部依赖数组，元素含 `name` / `url` / `tier` |

这说明它的 definition 更像：

```text
display metadata
+ routing description
+ long-form prompt body
```

而不是：

```text
runtime agent identity
+ context source contract
+ evidence contract
+ correction contract
+ result return contract
```

### 1.2 markdown body 结构

项目推荐的 body 分区包括：[E1]

- `Your Identity & Memory`
- `Your Core Mission`
- `Critical Rules You Must Follow`
- `Your Technical Deliverables`
- `Your Workflow Process`
- `Your Communication Style`
- `Learning & Memory`
- `Your Success Metrics`
- `Advanced Capabilities`

其中 `Identity & Memory` 小节里常见子项是：

- `Role`
- `Personality`
- `Memory`
- `Experience` [E1]

但这里的 `Memory` / `Learning & Memory` 仍然只是 **prompt 文本中的自我描述**，不是一个独立的数据层或运行时 memory API。

### 1.3 关键判断

所以，问题 1 的准确答案是：

> `agency-agents` 的 agent definition 字段，主要是 `name / description / color / emoji / vibe / services` 这些静态定义，加上一组推荐的 markdown prompt section。它没有我们这里 `MemberTaskRun`、`contextSources`、`materials`、`fidelity`、`knownLosses`、`result.returnedTo` 这类运行时记录字段。[E1][E2][E9]

## 2. 它有没有 per-member correction / role-history / memory update 机制？

### 2.1 per-member correction

**结论：没有内建机制。**[E3][E4]

它最接近 correction 的地方，是 NEXUS 协调文档里定义的 QA/Dev 循环：

```text
Developer implements
→ Evidence Collector tests
→ PASS / FAIL
→ if FAIL, send feedback and retry
```

但这仍然是：

- 对话层的 handoff 模板；
- 由宿主 LLM 和用户手工继续流程；
- 不是一个稳定 member 的 correction ledger。

换句话说，它有 **correction-shaped workflow text**，没有 **per-member correction system**。[E3][E4]

### 2.2 role-history

**结论：没有。**[E1][E5]

`agency-agents` 里没有类似下面这种结构：

```text
this member accumulated:
- user corrections
- accepted review conclusions
- repeated failure patterns
- remembered exclusions
```

它的 `Learning & Memory` 只是在 prompt 里写“你应该记住什么样的经验”，并不对应可引用的 `roleHistoryRefs` 或 `role-memory/*.md` artifact。[E1]

而我们本地设计里，`role history` 已经是明确的产品对象：

- `TeamMemberProfile.roleMemoryRefs`；
- `MemberTaskRun.contextSources.kind = "role-history"`；
- `docs/role-memory/skill-designer-corrections.md` 作为最小物化起点。[E8][E9][E10]

### 2.3 memory update

**结论：只有可选、外接、非确定性的 memory。**[E5]

`agency-agents` 提供了一个 `integrations/mcp-memory` 方向，允许 agent 通过外部 MCP memory server 做 `remember` / `recall` / `search` / `rollback` 一类操作；但这不是：

- agent definition 的内置字段；
- 每次 run 都会发生的 writeback；
- framework 层保证的一致性更新。

它更像：

```text
if host LLM decides to call external memory tools,
some memory may be updated
```

因此问题 2 的简短答案是：

> `agency-agents` 没有内建的 per-member correction / role-history / deterministic memory update。它最多提供静态 prompt 中的“记忆人格化表述”，外加可选 MCP memory 集成；真正的 correction 与历史积累不是框架保证。[E1][E3][E4][E5]

## 3. 它有没有 per-run evidence / material visibility / result return？

### 3.1 per-run evidence

**结论：只有文本模板意义上的 evidence，没有结构化 per-run evidence contract。**[E3][E6][E7]

例如它的 handoff template 会要求填写：

- `Evidence`
- `Screenshots`
- `Functional Verification`
- `Accessibility`
- `Performance`

这些确实是“证据型输出”，但它们的载体是：

```text
LLM-written text in conversation
```

不是：

```text
typed run record + runtime/provider evidence refs
```

### 3.2 material visibility

**结论：没有。**

它没有办法回答我们特别关心的几个问题：

```text
这次 member 基于哪些 source materials？
哪些只是可访问？
哪些真的进入模型可见上下文？
哪些只是被 prompt 提醒“你应该知道”？
```

而我们本地 contract 已经把这层做成显式字段：

- `materials.modelVisibleEvidenceRefs`
- `materials.mountedEvidenceRefs`
- `materials.searchableEvidenceRefs`
- `materials.sourceOnlyRefs` [E9]

这正是 `agency-agents` 完全没有覆盖的层。

### 3.3 result return

**结论：没有结构化 return contract。**

`agency-agents` 没有类似以下字段：

- `expectedResultReturn`
- `result.resultRef`
- `result.returnedTo`
- `memberTaskRequestRef`

也就是说，它无法稳定记录：

```text
this member's result returned to parent-agent / eval-runner / file / manual
```

而我们本地 `MemberTaskRun` contract 已把这部分写成产品主记录的一部分。[E9]

因此问题 3 的答案可以直接写成：

> 没有。`agency-agents` 可以产出带 `Evidence` 字段的文本结果，但没有 per-run evidence ledger、没有 material visibility 分层、没有结构化 result return。它表达的是“agent 应该如何汇报”，不是“系统如何证明一次 member task run 的材料路径和回流路径”。[E3][E6][E7][E9]

## 4. 我们的 member correction V0 应该如何避免被它替代？

这里最重要的不是“功能比它更多”，而是 **产品边界不能落在它擅长替代的层上**。

### 4.1 它最容易替代我们的哪一层

如果我们只做：

- member roster；
- role/profile 文案；
- activation hints；
- static standards refs；
- “某个 member 看起来很专业”的 prompt 包装；

那它确实很容易替代我们。

因为 `agency-agents` 本来就擅长：

```text
large role catalog
+ reusable prompt identities
+ rules / workflow / success metrics sections
```

这也是为什么我们自己的 `TeamMemberProfile` 不应被误认为护城河；它只是 member identity input，不是 runtime evidence。[E8][E11]

### 4.2 V0 应该把不可替代性放在哪里

应当把 V0 的边界收敛到：

```text
correction-bearing MemberTaskRun
+ role-history writeback
+ material visibility proof
+ result return anchor
```

更具体地说，至少要有下面 5 点：

#### A. correction 必须写回可引用 artifact，而不是只改 profile prompt

例如：

- `docs/role-memory/<member>-corrections.md`
- 或后续更结构化的 correction records

并且下一次 activation 时，作为：

- `TeamMemberProfile.roleMemoryRefs`
- `MemberTaskRun.contextSources.kind = "role-history"`

进入候选材料。[E8][E9][E10]

#### B. correction 必须和具体 run 绑定

不能只是“这个 member 以后记住了”。

要能回答：

```text
哪一次 run 触发了这条 correction？
由谁提出？
纠正的对象是什么？
下次是否真的被带入？
```

这要求至少存在：

- `activationPoint`
- `memberTaskRequestRef`
- `contextSources`
- `result.returnedTo` [E9]

#### C. correction 必须区分“存在”与“被看见”

这是避免退化成普通 notes 的关键。

只要 correction 文件存在，并不能说明这次 member 真看见了它。真正要记录的是：

- 它只是 `source-only`；
- 还是 `searchable`；
- 还是 `mounted`；
- 还是 `modelVisible`。 [E9]

这一步是 `agency-agents` 完全没有覆盖、但对我们最关键的不可替代边界。

#### D. correction 需要 negative control

V0 应继续保留像当前 acceptance fixtures 里那样的负控思路：

- missing role-history；
- missing target-material；
- summary-only 不得 pass。

否则系统只会“声称 correction 生效”，但不能证明 omission 真的会被检测出来。[E9][E12]

#### E. result return 必须进入主 agent 当前 loop

如果 correction 只是写在某个笔记里，没有明确回到：

- `parent-agent`
- `eval-runner`
- `file`

那它还是一个外置 notes 系统，而不是 member task run system。[E9]

### 4.3 建议的 V0 边界表述

我建议把这次文档里的最终结论压成下面这句：

> `agency-agents` 能替代静态角色库，但不能替代带 correction writeback、role-history consumption proof、material visibility 分层和 result return anchor 的 `MemberTaskRun`。因此，`member correction V0` 必须避免落在“更好的角色 prompt”这条路上，而要落在“可证明这次 member 带着哪些纠正完成了任务”这条路上。[E1][E3][E8][E9]

## 5. 推荐结论

如果只给一个实现方向建议，那就是：

```text
不要把 V0 做成 profile-first member library；
要把 V0 做成 correction-bearing run record。
```

最小闭环建议是：

1. `TeamMemberProfile` 继续只承担 identity / routing 输入；
2. correction 写入 `role-memory` artifact；
3. 下一次 activation 把它显式列为 `contextSources.kind = role-history`；
4. 在 `materials.*` 四档里证明它到底是 source-only、searchable、mounted 还是 model-visible；
5. 用 `result.returnedTo` 和 `memberTaskRequestRef` 把这次 run 闭环起来；
6. 保留负控，避免系统把“有 correction 文件”误报成“correction 已生效”。

只要这个边界成立，`agency-agents` 就最多是我们可吸收的角色目录来源，而不是替代者。

---

## 证据来源

- [E1] `msitarzewski/agency-agents` `CONTRIBUTING.md`：agent frontmatter 与 body section 约定  
  https://github.com/msitarzewski/agency-agents/blob/75173cea526e3324f8e71084eae7581561be54c4/CONTRIBUTING.md
- [E2] `msitarzewski/agency-agents` `scripts/lint-agents.sh`：frontmatter 必填字段校验  
  https://github.com/msitarzewski/agency-agents/blob/75173cea526e3324f8e71084eae7581561be54c4/scripts/lint-agents.sh
- [E3] `msitarzewski/agency-agents` `strategy/coordination/agent-activation-prompts.md`：NEXUS QA/Dev coordination loop  
  https://github.com/msitarzewski/agency-agents/blob/75173cea526e3324f8e71084eae7581561be54c4/strategy/coordination/agent-activation-prompts.md
- [E4] `msitarzewski/agency-agents` `strategy/coordination/handoff-templates.md`：PASS/FAIL handoff 模板  
  https://github.com/msitarzewski/agency-agents/blob/75173cea526e3324f8e71084eae7581561be54c4/strategy/coordination/handoff-templates.md
- [E5] `msitarzewski/agency-agents` `integrations/mcp-memory/README.md`：可选外接 MCP memory 集成  
  https://github.com/msitarzewski/agency-agents/blob/75173cea526e3324f8e71084eae7581561be54c4/integrations/mcp-memory/README.md
- [E6] `msitarzewski/agency-agents` `testing/testing-evidence-collector.md`：Evidence Collector agent 定义  
  https://github.com/msitarzewski/agency-agents/blob/75173cea526e3324f8e71084eae7581561be54c4/testing/testing-evidence-collector.md
- [E7] `architecture/12-workbuddy-style-member-ui-and-competitor-survey.md`：此前对 `agency-agents-zh` 的 role-library-first 判断
- [E8] `docs/contracts/team-member-profile-contract.md`：profile 只声明身份，不证明 material consumption
- [E9] `docs/contracts/member-task-run-record-contract.md`：`role-history`、material visibility、`knownLosses`、`result.returnedTo` contract
- [E10] `docs/role-memory/skill-designer-corrections.md`：当前最小 role-memory 物化样例
- [E11] `architecture/11-context-bearing-team-member-design.md` 与 `architecture/00-overview.md`：Context Tree 的不可替代边界是 context-bearing member task run，而不是静态 member profile
- [E12] `fixtures/member-surface/final-acceptance/negative-missing-role-history/*`：role-history omission 的负控方向
