# Trellis staged context sufficiency report

> 状态：本报告已被 `architecture/08-context-bearing-subagent-api-design.md`
> 修正。它保留为早期调研记录。当前 `08` 不再把 Trellis extension 或
> context-bearing subagent API 作为目标，而是要求先用真实 review eval
> 比较 designer checkpoint-fork reviewer 与 doc-only reviewer。

## Verdict

**B. Trellis staged docs 不完全够，但轻量扩展 Trellis 足够。**

一句话理由：**Trellis 已经结构化解决了 stable specs、task artifacts、per-agent staged context、platform-specific injection 和 workspace memory，但没有解决 runtime-visible checkpoint fidelity、tool-result visibility、compaction/prune state、以及 parent → reviewer → target 的上下文谱系。**这些缺口目前更像“checkpoint packet / reviewer packet”扩展点，而不是必须另起一个完整 Context Tree 产品。

---

## Research scope and method

- 本报告以 **`mindfold-ai/Trellis`** 为唯一目标项目。
- 主要证据来自：
  - 本仓库已有分析：`architecture/00-overview.md`, `architecture/03-harness-context-construction-survey.md`, `architecture/04-doc-vs-native-agent-deep-dive.md`
  - 真实 upstream checkout：`ref/Trellis-upstream/**`（当前复核 commit: `dddeb6e`）
  - 本地证据镜像：`ref/Trellis/**`（保留与报告最初引用一致的路径结构）
  - Trellis 官方文档 `docs.trytrellis.app`
- 获取过程说明：
  - 初次 `git clone` 失败于 TLS handshake (`gnutls_handshake`)
  - GitHub tarball 下载失败于 stream EOF
  - 因此先构造了 `ref/Trellis` 证据镜像；之后再次重试 clone，成功得到 `ref/Trellis-upstream`
- 本报告的最终判断以 **本地代码** 为准，优先引用 `ref/Trellis-upstream`；`ref/Trellis` 仅作为早期镜像与路径兼容层。

---

## Q1. Trellis context layers

| Layer | Source files | Producer | Consumer | Injected when | Scope / filter | Failure mode |
|---|---|---|---|---|---|---|
| Workflow layer | `ref/Trellis-upstream/.trellis/workflow.md`; `ref/Trellis-upstream/packages/cli/src/templates/shared-hooks/inject-workflow-state.py` | workflow author + Trellis template system | 主会话 agent | 每轮用户输入时的 breadcrumb；Codex SessionStart 也会注入 workflow summary | 按 `task.json.status` 选择 `[workflow-state:*]` block；Codex 还受 `codex.dispatch_mode` 影响 | 缺 tag 时降级为 “Refer to workflow.md for current step.”；只提供阶段提示，不提供历史 runtime state |
| Session startup orientation | `ref/Trellis-upstream/.trellis/scripts/common/session_context.py`; `ref/Trellis-upstream/packages/cli/src/templates/shared-hooks/session-start.py`; `ref/Trellis-upstream/packages/cli/src/templates/opencode/plugins/session-start.js` | Trellis runtime scripts | 主会话 agent | session start | 开发者身份、git 状态、active tasks、journal metadata、spec indexes；不是完整 transcript | 只提供 startup orientation / bootstrap context，不是 conversation replay，也不是 compaction output |
| Spec index / guide layer | `ref/Trellis-upstream/.trellis/spec/**/index.md`; `ref/Trellis-upstream/.trellis/scripts/common/packages_context.py` | humans / agents updating spec | 主会话 + implement/check agents | startup orientation + planning discovery + JSONL curation后间接进入 subagent | monorepo 下按 `packages`, `default_package`, `spec_scope`, active task package 过滤 | 如果没被写进 JSONL，subagent 不保证读到具体 spec |
| Package / layer scope layer | `ref/Trellis-upstream/.trellis/config.yaml`; `ref/Trellis-upstream/.trellis/scripts/common/config.py`; `ref/Trellis-upstream/.trellis/scripts/common/packages_context.py` | repo config | 主会话 / planning phase | `get_context.py --mode packages` / planning | `active_task`, explicit list, default package fallback | 只能过滤 spec scope，不能过滤 runtime transcript/history |
| Task artifact layer | `ref/Trellis-upstream/.trellis/tasks/<task>/task.json`, `prd.md`, `design.md`, `implement.md`, optional `research/`; `ref/Trellis-upstream/.trellis/scripts/task.py`; `ref/Trellis-upstream/.trellis/scripts/common/task_store.py` | `task.py create` + planning / research agents | 主会话 / implement / check / research | task create, planning, execution | task-local only | 如果 artifact 没写，系统不会自动从会话中补全；task hierarchy ≠ context lineage |
| Per-agent manifest layer | `implement.jsonl`, `check.jsonl`; `ref/Trellis-upstream/.trellis/scripts/common/task_context.py`; `ref/Trellis-upstream/.trellis/scripts/common/task_store.py`; `ref/Trellis-upstream/packages/cli/src/templates/shared-hooks/inject-subagent-context.py` | planning phase curator | implement/check agents | subagent dispatch 前 | 只读 JSONL 中列出的 spec/research 文件；seed `_example` 行不会生效 | seed-only manifest 会告警并退化为只给 task artifacts；无“自动保证已覆盖所有临时上下文” |
| Hook / prompt assembly layer | `ref/Trellis-upstream/packages/cli/src/templates/shared-hooks/inject-subagent-context.py`; `ref/Trellis-upstream/packages/cli/src/templates/opencode/plugins/inject-subagent-context.js`; `ref/Trellis-upstream/packages/cli/src/templates/codex/agents/*.toml` | platform hooks / subagent definitions | implement/check/research agents | PreToolUse / tool.execute.before / agent self-load | 平台能力差异大：有的 push、有的 pull | 不是 native fork；丢失 role boundary、tool visibility、compaction semantics |
| Workspace journal layer | `ref/Trellis-upstream/.trellis/workspace/<developer>/journal-*.md`; `ref/Trellis-upstream/.trellis/scripts/common/session_context.py`; `ref/Trellis-upstream/packages/cli/src/templates/opencode/lib/session-utils.js` | `add_session.py` / finish workflow | 主会话 startup orientation，人和 agent可读 | 下次 session start | developer-scoped, not task-scoped by default | SessionStart 暴露的是 **journal metadata only**（path + line count + near-limit flag），不是全文，更不会自动进入 implement/check subagent |

### Q1 judgment

**Trellis 的“分层上下文”是真实存在的，而且不止 docs 层。**它至少包括：workflow、startup orientation、spec indexes、package scoping、task artifacts、per-agent JSONL manifests、platform injection、workspace journal metadata。这个判断与本仓库 `architecture/04-doc-vs-native-agent-deep-dive.md` 的 7 层分析一致，并被 upstream 本地代码再次证实。

---

## Q2. Trellis 是否已经是一个 context compiler？

### 结论

**是，但它是“artifact/stage compiler”，不是“runtime/session reconstruction compiler”。**

### 分类判断

1. **Index-only injection** — **存在**
   - SessionStart / workflow breadcrumb 只给 workflow summary、spec indexes、startup orientation state。
   - 主会话被鼓励按需再读具体文件。

2. **Manifest-driven injection** — **强存在，且是 Trellis 核心能力**
   - `implement.jsonl` / `check.jsonl` 是明确的 per-agent context manifest。
   - `inject-subagent-context.py` 明确按固定顺序组装：
     `jsonl entries → prd.md → design.md if present → implement.md if present`
   - OpenCode plugin 同样用 task-local manifest + artifacts 组装 prompt。

3. **Runtime/session reconstruction** — **不存在**
   - 没有证据表明 Trellis 从 transcript、tool events、compaction artifacts、prompt assembly recipe 中重建某一历史 checkpoint 的 model-visible context。
   - `session_context.py:get_context_json` / `get_context_text` 构造的是 startup orientation summary，不是 replay/fork。
   - `.codex/agents/*.toml` 明确要求 subagent 自己读取 task path 和 artifacts；这说明 Codex 路径是 pull-based self-load，不是 runtime fork。

### Why this matters

这意味着 Trellis 已经满足“从分散文件中按 phase/task/agent/platform 编译目标上下文”的定义，但**它编译的是文档和 task artifacts，不是运行时对话状态。**这正是它与 Context Tree 的边界。

---

## Q3. Context coverage matrix

| Context 类型 | Trellis 是否覆盖 | 覆盖路径 | 是否需要人工 / agent 主动写入 | 备注 |
|---|---|---|---|---|
| 稳定项目规范 | Yes | `.trellis/spec/**`, package/layer index, JSONL manifests | 需要写 spec，但注入路径是系统化的 | 这是 Trellis 最强项 |
| task PRD / 需求 | Yes | `prd.md` | 需要 planning 写入 | 被 implement/check 明确读取 |
| 设计决策 | Partial | `design.md`, optional spec update | 需要主动写入 | 复杂任务可覆盖，轻量任务不保证 |
| implementation plan | Yes / Partial | `implement.md` | 复杂任务需要主动写入 | 对复杂任务是正式流程 |
| relevant source files | Manual / Partial | 通过 agent 自己再读代码；非 JSONL 预注入对象 | 是 | JSONL 明确不该注册 code files |
| research findings | Yes / Partial | `research/` + JSONL | 需要 research agent 或人写入，并被 manifest 引入 | 结构可承载，但不是自动捕获 |
| check/review criteria | Yes | `check.jsonl` + specs + artifacts | 需要规划时配置 | reviewer context 的强项之一 |
| 用户临时偏好 | Manual / Not guaranteed | 可写进 PRD/design/notes | 是 | 没有强制捕获机制 |
| 已排除方案 | Manual / Not guaranteed | 可写进 design/research | 是 | 不写就丢 |
| 中间探索路径 | Manual / Not guaranteed | `research/` 或 journal | 是 | 系统不自动记录 reasoning trail |
| 工具调用结果 | Missing | 无专门结构 | 若人工转写才有 | 没有 tool-result visibility fidelity |
| compaction / prune / DCP 状态 | Missing | 无 | 不适用 | Trellis 不处理 runtime compaction semantics |
| 当前 runtime-visible messages | Missing | 无 | 不适用 | SessionStart 只有 startup orientation，不是 message-level replay |
| 上游 checkpoint 边界 | Missing | 无 | 不适用 | 没有 checkpoint artifact / boundary manifest |
| parent -> reviewer -> target lineage | Missing | task parent/children 不是 context lineage | 不适用 | 这是 Context Tree 的独特点之一 |
| role / authority 边界 | Missing | hooks 把 context flatten 成 prompt text | 不适用 | 没有 system/developer/user/tool fidelity |

### Q3 judgment

**Trellis 已经覆盖 reviewer 需要的“大部分稳定工程上下文”，但没有覆盖 reviewer 需要的“运行时现场上下文”。**

更具体地说：

- 如果 reviewer 主要看 **规范、需求、设计、计划、research、diff**，Trellis 基本够。
- 如果 reviewer 需要看 **模型当时到底看到了什么、哪些 tool outputs 被看见、compaction 前后边界、某个历史节点的局部语境**，Trellis 不够。

---

## Q4. Trellis subagent 是文档增强，还是上下文 fork？

| Platform | 实现路径 | 结论 |
|---|---|---|
| Claude / Cursor / 多数 hook 平台 | `inject-subagent-context.py` 在 `PreToolUse` 前读取 task-local JSONL + artifacts，然后改写 subagent prompt | **文档增强 / prompt injection** |
| OpenCode | 当前代码存在 project-local plugin injection：`packages/cli/src/templates/opencode/plugins/inject-subagent-context.js` 通过 `tool.execute.before` 修改 `Task` args.prompt；历史迁移文件 `packages/cli/src/migrations/manifests/0.3.0-beta.9.json` 明确写过 “Full subagent context injection requires oh-my-opencode (omo). Without omo, agents use Self-Loading fallback.” | **存在注入实现，但不能把它表述成所有 OpenCode 路径都天然闭环；更准确是 project-local injection path + 历史 oh-my-opencode/global fallback 证据** |
| Codex main session | `packages/cli/src/templates/codex/hooks/session-start.py` 注入 startup orientation context + workflow TOC + task status | **只给主会话 startup orientation** |
| Codex subagents | `packages/cli/src/templates/codex/agents/trellis-implement.toml`, `trellis-check.toml`, `trellis-research.toml` 明确写着 “This platform does NOT auto-inject task context via hook. Before doing anything else, you MUST load context yourself.” | **pull-based reading**，不是 hook-push，更不是 fork |

### Hard evidence against native fork

- `inject-subagent-context.py:get_implement_context`, `get_check_context`, `main` 的核心工作是 **读文件并重写 prompt**。
- OpenCode plugin 的核心工作是 **mutate `Task` tool args.prompt in-place**。
- Codex agent TOML 明确说明 **不自动注入 task context**，需要 subagent 自己先解析 `Active task:` 或跑 `task.py current --source`。
- `.codex/agents/trellis-implement.toml` / `trellis-check.toml` 把 `multi_agent` 与 `multi_agent_v2` 都关闭了；这不是在利用 Codex native fork surface，而是在**刻意禁掉**递归子 agent 协作工具。
- 本次检索中没有发现任何 Trellis 代码调用类似 `spawn_agent(fork_context=true)` 或 `fork_turns="all"` 作为 reviewer context 的主路径。

### Q4 judgment

**Trellis subagent context = staged artifact injection / pull-based reading / inline skill，明确不是 parent runtime context fork。**

---

## Q5. Trellis 是否有“上游节点派生 reviewer”的概念？

### 判定

**Missing**

### 证据

- `task.json` 的 `parent` / `children` 用于任务树和交付拆分，不是上下文 lineage。
- `task_store.py:cmd_create` / archive-linked parent-child handling 只是任务链接和归档处理，不记录“这个 reviewer 从哪个历史 checkpoint 派生”。
- `task.json.status`, `current_phase`, `next_action` 等 workflow state 字段描述的是**任务生命周期**，不是**历史上下文拓扑**。
- Trellis 的 check agent 默认基于 active task artifacts + `check.jsonl` 工作，而不是基于某个历史 design checkpoint 派生出来的 reviewer packet。

### Nuanced reading

如果人为把旧 design / research 文件列进 `check.jsonl`，reviewer 可以“更多地站在旧设计视角看问题”；但这仍然是**手工文档路由**，不是系统记录的 lineage。

---

## Q6. Trellis 是否会污染长期文档？

### 现有隔离机制

Trellis **已经有三层归属分离**：

1. **长期稳定规则** → `.trellis/spec/**`
2. **task-local context** → `.trellis/tasks/<task>/prd.md`, `design.md`, `implement.md`, `research/`, `*.jsonl`
3. **developer/session memory** → `.trellis/workspace/<developer>/journal-*.md`

这说明 Trellis 并不是把所有东西都塞进长期 spec，它本身已经有“污染隔离”意识。

### 仍然容易污染的点

| 风险点 | 为什么会污染 |
|---|---|
| 用户临时偏好 | 如果想让未来 reviewer 记住，团队可能把一次性偏好写进长期 spec |
| 已排除方案 / 调试路径 | 若没有 task-local packet，只能塞进 design 或 spec 才能被后续 agent看到 |
| 工具结果结论 | 没有专门 artifact，就可能被“总结升格”为 spec 文案 |
| 中间探索中的临时约束 | 若想让后续 subagent 稳定可见，最容易被写进长期 docs |

### Guardrail strength

- `workflow.md` 明确区分了 PRD、design、implement、JSONL manifests、workspace journals、spec update。
- 但 **guardrail 主要是流程约束，不是强类型上下文边界。**
- `trellis-update-spec` 是“把 learnings 提升回 spec”的机制，这很好，但也意味着如果团队 discipline 不足，task-local 发现可能被过早升格。

### Q6 judgment

**Trellis 已经有长期 specs vs task-local docs vs workspace journal 的基础隔离机制；真正缺的是“临时但重要、又不该升格为长期规则”的 checkpoint-local artifact。**

---

## Q7. 如果只扩展 Trellis，能否补齐 Context Tree 缺口？

### Option 1. 不改 Trellis，只用现有机制

**能解决什么**

- 稳定规范、PRD、设计、执行计划、research、review checklist 的 staged routing
- 绝大多数“稳定工程上下文 reviewer”场景

**不能解决什么**

- runtime-visible messages
- tool result visibility
- compaction / prune state
- checkpoint lineage
- role / authority fidelity

**需要改哪些文件**

- 无

**风险**

- 会高估 docs 对 reviewer 的上下文充分性
- 临时上下文容易漏写

**是否值得**

- 对一般工程工作流值得；对你们当前想验证的“reviewer fidelity”问题不够。

### Option 2. 轻量扩展 Trellis：新增 node-local packet / reviewer packet / checkpoint artifact

**能解决什么**

- 把“临时但关键”的上下文从长期 specs 中剥离出来
- 让 reviewer 读到更接近某一阶段边界的 compiled context
- 为 lineage、known losses、boundary type 建立显式 artifact

**不能解决什么**

- 仍然不等于 native fork
- 如果平台不支持真正 message-level replay，仍然无法 1:1 复现 model-visible runtime context

**建议改哪些文件 / 位置**

- `task.json`：增加 reviewer/context packet metadata（source node, boundary type, known losses）
- `*.jsonl`：允许引用 `checkpoint-packet.md/json` 之类的新 artifact
- `inject-subagent-context.py` / `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js`：把 packet 纳入实现 / check context read order
- Codex subagent TOML：要求优先读取 reviewer packet / checkpoint packet

**风险**

- 复杂度上升
- packet schema 设计不好会退化成另一套“巨大文档”

**是否值得**

- **最值得。**这是本报告的主推荐。

### Option 3. Context Tree lite 插件：在 Trellis 阶段边界调用 native fork 或 compiled packet

**能解决什么**

- 在支持的平台上获得更高 fidelity reviewer context
- 在不支持的平台上退回 compiled packet

**不能解决什么**

- 跨平台一致性仍然差
- native fork 仍然黑盒且审计难

**需要改哪些文件**

- Trellis platform adapters / hook layer
- 额外的 Context Tree-lite runtime or plugin layer

**风险**

- 引入第二套系统边界
- 很容易从“轻插件”膨胀成产品

**是否值得**

- 只有当你们确认“checkpoint-local runtime fidelity”明显优于 staged packet 时才值得。

### Option 4. 做完整 Context Tree

**能解决什么**

- 原生表达树结构、review lineage、boundary fidelity、known losses、compiled packet / native fork dual backend

**不能解决什么**

- 无法神奇消除平台黑盒限制；很多 fidelity 仍受宿主平台约束

**需要改哪些文件**

- 基本是独立系统

**风险**

- 过度建设
- 与 Trellis 职责重叠

**是否值得**

- **当前不值得。**除非后续 eval 明确证明：Trellis + reviewer packet 仍明显弱于 runtime-fork / compiled-checkpoint reviewer。

---

## Missing guarantees

Trellis 结构上**不能保证**以下上下文进入 reviewer：

1. 模型当时实际可见的 runtime message boundary
2. tool results as seen by model
3. compaction / prune / DCP transformation state
4. parent context node → reviewer → target 的 lineage
5. role / authority fidelity（system / developer / user / tool）
6. 未被人工写入 docs 的临时偏好、排除路径和中间探索轨迹

换句话说，**Trellis 保证的是“被整理进 artifacts 的上下文”，不是“运行时现场上下文”。**

---

## Recommendation

### 建议路线

1. **先把 Trellis 当主 workflow。**
2. **不要做完整 Context Tree。**
3. **先做 Trellis 轻扩展：reviewer packet / checkpoint packet。**
4. **只有当后续 eval 证明 packet 仍不够，才进入 Context Tree lite。**

### Practical interpretation

- 如果目标是“让 reviewer 在多数真实工程任务里拿到足够上下文”，Trellis 已经很强。
- 如果目标是“精确保留历史 checkpoint 上模型可见上下文并可审计回放”，Trellis 还不够，但缺口集中在 **packetization / boundary capture**，不在基础 task/spec/workflow 架构。

所以，**Context Tree 更像 Trellis 的 reviewer/checkpoint extension，而不是现在就该替代 Trellis 的独立主系统。**

---

## Evidence

### Local repo evidence

- `architecture/00-overview.md`
  - 定义 Context Tree 的独特点：context lineage harness、compiled-context-packet、fidelity / knownLosses / transformLayers
- `architecture/03-harness-context-construction-survey.md`
  - 把 Trellis 定位为 staged context delivery / project memory，而非 checkpoint-native context fork
- `architecture/04-doc-vs-native-agent-deep-dive.md`
  - 已经提出 Trellis 7 层结构、缺口、以及 “如果补 node-local packet，Trellis 基本就覆盖 Context Tree 核心价值”的判断框架

### Trellis upstream code evidence (`ref/Trellis-upstream`)

- `ref/Trellis-upstream/.trellis/scripts/common/session_context.py`
  - `get_context_json`：输出 `{developer, git, tasks, journal}` 结构；其中 journal 只有 `{file, lines, nearLimit}`
  - `get_context_text`：输出 journal active file 和 line count
- `ref/Trellis-upstream/.trellis/scripts/common/packages_context.py`
  - `get_packages_section`, `get_context_packages_json`, `_resolve_scope_set`：实现 package/layer scope 与 `active_task` / `default_package` fallback
- `ref/Trellis-upstream/.trellis/scripts/common/config.py`
  - `get_packages`, `get_default_package`, `get_spec_scope`：读取 package/scoping 配置面
- `ref/Trellis-upstream/.trellis/scripts/common/task_store.py`
  - `_write_seed_jsonl`：seed `_example` row
  - `cmd_create`：在 task create 时 seed `implement.jsonl` / `check.jsonl`
- `ref/Trellis-upstream/.trellis/scripts/common/task_context.py`
  - `cmd_add_context`：把 `{"file": ..., "reason": ...}` 写入 JSONL
  - `_validate_jsonl`：跳过无 `file` 的 seed/comment row
  - `cmd_list_context`：只把有 `file` 的条目算作真实 curated entry
- `ref/Trellis-upstream/.trellis/scripts/task.py`
  - `cmd_start`, `cmd_current`, `cmd_finish`：证明 active task 是 runtime pointer + task artifact workflow，不是 context lineage graph
- `ref/Trellis-upstream/packages/cli/src/templates/shared-hooks/inject-subagent-context.py`
  - `read_jsonl_entries`：跳过 seed/comment row
  - `get_implement_context`：读取顺序 `implement.jsonl → prd.md → design.md → implement.md`
  - `get_check_context`：读取 `check.jsonl + task artifacts`
  - `build_implement_prompt`, `build_check_prompt`, `main`：明确是 prompt injection，不是 runtime fork
- `ref/Trellis-upstream/packages/cli/src/templates/shared-hooks/inject-workflow-state.py`
  - `load_breadcrumbs`, `resolve_breadcrumb_key`, `build_breadcrumb`, `main`：构造 per-turn workflow-state breadcrumb
- `ref/Trellis-upstream/packages/cli/src/templates/shared-hooks/session-start.py`
  - `_build_compact_current_state`, `_build_workflow_toc`, `main`：构造 startup orientation / session bootstrap context
  - hook 文案明确写着 “Use it to orient the session; load details on demand.”
- `ref/Trellis-upstream/packages/cli/src/templates/opencode/lib/session-utils.js`
  - `buildSessionContext`, `buildCompactCurrentState`：OpenCode session-start 只暴露 journal path + line count 等 metadata
- `ref/Trellis-upstream/packages/cli/src/templates/opencode/plugins/inject-subagent-context.js`
  - `getImplementContext`, `getCheckContext`, `injectTrellisContextIntoBash`：OpenCode 的 project-local plugin 注入路径
  - `tool.execute.before` handler：通过改写 `Task` prompt 做注入
- `ref/Trellis-upstream/packages/cli/src/templates/opencode/plugins/session-start.js`
  - `chat.message` path：一次性 startup injection
  - `session.compacted` event 只做 dedup clear，不把 compaction 结果注入 session context
- `ref/Trellis-upstream/packages/cli/src/templates/codex/hooks/session-start.py`
  - `FIRST_REPLY_NOTICE`, `_build_compact_current_state`, `main`：Codex 主会话 startup orientation 注入
- `ref/Trellis-upstream/packages/cli/src/templates/codex/agents/trellis-implement.toml`
- `ref/Trellis-upstream/packages/cli/src/templates/codex/agents/trellis-check.toml`
- `ref/Trellis-upstream/packages/cli/src/templates/codex/agents/trellis-research.toml`
  - subagent developer instructions 明确要求 self-load task path + JSONL + artifacts
  - `multi_agent = false`, `multi_agent_v2.enabled = false`
- `ref/Trellis-upstream/packages/cli/src/migrations/manifests/0.3.0-beta.9.json`
  - 历史证据："Full subagent context injection requires oh-my-opencode (omo). Without omo, agents use Self-Loading fallback."

### Local mirror provenance

- `ref/Trellis/README.md`
  - 说明 `ref/Trellis` 是在 clone 失败期间构建的本地证据镜像；在真实 clone 成功后，它只保留为早期引用兼容层，不再是主证据源。

---

## Final judgment

如果把问题说得最直接一点：

> **Trellis 已经足够做“文档化、阶段化、可审计”的 reviewer context；它还不够做“历史 checkpoint 现场复刻”。**

因此当前最佳方向不是“抛开 Trellis 另做完整 Context Tree”，而是：

> **继续以 Trellis 为主框架，在 reviewer/check 阶段补一个 task-local checkpoint packet / reviewer packet。**

这会把最关键的缺口补上，同时避免把你们重新拖进一套过大的新系统。

**边界说明：本报告只能证明 Trellis 在结构上不能保证 runtime checkpoint fidelity；它不能证明这些缺口在实际 review 质量上一定重要。是否进入 Context Tree lite，仍需后续用真实任务或最小 eval 验证。**
