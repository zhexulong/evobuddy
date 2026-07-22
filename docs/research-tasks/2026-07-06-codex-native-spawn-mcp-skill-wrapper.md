# 调研任务：Codex native spawn 的 MCP / skill 包装与 Context Tree 回写

## 目标

回答下面这个实现前问题：

```text
在真实 Codex agent 会话中，agent-callable MCP / skill
能否触发或包裹 native spawn，
并把 spawn result 与 evidence 写回 Context Tree？
```

这里的重点不是 eval harness 能否 ingest retained artifact，那个链路已经证明可行。
本调研要回答的是：

1. `spawn_agent` / `wait_agent` 这一层能否被 MCP / skill 直接调用；
2. 如果不能，最合理的 wrapper 边界是什么；
3. 仓库内已经有哪些产品级 API 可以复用来把结果写回 Context Tree。

## 结论

结论分两层：

1. **能包裹 native spawn 的前后流程，但不能替代 runtime 自己成为 native spawn surface。**
2. **当前仓库已经具备“spawn 结果 -> Context Tree manifest/artifact 回写”的大部分底层 API，但还缺一个给真实 agent 会话调用的薄包装层。**

更具体地说：

- skill 可以作为 **指令包装层**，让 agent 在真实 Codex 会话里执行 `spawn_agent(...)`、`wait_agent(...)`，然后再调用 Context Tree 回写逻辑；
- MCP 可以作为 **证据采集 / artifact 回写层**，接收 spawn 结果并把它规范化成 Context Tree artifacts；
- 但 skill / MCP **不能从外部越层变成 native spawn runtime 本身**。`spawn_agent` / `wait_agent` 仍属于 agent runtime 内部能力，而不是当前 app-server / MCP 协议直接暴露的接口。

## 关键边界

### 1. skill 不是 native spawn surface

skill 更接近 prompt / synthetic context injection，而不是 runtime API。

因此 skill 能做的是：

- 指示 agent 现在应该构造 reviewer prompt；
- 指示 agent 调用 `spawn_agent(...)`；
- 指示 agent 调用 `wait_agent(...)`；
- 指示 agent 把结果交给 Context Tree writer。

skill 不能做的是：

- 绕过 agent 自己直接调用 runtime 内部 spawn surface；
- 作为外部过程拿到 live runtime 的 hidden session state；
- 代替 runtime 自己管理 spawned agent 的执行与 result return。

### 2. MCP 不是 native spawn runtime

MCP server 是独立 tool execution 进程，适合做：

- 结果结构化；
- artifact 校验；
- manifest 构造；
- evidence 落盘；
- graph / report side-effect。

但它不适合也不能天然做的是：

- 直接调用和当前 agent 会话同一 runtime 内部的 `spawn_agent` / `wait_agent`；
- 访问 agent runtime 的 thread manager / rollout store / session DB；
- 把自己伪装成 native spawn surface。

这意味着最合理的边界是：

```text
skill / agent instruction
→ agent runtime 内部执行 native spawn
→ MCP / helper 接收 spawn 结果
→ Context Tree 写回 artifacts / manifests / graph
```

### 3. retained-artifact proof 与 same-process live proof 不是一回事

当前仓库已经明确：

- `npm run eval:codex:live` 通过 app-server surface 可以跑 `thread/*` 能力；
- 但它不能直接从同一进程内调用 live runtime 的 `spawn_agent` / `wait_agent`；
- 所以当前 native-spawn proof 是 **retained-artifact proof**，不是 **same-process live app-server proof**。

这一点不影响 V0 implementation proof，但必须在文档和报告中明确区分，避免把 artifact-ingested native spawn pass 误写成 app-server 直接 native spawn pass。

## 仓库内已具备的回写能力

### A. native spawn 结果规范化

文件：`src/adapters/codex-native-spawn.mjs`

已有纯函数：

- `buildContextTreeReviewerPrompt()`
- `normalizeNativeSpawnFinalAnswer()`
- `createNativeSpawnManifestInput()`
- `codexApiForForkMode()`

它们的定位很清楚：

```text
负责 native spawn 前后数据结构的纯函数规范化，
不负责自己调用 spawn_agent。
```

这正适合未来被 skill-side 或 MCP-side wrapper 调用。

### B. artifact 校验与 case result 转换

文件：`src/eval/native-spawn-artifact.mjs`

核心入口：

- `nativeSpawnCaseResultFromArtifact()`

已覆盖：

- `artifactKind` 校验；
- `checkpointAnchor` 合同校验；
- reviewer prompt leak audit；
- expected / forbidden canary 判定；
- evidence gating；
- `createCaptureManifest()` 生成。

这说明 native spawn artifact contract 已经是稳定的产品约束，不是一次性测试脚本。

### C. Context Tree manifest 构造

文件：`src/core/context-tree-manifest.mjs`

已有产品级 manifest factory：

- `createCheckpointManifest()`
- `createSpawnRunManifest()`
- `createSpawnResultManifest()`

这三者已经能表达：

```text
checkpoint
→ spawn request / material selection / fidelity
→ result return / evidence summary
```

### D. 独立 artifact 落盘

文件：`src/core/context-tree-artifacts.mjs`

已有：

- `writeContextTreeManifestArtifacts()`

它已经能把：

- `checkpoint-manifest.json`
- `spawn-manifest.json`
- `spawn-result.json`

独立落盘到指定目录。

### E. eval / helper 侧的现成示例

文件：`scripts/eval/write-native-spawn-artifact.mjs`

这个 CLI 已经证明：

- 可以把真实 retained `reviewerPrompt` + `wait_agent` final answer
- 转成 validator-clean 的 native spawn artifact
- 再被 eval 正确 ingest。

它不是最终的 live session wrapper，但它已经是最接近产品 sidecar 的现成例子。

## 当前缺失的 glue

当前缺的不是数据模型，而是 **真实 agent 会话可调用的薄包装层**。

### 1. 没有 agent-callable MCP tool 定义

现在仓库里有 library-level functions，但没有一个真正给 agent 调用的 tool，例如：

```text
context_tree_record_native_spawn(...)
```

### 2. 没有统一的产品级 orchestration API

当前写回流程是由多个 primitives 拼出来的：

- normalize native spawn result
- create manifests
- write artifacts

但还没有一个产品级入口，例如：

```ts
recordNativeSpawnToContextTree(input)
```

### 3. graph store 还没有自动接线

文件：`src/core/graph-store.mjs`

有：

- `addNode()`
- `addEdge()`
- `toJSON()`

但当前还没有 manifest → graph 的自动回写路径。

也就是说，现在 manifest artifact 会落盘，但 graph 还不是同一条产品 side-effect 链的一部分。

### 4. 缺少 live session checkpoint anchor 采集器

artifact / manifest 都已经要求：

- `createdAt`
- `turnId` / `messageId` / `checkpointId`

但当前还没有一个面向真实 live session wrapper 的统一 helper，专门把当前 parent 会话边界采成合法 `checkpointAnchor`。

## 最合理的实现形态

### 推荐形态：skill + MCP sidecar

最合理的分工不是让 MCP 去“拥有 native spawn”，而是：

#### 1. skill 负责 runtime 内动作

skill 让 agent 在真实 Codex 会话里做：

```text
build reviewerPrompt
→ spawn_agent(...)
→ wait_agent(...)
→ collect spawnedAgentId / final answer / parent boundary
```

#### 2. MCP tool 负责结构化回写

然后 agent 调一个 Context Tree tool，例如：

```text
context_tree_record_native_spawn({
  sourceThreadId,
  checkpointAnchor,
  spawnedAgentId,
  forkMode,
  reviewerPrompt,
  observedAnswer,
  evidenceRefs?
})
```

tool 内部只做产品级写回：

- `normalizeNativeSpawnFinalAnswer()`
- `createCheckpointManifest()`
- `createSpawnRunManifest()`
- `createSpawnResultManifest()`
- `writeContextTreeManifestArtifacts()`

如果需要兼容 eval/report，再额外输出一份 native spawn artifact JSON。

## 最小实现建议

如果下一步要进入实现，建议先做一个很薄的产品 API，而不是直接扩成完整 OpenCode adapter：

建议新增类似：

```text
src/core/context-tree-native-spawn-record.mjs
```

导出：

```ts
recordNativeSpawnToContextTree({
  outputDir,
  sourceThreadId,
  checkpointAnchor,
  spawnedAgentId,
  forkMode,
  reviewerPrompt,
  observedAnswer,
  evidenceRefs,
  knownLosses,
})
```

它内部负责：

1. 规范化 native spawn result；
2. 生成 checkpoint / spawn run / spawn result manifests；
3. 调 `writeContextTreeManifestArtifacts()`；
4. 可选：回写 graph store snapshot；
5. 可选：输出 eval-compatible native spawn artifact。

这样后续无论是：

- Codex skill wrapper；
- OpenCode MCP tool；
- 未来 adapter；
- 还是手工 retained-artifact capture；

都能复用同一个产品写回入口，而不是复制 eval runner 里的拼装逻辑。

## 当前判断

本调研的结论不是简单的 yes / no，而是：

- **Yes**：真实 Codex agent 会话里的 skill / MCP 可以包裹 native spawn 的前后流程；
- **No**：它们不能从外部越层直接成为 native spawn runtime surface；
- **Yes**：当前仓库已经具备把 spawn result / evidence 写回 Context Tree 的大部分核心 API；
- **Missing**：还缺一个 session-callable 的薄包装层，把真实 live session 数据接到这些 API 上。

## 对下一步实现的影响

如果目标是最小增量推进，建议顺序是：

1. 先做产品级 `recordNativeSpawnToContextTree()` 薄包装；
2. 再做一个 agent-callable MCP tool schema；
3. 最后再决定是否进入 OpenCode adapter 层。

原因：

- 这样可以先把“live native spawn result → Context Tree product writeback”变成稳定边界；
- skill / MCP / adapter 都只是在调用同一个产品入口；
- 也能避免过早把实现绑死在某一个 host runtime 的插件机制上。
