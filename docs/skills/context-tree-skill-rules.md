# Context Tree Skill Rules

本文件是 Context Tree skills 的作者规则和产品语义约束，不是运行时 `SKILL.md`。未来 agent 加载 skill 时不应优先读本文件；它用于我们审查 skill 是否写对。

## 1. 分层

### rules/spec 层

写清楚 skill 的边界、术语、触发模型和禁止事项。这里可以解释为什么不绑定 Superpowers/Trellis、为什么不用 native-fork 作为主语、为什么 agent 不应负责理解 context 内容。

### SKILL.md 层

只写未来 agent 可执行的规则。它必须站在 agent 正常工作视角上：

```text
我下一步要做什么？
这个下一步是否依赖本 session 之前发生/决定过的事？
是否应该先请求一个 checkpoint-derived reviewer/checker/oracle？
```

`SKILL.md` 不应解释架构定位，不应写长篇 "What this skill is not"，不应要求 agent 判断自己是不是 loop-controller。

### contracts 层

写 record/writeback 字段、artifact shape、CLI/MCP 输入输出。contracts 主要给实现者、adapter、eval 和需要调用 writeback entrypoint 的 agent 看，不是运行时 skill 默认加载材料。`SKILL.md` 可以指向 contract，但必须说明只有在实现或调用 writeback 时才需要遵循。

### skill 不可取代性

每个 runtime skill 必须有不可取代的 agent 行为意义。一个 skill 只有在它会改变 agent 正常工作中的判断或动作时才成立。

不要为这些内容单独创建 skill：

- schema / enum / artifact guard；
- contract 的口语化包装；
- eval negative-control 防线；
- 平台已有 runtime 操作教程；
- 只告诉 agent “不要把 A 误标成 B”。

这些应进入 contracts、tests、implementation plan 或 adapter validation。Runtime skill 应解决 agent 自己在正常工作中会遇到的触发判断问题，例如“何时保存 checkpoint”或“何时使用 checkpoint 派生独立 reviewer/checker/oracle”。

## 2. 术语

### checkpoint

`checkpoint` 是一个最小完整、可恢复的 session boundary。

agent 可以标记边界和目的，但不负责选择、总结或保存 context。Context Tree / adapter 负责捕获可恢复材料，并记录 known losses。

### checkpoint-derived agent

`checkpoint-derived agent` 是从 checkpoint 的可恢复材料派生出来的独立 agent。主路径是：

```text
checkpoint
-> recoverable session material
-> task-conditioned prune
-> checkpoint-derived agent
-> result return
-> evidence/writeback
```

不要把 `native-fork` 写成产品主路径。平台 native fork 可以作为底层材料来源或对照路径，但 skill 的主语应是 checkpoint-derived agent。

### reviewer / checker / oracle / reflector / planner

这些是 checkpoint-derived agent 的任务角色：

- reviewer: 审查 plan/spec/diff/verdict 是否符合 prior session；
- checker: 检查某个条件或约束是否成立；
- oracle: 对 spec/eval/proof/claim 给出判定；
- reflector: 分析失败或分歧原因；
- planner: 给出下一步计划建议。

不要使用 `helper`，因为它容易被理解为 helper function。

## 3. 三个 skill

checkpoint 保存、checkpoint 使用、member discovery 是三个不同的触发面，必须拆成三个 skill：

```text
context-tree-save-checkpoint
context-tree-use-checkpoint
context-tree-discover-members
```

不要添加 `context-tree-codex-native-spawn` 这类平台记录 skill，除非它能证明有不可取代的 agent 行为意义。Codex native-spawn writeback 的防误标规则属于 contract/test/adapter validation，不属于 runtime skill。

不要在一个 `SKILL.md` 里写两个动作。原因：

- 保存 checkpoint 是低成本、宽触发、保留未来选择权；
- 使用 checkpoint 是高成本、窄触发、派生独立 agent 影响当前下一步；
- member discovery 会改变 parent agent 何时从 cold-start member routing 转向发现候选成员，以及如何回答 discovery gate/extractor 请求；
- 合在一起会让 agent 把“标记边界”“派生审查”“发现候选成员”混成同一个动作。

### context-tree-save-checkpoint

问题：

```text
这里是否值得留下未来可派生的可恢复 session boundary？
```

触发更宽，成本更低。典型信号：

- 用户给出关键约束、偏好、排除项；
- 某个方向被明确接受或否决；
- 一轮设计、探索、调试或讨论形成阶段性结论；
- 即将把讨论转成 plan/spec/patch/verdict；
- 即将 compact、prune、长会话继续、切换任务或切换模型；
- 用户显式要求“这里记一下”或“之后从这里分叉”。

compact/prune 场景不能只存 label。必须记录可恢复材料 refs；如果无法保证完整恢复，应记录 known loss。

### context-tree-use-checkpoint

问题：

```text
现在是否应该从相关 checkpoint 派生一个独立 agent 来影响下一步？
```

触发更窄，成本更高。不要写成 `depends on prior session context`，因为 agent 不知道 context 有什么。应写成 `depends on prior session`。

触发条件必须基于 agent 可观察的下一步动作：

- agent 即将采取一个实质下一步；
- 这个下一步依赖本 session 之前发生、讨论、失败或决定过的事；
- 如果判断错了，会造成明显返工、错误方向、错误 verdict、错误承诺或需要回头问用户；
- checkpoint-derived reviewer/checker/oracle/reflector/planner 的答案可能改变是否继续、如何继续、何时继续或继续到什么范围。

跳过条件：

- 下一步是机械动作；
- 错误便宜且容易回滚；
- 判断只依赖当前 artifact，如当前 diff、当前 spec、当前 test output；
- 已经有等价的 checkpoint-derived check 覆盖同一问题。

### context-tree-discover-members

问题：

```text
现在是否应该为当前项目启动 cold-start member discovery，并根据真实用户语句回答 discovery gate/extractor？
```

它的不可取代行为意义是：

- 改变 parent agent 何时从“只在已确认成员中路由”切换到 cold-start discovery；
- 改变 parent agent 如何提供 `ctree members discover` 的 gate/extractor 答案；
- 让 agent 明确保持候选为 unconfirmed，直到用户要求 Confirm、Rename、Add 或 Discard。

它不应重复：

- checkpoint save/use 的触发与动作；
- schema、enum、artifact guard；
- contract 的字段级约束。

V0 transport 是 CLI：

```text
ctree members discover
```

未来 MCP 可以包装这条能力，但 runtime skill 不应要求 MCP 作为前提。

## 4. 触发 wording 约束

禁止在 `SKILL.md` 中使用这些触发前提：

- "if you are the loop-controller";
- "if you know stronger context is available";
- "if you know prior context contains ...";
- 固定 host 阶段名作为必要条件，如 "before Superpowers writing-plans"；
- `native-fork` 作为必须使用的主路径。

应使用这种 agent 视角：

```text
When the session reaches a boundary future work may need, save a checkpoint.

Before you turn prior session work into a consequential next step, consider requesting a checkpoint-derived agent.
```

## 5. Skill 内容要求

### context-tree-save-checkpoint 应包含：

1. 简短 overview；
2. save checkpoint trigger；
3. checkpoint label/purpose shape；
4. 不让 agent 管 context 的规则；
5. compact/prune known-loss 规则；
6. writeback contract 指针，且说明仅实现或调用 writeback 时需要。

### context-tree-use-checkpoint 应包含：

1. 简短 overview；
2. use checkpoint trigger；
3. checkpoint-derived agent request shape；
4. result use requirement；
5. fidelity/evidence rules；
6. writeback contract 指针，且说明仅实现或调用 writeback 时需要。

### context-tree-discover-members 应包含：

1. 简短 overview；
2. symptom-driven discovery trigger；
3. `ctree members discover` 与 answer-gate / answer-extractor 的运行形状；
4. 仅从 displayed genuine user lines 提供 gate/extractor 答案的规则；
5. unconfirmed candidate policy；
6. 不要求 runtime agent 预先加载 schema 或 contract。

`SKILL.md` 不应包含：

- 产品定位长文；
- 对 Superpowers/Trellis 的依附性描述；
- MCP/CLI 详细 schema；
- long non-goals section；
- 要求 agent 管理 context 内容或判断 material path。

## 6. Context Tree 责任

Context Tree / adapter 负责：

- 保存 checkpoint 的最小完整可恢复材料；
- 从 checkpoint 派生 agent 前做 task-conditioned prune；
- 选择并记录实际 material path；
- 标记 known losses；
- 写 checkpoint/spawn/result artifacts；
- 不把 fresh-thread / summary-only 写成成功的 Context Tree 派生路径。

agent 负责：

- 识别下一步是否依赖 prior session；
- 在合适边界标记 checkpoint；
- 在合适时机请求 checkpoint-derived agent；
- 使用派生 agent 结果决定下一步；
- 调用记录入口或保留可记录的返回结果。
