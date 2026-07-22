# GPT-5.6 级模型上重型 Superpowers 编排为何可能反向降效

## 0. 结论摘要

这份报告的结论先直接说清：

1. **问题通常不在 GPT-5.6 级模型“能力不够”，而在重型 superpowers 编排把模型的优化目标从“把任务做好”扭成了“把流程走完”。**
2. **当系统提示、skill 规则、强制工具调用、强制委托、强制 todo/汇报同时叠加时，模型承受的是多重约束竞争，而不是单一高质量约束。**
3. **对于更强、也更服从指令层级的模型，这种过度编排不应被视为纯中性噪声；在不少任务形态下，它可能压制其原生长处：任务压缩、动态规划、跳步能力、证据筛选、简洁回答。**
4. **Tavily-Hikari 这类检索层不是根因；真正的问题是“是否被强制使用、在什么问题上使用、向上下文注入了多少额外材料”。**
5. **如果一个框架让回答变得更慢、更碎、更程序正确但不更任务正确，那么应优先怀疑 orchestration overfit，而不是先怀疑基础模型退化。**

更具体地说：

- 过长系统提示会带来独立的 reasoning tax，而不只是“看起来啰嗦”；[E1][E9]
- instruction hierarchy 冲突在 agent 框架中会被放大，而不是自动被模型完美消解；[E2][E3]
- 工具和子代理数量上升后，模型的选择准确率与整体连贯性会出现非线性恶化；[E4][E5]
- 一些已公开的工程事故表明，**只改 harness / system prompt，不改模型权重，也足以明显拉低结果质量**；[E6]
- 公开使用反馈中，GPT-5 代际在部分工具调用与 agent 自主性场景下被观察到更谨慎；在重型流程叠加时，这可能表现为确认增多、路径变长或行动迟滞。[E7]

因此，本报告的核心判断是：

```text
superpowers 的问题不是“有流程”，
而是“把流程写成了高优先级、全局、默认、不可跳过的行为合同”。
```

## 1. 调研边界与术语定义

### 1.1 本报告回答什么

本报告回答的是：

```text
为什么在 GPT-5.6 这类前沿模型上，
重型 superpowers-style orchestration
可能不提升、反而压制模型表现？
```

这里的“表现”主要指：

- 对用户真实目标的把握能力；
- 任务分解与裁剪能力；
- 推理连贯性；
- 是否能用最短正确路径达成结果；
- 在需要外部证据时，是否仍保留对证据质量的判断能力。

### 1.2 本报告不回答什么

本报告**不**直接回答：

- GPT-5.6 的内部权重或架构到底如何实现；
- 某个具体 superpowers 仓库在全部任务上是否都变差；
- Tavily-Hikari 本身作为产品是否“好”或“坏”；
- 某条单独提示词是否必然有害。

本报告更接近**机制层归纳**，而不是一次针对单模型单基准的封闭对照实验。

对 `GPT-5.6` 的判断也主要属于**前沿模型机制外推**：它基于更强指令跟随模型在工具调用、agent 使用和上下文承压场景中的公开反馈与相邻证据，而不是针对 GPT-5.6 的封闭对照实验。

### 1.3 术语定义

#### A. superpowers

本文中的 `superpowers` 指一类高密度 agent orchestration 层，通常包含：

- skill 选择规则；
- 分层指令优先级；
- 必须先 brainstorm / plan / delegate / verify 的流程；
- 强制工具调用；
- 强制 todo / review / status update；
- 子代理分工与后台回收机制。

这里的关键不在“有这些能力”，而在：

```text
这些能力是否被写成默认启用、强制遵守、难以跳过的高优先级合同。
```

#### B. 重型编排 / overconstraint

`重型编排` 或 `overconstraint` 不是“提示长”这么简单，而是：

- 指令很多；
- 指令层级复杂；
- 任务无论大小都被同一种流程包裹；
- 过程合规比结果质量更容易被模型感知为“奖励”。

#### C. Tavily-Hikari

`Tavily-Hikari` 在本文中被看作**检索与外部资料注入层**。

它的角色更接近：

```text
为当前问题引入外部上下文和网页证据。
```

因此它是否有害，不取决于“能否搜到东西”，而取决于：

- 这个问题是否真的需要外部检索；
- 检索结果是否被压缩为高信号材料；
- 是否把检索片段错误地当作替代推理的捷径。

## 2. 核心机制：superpowers 为什么会压制 GPT-5.6

## 2.1 目标劫持：模型开始优化“流程合规”，而不是“任务成功”

这是本报告认为最重要的机制。

如果高优先级指令持续强调：

- 必须先调 skill；
- 必须先委托 specialist；
- 必须创建 todo；
- 必须在阶段之间汇报；
- 必须在结束前再触发 review；

那么模型最稳定可见的奖励会变成：

```text
把过程做全，比把问题做对更重要。
```

这会带来两个后果：

1. **模型把 token 预算优先花在“证明自己在谨慎工作”上；**
2. **模型降低对“是否真的需要这一步”的主动判断。**

对 GPT-5.6 这类更强模型来说，伤害反而更明显，因为其原生优势之一正是：

- 能快速判断哪些步骤值得做；
- 能在少量信息下形成任务骨架；
- 能跳过无收益流程。

重型 superpowers 等于把这些能力改写成：

```text
即使知道可以直接做，也要先完成流程动作。
```

## 2.2 上下文税：额外 token 会独立拉低推理质量

一个常见误解是：

```text
只要上下文窗口够大，提示再长也只是更慢，不会更差。
```

现有证据并不支持这个乐观判断。

外部研究显示，**即便相关信息已被完美检索出来，仅仅因为输入变长，模型表现也会明显下降**。[E1]

这意味着：

- tool schema；
- skill 说明；
- 冲突规则；
- 反模式列表；
- 过程示例；
- 子代理协议；

这些内容不只是“占空间”，而是在直接征税。

本次检索整理到的工程讨论也出现了相同方向的信号：**远在名义上下文上限之前，较长提示就可能开始损害推理准确率**，[E9] 这与 Anthropic 所说的 `context rot` 现象在方向上是一致的。

因此，superpowers 的常见问题不是它完全错误，而是：

```text
它把本应留给“用户真实问题”的注意力预算，预先消费在元规则上。
```

## 2.3 指令层级冲突：模型会更保守，而不是更聪明

instruction hierarchy 的意义不在于“模型知道谁优先级更高”，而在于：

```text
每增加一个高优先级规范来源，模型都必须为冲突解析付出代价。
```

在 agent 场景中，常见冲突包括：

- “要简洁” vs “要解释步骤”；
- “先回答问题” vs “先调技能与工具”；
- “如果简单就直接做” vs “任何任务都先套流程”；
- “尊重当前用户意图” vs “默认执行全局工作流”。

基础的 instruction hierarchy 研究已经表明，模型并不是 100% 无误地解决这些冲突。[E2]
而 many-tier agent instruction hierarchy 的后续研究则进一步表明，一旦从简单的 system / user / tool 三层扩展为更多层，冲突管理会显著复杂化。[E3]

结果不是模型“不会做题”，而是模型更容易进入：

- 保守解释；
- 防御性语言；
- 机械遵守；
- 对简单任务也过度升级处理。

## 2.4 工具诱导近视：工具被当成推理替代物，而不是证据补充

当框架鼓励“先搜、先调工具、先拉外部证据”时，模型可能获得更高的信息可得性，但未必获得更好的 reasoning discipline。

ACL 2026 关于 `Tool-Induced Myopia` 的研究指出：

- 工具增强可能提高最终答对率；
- 但推理质量本身会下降；
- 模型会更容易把工具输出当成替代思考的捷径。[E5]

这类退化尤其表现为：

- 枚举替代论证；
- 片段替代结构；
- “看起来有外部依据”替代“真正解释清楚”。

对 Tavily-Hikari 而言，这种风险表现为：

```text
当问题本质上需要机制推理时，
检索片段可能帮助的是“引用感”，
而不是“因果解释力”。
```

因此 Tavily-Hikari 不是不能用，而是不该被默认写成：

- 所有题都先搜；
- 搜到的内容天然更可信；
- 搜索结果可以覆盖模型自身的一阶判断。

## 2.5 工具/技能/子代理过多后，选择质量会出现非线性恶化

实践侧与 benchmark 侧的信号都表明：

- 工具数量少时，模型可以稳定路由；
- 工具数量增加后，命名相似、边界相近、schema 接近的工具会相互干扰；
- 到更高规模后，选择准确率会出现明显塌陷。[E4]

这里有两个经常被低估的问题：

1. **模型不是在“知道所有工具后挑一个”，而是在“有限注意力下压缩一组相似描述”；**
2. **每个可选项的存在本身就会改变模型的搜索空间。**

如果 superpowers 还额外规定：

- 必须优先派 explore；
- 必须优先派 librarian；
- 必须在视觉任务上改走 visual-engineering；
- 必须在复杂任务上先跑 oracle；

那么模型不只是“多了能力”，而是多了大量需要先做路由判断的动作。

## 2.6 多代理协调税：认知被切碎，摘要变成新的损失点

委托 specialist 并非天然有害。它真正有价值的前提是：

- 子问题相互独立；
- 需要外部检索或大范围探索；
- 汇总成本低于单模型整体建模成本。

问题在于，很多 conceptual task 并不满足这个条件。

当一个本应由单一连贯思维链完成的问题，被切成：

- 外部搜索；
- 结构规划；
- Oracle 复核；
- 若干 explore 摘要；

最终主模型面对的已不再是“原问题”，而是一组**二次压缩后的中间结论**。

这会引入：

- 信息损失；
- 术语漂移；
- 视角不一致；
- 重复工作；
- 错误放大。[E3][E4]

也就是说，多代理不是白送的并行度，而是一个有成本的认知分片器。

## 3. 为什么 GPT-5.6 这类更强模型更容易被重型框架“反噬”

一个表面悖论是：

```text
模型越强，不是越能驾驭复杂流程吗？
为什么反而更容易被 superpowers 拖累？
```

本报告的判断是：**因为更强模型往往也更服从、更细致地执行高优先级约束。**

### 3.1 强模型的长处，本来就包括“跳过无意义步骤”

更强模型常见的隐性长处不是“能处理更多 checklist”，而是：

- 能更快抓住问题骨架；
- 能压缩表述；
- 能识别哪一步是多余的；
- 能在局部不确定时仍保持整体方向稳定。

如果 superpowers 把所有步骤都写成不可跳过的显式合同，那么框架就等于把模型的一部分高级策略能力替换成：

```text
按部就班执行低信息密度动作。
```

### 3.2 GPT-5 代际的谨慎性会和重型流程叠加

公开工程反馈中，GPT-5 系列在部分 agent SDK 与工具调用场景下被报告为：

- 更倾向索要额外确认；
- 更倾向在调用工具前要更多细节；
- 比上一代更保守地处理自主操作。[E7]

如果框架本身又告诉它：

- 先别做，先确认；
- 先别答，先查；
- 先别直达，先委托；

那么这两股力量叠加后，一个常见结果就不是“更稳”，而是：

```text
更慢、更碎、更难做出最短正确动作。
```

### 3.3 强模型更容易严格执行坏约束

一个不舒服但很现实的结论是：

```text
更强的指令跟随能力，也意味着更强的错误流程执行能力。
```

也就是说，如果 orchestration policy 设计得不好，模型升级不一定会缓解问题，反而可能让问题显性化，因为模型不再“偷懒跳过”那些坏步骤，而是认真把它们做完。

## 4. Tavily-Hikari 在这类问题里的真实角色

## 4.1 Tavily-Hikari 不是根因，而是放大器

如果问题是：

- 最新 API 变更；
- 某个库的当前文档；
- 某项近期新闻；
- 某个 issue 是否已被修复；

那么 Tavily-Hikari 这类工具的价值非常高。

但当问题变成：

```text
为什么一个 orchestration layer 会系统性压制模型能力？
```

这类题目需要的是：

- 机制归纳；
- 证据分级；
- 因果拆解；
- 对不同来源强度的判断。

这时 Tavily-Hikari 更适合作为：

- 外部事实校正器；
- 源材料收集器；
- 论点补强器；

而不适合作为主思维链本身。

## 4.2 真正危险的是“默认先搜”而不是“可用时再搜”

在 agent 框架里，Tavily-Hikari 的副作用往往不是来自工具本身，而来自策略：

- 是否被规定为所有非平凡问题的默认起手；
- 是否在 conceptual task 上也被无差别触发；
- 是否把大量原始搜索结果直接塞回主上下文。

如果检索层被设计成：

```text
只在确实需要外部事实时触发，
并且先压缩、再引用、最后才进入主回答，
```

那么它通常是增益。

如果被设计成：

```text
先搜再说；搜得越多越稳；
把结果原样回灌给主模型；
```

那么它会和 context rot、tool-induced myopia、instruction overload 形成共振。

## 5. 证据分级

本报告采用三层证据：

需要先说明的是：direct evidence 直接支持的是若干降效机制本身；本文对 superpowers-heavy orchestration 的总体判断，则是这些机制在同一框架中叠加后的工程归纳。

### 5.1 Direct evidence

这类证据直接支持某一机制，优先级最高：

- 长上下文本身拉低性能；[E1]
- instruction hierarchy 的存在与 many-tier 冲突扩展；[E2][E3]
- 工具诱导近视；[E5]
- 指令饱和 / requirement stacking 导致遵循率下降；[E8]

### 5.2 Strong engineering evidence

这类证据不是理论论文，但来自头部实验室或公开事故，强度次高：

- Anthropic/Claude Code harness 与 system prompt 微调导致质量回退；[E6]
- context engineering / context rot 的一手工程讨论与方法论；[E9]

### 5.3 Practitioner-observed evidence

这类证据不能单独当作定理，但在产品层很重要：

- GPT-5 在 agent SDK / tool calling 场景里的谨慎性回退反馈；[E7]
- 工具过多后的路由崩塌经验；[E4]

因此，本报告最稳妥的表达是：

```text
“重型 superpowers 很可能系统性伤害 GPT-5.6 表现”
比
“它在所有任务上必然伤害表现”
更符合证据边界。
```

## 6. 判断

### 6.1 可以直接下的判断

1. **重型 superpowers 的一个高风险副作用是目标偏移，而不是单纯的 token 浪费。**
2. **上下文变长、规则变多、工具变多、子代理变多，这几件事不是线性叠加，而是相互增强。**
3. **GPT-5.6 这类更强模型并不会天然“吃下所有框架复杂度”；在高优先级约束设计不当时，它可能更忠实地执行低收益流程。**
4. **Tavily-Hikari 在 conceptual task 上若被写成默认强制动作，确实可能成为降效链路的一部分；但它不是最深层根因。**
5. **最应该被削减的不是“能力种类”，而是“默认强制程度”和“高优先级元规则密度”。**

### 6.2 不能过度声称的判断

1. 不能仅凭本报告断言 GPT-5.6 在所有 agent 任务上都比前代差。
2. 不能仅凭外部资料断言某个具体 superpowers 仓库在全部配置下都错误。
3. 不能把 Tavily-Hikari 的检索引入等同于所有检索增强系统都应被关闭。

### 6.3 对框架设计的直接启发

如果要让前沿模型发挥得更好，最合理的方向不是“再加一层 superpowers”，而是：

- 把流程从默认强制改为条件触发；
- 把工具从默认先用改为证据驱动；
- 把外部检索从原始片段堆叠改为高信号压缩；
- 把 review / Oracle / delegation 留给真正高风险或高复杂度问题；
- 把“过程完整”重新降级为“结果可靠”的从属指标。

## 7. 附录：来源与证据编号

### [E1] Direct

- Du et al., **Context Length Alone Hurts LLM Performance Despite Perfect Retrieval** (EMNLP 2025 / arXiv:2510.05381)

### [E2] Direct

- Wallace et al., **The Instruction Hierarchy: Training LLMs to Prioritize Privileged Instructions** (2024)

### [E3] Direct

- **Many-Tier Instruction Hierarchy in LLM Agents** (2026)

### [E4] Practitioner-observed / benchmark-aligned

- Tool overload / too many tools analyses, including ToolRAG-style practitioner reports and public benchmark commentary summarized during this research pass

### [E5] Direct

- Bayat et al., **From Proof to Program: Characterizing Tool-Induced Reasoning Hallucinations in Large Language Models** (ACL 2026 / arXiv:2511.10899)

### [E6] Strong engineering evidence

- Anthropic / Claude Code harness incident reports and follow-up coverage describing performance regression caused by orchestration-layer changes rather than weight changes

### [E7] Practitioner-observed

- Public GPT-5 agent/tool-calling regression reports, including OpenAI Agents SDK issue discussions and forum threads referenced during this research pass

### [E8] Direct

- Research on instruction saturation / prompt requirement stacking, including **What Prompts Don't Say: Understanding and Managing Underspecification in LLM Prompts** and adjacent 2025 prompt-engineering effectiveness studies

### [E9] Research-pass synthesis with engineering references

- This research pass's Tavily-Hikari-assisted source synthesis, including engineering discussions and references on context rot, context engineering, and the practical degradation of overlong prompts before nominal context limits. It is supportive material, not a standalone primary proof object.

## 8. 当前判断边界

最后把边界再说清楚：

```text
本报告足以支持“在前沿模型上，应优先削减重型 superpowers 的默认强制性，并把工具、检索、委托改为条件触发”，
但还不足以单独给出一个最优新框架的完整实证排序。
```

换句话说，当前最稳的动作不是继续给 GPT-5.6 叠更多上层规则，而是：

1. 先删掉不必要的强制步骤；
2. 再观察回答是否变得更短、更准、更聚焦；
3. 只有在结果退化时，才把必要流程逐项加回。

这比“先假设模型不够稳，所以继续加流程”更符合现有证据。
