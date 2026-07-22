# EvoBuddy 代码质量与产品质量审查报告

> 审查日期：2026-07-19  
> 审查对象：`/home/prosumer/agent/context-tree` 当前工作区快照  
> 审查方法：代码与文档走查、关键调用链追踪、测试与静态检查实跑、产品主流程与失败流程核验  
> 说明：当前分支 `member-task-run-ledger-v0` 尚无任何 Git 提交，且工作区文件全部未跟踪。因此本报告只能评价当前快照，无法进行历史回归、变更责任或版本演进分析。

> 复核更新：2026-07-19 二次复核确认 P0/P1 核心问题仍存在；当前完整 `npm test` 结果已从原报告的 5 个失败变为 6 个失败，新增/现存失败为 Rust TUI product PTY live eval。

## 1. 结论摘要

EvoBuddy 已具备较强的技术验证能力：证据分级清楚、失败关闭（fail-closed）意识强、Node 与 Rust 两侧均有大量契约和快照测试，Rust 工作区测试也能完整通过。项目的突出优势不是功能数量，而是对“什么证据可以支撑什么产品声明”保持克制，这一点在同类早期 Agent 工具中较为难得。

但当前快照**不建议发布为可用 MVP**。主要原因不是底层模型或证据链不成立，而是 README 和发布文档定义的默认产品入口 `evobuddy workbench` 已出现可复现回归：完整 Node 测试 1773 项中有 6 项失败，失败集中在 Workbench 路由、状态导出、品牌呈现和真实 PTY 验收。换言之，底层组件测试大体健康，但用户首先接触的产品主路径没有保持绿色。

综合判断：

- **代码质量：6.5/10**。核心契约和测试文化较强，但发布门禁、命令执行边界、模块组织和重复基础逻辑仍需治理。
- **产品质量：5.5/10**。产品边界诚实、差异化明确，但默认入口回归、主价值依赖外部运行时、上手链路和产品/评测界面混杂，尚未达到外部用户可稳定采用的程度。
- **发布建议：No-Go**。先关闭 P0/P1 问题，再重新运行完整门禁并形成首个可追溯版本。

## 2. 产品模型

### 2.1 产品是什么

EvoBuddy 是面向 AI 编程 Agent 运行时的“上下文型专业成员”系统。它将已确认的 Buddy 定义投影到 OpenCode、Claude Code 和 Codex 等运行时，让父 Agent 能把任务委派给专业 Buddy，并把调用、结果返回、材料选择和演化过程记录为可审计证据。

其核心价值不是单纯“再封装一个子 Agent CLI”，而是：

1. 让专业角色以稳定定义进入不同运行时；
2. 区分直接 CLI、父 Agent 指令调用、自然路由、原生子 Agent 等不同证据等级；
3. 防止把 fixture、适配器调用或事后拼装材料误报为真实产品成功；
4. 允许 Buddy 通过有证据、有版本的 patch 演化。

这一定位由 `README.md:3`、`README.md:17`、`README.md:26-39` 和 `docs/release-mvp.md:25-48` 共同定义。

### 2.2 目标用户与核心任务

| 用户 | 核心任务 | 当前支持度 |
| --- | --- | --- |
| AI 编程工具使用者/操作者 | 初始化项目、同步 Buddy、观察委派结果 | 部分可用，Workbench 主路径当前回归 |
| Agent/运行时工程师 | 验证原生委派、自然路由与结果返回 | 证据链丰富，但流程复杂且依赖宿主运行时 |
| 评测与质量工程师 | 基于可验证 artifact 做 release gate | 支持较强，是当前最成熟能力 |
| Buddy/Skill 作者 | 定义专业角色并通过证据演化行为 | 已有 preset、registry、patch 和 ledger 基础 |

### 2.3 当前主流程

文档定义的 MVP 主流程是：

1. `evobuddy setup --project <path> --runtime opencode`
2. `evobuddy buddies sync --project <path>`
3. 父 Agent 使用已同步的原生 Buddy 定义
4. `evobuddy doctor --project <path>`
5. `evobuddy workbench --project <path>`
6. 运行三运行时 release eval 和最终 readiness gate

证据见 `README.md:53-61` 和 `docs/release-mvp.md:3-21`。其中第 5 步是用户可视化理解产品是否工作的关键入口，也是当前最明显的断点。

## 3. 验证结果

### 3.1 已执行命令

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `cargo test --workspace` | 通过 | Rust TUI 共 28 个集成/快照/契约测试通过，另有 0-test 单元目标 |
| `npm test` | 失败 | 二次复核结果：1773 项，1766 通过、6 失败、1 skipped，耗时约 21 秒 |
| 聚焦运行 3 个 Workbench CLI 测试文件 | 失败 | 10 项：5 通过、5 失败，稳定复现其中一组 Workbench/旧 PTY 问题；完整测试另有 Rust TUI product PTY eval 失败 |
| `cargo fmt --all -- --check` | 通过 | Rust 格式符合 rustfmt |
| `cargo clippy --workspace --all-targets -- -D warnings` | 失败 | 二次复核仍失败：`dashboard.rs:453-456` 触发 `clippy::iter_nth` |
| 仓库级 LSP diagnostics | 不适用 | 工具尝试将目录按 Markdown 处理，当前环境未配置 Markdown LSP；因此未将该结果作为代码质量结论 |

### 3.2 失败测试分布

失败集中在同一产品表面，但至少包含三类独立问题：JS dispatcher/state export 路由缺陷、Rust TUI 的品牌/旧 Workbench PTY 验收缺陷，以及 Rust TUI product PTY live eval 验收缺陷。

1. `test/cli/evobuddy-cli.test.mjs:21-27`：帮助文本不满足产品契约文案；
2. `test/cli/evobuddy-cli.test.mjs:139-163`：actor-aware interactive 请求没有完整保留 `--input-root`；
3. `test/cli/evobuddy-cli.test.mjs:165-188`：`--json-out` 未导出 `evobuddy.workbench.state.v1`；
4. `test/cli/evobuddy-tui-cli.test.mjs:12-32`：TUI 首屏缺少 `EvoBuddy` 品牌标识；
5. `test/cli/run-evobuddy-workbench-interactive-pty-live-eval-cli.test.mjs:12`：旧 Workbench interactive PTY 验收报告返回 `fail`，缺少 repaint、TaskRoom detail、read-only banner 和 focus chrome；该失败不能仅由 JS `passthrough` 缺陷解释。
6. `test/cli/run-evobuddy-rust-tui-pty-live-eval-cli.test.mjs:12`：Rust TUI product PTY live eval 报告返回 `fail`，缺少 TeamAgent/member vs FocusedBuddy/delegate split、agent command center panes、team member workspace evidence、focused buddy workspace evidence。

这些失败不是随机环境噪声：聚焦重跑稳定复现其中 5 个失败，完整测试稳定显示 6 个失败。

## 4. 代码质量审查

### P0-CODE-01：Workbench actor-aware 判断和状态导出发生契约回归（发布阻断）

**证据**

- `scripts/evobuddy/evobuddy.mjs:127-162` 的 `parseFlags()` 会把 `--input-root`、`--json-out` 等识别为结构化字段，不再保留在 `passthrough`。
- `scripts/evobuddy/evobuddy.mjs:202-219` 的 `resolveWorkbenchInvocation()` 却仍通过 `args.passthrough` 判断 actor-aware 请求，并把 `args.passthrough` 直接作为 forwarded 参数。
- 因此：
  - 只有 `--input-root + --json-out` 时，`actorAwareRequest` 为 `false`，`stateExport` 也为 `false`，命令误入旧路径；
  - 带 `--interactive` 时虽然能被识别为 actor-aware，但 `--input-root` 已被解析器消费，未进入 forwarded 参数；
  - `workbench --json-out` 最终生成的不是 `evobuddy.workbench.state.v1`。
- 对应断言在 `test/cli/evobuddy-cli.test.mjs:139-188` 稳定失败。

**影响**

这是主入口行为错误，不只是测试文案漂移。它会让 JSON state export 误入旧路径并生成错误结构，也会让兼容调用层对 interactive 参数的语义判断与转发结果不一致。README 和 `docs/release-mvp.md:3-9` 都把 Workbench 定义为产品入口，因此应按发布阻断处理。

需要明确的是：实际 `workbench --interactive --input-root` 默认会在 `scripts/evobuddy/evobuddy.mjs:377-382` 进入 Rust 产品路径，并由 `resolveRustWorkbenchArgs()` 从结构化字段重新加入 `--input-root`。因此，真实 PTY 验收失败不能直接归因于本项 `passthrough` 缺陷。

**建议**

统一 Workbench 参数模型：路由判断直接使用已解析字段（如 `args.inputRoot`、actor/report 字段），转发参数也从结构化字段显式构造；不要同时把 `passthrough` 当作语义判断和完整参数源。增加参数组合表驱动测试，覆盖 interactive、state export、headless、legacy 四种模式。

### P0-CODE-02：Rust TUI 品牌与真实 PTY 交互验收未达到产品契约（发布阻断）

**证据**

- `test/cli/evobuddy-tui-cli.test.mjs:12-32` 直接运行 Rust TUI 的 headless snapshot；输出包含 `Workbench`，但没有测试要求的 `EvoBuddy` 品牌标识；
- `test/cli/run-evobuddy-workbench-interactive-pty-live-eval-cli.test.mjs:12` 通过产品入口运行旧 Workbench PTY 验收，报告返回 `fail`，失败原因包括缺少 repaint、TaskRoom detail、read-only banner 和 focus chrome；
- `test/cli/run-evobuddy-rust-tui-pty-live-eval-cli.test.mjs:12` 通过 Rust TUI product PTY live eval，报告返回 `fail`，失败原因包括缺少 TeamAgent/member 与 FocusedBuddy/delegate split、agent command center panes、team member workspace evidence 和 focused buddy workspace evidence；
- 这些 PTY 测试独立于 state export 单测，不能在没有更深运行时证据时归并为同一个 JS 路由根因。

**影响**

TUI 是文档定义的产品可视入口。品牌契约失败会加剧 EvoBuddy、Context Tree、WorkBuddy 多套名称并存的问题；真实 PTY 验收失败说明快照单测全绿尚不足以证明用户在真实终端中的导航、重绘、详情体验和 WorkBuddy/Aion/Grok 风格的信息架构可用。

**建议**

分别修复品牌首屏、旧 Workbench PTY 交互验收和 Rust TUI product PTY 验收。读取 PTY eval report 的逐项失败原因，针对终端重绘、焦点状态、TaskRoom 详情、只读提示、TeamAgent/FocusedBuddy 分区、agent command center 和 workspace evidence 建立最小回归测试；不要用放宽验收断言代替产品行为修复。

### P1-CODE-03：Rust 后端通过 `sh -lc` 拼接路径执行命令，存在命令注入和可移植性风险

**证据**

- `crates/evobuddy-tui/src/backend.rs:98-126` 将 `project`、`input_root` 和多种 report path 通过 `display()` 拼进字符串；
- `crates/evobuddy-tui/src/backend.rs:134-140` 使用 `Command::new("sh").arg("-lc").arg(&command)` 执行该字符串；
- `crates/evobuddy-tui/src/main.rs:13-28` 表明这些路径来自 CLI 参数，`backend_command` 本身也允许直接传入任意 shell 命令。

**影响**

默认路径中，包含空格或 shell 元字符的合法文件名可能导致执行失败；恶意路径可改变 shell 语义。实现也依赖 POSIX `sh`，降低 Windows 可移植性。显式 `--backend-command` 若是调试逃生口，可以保留为高风险能力，但默认产品路径不应经过 shell。

**建议**

默认导出器改为 `Command::new("node")` 加逐项 `.arg(...)`。如确需保留 `--backend-command`，应明确标记为高级/不受信任输入禁止使用的选项，并与默认路径完全分离。

### P1-CODE-04：缺少仓库级持续集成和版本治理基线

**证据**

- 根目录无 `.github/workflows/`；
- 根目录无 `.gitignore`，但存在 `target/`、`.evobuddy/`、`.opencode/` 等构建或运行态目录；
- `git log --oneline -10` 返回当前分支没有提交；
- `git status --short` 显示所有项目文件均为未跟踪；
- 当前 `npm test` 与严格 clippy 均失败，但没有自动门禁阻止发布。

**影响**

代码、fixture、运行态证据与构建产物之间缺少可追溯边界；任何“已发布/已回归/某提交通过”的声明都无法从 Git 复现。没有 CI 时，现有强测试文化无法转化为持续交付保障。

**建议**

先建立首个干净提交和根 `.gitignore`，再添加至少包含 Node 20/22 测试、`cargo test`、`cargo fmt --check`、`cargo clippy -D warnings` 的 CI。发布 readiness 命令必须以这些基础门禁全绿为前置条件。

### P2-CODE-05：基础校验与克隆逻辑大量复制，增加契约漂移成本

**证据**

- `function requireString(` 在 `src/` 下 56 个文件中各出现一次；
- `function stableClone(` 在 `src/` 下 10 个文件中各出现一次。

**影响**

当前重复代码通常很短，不构成立即故障；但它们位于大量 artifact、proof 和 contract 边界，任何校验语义调整都需要多点修改，容易产生“同名校验、不同规则”的隐性漂移。

**建议**

不要一次性大重构。先抽取无争议的 `requireString`、`requireObject`、`stableClone` 等纯函数，按领域批次迁移，并用现有测试锁定行为。

### P2-CODE-06：核心目录过于扁平，领域边界难以从文件结构识别

**证据**

`src/core/` 至少包含 100 个顶层 `.mjs` 文件，混合了 member lifecycle、evolution、runtime proof、TaskRoom、project state、Workbench model 等多个领域。

**影响**

新维护者需要依赖命名和文档才能理解模块边界；相关模块容易互相直接引用，公共 API 与内部实现不清晰。它不会立即导致错误，但会放大后续演进成本。

**建议**

以现有领域词汇渐进拆分 `core/member/`、`core/evolution/`、`core/runtime/`、`core/taskroom/`、`core/workbench/`，并保留兼容导出层，避免大爆炸式移动。

### P2-CODE-07：静态质量门禁未保持全绿

**证据**

`cargo clippy --workspace --all-targets -- -D warnings` 二次复核在 `crates/evobuddy-tui/src/widgets/dashboard.rs:453-456` 失败：对 slice 使用 `.iter().nth(2)`，clippy 建议 `.get(2)`。

**影响**

问题本身很小，但说明项目没有把 clippy 作为持续门禁；在无 CI 的情况下，类似低成本问题会持续积累。

**建议**

修复为 `.get(2)`，并把严格 clippy 纳入 CI。

### P3-CODE-08：存在误导性的实现细节和轻微维护异味

- `crates/evobuddy-tui/src/main.rs:59-61` 通过进程环境变量传递 frame dump 配置，增加全局隐式状态；Rust 当前版本要求该调用位于 `unsafe`，但更好的设计是显式传入应用/渲染配置，而不是简单删除 `unsafe`。
- `scripts/evobuddy/evobuddy.mjs:135` 有轻微缩进不一致。
- `missing-parent-invocation.json` 位于仓库根目录，命名和内容更像测试/调试 artifact，建议迁移到明确的 fixture 目录或注明用途。

## 5. 产品质量审查

### P0-PRODUCT-01：产品默认入口当前不可作为稳定 MVP 交付

**证据**

- README 主流程把 `evobuddy workbench` 列为关键步骤（`README.md:53-61`）；
- `docs/release-mvp.md:3-9` 明确将其列为 Product entry；
- 6 个失败测试均属于 Workbench 产品表面：其中 dispatcher/state export 与产品入口直接相关，Rust TUI headless 测试独立证明品牌呈现回归，旧 Workbench PTY 与 Rust TUI product PTY 测试则分别证明真实终端交互验收未闭合；
- `test/cli/run-evobuddy-workbench-interactive-pty-live-eval-cli.test.mjs:12` 和 `test/cli/run-evobuddy-rust-tui-pty-live-eval-cli.test.mjs:12` 的产品入口验收均返回 `fail`。

**产品影响**

用户无法可靠导出 Rust 后端所需状态；同时 TUI 品牌和真实 PTY 交互验收不满足既有契约。对一个以“可审计、可信证据”为差异化的产品而言，观察入口本身发生多处语义漂移会直接削弱信任。

**建议**

暂停 MVP 发布；修复 Workbench 参数路由后，要求完整 `npm test`、聚焦 PTY 验收、Rust 测试、clippy 全绿，并保存一次真实从 setup 到 Workbench 的验收记录。

### P1-PRODUCT-02：核心价值交付高度依赖宿主运行时，产品自身无法保证闭环

**证据**

- `README.md:39` 明确说明 fresh live success 依赖宿主运行时输出原生 spawn 或自主路由证据；
- `README.md:57` 要求父 Agent 使用同步后的原生 Buddy；
- `README.md:70` 和 `docs/release-mvp.md:100-102` 又明确 adapter fallback 不满足原生或 benchmark release 充分性。

**产品影响**

EvoBuddy 能保证定义投影、证据验证和诚实分级，却不能独立保证“父 Agent 自然选择 Buddy”这一核心体验。外部用户可能完成安装，却仍无法稳定体验产品宣称的最高价值。

**建议**

将价值主张拆成两层并分别承诺：

1. **可控价值**：跨运行时定义投影、证据记录、审计和演化；
2. **条件价值**：宿主支持且产生足够证据时的自然路由/原生委派。

同时提供一个自包含演示或受控参考运行时，让新用户在不依赖外部环境偶然行为的情况下体验完整闭环。

### P1-PRODUCT-03：`doctor` 的产品承诺大于实际检查范围

**证据**

- `README.md:58` 说 `doctor` 用于确认 setup、sync 和 foundation readiness；
- `scripts/evobuddy/evobuddy.mjs:268-287` 实际只检查内部 target 文件是否存在、package bin 是否匹配，以及项目若干路径是否存在；
- runtime definition drift 由单独的 `buddies doctor` 实现（`scripts/evobuddy/evobuddy.mjs:302-311`），并未纳入顶层 `doctor`。

**产品影响**

用户看到 `Doctor status: pass` 时，可能误以为三运行时同步内容和基础 readiness 已验证，实际只证明文件/目录存在。这与产品强调的“证据不能越级声明”原则不一致。

**建议**

要么收窄文案为“安装结构检查”，要么让顶层 `doctor` 聚合 setup schema 校验、Buddy projection drift、Rust binary、外部命令依赖以及最近 release report 状态，并输出分项结果和明确的 claim ceiling。

### P2-PRODUCT-04：上手流程偏向内部评测人员，而不是首次使用者

**证据**

- Quick Start 包含 7 条命令（`README.md:5-15`），第一条就是运行完整测试；
- Main Commands 将普通产品命令和长参数 release eval 混列（`README.md:41-51`）；
- `package.json:9-99` 暴露约 90 个脚本，混合 `evobuddy:`、`context-tree:` 与 `eval:codex:` 命名；
- Rust TUI 需要单独 `cargo build -p evobuddy-tui`（`package.json:34`）。

**产品影响**

对内部研究/评测工程师很透明，但首次使用者难以判断“最短价值路径”与“发布证据链”的区别，安装成本也同时要求 Node 和 Rust 工具链。

**建议**

提供 `evobuddy init`（setup + sync + doctor）和 5 分钟教程；把 release/eval 文档移到“维护者/验证者”章节；提供预编译 TUI 或明确允许先使用无 Rust 的只读输出。

### P2-PRODUCT-05：三运行时支持的表达需要更精确

**证据**

- `buddies sync` 会向 OpenCode、Claude Code、Codex 写投影，测试也验证三者文件生成（`test/cli/evobuddy-cli.test.mjs:54-83`）；
- 但 `setup` 只接受 `opencode`（`scripts/evobuddy/evobuddy.mjs:247-265`）；
- readiness 文档又要求三运行时真实机制根和自然使用根（`README.md:60-61`）。

**产品影响**

“支持三运行时”实际包含不同层次：可生成定义、可被宿主识别、可完成自然路由、可形成 release-grade evidence。若不分层表达，用户容易把“投影成功”理解为“产品闭环成功”。

**建议**

在 README 增加能力矩阵，分别列出 setup、projection、native invocation、natural routing evidence、TaskRoom parity 的当前状态。

### P2-PRODUCT-06：品牌与兼容层仍有迁移残留

**证据**

- 产品名已统一为 EvoBuddy，但大量脚本仍保留 `context-tree:` 前缀（`package.json:35-99`）；
- Workbench 用户文档标题和首段仍以 “WorkBuddy-style / Context Tree” 为主（`docs/workbuddy-style-tui-workbench-v0.md:1-5`）；
- TUI 首屏快照只有 `Workbench`，未出现 `EvoBuddy`，导致品牌契约测试失败（`test/cli/evobuddy-tui-cli.test.mjs:28-31`）。

**产品影响**

内部迁移历史渗透到用户界面和命令面，会增加“这是 EvoBuddy、Context Tree 还是 WorkBuddy 兼容层”的理解成本。

**建议**

产品层统一 EvoBuddy；Context Tree 仅作为内部兼容/历史命名出现，并给旧命令设置明确弃用期。

### P3-PRODUCT-07：当前不是可对外分发的版本形态

**证据**

- `package.json:3-4` 为 `0.0.0` 且 `private: true`；
- 无 Git 提交历史；
- 无自动构建和发布流程；
- README 的 PTY 示例硬编码本机路径 `/home/prosumer/agent/context-tree`（`README.md:63-68`）。

**判断**

这些状态对内部实验仓库可以接受，但与外部 MVP 发布不兼容。建议在修复 P0/P1 后建立 `0.1.0` 内测版本、安装说明、支持矩阵和变更记录。

## 6. 值得保留的优势

1. **证据等级诚实**：`README.md:26-31` 清楚区分 direct CLI、父 Agent 指令调用、自然路由和 runtime-native subagent，避免能力越级声明。
2. **失败关闭意识强**：完整 Node 测试中 1766 项通过，包含大量负向控制、digest closure、fixture 边界和 provenance 校验。
3. **Rust TUI 基础测试曾有覆盖，但当前不能单独支撑发布**：原审查时 `cargo test --workspace` 通过；二次复核未重跑该命令，且当前严格 clippy 与 Rust TUI product PTY live eval 仍失败。因此 Rust 单元/快照覆盖应保留，但不能替代 PTY 和 clippy 门禁。
4. **运行时投影有漂移检查**：`buddies doctor` 能发现被修改的运行时定义，测试见 `test/cli/evobuddy-cli.test.mjs:86-104`。
5. **项目状态初始化具备幂等性**：重复 setup 不覆盖已有 registry，测试见 `test/cli/evobuddy-cli.test.mjs:29-52`。
6. **文档主动限制声明上限**：`docs/release-mvp.md:73-102` 明确区分 OpenCode MVP、三运行时 parity 和 legacy Buddy compatibility proof。
7. **Node 运行时供应链面较小**：根 package 没有第三方 npm 依赖，不应把“没有 lockfile”本身视为当前严重问题；未来引入依赖时再启用锁文件和审计即可。

## 7. 整改优先级

### 发布前必须完成（P0/P1）

1. 分别修复 Workbench dispatcher/state export、Rust TUI 品牌、旧 Workbench PTY 交互主路径，以及 Rust TUI product PTY live eval；
2. 默认 Rust 后端移除 `sh -lc` 字符串拼接执行；
3. 让顶层 `doctor` 的能力与文案一致，或收窄其产品承诺；
4. 建立 Git 基线、根 `.gitignore` 和 CI；
5. 保证 `npm test`、`cargo test --workspace`、`cargo fmt --check`、严格 clippy 全绿。

### 0-30 天（稳定可用）

1. 增加 Workbench 模式组合测试和一次真实端到端验收；
2. 增加三运行时能力矩阵，拆分“投影支持”与“产品闭环支持”；
3. 提供 `evobuddy init` 和首次使用教程；
4. 统一 EvoBuddy 品牌与用户级命令入口。

### 31-60 天（降低维护成本）

1. 渐进抽取通用校验/克隆函数；
2. 按 member/evolution/runtime/taskroom/workbench 拆分 `src/core/`；
3. 为外部工具依赖和运行时失败提供结构化错误码与恢复建议；
4. 提供预编译 TUI 或单工具链降级路径。

### 61-90 天（验证产品价值）

1. 提供不依赖宿主偶然路由行为的自包含演示闭环；
2. 用真实用户任务衡量 Buddy 采用率、成功返回率、失败恢复率和节省时间；
3. 建立 `0.1.x` 内测发布、变更日志、支持范围和回滚策略。

## 8. 发布验收标准

达到以下条件后，才建议把当前快照升级为可试用 MVP：

- [ ] 完整 `npm test` 0 失败；
- [ ] `cargo test --workspace` 0 失败；
- [ ] `cargo fmt --all -- --check` 通过；
- [ ] `cargo clippy --workspace --all-targets -- -D warnings` 通过；
- [ ] `evobuddy setup -> buddies sync -> doctor -> workbench` 在干净临时项目中通过；
- [ ] Workbench interactive、JSON state export、Rust headless snapshot、Rust product PTY live eval、legacy compatibility 五种模式均有测试且通过；
- [ ] 默认后端命令不经 shell 解释；
- [ ] 顶层 doctor 不对未检查的 sync/readiness 状态给出 pass 暗示；
- [ ] CI 在至少 Node 20/22 和当前 Rust stable 上复现以上门禁；
- [ ] 形成首个可追溯 Git 提交和版本标签。

## 9. 审查边界

- 本次没有修改产品实现，只新增本报告；
- 未执行真实 OpenCode/Claude/Codex 在线自然路由，因为它依赖外部宿主、会话和证据源；本报告只评价仓库当前代码、保留 artifact、测试与文档可证明的范围；
- 未把“使用 JavaScript 而非 TypeScript”“没有外部 npm 依赖”“允许用户选择输出目录”等设计选择直接定性为缺陷；
- 所有严重结论均有可复现测试失败、明确代码路径或文档/实现冲突支撑。
