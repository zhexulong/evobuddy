# 调研任务：WorkBuddy-style member UI 与开源竞品替代性

## 背景

Context Tree 的产品定位已经从严格的 session tree / checkpoint fork，收敛为：

```text
role-aware context graph + on-demand member task runs
```

也就是：主 agent 在需要时，把一次具体任务委派给某个可复用的 specialist member；实际执行走宿主 runtime 的 native subagent / teammate / fork / SendMessage；Context Tree 记录这次 `MemberTaskRun` 的 context sources、material path、fidelity、known losses、runtimeAgentId 和 result return。

用户提出一个新判断：这个体验某种意义上类似 WorkBuddy / AI coworker / AI workforce。我们需要调研：

1. 是否应该参考 WorkBuddy-style UI；
2. 有哪些 100+ star 的开源相邻/竞品项目；
3. 它们是否能替代 Context Tree，还是只能作为 UI / role library / workflow backend 参考；
4. 如果参考它们，Context Tree 的 UX 和架构边界应该怎样收窄。

## 需要回答的问题

### 1. WorkBuddy-style UI 是否适合我们

请调研 WorkBuddy、OpenClaw/Poco、Claude Agent Teams、Alook、OpenLoomi 等类似产品/项目的 UI 心智，判断下面这种用户体验是否成立：

```text
用户看到的是一组可复用的工作伙伴 / specialist members；
主 agent 在合适时机把任务交给某个 member；
member 有自己的职责、触发条件、历史纠正和 role memory；
member 完成后结果回到主 agent；
用户需要时可以展开查看这次 task run 的 context sources / evidence。
```

重点判断：

- 默认 UI 是否应该是 member roster，而不是 tree / graph；
- 每个 member 是否应该有 profile、recent task runs、remembered corrections、available actions；
- `MemberTaskRun` 是否应该以 timeline / task drawer 形式展示；
- context inheritance / provenance / fidelity / known losses 是否应该默认隐藏，只作为可展开 evidence 层；
- 是否应该提供类似 team/coworker 的 direct message / continue previous member task 能力。

### 2. 开源竞品/相邻项目列表

请用 tavily-hikari、GitHub search、项目 README 和必要源码调研 100+ star 开源项目。至少覆盖以下候选，如果发现更相关的也加入：

- `jnMetaCode/agency-agents-zh`
- `simstudioai/sim`
- `MervinPraison/PraisonAI`
- `poco-ai/poco-claw`
- `alookai/alook`
- `melandlabs/openloomi`
- `mindsdb/anton`
- `saadnvd1/agent-os`
- `victordibia/autogen-ui`
- `AIOSAI/AIPass`
- `markus-global/markus`
- Claude Code Agent Teams 官方文档
- WorkBuddy 官方材料或可验证资料

对每个项目请记录：

```text
repo / URL
stars
license
定位一句话
核心 UI 模型
agent/member/team 模型
memory/context 模型
是否支持 native coding-agent runtime，例如 Claude Code / Codex / OpenCode
是否支持 persistent member / role memory
是否支持 task run evidence / replay / provenance
是否支持 context source / fidelity / known losses 这类审计
对 Context Tree 的替代风险：高 / 中 / 低
我们可借鉴点
不能替代我们的点
```

### 3. 替代性判断

请明确区分四类替代：

1. **UI 替代**：它已经有 member/team/task/artifact UI，我们是否只需要接入它；
2. **role/profile 替代**：它有可复用 agent definitions / skills / role library；
3. **runtime 替代**：它自己运行 agents，而不是复用 Claude/Codex/OpenCode native subagent；
4. **context/evidence 替代**：它是否真的能记录“这次 member task run 基于哪些上下文材料、哪些进入模型上下文、哪些只是 searchable/mounted、known losses 是什么”。

Context Tree 目前最重要的不可替代点假设是：

```text
不是再做一个 AI workforce platform；
而是在宿主 agent runtime 的 native subagent/team/fork 流程旁边，
记录和优化 context-bearing member task run。
```

请验证这个假设是否仍成立。

### 4. 对我们 UI 的具体建议

请输出一版最小 UX 信息架构。至少包括：

#### A. Member roster 默认视图

每个 member 显示哪些字段，例如：

```text
memberName
role / description
status: idle / running / needs-input / failed / archived
recent task runs
remembered corrections
available task kinds: consult / review / check / plan / diagnose
confidence / routing hints
```

#### B. Member detail

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

#### C. MemberTaskRun drawer

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

#### D. Graph/provenance 可展开层

请说明哪些图边默认隐藏，哪些需要可展开：

```text
member identity edge
runtime lineage edge
context source edge
work-product dependency edge
role/authority edge
result return edge
```

#### E. 用户操作

请给出 3-5 个用户流程：

- 显式让某个 member review；
- 主 agent 自动选择 member；
- 用户继续和某个 member 对话；
- 用户查看某次 task run 的 evidence；
- 用户修正 member 的行为并让它下次记住。

### 5. 对实现边界的建议

请明确我们是否应该：

- 只做 CLI/report，不做完整 UI；
- 做一个轻量 web UI；
- 作为 WorkBuddy/OpenClaw/Poco/Alook/OpenLoomi 的插件；
- 只输出标准 artifacts，让其它 UI 消费；
- 先实现 member registry + task run record，再决定 UI。

同时请给出 V0 推荐路径和非目标。

## 调研方法要求

- 优先使用 primary sources：官方 docs、README、源码、release notes、demo screenshots。
- 不要只根据项目 slogan 判断。
- 对每个结论标注证据来源。
- 明确区分 proven / likely / unknown。
- 对 license 做记录，特别是 AGPL/GPL 项目不要建议直接复制代码。
- 如果某项目只提供 marketing copy，标记为 evidence weak。
- 如果项目声称支持 memory/context，必须确认它是 document/RAG memory、workflow state、agent conversation history、还是 native runtime context provenance。

## 输出格式

请输出一份中文调研报告，建议保存为：

```text
architecture/12-workbuddy-style-member-ui-and-competitor-survey.md
```

报告建议结构：

```text
# WorkBuddy-style member UI 与开源竞品替代性调研

## 0. 结论摘要
## 1. 我们当前的产品假设
## 2. WorkBuddy / coworker UI 心智是否适合
## 3. 竞品矩阵
## 4. 替代性分析
## 5. 可借鉴 UI 模式
## 6. 不应照搬的模式
## 7. 推荐 UX 信息架构
## 8. 推荐实现边界
## 9. 未解决问题与下一步调研
```

## 关键判断标准

最后请必须回答这三个问题：

1. **我们是否应该把用户心智从 Context Tree 改成 WorkBuddy-style member/coworker？**
2. **是否存在 100+ star 开源项目已经足以替代我们？如果有，是替代哪一层？**
3. **如果不被替代，我们最小不可替代产品边界是什么？**

