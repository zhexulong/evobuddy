# EvoBuddy TaskRoom Native-TUI Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully implement the approved TaskRoom-first EvoBuddy workbench that launches and attaches to native Agent TUIs through tmux, preserves evidence-backed fork/handoff semantics, exposes only explicit contextual actions, and retains the existing read-only Workbench as a compatibility surface.

**Architecture:** Keep the Node core authoritative for durable TaskRoom, AgentInstance, ForkRecord, HandoffRecord, native-session descriptors, locks, and evidence refresh. Keep the Rust/Ratatui crate responsible for the interactive workbench, terminal suspension/restoration, deterministic action dispatch, and the tmux substrate client. Runtime capability adapters produce structured argv and capability facts; they never return executable shell strings. The first production substrate is tmux; Zellij/cmux remain capability-gated follow-on decisions behind the same substrate contract.

**Tech Stack:** Node.js ESM, `node:test`, Rust 2024 workspace, Ratatui 0.30, Crossterm 0.29, Serde/serde_json, std::process::Command, tmux CLI, POSIX `script(1)` PTY harness, SHA-256 versioned JSON/JSONL artifacts.

## Global Constraints

- TaskRoom is the first-level product object; terminal and provider sessions are execution facets.
- The current read-only Workbench remains a compatibility/evidence-inspection surface until the interactive command path has real PTY proof.
- The MVP has no hidden or mandatory orchestrator. An optional coordinator is a visible normal TeamAgent with its own runtime session and evidence trail.
- Primary screens use contextual action bars. Text entry appears only in explicitly scoped search, command, TaskRoom creation, handoff, or structured-question controls.
- Native runtimes own conversation, tools, diffs, Ask Question, permissions, sandboxing, and runtime-specific UX.
- EvoBuddy must not embed arbitrary TUIs, build a terminal emulator, use terminal text injection, or use screen scraping as release-grade evidence.
- tmux is the first production substrate. TaskRoom and runtime code must depend on a substrate interface rather than tmux-specific product semantics.
- Exact resume is shown only when a validated provider conversation identity exists. Heuristic continuation and TaskRoom-context continuation must use distinct labels.
- Detach never means stop. Attach never silently creates a duplicate live session.
- Terminal output or terminal idleness alone cannot prove result return or TaskRoom completion.
- Every runtime action names its target participant, runtime, workspace, and safety mode.
- Every text entry surface names its destination and effect before submission.
- Session descriptors must never serialize secrets or arbitrary executable shell strings.
- Use structured argv for all child processes. Remove the current `sh -lc` backend-command path before enabling runtime mutation.
- Preserve additive schema compatibility and existing versioned contract conventions.
- Follow TDD for every implementation task: failing test, observed failure, minimal implementation, focused pass, regression pass.
- Do not weaken existing proof gates or delete failing tests to make the suite pass.

---

## Concrete Examples

### Example 1: Launch a new Codex participant

- **Example:** A user selects a TaskRoom participant with no managed Codex session and invokes `Open native runtime`.
- **Expected result:** EvoBuddy reserves one descriptor, creates one tmux session in the selected workspace, starts Codex with structured argv and the TaskRoom context packet, marks the descriptor attachable, leaves Ratatui terminal mode, attaches interactively, and restores the same TaskRoom selection after detach.
- **Verification:** `npm run evobuddy:eval-native-tui-tmux:live -- --scenario launch-codex` reports `status: "pass"`; its artifact records one descriptor, one tmux session, one child process, `AttachOutcome::Detached`, and matching TaskRoom/AgentInstance ids.
- **Failure signal:** More than one live session exists, the descriptor is not durable before attach, the wrong cwd/runtime starts, or the user returns to a different Workbench selection.
- **If it fails:** Return to the implementation task owning the router, descriptor lifecycle, or terminal guard; add a failing regression before changing code.

### Example 2: Attach without duplication

- **Example:** A live managed Claude session already exists for the selected AgentInstance.
- **Expected result:** `Open native runtime` attaches to the existing terminal session and does not spawn a second Claude process or descriptor.
- **Verification:** The tmux integration test compares session/process counts before and after attach; both remain one.
- **Failure signal:** A second session, process, or attachable descriptor is created.
- **If it fails:** Correct per-instance locking/reconciliation; do not hide the duplicate in projection code.

### Example 3: Runtime-owned permission request

- **Example:** A reliable runtime hook or protocol reports that Codex or Claude needs permission.
- **Expected result:** EvoBuddy shows `Needs input in <runtime>` and `Enter Open session`; it does not reproduce, answer, or inject input into the permission prompt.
- **Verification:** Runtime capability/evidence tests produce a source-qualified attention state; a negative test proves the Workbench has no command that answers the native prompt.
- **Failure signal:** Generic Workbench input answers the prompt, terminal text is injected, or terminal-pattern matching is treated as authoritative permission evidence.
- **If it fails:** Return to the runtime adapter/security tasks.

### Example 4: Crash and reconciliation

- **Example:** EvoBuddy exits while an Agent continues in tmux, or descriptor creation fails after tmux session creation.
- **Expected result:** The Agent continues. On restart, reconciliation classifies the session as matched or orphaned, restores/repairs the TaskRoom link, and refuses to create an unverified duplicate.
- **Verification:** A live eval kills the EvoBuddy client, restarts it, and checks descriptor/substrate classification plus unchanged child PID.
- **Failure signal:** The Agent dies with EvoBuddy, a stale lock blocks forever, or restart creates another session.
- **If it fails:** Correct store locking and reconciliation before touching UI labels.

### Example 5: Exact resume versus context continuation

- **Example:** The terminal session is gone. One record has a validated OpenCode conversation ref; another Codex record has no validated exact ref.
- **Expected result:** OpenCode exposes `Resume conversation`; Codex exposes `Continue with TaskRoom context`. Neither action is mislabeled.
- **Verification:** Capability matrix unit tests and action-bar snapshots assert exact labels and disabled reasons.
- **Failure signal:** A heuristic/latest command is presented as exact resume.
- **If it fails:** Correct runtime capability descriptors and action derivation.

### Example 6: Idle is not returned

- **Example:** A native TUI is idle but no result-return or handoff artifact exists.
- **Expected result:** The runtime facet may show idle/available, but the AgentInstance is not `Returned` and the TaskRoom is not `Completed`.
- **Verification:** Evidence reducer negative-control tests keep the work state unchanged.
- **Failure signal:** Terminal inactivity satisfies completion.
- **If it fails:** Correct evidence aggregation; never fix by changing copy alone.

### Example 7: No hidden orchestrator

- **Example:** The user enters free text only inside the TaskRoom objective or handoff body field.
- **Expected result:** EvoBuddy records the scoped value and performs only the explicitly selected form action. It does not choose agents, create participants, or advance workflow from open-ended text.
- **Verification:** Input reducer tests prove only `/`, `:`, `n`, `h`, and inline questions open scoped controls; no persistent open-ended input exists.
- **Failure signal:** A generic prompt silently launches or coordinates agents.
- **If it fails:** Return to the Workbench interaction task and remove the implicit orchestration path.

### Invariants

- A TaskRoom id never depends on a tmux or provider session id.
- A terminal session or transcript may support Fork/Handoff proof but never replaces durable ForkRecord/HandoffRecord closure.
- The native session store is authoritative for EvoBuddy ownership metadata; tmux is authoritative only for substrate liveness.
- The Workbench reducer remains side-effect-free; commands are emitted as typed effects and executed by the interactive shell.
- Read-only snapshots and reports remain available even when tmux is missing.
- Missing runtime/substrate capabilities produce disabled actions with reasons, not crashes or overclaims.

---

## Milestone 0: Establish a Green and Safe Baseline

### Task 1: Repair existing Workbench regressions and command safety

**Files:**
- Modify: `scripts/evobuddy/evobuddy.mjs`
- Modify: `crates/evobuddy-tui/src/backend.rs`
- Modify: `crates/evobuddy-tui/src/widgets/dashboard.rs`
- Modify: `test/cli/evobuddy-cli.test.mjs`
- Modify: `crates/evobuddy-tui/tests/action_bridge.rs`
- Modify: `docs/quality-review-report-2026-07-19.md` only if the repaired evidence needs an addendum; do not rewrite historical results.

**Example:** preserves all invariants; technical prerequisite.

**Interfaces:**
- Consumes: current `resolveWorkbenchInvocation()` and `backend_state_command()` behavior.
- Produces: safe structured state-export command construction and a green baseline for later slices.

- [ ] **Step 1: Add failing CLI regression tests for `--input-root` and `--json-out` forwarding**

```js
test('workbench state export forwards input-root and writes evobuddy.workbench.state.v1', async () => {
  const result = await runEvobuddy([
    'workbench', '--project', projectRoot,
    '--input-root', retainedInputRoot,
    '--json-out', outputPath,
  ]);
  assert.equal(result.exitCode, 0);
  const value = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(value.schema, 'evobuddy.workbench.state.v1');
  assert.ok(value.taskRooms.length > 0);
});
```

- [ ] **Step 2: Run the focused CLI test and capture the current failure**

Run: `node --test test/cli/evobuddy-cli.test.mjs`

Expected: FAIL because `--input-root` or `--json-out` is consumed/routed incorrectly.

- [ ] **Step 3: Replace backend shell interpolation with structured argv**

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackendCommand {
    pub program: String,
    pub args: Vec<String>,
}

pub fn backend_state_command(options: &BackendOptions) -> BackendCommand {
    BackendCommand {
        program: "node".to_owned(),
        args: build_state_export_args(options),
    }
}
```

Delete the `sh -lc` execution branch. If a test-only override remains necessary, represent it as `program + args`, never one shell string.

- [ ] **Step 4: Fix CLI forwarding and the clippy `iter().nth(2)` issue**

Use explicit argument arrays in `scripts/evobuddy/evobuddy.mjs`. Replace the flagged Rust sequence with `.get(2)` without changing behavior.

- [ ] **Step 5: Run baseline verification**

Run:

```bash
node --test test/cli/evobuddy-cli.test.mjs
cargo test -p evobuddy-tui
cargo clippy -p evobuddy-tui --all-targets -- -D warnings
cargo fmt --all -- --check
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/evobuddy/evobuddy.mjs crates/evobuddy-tui/src/backend.rs crates/evobuddy-tui/src/widgets/dashboard.rs test/cli/evobuddy-cli.test.mjs crates/evobuddy-tui/tests/action_bridge.rs
git commit -m "fix: restore safe workbench command baseline"
```

---

## Milestone 1: Contracts and Durable Native-Session State

### Task 2: Define native-session, runtime-capability, and evidence-refresh contracts

**Files:**
- Create: `src/core/evobuddy-native-session-descriptor.mjs`
- Create: `src/core/evobuddy-runtime-capability.mjs`
- Create: `src/core/evobuddy-evidence-refresh-record.mjs`
- Create: `docs/contracts/evobuddy-native-session-contract.md`
- Create: `docs/contracts/evobuddy-runtime-capability-contract.md`
- Create: `test/core/evobuddy-native-session-descriptor.test.mjs`
- Create: `test/core/evobuddy-runtime-capability.test.mjs`
- Create: `test/core/evobuddy-evidence-refresh-record.test.mjs`
- Create: `test/docs/evobuddy-native-session-contract.test.mjs`

**Example:** implements Examples 1, 4, and 5; preserves TaskRoom/session identity invariants.

**Interfaces:**
- Produces:
  - `createNativeSessionDescriptor(input)`
  - `validateNativeSessionDescriptor(value)`
  - `transitionNativeSessionDescriptor(value, transition)`
  - `createRuntimeCapabilityDescriptor(input)`
  - `deriveContinuationAction(capability, sessionFacts)`
  - `createEvidenceRefreshRecord(input)`

- [ ] **Step 1: Write failing schema tests**

```js
test('native session descriptor rejects executable command strings and secrets', () => {
  assert.throws(() => createNativeSessionDescriptor({
    descriptorId: 'session-1',
    roomId: 'room-1',
    agentInstanceId: 'instance-1',
    runtime: 'codex',
    workspace: '/repo',
    substrate: 'tmux',
    substrateSessionRef: 'evb-repo-room-builder-a1',
    lifecycle: 'creating',
    launchCommand: 'codex --dangerous',
    env: { API_KEY: 'secret' },
  }), /launchCommand|secret|env/);
});

test('continuation action distinguishes exact, heuristic, context, and unsupported', () => {
  assert.equal(deriveContinuationAction(exactCapability, exactFacts).kind, 'exact-resume');
  assert.equal(deriveContinuationAction(heuristicCapability, heuristicFacts).kind, 'heuristic-resume');
  assert.equal(deriveContinuationAction(contextCapability, contextFacts).kind, 'continue-with-context');
  assert.equal(deriveContinuationAction(freshCapability, {}).kind, 'fresh-session');
  assert.equal(deriveContinuationAction(unsupportedCapability, {}).kind, 'unsupported');
});

test('descriptor attach transition records lastAttachedAt without execution data', () => {
  const attached = transitionNativeSessionDescriptor(descriptor, {
    kind: 'attached',
    at: '2026-07-20T00:00:00.000Z',
  });
  assert.equal(attached.lastAttachedAt, '2026-07-20T00:00:00.000Z');
  assert.equal(typeof attached.launchCommandRef, 'string');
  assert.equal('launchCommand' in attached, false);
  assert.equal('env' in attached, false);
});
```

- [ ] **Step 2: Run tests to verify missing modules fail**

Run: `node --test test/core/evobuddy-native-session-descriptor.test.mjs test/core/evobuddy-runtime-capability.test.mjs test/core/evobuddy-evidence-refresh-record.test.mjs`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement exact versioned contracts**

Use these lifecycle values:

```js
export const NATIVE_SESSION_LIFECYCLES = Object.freeze([
  'creating', 'attachable', 'attached', 'detached',
  'stale', 'failed', 'terminated',
]);

export const CONTINUATION_KINDS = Object.freeze([
  'exact-resume', 'heuristic-resume', 'continue-with-context',
  'fresh-session', 'unsupported',
]);
```

Descriptor fields must be exact and versioned: `schema: "evobuddy.native-session.v1"`, `descriptorVersion: 1`, `descriptorId`, `roomId` (the serialized TaskRoom id), `agentInstanceId`, `runtime`, `workspace`, `terminalSubstrate`, `terminalSessionRef`, optional validated `providerConversationRef`, `launchCommandRef`, `runtimeCapabilityRef`, `lifecycle`, `createdAt`, nullable `lastAttachedAt`, `safetyMode`, nullable `contextPacketRef`, `evidenceRefs`, `recoveryPolicy`, and `digest`. `launchCommandRef` and `runtimeCapabilityRef` are non-executable identifiers resolved through the adapter registry; descriptors never serialize command text, argv, environment values, secrets, or raw authentication tokens.

- [ ] **Step 4: Document invariants and rejection rules**

The contract docs must explicitly prohibit secrets, arbitrary shell, exact-resume overclaim, TaskRoom identity derived from session ids, and terminal output as completion proof.

- [ ] **Step 5: Run focused and contract tests**

Run:

```bash
node --test test/core/evobuddy-native-session-descriptor.test.mjs test/core/evobuddy-runtime-capability.test.mjs test/core/evobuddy-evidence-refresh-record.test.mjs
node --test test/docs/evobuddy-native-session-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/evobuddy-native-session-descriptor.mjs src/core/evobuddy-runtime-capability.mjs src/core/evobuddy-evidence-refresh-record.mjs docs/contracts/evobuddy-native-session-contract.md docs/contracts/evobuddy-runtime-capability-contract.md test/core/evobuddy-native-session-descriptor.test.mjs test/core/evobuddy-runtime-capability.test.mjs test/core/evobuddy-evidence-refresh-record.test.mjs test/docs/evobuddy-native-session-contract.test.mjs
git commit -m "feat: define native session contracts"
```

### Task 3: Add atomic native-session storage and reconciliation locks

**Files:**
- Modify: `src/core/evobuddy-project-state.mjs`
- Create: `src/core/evobuddy-native-session-store.mjs`
- Create: `src/core/evobuddy-session-lock.mjs`
- Create: `test/core/evobuddy-native-session-store.test.mjs`
- Create: `test/core/evobuddy-session-lock.test.mjs`
- Modify: `test/core/evobuddy-project-state.test.mjs`

**Example:** implements Example 4 and the no-duplicate invariant.

**Interfaces:**
- Consumes: Task 2 descriptor factories.
- Produces:
  - `reserveNativeSession(projectRoot, descriptorInput)`
  - `commitNativeSession(projectRoot, descriptorId, substrateFacts)`
  - `readNativeSession(projectRoot, descriptorId)`
  - `listNativeSessions(projectRoot)`
  - `updateNativeSession(projectRoot, descriptorId, transition)`
  - `withAgentInstanceSessionLock(projectRoot, agentInstanceId, fn)`
  - `classifySessionReconciliation(descriptors, substrateFacts)`

- [ ] **Step 1: Write failing atomicity and stale-lock tests**

```js
test('reserve then failed create remains reconcilable and cannot duplicate', async () => {
  const reserved = await reserveNativeSession(projectRoot, descriptorInput);
  assert.equal(reserved.lifecycle, 'creating');
  await assert.rejects(() => reserveNativeSession(projectRoot, descriptorInput), /locked|existing/);
  const classifications = classifySessionReconciliation([reserved], []);
  assert.equal(classifications[0].classification, 'stale');
});
```

- [ ] **Step 2: Run focused tests and observe failure**

Run: `node --test test/core/evobuddy-native-session-store.test.mjs test/core/evobuddy-session-lock.test.mjs`

Expected: FAIL because storage/lock modules do not exist.

- [ ] **Step 3: Extend `.evobuddy` layout**

Add:

```text
.evobuddy/native-sessions/<descriptorId>.json
.evobuddy/native-sessions/index.json
.evobuddy/native-session-launch-plans/<planId>.json
.evobuddy/locks/session-<agentInstanceId>.lock
.evobuddy/evidence-refresh/<roomId>.json
```

Use owner-only directory/file permissions where supported, same-directory temp files, fsync/rename atomic writes, and lock metadata containing pid, process start token, agentInstanceId, acquiredAt, and expiry.

- [ ] **Step 4: Implement stale-lock recovery without deleting live locks**

Verify the lock owner PID/start token before reclaiming. A mere age threshold must not break a live attach.

- [ ] **Step 5: Run focused tests and existing project-state tests**

Run:

```bash
node --test test/core/evobuddy-native-session-store.test.mjs test/core/evobuddy-session-lock.test.mjs test/core/evobuddy-project-state.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/evobuddy-project-state.mjs src/core/evobuddy-native-session-store.mjs src/core/evobuddy-session-lock.mjs test/core/evobuddy-native-session-store.test.mjs test/core/evobuddy-session-lock.test.mjs test/core/evobuddy-project-state.test.mjs
git commit -m "feat: persist and lock native sessions"
```

### Task 4: Link native sessions to existing AgentInstance, ForkRecord, and HandoffRecord proof

**Files:**
- Modify: `src/core/evobuddy-taskroom-fork-handoff.mjs`
- Modify: `src/core/evobuddy-taskroom-record.mjs`
- Modify: `src/core/evobuddy-taskroom-loop-proof.mjs`
- Modify: `test/core/evobuddy-taskroom-fork-handoff.test.mjs`
- Modify: `test/core/evobuddy-taskroom-record.test.mjs`
- Modify: `test/eval/evobuddy-taskroom-product-proof.test.mjs`

**Example:** implements the Fork/Handoff proof invariant and Example 6.

**Interfaces:**
- Consumes: `descriptorId` and `evidenceRefs` from Tasks 2-3.
- Produces additive optional links: `nativeSessionDescriptorId` on AgentInstance and runtime evidence refs on Fork/Handoff closure; no replacement of existing records.

- [ ] **Step 1: Add failing positive and negative closure tests**

```js
test('native session supports but does not replace fork handoff closure', () => {
  const result = validateForkHandoffClosure({
    instances: [sourceInstance, targetInstanceWithDescriptor],
    forks: [forkRecord],
    handoffs: [handoffWithEvidence],
    nativeSessions: [attachableDescriptor],
  });
  assert.equal(result.valid, true);
});

test('terminal session without durable handoff does not prove return', () => {
  assert.throws(() => validateForkHandoffClosure({
    instances: [sourceInstance, targetInstanceWithDescriptor],
    forks: [forkRecord],
    handoffs: [],
    nativeSessions: [attachableDescriptor],
  }), /handoff|closure/);
});
```

- [ ] **Step 2: Run focused tests and verify negative failure**

Run: `node --test test/core/evobuddy-taskroom-fork-handoff.test.mjs test/eval/evobuddy-taskroom-product-proof.test.mjs`

Expected: FAIL because native-session linkage is not validated.

- [ ] **Step 3: Implement additive linkage and proof checks**

Do not add tmux pane refs as handoff delivery proof. Validate that any referenced descriptor matches `roomId`, `agentInstanceId`, and runtime; require explicit HandoffRecord/resultReturn evidence for return/completion.

- [ ] **Step 4: Run TaskRoom core and eval tests**

Run:

```bash
node --test test/core/evobuddy-taskroom-record.test.mjs test/core/evobuddy-taskroom-fork-handoff.test.mjs test/eval/evobuddy-taskroom-product-proof.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/evobuddy-taskroom-fork-handoff.mjs src/core/evobuddy-taskroom-record.mjs src/core/evobuddy-taskroom-loop-proof.mjs test/core/evobuddy-taskroom-fork-handoff.test.mjs test/core/evobuddy-taskroom-record.test.mjs test/eval/evobuddy-taskroom-product-proof.test.mjs
git commit -m "feat: link native sessions to taskroom proof"
```

---

## Milestone 2: Projection and TaskRoom-First Read-Only UI

### Task 5: Extend Workbench state projection with sessions, capabilities, and actionable status

**Files:**
- Modify: `src/core/evobuddy-workbench-state-contract.mjs`
- Modify: `scripts/context-tree/export-evobuddy-workbench-state.mjs`
- Modify: `crates/evobuddy-tui/src/model.rs`
- Modify: `test/core/evobuddy-workbench-state-contract.test.mjs`
- Modify: `crates/evobuddy-tui/tests/model_contract.rs`
- Modify: `test/fixtures/evobuddy-workbench-state-v1.json`
- Modify: `test/fixtures/evobuddy-workbench-state-current.json`

**Example:** implements Examples 2, 3, 5, and 6 as visible projection facts.

**Interfaces:**
- Consumes: native-session store, runtime capability descriptors, existing TaskRoom artifacts.
- Produces additive `nativeSessions`, `runtimeCapabilities`, source-qualified attention, objective/acceptance criteria, and action eligibility in `evobuddy.workbench.state.v1`.

- [ ] **Step 1: Write failing JS and Rust projection tests**

```rust
#[test]
fn parses_native_session_and_action_capabilities_additively() {
    let state = fixture_state("evobuddy-workbench-state-v1.json");
    assert_eq!(state.native_sessions[0].lifecycle, NativeSessionLifecycle::Attachable);
    assert_eq!(state.task_rooms[0].available_actions[0].id, "open-native-runtime");
}
```

- [ ] **Step 2: Run tests and observe missing fields**

Run:

```bash
node --test test/core/evobuddy-workbench-state-contract.test.mjs
cargo test -p evobuddy-tui --test model_contract
```

Expected: FAIL on missing projection/model fields.

- [ ] **Step 3: Add additive projection types**

Rust types must include `NativeSessionSummary`, `RuntimeCapabilitySummary`, `ActionAvailability`, `AttentionSource`, and a dedicated `TaskRoomStatus` with exactly `Queued`, `Working`, `NeedsInput`, `NeedsReview`, `Blocked`, `Returned`, `Completed`, `Failed`, and `Archived`. Unknown or stale evidence is represented only through source/confidence/staleness diagnostics and disabled-action reasons; it must never become a first-level TaskRoom work state.

- [ ] **Step 4: Preserve old fixtures and unknown-field compatibility**

Use `#[serde(default)]` for additive collections so retained V1 state without sessions remains readable and read-only.

- [ ] **Step 5: Run projection and model tests**

Expected: all focused tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/evobuddy-workbench-state-contract.mjs scripts/context-tree/export-evobuddy-workbench-state.mjs crates/evobuddy-tui/src/model.rs test/core/evobuddy-workbench-state-contract.test.mjs crates/evobuddy-tui/tests/model_contract.rs test/fixtures/evobuddy-workbench-state-v1.json test/fixtures/evobuddy-workbench-state-current.json
git commit -m "feat: project native session workbench state"
```

### Task 6: Make TaskRooms and attention the first-level Rust TUI

**Files:**
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/src/views.rs`
- Modify: `crates/evobuddy-tui/src/widgets/dashboard.rs`
- Modify: `crates/evobuddy-tui/src/widgets/workspace.rs`
- Modify: `crates/evobuddy-tui/src/widgets/status_bar.rs`
- Modify: `crates/evobuddy-tui/tests/dashboard_snapshots.rs`
- Modify: `crates/evobuddy-tui/tests/workspace_snapshots.rs`
- Modify: `crates/evobuddy-tui/tests/input_flow.rs`

**Example:** implements Examples 3, 5, 6, and 7; preserves read-only compatibility.

**Interfaces:**
- Consumes: Task 5 projection.
- Produces: TaskRoom-first `WorkbenchApp`, attention sorting, selected-room detail, contextual action-bar renderer.

- [ ] **Step 1: Replace old snapshot expectations with failing TaskRoom-first expectations**

```rust
#[test]
fn home_is_taskroom_work_inbox_with_contextual_action_bar() {
    let frame = render_current_snapshot(&mut app(), 120, 40).unwrap();
    assert!(frame.contains("Needs input"));
    assert!(frame.contains("Selected TaskRoom"));
    assert!(frame.contains("Enter Open"));
    assert!(frame.contains("n New room"));
    assert!(!frame.contains("> continue / switch agent"));
}
```

- [ ] **Step 2: Run focused snapshots and confirm failure**

Run: `cargo test -p evobuddy-tui --test dashboard_snapshots --test workspace_snapshots --test input_flow`

Expected: FAIL because dashboard is actor-first and status bar is static.

- [ ] **Step 3: Introduce TaskRoom-first state without side effects**

Keep `WorkbenchApp` reducer-only. Make root focus `TaskRooms`; derive sorted rooms by actionable priority then activity. Team Agents and Focused Buddies remain accessible as participant/actor views, not the default root.

- [ ] **Step 4: Implement contextual action bars**

```rust
pub struct ActionHint {
    pub key: &'static str,
    pub label: &'static str,
    pub enabled: bool,
    pub disabled_reason: Option<String>,
}

pub fn action_hints(app: &WorkbenchApp) -> Vec<ActionHint> {
    match app.view_mode {
        ViewMode::Dashboard | ViewMode::Search => vec![
            ActionHint::enabled("Enter", "Open"),
            ActionHint::enabled("n", "New room"),
            ActionHint::enabled("/", "Search"),
            ActionHint::enabled("f", "Filter"),
            ActionHint::enabled(":", "Commands"),
            ActionHint::enabled("?", "Help"),
        ],
        ViewMode::TaskRoomWorkspace => app.selected_room_action_hints(),
        ViewMode::AgentInstanceWorkspace => app.selected_instance_action_hints(),
        _ => vec![ActionHint::enabled("Esc", "Back")],
    }
}
```

The list, room detail, and instance detail action sets must match the approved design. Disabled actions remain visible with reasons.

- [ ] **Step 5: Run snapshot/input tests at wide, compact, and narrow sizes**

Expected: PASS with TaskRoom-first landmarks and no persistent input.

- [ ] **Step 6: Commit**

```bash
git add crates/evobuddy-tui/src/app.rs crates/evobuddy-tui/src/views.rs crates/evobuddy-tui/src/widgets/dashboard.rs crates/evobuddy-tui/src/widgets/workspace.rs crates/evobuddy-tui/src/widgets/status_bar.rs crates/evobuddy-tui/tests/dashboard_snapshots.rs crates/evobuddy-tui/tests/workspace_snapshots.rs crates/evobuddy-tui/tests/input_flow.rs
git commit -m "feat: make taskrooms the workbench home"
```

### Task 7: Implement on-demand scoped inputs and deterministic commands

**Files:**
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/src/views.rs`
- Modify: `crates/evobuddy-tui/src/input.rs`
- Modify: `crates/evobuddy-tui/src/ui.rs`
- Modify: `crates/evobuddy-tui/src/widgets/command_palette.rs`
- Replace: `crates/evobuddy-tui/src/widgets/task_composer.rs` with scoped form widgets or split into:
  - Create: `crates/evobuddy-tui/src/widgets/task_room_form.rs`
  - Create: `crates/evobuddy-tui/src/widgets/handoff_form.rs`
  - Create: `crates/evobuddy-tui/src/widgets/structured_question.rs`
- Modify: `crates/evobuddy-tui/src/widgets/mod.rs`
- Modify: `crates/evobuddy-tui/tests/input_flow.rs`
- Modify: `crates/evobuddy-tui/tests/workspace_snapshots.rs`

**Example:** implements Example 7 and permission ownership in Example 3.

**Interfaces:**
- Produces typed reducer effects:

```rust
pub enum WorkbenchEffect {
    None,
    CreateTaskRoom(CreateTaskRoomDraft),
    CreateHandoff(CreateHandoffDraft),
    ExecuteCommand(DeterministicCommand),
    AnswerQuestion(StructuredAnswer),
    OpenNativeRuntime { room_id: String, instance_id: String },
}
```

- [ ] **Step 1: Write failing reducer tests for `/`, `:`, `n`, `h`, and numbered answers**

Verify that printable text on the normal screen does nothing, fields show destination/effect, and no generic prompt can select or launch an Agent.

- [ ] **Step 2: Run input-flow tests and observe failure**

Run: `cargo test -p evobuddy-tui --test input_flow --test workspace_snapshots`

- [ ] **Step 3: Refactor `handle_key_event` to return typed effects**

```rust
pub fn handle_key_event(app: &mut WorkbenchApp, input: KeyInput) -> WorkbenchEffect
```

Keep all form editing and command parsing deterministic. Commands are enum-backed, validated, and completed against projected ids; no free-form shell or natural-language parser.

- [ ] **Step 4: Implement structured TaskRoom and handoff forms**

TaskRoom fields: objective, acceptance criteria, workspace, actor, runtime, safety mode. Handoff fields: sender, receiver, body, artifact refs, expected next action, return destination.

- [ ] **Step 5: Implement inline EvoBuddy-owned structured questions**

Support `1-9`, arrows + Enter, optional free text only when the question schema permits it. Runtime-owned prompts expose only `Open session`.

- [ ] **Step 6: Run reducer and snapshot tests**

Expected: PASS and no `task_composer_draft`/persistent-input semantics remain.

- [ ] **Step 7: Commit**

```bash
git add crates/evobuddy-tui/src/app.rs crates/evobuddy-tui/src/views.rs crates/evobuddy-tui/src/input.rs crates/evobuddy-tui/src/ui.rs crates/evobuddy-tui/src/widgets crates/evobuddy-tui/tests/input_flow.rs crates/evobuddy-tui/tests/workspace_snapshots.rs
git commit -m "feat: add scoped workbench actions and forms"
```

---

## Milestone 3: Terminal Safety and Substrate Contract

### Task 8: Add a reusable TerminalModeGuard

**Files:**
- Create: `crates/evobuddy-tui/src/terminal_mode.rs`
- Modify: `crates/evobuddy-tui/src/lib.rs`
- Modify: `crates/evobuddy-tui/src/ui.rs`
- Create: `crates/evobuddy-tui/tests/terminal_mode.rs`
- Modify: `scripts/context-tree/run-evobuddy-rust-tui-pty-live-eval.mjs`

**Example:** implements Examples 1 and 4; preserves terminal restoration invariants.

**Interfaces:**
- Produces:

```rust
pub trait TerminalControl {
    fn drain_events(&mut self) -> anyhow::Result<()>;
    fn suspend(&mut self) -> anyhow::Result<()>;
    fn restore(&mut self) -> anyhow::Result<()>;
}

pub struct TerminalModeGuard<'a, T: TerminalControl> {
    control: Option<&'a mut T>,
    restored: bool,
}
```

- [ ] **Step 1: Write failing fake-control tests for order and idempotence**

```rust
#[test]
fn guard_drains_suspends_and_restores_once_on_drop() {
    let mut fake = FakeTerminalControl::default();
    { let _guard = TerminalModeGuard::enter(&mut fake).unwrap(); }
    assert_eq!(fake.calls, ["drain", "suspend", "restore"]);
}
```

Add tests for attach error, panic via `catch_unwind`, explicit restore plus Drop, and restore failure diagnostics.

- [ ] **Step 2: Run focused tests and observe missing module**

Run: `cargo test -p evobuddy-tui --test terminal_mode`

- [ ] **Step 3: Implement Crossterm terminal control**

Suspend order: drain pending events, flush, disable raw mode, disable mouse capture if enabled, leave alternate screen, show cursor. Restore order: enter alternate screen, enable mouse capture if configured, enable raw mode, clear backend, redraw, restore cursor policy. Ensure best-effort cleanup aggregates errors.

- [ ] **Step 4: Route app startup/shutdown through the same controller**

Remove duplicated raw/alternate lifecycle code from `run_interactive_app()`.

- [ ] **Step 5: Extend PTY eval assertions**

Assert ordered alternate-screen leave/enter sequences around a fake external command and a usable final shell state.

- [ ] **Step 6: Run focused Rust and PTY tests**

Run:

```bash
cargo test -p evobuddy-tui --test terminal_mode
npm run evobuddy:eval-rust-tui-pty:live -- --project . --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-terminal-mode
```

Expected: terminal-mode scenario PASS; broader eval may remain blocked only on later tmux features, with explicit missing-capability evidence.

- [ ] **Step 7: Commit**

```bash
git add crates/evobuddy-tui/src/terminal_mode.rs crates/evobuddy-tui/src/lib.rs crates/evobuddy-tui/src/ui.rs crates/evobuddy-tui/tests/terminal_mode.rs scripts/context-tree/run-evobuddy-rust-tui-pty-live-eval.mjs
git commit -m "feat: guard terminal suspend and restore"
```

### Task 9: Define the terminal substrate contract with a fake backend

**Files:**
- Create: `crates/evobuddy-tui/src/substrate/mod.rs`
- Create: `crates/evobuddy-tui/src/substrate/fake.rs`
- Modify: `crates/evobuddy-tui/src/lib.rs`
- Create: `crates/evobuddy-tui/tests/substrate_contract.rs`
- Create: `docs/contracts/evobuddy-terminal-substrate-contract.md`
- Create: `test/docs/evobuddy-terminal-substrate-contract.test.mjs`

**Example:** preserves substrate portability and no tmux-product-leak invariants.

**Interfaces:**

```rust
pub trait TerminalSubstrate {
    fn probe(&self) -> Result<SubstrateCapabilities>;
    fn create_session(&self, request: &CreateSessionRequest) -> Result<SubstrateSessionFacts>;
    fn attach_interactive(&self, session: &SubstrateSessionRef) -> Result<AttachOutcome>;
    fn inspect(&self, session: &SubstrateSessionRef) -> Result<SubstrateSessionFacts>;
    fn list_sessions(&self, scope: &SessionScope) -> Result<Vec<SubstrateSessionFacts>>;
    fn terminate(&self, session: &SubstrateSessionRef) -> Result<()>;
}

pub struct CreateSessionRequest {
    pub descriptor_id: String,
    pub session_ref: SubstrateSessionRef,
    pub launcher_plan_ref: LauncherPlanRef,
    pub program: PathBuf,
    pub args: Vec<OsString>,
    pub cwd: PathBuf,
    pub environment_policy_ref: String,
    pub display: SessionDisplayMetadata,
}

pub struct SubstrateSessionFacts {
    pub session_ref: SubstrateSessionRef,
    pub exists: bool,
    pub attached_client_count: u32,
    pub child_process_alive: bool,
    pub last_activity_at: Option<DateTime<Utc>>,
    pub exit_state: Option<SubstrateExitState>,
    pub backend_metadata: BTreeMap<String, String>,
}
```

- [ ] **Step 1: Write failing contract tests with a fake substrate**

Test attach outcomes `Detached`, `SessionEnded`, `AttachFailed`, `Interrupted`; unsupported capabilities must disable actions with a reason. Test every `SubstrateSessionFacts` field, malformed backend facts, and that activity/child liveness never derives Agent `Returned` or `Completed` semantics.

- [ ] **Step 2: Run tests and observe failure**

Run: `cargo test -p evobuddy-tui --test substrate_contract`

- [ ] **Step 3: Implement typed substrate-neutral requests/facts**

No tmux window/pane terms may appear in TaskRoom/UI public types. Backend-specific details live under an opaque metadata map or tmux module.

- [ ] **Step 4: Write and test the substrate contract doc**

Document capability negotiation for tmux, future Zellij, and future cmux; unsupported operations degrade to disabled actions.

- [ ] **Step 5: Run contract tests**

Expected: Rust and docs tests PASS.

- [ ] **Step 6: Commit**

```bash
git add crates/evobuddy-tui/src/substrate crates/evobuddy-tui/src/lib.rs crates/evobuddy-tui/tests/substrate_contract.rs docs/contracts/evobuddy-terminal-substrate-contract.md test/docs/evobuddy-terminal-substrate-contract.test.mjs
git commit -m "feat: define terminal substrate contract"
```

---

## Milestone 4: tmux Substrate and Native Session Router

### Task 10: Implement tmux probe, create, inspect, list, and terminate

**Files:**
- Create: `crates/evobuddy-tui/src/substrate/tmux.rs`
- Create: `crates/evobuddy-tui/src/bin/evobuddy-session-launcher.rs`
- Create: `crates/evobuddy-tui/src/launcher.rs`
- Modify: `crates/evobuddy-tui/src/substrate/mod.rs`
- Create: `crates/evobuddy-tui/tests/tmux_substrate.rs`
- Create: `crates/evobuddy-tui/tests/session_launcher.rs`
- Create: `scripts/context-tree/run-evobuddy-tmux-substrate-live-eval.mjs`
- Modify: `package.json`

**Example:** supports Examples 1, 2, and 4 without attach yet.

**Interfaces:**
- Consumes: Task 9 contract.
- Produces: `TmuxSubstrate { binary, socket_name }` using `tmux -L evobuddy` by default to isolate managed sessions.

- [ ] **Step 1: Write tmux integration tests with unique socket/session names**

Tests must skip with explicit `tmux-missing` only when `tmux -V` is unavailable. Cover `has-session`, detached `new-session`, parseable `list-sessions -F`, `display-message -p`, attached client count, child-process liveness, last activity, known exit state, collision handling, managed status-line configuration, malformed output rejection, and `kill-session`. Launcher tests must prove shell metacharacters in runtime args are inert, runtime argv and environment values never appear in the tmux command string, plan ids/path refs are strictly validated, and malformed/missing/digest-mismatched plans fail blocked without starting the runtime. Assertions must prove substrate facts do not derive TaskRoom `Returned` or `Completed`.

- [ ] **Step 2: Run the test and record the expected missing implementation**

Run: `cargo test -p evobuddy-tui --test tmux_substrate -- --nocapture`

- [ ] **Step 3: Implement structured tmux commands**

tmux has a shell-command boundary, so runtime `program`, `args`, cwd, context, safety data, and environment values must never be interpolated into `new-session`. Node writes an owner-only, digest-protected, one-use `evobuddy.runtime-launch-plan.v1` under `.evobuddy/native-session-launch-plans/<planId>.json`; it contains structured `program`, `args`, `cwd`, `environmentPolicyRef`, `contextPacketRef`, and `safetyMode`, but no secret values. Rust validates that `launcherPlanRef` is a safe project-local id/path. The only tmux command is a fixed trusted executable plus that sanitized reference, equivalent to `evobuddy-session-launcher --project-root <validated-root> --plan-id <safe-id>`. The launcher opens the plan without following symlinks, validates owner-only permissions/schema/digest/descriptor binding, resolves the adapter-owned environment policy at launch time, changes cwd, and replaces itself using `std::os::unix::process::CommandExt::exec` (or the platform-equivalent direct process API). On validation/exec failure it writes typed failure evidence and exits nonzero; it never falls back to a shell. Use deterministic sanitized tmux names plus descriptor short ids. Do not use `new-session -A` or `send-keys`.

For every managed EvoBuddy session, configure a tmux-compatible status line through structured tmux options. It identifies the session as EvoBuddy-managed and displays the exact detach shortcut `Ctrl+B d`; MVP does not change the tmux prefix.

- [ ] **Step 4: Implement probe and safe parsing**

Probe reports version and supported operations. List output uses a stable delimiter/format with validated fields; reject malformed output rather than guessing.

- [ ] **Step 5: Add live-eval script and package command**

Add:

```json
"evobuddy:eval-tmux-substrate:live": "node scripts/context-tree/run-evobuddy-tmux-substrate-live-eval.mjs"
```

The report must include socket name, created session ref, inspect facts, termination facts, and status `pass|blocked|fail`.

- [ ] **Step 6: Run integration and live eval**

Run:

```bash
cargo test -p evobuddy-tui --test tmux_substrate -- --nocapture
npm run evobuddy:eval-tmux-substrate:live -- --out /tmp/evobuddy-tmux-substrate
```

Expected: PASS when tmux exists; honest BLOCKED with `tmux-missing` otherwise.

- [ ] **Step 7: Commit**

```bash
git add crates/evobuddy-tui/src/substrate/tmux.rs crates/evobuddy-tui/src/substrate/mod.rs crates/evobuddy-tui/src/bin/evobuddy-session-launcher.rs crates/evobuddy-tui/src/launcher.rs crates/evobuddy-tui/tests/tmux_substrate.rs crates/evobuddy-tui/tests/session_launcher.rs scripts/context-tree/run-evobuddy-tmux-substrate-live-eval.mjs package.json
git commit -m "feat: add tmux session substrate"
```

### Task 11: Implement native-session CLI commands and runtime adapters

**Files:**
- Create: `src/core/evobuddy-runtime-session-router.mjs`
- Create: `src/core/evobuddy-runtime-launch-plan.mjs`
- Create: `src/adapters/opencode-native-session.mjs`
- Create: `src/adapters/claude-native-session.mjs`
- Create: `src/adapters/codex-native-session.mjs`
- Create: `src/adapters/gemini-native-session.mjs`
- Modify: `scripts/evobuddy/evobuddy.mjs`
- Create: `test/core/evobuddy-runtime-session-router.test.mjs`
- Create: `test/core/evobuddy-runtime-launch-plan.test.mjs`
- Create: `test/adapters/opencode-native-session.test.mjs`
- Create: `test/adapters/claude-native-session.test.mjs`
- Create: `test/adapters/codex-native-session.test.mjs`
- Create: `test/adapters/gemini-native-session.test.mjs`

**Example:** implements Example 5 and structured launch behavior in Example 1.

**Interfaces:**
- Produces adapter contract:

```js
{
  runtime,
  probe({ projectRoot }),
  buildLaunchArgv({ workspace, contextPacketRef, safetyMode }),
  buildExactResumeArgv({ workspace, providerConversationRef, safetyMode }),
  discoverHeuristicCandidates({ workspace, projectRoot }),
  classifyAttention(runtimeEvidence),
  refreshEvidence({ descriptor, projectRoot }),
}
```

The router returns a versioned typed plan rather than executable text:

```js
{
  schema: 'evobuddy.runtime-session-open-plan.v1',
  descriptorId,
  continuation: {
    kind: 'exact-resume|heuristic-resume|continue-with-context|fresh-session|unsupported',
    heuristicCandidateSource: null,
    candidateCount: 0,
    candidates: [
      { candidateId, label, providerConversationRef, sourceRef, observedAt, confidence },
    ],
    requiresStructuredChoice: false,
    disabledReason: null,
  },
  intent: {
    roomId,
    agentInstanceId,
    runtime,
    workspace,
    launchMode,
    providerConversationRef: null,
    terminalSessionRef,
    contextPacketRef: null,
    safetyMode,
    expectedEvidencePath,
    recoveryHint,
  },
  createSessionRequest: {
    descriptorId,
    sessionRef: terminalSessionRef,
    launcherPlanRef,
    program,
    args,
    cwd: workspace,
    environmentPolicyRef,
    display: { participant, runtime, workspace, safetyMode, detachShortcut: 'Ctrl+B d' },
  },
}
```

- [ ] **Step 1: Write failing capability/argv tests for all four runtimes**

Tests must assert argv arrays, no shell metacharacter execution, exact resume only with validated identity, explicit unsupported reasons, and complete `RuntimeSessionIntent`/`CreateSessionRequest` fields. For heuristic resume, assert `heuristicCandidateSource`, `candidateCount`, the complete `candidates` payload, and `requiresStructuredChoice`; more than one candidate must preserve every candidate identity and require structured choice instead of silently selecting the latest conversation. Launch-plan tests assert owner-only atomic writes, digest/descriptor binding, one-use lifecycle, no secret values, and that only `launcherPlanRef` crosses the tmux shell-command boundary.

- [ ] **Step 2: Run adapter tests and observe missing modules**

Run:

```bash
node --test test/adapters/opencode-native-session.test.mjs test/adapters/claude-native-session.test.mjs test/adapters/codex-native-session.test.mjs test/adapters/gemini-native-session.test.mjs test/core/evobuddy-runtime-session-router.test.mjs
```

- [ ] **Step 3: Implement capability probes and structured argv builders**

Use installed CLI version/capability probing. Never hard-code an exact resume command unless the installed CLI proves support. Keep Codex app-server evidence separate from CLI terminal attach. Persist structured execution fields as `evobuddy.runtime-launch-plan.v1` at the owner-only path allocated in Task 3; return its safe `launcherPlanRef` together with the in-memory typed fields so Rust can validate the binding while tmux receives only the reference.

- [ ] **Step 4: Add explicit CLI commands**

```text
evobuddy taskroom session reserve --room <id> --instance <id> --runtime <name>
evobuddy taskroom session plan-open --room <id> --instance <id> --mode <exact-resume|heuristic-resume|continue-with-context|fresh-session> --json
evobuddy taskroom session commit --descriptor <id> --substrate-ref <ref>
evobuddy taskroom session inspect --descriptor <id> --json
evobuddy taskroom session reconcile --project <path> --json
evobuddy taskroom refresh --room <id> --json
```

`plan-open` returns the exact versioned structure above. Rust remains responsible for interactive tmux attach and passes `createSessionRequest` to the substrate without reconstructing or inferring runtime argv; Node owns durable mutation, continuation-choice facts, and runtime argv/capability decisions.

- [ ] **Step 5: Run adapter/router and CLI tests**

Expected: PASS for deterministic fixtures; unavailable local runtimes report unsupported capability rather than test failure.

- [ ] **Step 6: Commit**

```bash
git add src/core/evobuddy-runtime-session-router.mjs src/core/evobuddy-runtime-launch-plan.mjs src/adapters/opencode-native-session.mjs src/adapters/claude-native-session.mjs src/adapters/codex-native-session.mjs src/adapters/gemini-native-session.mjs scripts/evobuddy/evobuddy.mjs test/core/evobuddy-runtime-session-router.test.mjs test/core/evobuddy-runtime-launch-plan.test.mjs test/adapters/opencode-native-session.test.mjs test/adapters/claude-native-session.test.mjs test/adapters/codex-native-session.test.mjs test/adapters/gemini-native-session.test.mjs
git commit -m "feat: add runtime native session adapters"
```

### Task 12: Implement the Rust native-session backend bridge and reconciliation

**Files:**
- Modify: `crates/evobuddy-tui/src/backend.rs`
- Create: `crates/evobuddy-tui/src/session.rs`
- Create: `crates/evobuddy-tui/src/router.rs`
- Modify: `crates/evobuddy-tui/src/lib.rs`
- Modify: `crates/evobuddy-tui/src/main.rs`
- Create: `crates/evobuddy-tui/tests/session_router.rs`
- Modify: `crates/evobuddy-tui/tests/action_bridge.rs`

**Example:** implements Examples 1, 2, 4, and 5.

**Interfaces:**
- Consumes: the versioned `plan-open` response from Task 11 and `TerminalSubstrate` from Task 9.
- Produces Rust mirror types `RuntimeSessionOpenPlan`, `RuntimeSessionIntent`, `ContinuationDecision`, `RuntimeSessionAction`, `RuntimeSessionResult`, and `RuntimeSessionRouter<S: TerminalSubstrate>`.

- [ ] **Step 1: Write failing router tests with fake backend and fake substrate**

Cover plan-open→reserve→create→commit, exact validation of structured `program`/`args`/`cwd`/environment-policy ref plus unchanged `launcherPlanRef`, existing attach without create, descriptor failure after create, stale/orphan reconciliation, exact/heuristic/context/fresh action selection, unchanged multi-candidate structured-choice payload, and lock conflict.

- [ ] **Step 2: Run tests and observe failure**

Run: `cargo test -p evobuddy-tui --test session_router --test action_bridge`

- [ ] **Step 3: Implement structured Node bridge commands**

All Node calls use `Command { program: "node", args }`; parse the versioned `RuntimeSessionOpenPlan` JSON response and preserve stderr/exit status in typed diagnostics. Rust mirrors and preserves `candidates`/`requiresStructuredChoice`, validates the launch-plan binding, and rejects missing fields or schema mismatches; it never performs widget-local candidate discovery or infers launch argv.

- [ ] **Step 4: Implement router transaction**

```text
lock instance
→ request typed plan-open
→ inspect descriptor/substrate
→ reserve descriptor when new
→ validate launch-plan binding and pass plan.createSessionRequest unchanged to substrate create
→ verify session facts
→ commit descriptor attachable
→ return typed next action
→ unlock
```

Never attach while holding a durable creation lock; attach uses existing committed identity.

- [ ] **Step 5: Implement startup reconciliation**

Classify `matched|orphaned|conflicted|stale`; project those classifications before enabling new launch.

- [ ] **Step 6: Run router/action tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add crates/evobuddy-tui/src/backend.rs crates/evobuddy-tui/src/session.rs crates/evobuddy-tui/src/router.rs crates/evobuddy-tui/src/lib.rs crates/evobuddy-tui/src/main.rs crates/evobuddy-tui/tests/session_router.rs crates/evobuddy-tui/tests/action_bridge.rs
git commit -m "feat: route durable native sessions"
```

---

## Milestone 5: Interactive Attach and TaskRoom Actions

### Task 13: Implement tmux interactive attach with TerminalModeGuard

**Files:**
- Modify: `crates/evobuddy-tui/src/substrate/tmux.rs`
- Modify: `crates/evobuddy-tui/src/router.rs`
- Modify: `crates/evobuddy-tui/src/ui.rs`
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/tests/tmux_substrate.rs`
- Modify: `crates/evobuddy-tui/tests/session_router.rs`
- Create: `scripts/context-tree/run-evobuddy-native-tui-tmux-live-eval.mjs`
- Modify: `package.json`

**Example:** implements Examples 1-4.

**Interfaces:**
- `attach_interactive()` runs blocking `tmux -L evobuddy attach-session -t <ref>` outside raw/alternate mode and maps exit facts to `AttachOutcome`.
- Before suspension, the Workbench renders a pre-attach notice containing participant, runtime, workspace, safety mode, target session ref, and `Detach: Ctrl+B d`; the managed tmux status line repeats `Detach: Ctrl+B d`.

- [ ] **Step 1: Add failing attach outcome and terminal-order tests**

Test the exact pre-attach notice, managed tmux status text, normal detach exit 0, killed session, missing session, interrupted attach, nested `$TMUX` behavior, and unchanged session/process count.

- [ ] **Step 2: Run focused tests and retain failure evidence**

Run: `cargo test -p evobuddy-tui --test tmux_substrate --test session_router --test terminal_mode -- --nocapture`

- [ ] **Step 3: Implement blocking attach without `-x`, `-A`, or `send-keys`**

Detect existing `$TMUX`: either switch client using a documented safe path or use the dedicated `-L evobuddy` namespace with explicit tested behavior. Do not blindly unset `TMUX`; record which path was used.

- [ ] **Step 4: Wire `WorkbenchEffect::OpenNativeRuntime` in the interactive shell**

Reducer emits the effect; `run_interactive_app()` executes router actions, constructs `TerminalModeGuard`, attaches, restores, reloads Workbench state, and preserves back stack/selection ids.

- [ ] **Step 5: Add native tmux PTY live eval**

Add package script:

```json
"evobuddy:eval-native-tui-tmux:live": "node scripts/context-tree/run-evobuddy-native-tui-tmux-live-eval.mjs"
```

Scenarios: launch, visible pre-attach notice, visible managed status-line detach hint, existing attach, `Ctrl+B d` detach-return, process survival after detach, session kill, client crash/restart, resize during attach, attach failure restoration. Use a harmless deterministic fake native TUI command for CI; real runtime scenarios are separate capability evals.

- [ ] **Step 6: Run tests and live eval**

Run:

```bash
cargo test -p evobuddy-tui --test terminal_mode --test tmux_substrate --test session_router -- --nocapture
npm run evobuddy:eval-native-tui-tmux:live -- --project . --out /tmp/evobuddy-native-tui-tmux
```

Expected: PASS with descriptor/session/process/attach artifacts.

- [ ] **Step 7: Commit**

```bash
git add crates/evobuddy-tui/src/substrate/tmux.rs crates/evobuddy-tui/src/router.rs crates/evobuddy-tui/src/ui.rs crates/evobuddy-tui/src/app.rs crates/evobuddy-tui/tests/tmux_substrate.rs crates/evobuddy-tui/tests/session_router.rs scripts/context-tree/run-evobuddy-native-tui-tmux-live-eval.mjs package.json
git commit -m "feat: attach native tui sessions through tmux"
```

### Task 14: Wire TaskRoom creation, participant, handoff, stop, and archive actions

**Files:**
- Create: `src/core/evobuddy-taskroom-store.mjs`
- Modify: `scripts/evobuddy/evobuddy.mjs`
- Modify: `crates/evobuddy-tui/src/backend.rs`
- Modify: `crates/evobuddy-tui/src/ui.rs`
- Modify: `crates/evobuddy-tui/src/app.rs`
- Create: `test/core/evobuddy-taskroom-store.test.mjs`
- Modify: `crates/evobuddy-tui/tests/input_flow.rs`
- Create: `crates/evobuddy-tui/tests/workbench_effects.rs`

**Example:** implements Example 7 and explicit TaskRoom ownership.

**Interfaces:**
- Node commands:
  - `evobuddy taskroom create`
  - `evobuddy taskroom participant add`
  - `evobuddy taskroom handoff create`
  - `evobuddy taskroom session stop`
  - `evobuddy taskroom archive`
- Rust executes only typed effects with explicit ids/fields.

- [ ] **Step 1: Write failing durable-store and effect tests**

Verify atomic room writes, append-only message/handoff records, digest changes, explicit confirmations for destructive effects, and no natural-language auto-routing.

- [ ] **Step 2: Run focused tests**

Run:

```bash
node --test test/core/evobuddy-taskroom-store.test.mjs
cargo test -p evobuddy-tui --test input_flow --test workbench_effects
```

- [ ] **Step 3: Implement `.evobuddy/taskrooms/<roomId>/` durable store**

Use existing TaskRoom schemas and append-only records:

```text
room.json
instances.jsonl
messages.jsonl
forks.jsonl
handoffs.jsonl
wakes.jsonl
artifacts/
```

- [ ] **Step 4: Wire explicit effects and confirmations**

The TUI must show target/effect before create, stop, terminate, and archive. Detach remains separate from stop.

- [ ] **Step 5: Run core/Rust tests and export projection**

Expected: newly created records appear in refreshed Workbench state; no implicit participant creation.

- [ ] **Step 6: Commit**

```bash
git add src/core/evobuddy-taskroom-store.mjs scripts/evobuddy/evobuddy.mjs crates/evobuddy-tui/src/backend.rs crates/evobuddy-tui/src/ui.rs crates/evobuddy-tui/src/app.rs test/core/evobuddy-taskroom-store.test.mjs crates/evobuddy-tui/tests/input_flow.rs crates/evobuddy-tui/tests/workbench_effects.rs
git commit -m "feat: execute explicit taskroom actions"
```

---

## Milestone 6: Runtime Evidence, Attention, and Completion Integrity

### Task 15: Implement source-qualified runtime attention and evidence refresh

**Files:**
- Create: `src/core/evobuddy-native-session-evidence.mjs`
- Modify: `src/core/evobuddy-evidence-refresh-record.mjs`
- Modify: `src/core/evobuddy-workbench-state-contract.mjs`
- Modify: `src/adapters/opencode-native-session.mjs`
- Modify: `src/adapters/claude-native-session.mjs`
- Modify: `src/adapters/codex-native-session.mjs`
- Modify: `src/adapters/gemini-native-session.mjs`
- Modify: `scripts/evobuddy/evobuddy.mjs`
- Create: `test/core/evobuddy-native-session-evidence.test.mjs`
- Modify: `test/core/evobuddy-workbench-state-contract.test.mjs`

**Example:** implements Examples 3 and 6.

**Interfaces:**
- Produces evidence observations with `state`, `sourceKind`, `sourceRef`, `observedAt`, `confidence`, `staleAfter`.

- [ ] **Step 1: Write failing precedence/staleness/negative-control tests**

```js
test('idle terminal activity cannot produce Returned', () => {
  const result = reduceNativeSessionEvidence({
    terminal: { childAlive: true, lastActivityAt: now },
    runtimeEvidence: [],
    handoffs: [],
  });
  assert.notEqual(result.workState, 'returned');
  assert.notEqual(result.roomState, 'completed');
});
```

- [ ] **Step 2: Run tests and observe failure**

Run: `node --test test/core/evobuddy-native-session-evidence.test.mjs`

- [ ] **Step 3: Implement evidence precedence**

Order: stable runtime hook/protocol → runtime exporter/session artifact → terminal lifecycle/activity → bounded pattern hint → unknown. Pattern hints are provisional and cannot prove permission, return, or completion.

- [ ] **Step 4: Implement `taskroom refresh`**

Refresh each linked descriptor through its runtime adapter, write `evobuddy-evidence-refresh.v1`, update evidence refs, and return typed diagnostics. Do not capture pane output as proof.

- [ ] **Step 5: Run evidence/projection tests**

Expected: PASS including stale downgrade and source-qualified `Needs input in <runtime>`.

- [ ] **Step 6: Commit**

```bash
git add src/core/evobuddy-native-session-evidence.mjs src/core/evobuddy-evidence-refresh-record.mjs src/core/evobuddy-workbench-state-contract.mjs src/adapters/opencode-native-session.mjs src/adapters/claude-native-session.mjs src/adapters/codex-native-session.mjs src/adapters/gemini-native-session.mjs scripts/evobuddy/evobuddy.mjs test/core/evobuddy-native-session-evidence.test.mjs test/core/evobuddy-workbench-state-contract.test.mjs
git commit -m "feat: refresh native session evidence"
```

### Task 16: Render evidence-backed actions, trace, and recovery states

**Files:**
- Modify: `crates/evobuddy-tui/src/model.rs`
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/src/widgets/dashboard.rs`
- Modify: `crates/evobuddy-tui/src/widgets/workspace.rs`
- Modify: `crates/evobuddy-tui/src/widgets/trace.rs`
- Modify: `crates/evobuddy-tui/src/widgets/status_bar.rs`
- Modify: `crates/evobuddy-tui/tests/dashboard_snapshots.rs`
- Modify: `crates/evobuddy-tui/tests/workspace_snapshots.rs`

**Example:** observes Examples 3-6.

**Interfaces:**
- Consumes source-qualified evidence and reconciliation classifications.
- Produces visible labels/actions: `Open session`, `Resume conversation` (exact only), `Heuristic resume` / `Resume latest candidate` (explicitly heuristic), `Continue with TaskRoom context`, `Start new session`, `View evidence`, `Retry`, with disabled reasons.

- [ ] **Step 1: Write failing snapshots for exact labels and stale/unknown states**

Ensure proof taxonomy remains in Trace, not first-level state. Add reducer/UI tests proving exact resume is unavailable without validated provider identity, one heuristic candidate remains explicitly labeled heuristic, multiple heuristic candidates open an EvoBuddy-owned structured choice listing candidate identities directly from `RuntimeSessionOpenPlan.continuation.candidates`, widgets perform no candidate discovery, `Continue with TaskRoom context` stays separate, and `Start new session` maps only to `fresh-session`.

- [ ] **Step 2: Run snapshots and observe failure**

Run: `cargo test -p evobuddy-tui --test dashboard_snapshots --test workspace_snapshots`

- [ ] **Step 3: Implement pure action derivation from capability + session + evidence**

Do not branch directly on runtime names in widgets.

- [ ] **Step 4: Render recovery diagnostics**

Cover missing tmux, stale descriptor, orphan, conflict, dead child, attach failure, restore failure, unsupported exact resume, and evidence stale/unknown.

- [ ] **Step 5: Run snapshots and input tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add crates/evobuddy-tui/src/model.rs crates/evobuddy-tui/src/app.rs crates/evobuddy-tui/src/widgets/dashboard.rs crates/evobuddy-tui/src/widgets/workspace.rs crates/evobuddy-tui/src/widgets/trace.rs crates/evobuddy-tui/src/widgets/status_bar.rs crates/evobuddy-tui/tests/dashboard_snapshots.rs crates/evobuddy-tui/tests/workspace_snapshots.rs
git commit -m "feat: show evidence backed runtime actions"
```

---

## Milestone 7: Security and Destructive Lifecycle Semantics

### Task 17: Harden session names, workspaces, descriptors, and process execution

**Files:**
- Modify: `src/core/evobuddy-native-session-descriptor.mjs`
- Modify: `src/core/evobuddy-native-session-store.mjs`
- Modify: `src/core/evobuddy-runtime-session-router.mjs`
- Modify: `src/core/evobuddy-runtime-launch-plan.mjs`
- Modify: `crates/evobuddy-tui/src/substrate/tmux.rs`
- Modify: `crates/evobuddy-tui/src/launcher.rs`
- Modify: `crates/evobuddy-tui/src/backend.rs`
- Create: `test/security/evobuddy-native-session-command-safety.test.mjs`
- Create: `crates/evobuddy-tui/tests/session_security.rs`

**Example:** preserves all security and ownership invariants.

**Interfaces:**
- Produces sanitized display/session names, canonical workspace validation, restrictive file permissions, and structured child argv.

- [ ] **Step 1: Add malicious-input regression tests**

Test room titles, actor names, workspace paths, session refs, provider refs, launcher plan ids/paths, runtime argv, and environment-like input containing shell metacharacters, newlines, traversal, symlinks, permission widening, digest mismatch, and control bytes. Assert tmux sees only the fixed launcher command and sanitized plan reference; runtime args remain inert and are passed only through direct `exec`.

- [ ] **Step 2: Run tests and confirm current unsafe paths fail**

Run:

```bash
node --test test/security/evobuddy-native-session-command-safety.test.mjs
cargo test -p evobuddy-tui --test session_security
```

- [ ] **Step 3: Implement validation and ownership**

Canonicalize workspace; require it to exist and match project/worktree policy. Derive tmux names from safe slugs plus ids. Store descriptor and launch-plan files owner-only. Reject secrets/command strings/control bytes, unsafe launcher refs, symlinks, digest/descriptor mismatches, replayed one-use plans, and environment values outside the adapter-owned policy resolver.

- [ ] **Step 4: Separate detach, stop process, terminate session, and archive**

Each destructive action must show effects on process, provider conversation, worktree, and evidence, and require confirmation.

- [ ] **Step 5: Run security and lifecycle regressions**

Expected: PASS and no shell process is invoked.

- [ ] **Step 6: Commit**

```bash
git add src/core/evobuddy-native-session-descriptor.mjs src/core/evobuddy-native-session-store.mjs src/core/evobuddy-runtime-session-router.mjs src/core/evobuddy-runtime-launch-plan.mjs crates/evobuddy-tui/src/substrate/tmux.rs crates/evobuddy-tui/src/launcher.rs crates/evobuddy-tui/src/backend.rs test/security/evobuddy-native-session-command-safety.test.mjs crates/evobuddy-tui/tests/session_security.rs
git commit -m "fix: harden native session execution"
```

---

## Milestone 8: Full PTY, Runtime, and Product Acceptance

### Task 18: Replace legacy PTY expectations with TaskRoom-native orchestration acceptance

**Files:**
- Modify: `src/tui/evobuddy-workbench-pty-session.mjs`
- Modify: `scripts/context-tree/run-evobuddy-rust-tui-pty-live-eval.mjs`
- Modify: `scripts/context-tree/run-evobuddy-workbench-interactive-pty-live-eval.mjs`
- Modify: `test/cli/run-evobuddy-rust-tui-pty-live-eval-cli.test.mjs`
- Modify: `test/cli/run-evobuddy-workbench-interactive-pty-live-eval-cli.test.mjs`
- Modify: `scripts/context-tree/run-evobuddy-native-tui-tmux-live-eval.mjs`
- Create: `test/cli/run-evobuddy-native-tui-tmux-live-eval-cli.test.mjs`

**Example:** observes all seven examples.

**Interfaces:**
- Produces deterministic reports with `status`, scenario evidence, failure signals, environment blockers, and artifact paths.

- [ ] **Step 1: Write failing CLI eval assertions requiring PASS**

Remove tests that accept known `fail` as success. Missing tmux may produce `blocked` only with an explicit reason; CI environments with tmux installed must require pass.

- [ ] **Step 2: Run eval CLI tests and retain failures**

Run: `node --test test/cli/run-evobuddy-rust-tui-pty-live-eval-cli.test.mjs test/cli/run-evobuddy-native-tui-tmux-live-eval-cli.test.mjs`

- [ ] **Step 3: Update scenarios to approved UI and architecture**

Assert TaskRoom-first home, contextual action bars, scoped forms, no persistent prompt, no hidden orchestrator, native attach, pre-attach detach notice, managed tmux detach hint, detach-return, process survival, no duplicate, reconciliation, exact/heuristic/context/fresh labels and candidate choice, permission routing, idle-not-returned, and terminal restoration.

- [ ] **Step 4: Keep legacy read-only eval as compatibility proof**

The legacy interactive workbench eval must either pass its documented compatibility contract or be explicitly renamed/deprecated with a replacement contract. Do not count it as native attach proof.

- [ ] **Step 5: Run all PTY evals**

Run:

```bash
npm run evobuddy:eval-workbench-interactive-pty:live -- --project . --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-readonly-pty
npm run evobuddy:eval-rust-tui-pty:live -- --project . --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-rust-pty
npm run evobuddy:eval-native-tui-tmux:live -- --project . --out /tmp/evobuddy-native-tmux
```

Expected: compatibility and Rust UI PASS; native tmux PASS where tmux is installed.

- [ ] **Step 6: Commit**

```bash
git add src/tui/evobuddy-workbench-pty-session.mjs scripts/context-tree/run-evobuddy-rust-tui-pty-live-eval.mjs scripts/context-tree/run-evobuddy-workbench-interactive-pty-live-eval.mjs scripts/context-tree/run-evobuddy-native-tui-tmux-live-eval.mjs test/cli/run-evobuddy-rust-tui-pty-live-eval-cli.test.mjs test/cli/run-evobuddy-workbench-interactive-pty-live-eval-cli.test.mjs test/cli/run-evobuddy-native-tui-tmux-live-eval-cli.test.mjs
git commit -m "test: prove taskroom native tui orchestration"
```

### Task 19: Add real runtime capability acceptance without making it a universal client

**Files:**
- Create: `scripts/context-tree/run-evobuddy-native-runtime-capability-eval.mjs`
- Create: `test/eval/evobuddy-native-runtime-capability-eval.test.mjs`
- Modify: `package.json`
- Modify: `docs/release-mvp.md`

**Example:** observes Examples 1, 3, and 5 across available runtimes.

**Interfaces:**
- Evaluates OpenCode, Claude Code, Codex CLI, and Gemini CLI independently; unavailable runtimes are explicit blocked entries, not synthetic passes.

- [ ] **Step 1: Write failing hermetic report tests**

The report schema must separate substrate success, runtime installed/authenticated, exact resume capability, needs-input source, evidence source, and live scenario status.

- [ ] **Step 2: Run the hermetic test and observe the missing runner failure**

Run: `node --test test/eval/evobuddy-native-runtime-capability-eval.test.mjs`

Expected: FAIL because the report producer/script does not exist.

- [ ] **Step 3: Implement capability eval runner**

Use safe no-op/test workspaces and runtime-supported dry/safe modes. Do not automate permission prompts. Do not require every runtime to support exact resume.

- [ ] **Step 4: Add package script**

```json
"evobuddy:eval-native-runtime-capabilities:live": "node scripts/context-tree/run-evobuddy-native-runtime-capability-eval.mjs"
```

- [ ] **Step 5: Run hermetic tests and available live runtimes**

Run:

```bash
node --test test/eval/evobuddy-native-runtime-capability-eval.test.mjs
npm run evobuddy:eval-native-runtime-capabilities:live -- --project . --out /tmp/evobuddy-runtime-capabilities
```

Expected: report honestly passes available scenarios and blocks unavailable ones with exact reasons.

- [ ] **Step 6: Commit**

```bash
git add scripts/context-tree/run-evobuddy-native-runtime-capability-eval.mjs test/eval/evobuddy-native-runtime-capability-eval.test.mjs package.json docs/release-mvp.md
git commit -m "test: evaluate native runtime capabilities"
```

---

## Milestone 9: Additional Substrate Decision Gates

### Task 20: Validate the substrate abstraction against Zellij and cmux without preempting tmux proof

**Files:**
- Create parent directory: `docs/adr/`
- Create: `docs/adr/evobuddy-zellij-substrate-evaluation.md`
- Create: `docs/adr/evobuddy-cmux-workspace-integration-evaluation.md`
- Create: `crates/evobuddy-tui/tests/substrate_capability_matrix.rs`
- Modify: `docs/contracts/evobuddy-terminal-substrate-contract.md`

**Example:** preserves the future-substrate invariant; technical-only after tmux PASS.

**Interfaces:**
- Consumes: proven substrate contract and tmux implementation.
- Produces explicit capability matrices and a go/no-go decision for later backend-specific plans.

- [ ] **Step 1: Add failing fake capability tests**

Model at least: interactive attach, detached persistence, exact inspect, client switching, remote availability, platform support, and recovery. Prove unsupported capabilities disable actions cleanly.

- [ ] **Step 2: Run capability tests**

Run: `cargo test -p evobuddy-tui --test substrate_capability_matrix`

- [ ] **Step 3: Write source-backed Zellij evaluation ADR**

Create `docs/adr/` if it does not exist, then write the ADR at the exact path listed above.

Decide whether Zellij can implement the same contract without changing TaskRoom semantics. If GO, require a separate backend implementation plan after tmux release proof. If NO-GO, document the missing capability and retain disabled support.

- [ ] **Step 4: Write source-backed cmux evaluation ADR**

Treat cmux as optional macOS workspace focus, not a cross-platform dependency or terminal emulator mandate. Define its capability and platform gates.

- [ ] **Step 5: Run docs and capability tests**

Expected: PASS; no Zellij/cmux backend is claimed implemented merely because the interface exists.

- [ ] **Step 6: Commit**

```bash
git add docs/adr/evobuddy-zellij-substrate-evaluation.md docs/adr/evobuddy-cmux-workspace-integration-evaluation.md crates/evobuddy-tui/tests/substrate_capability_matrix.rs docs/contracts/evobuddy-terminal-substrate-contract.md
git commit -m "docs: evaluate additional terminal substrates"
```

### Task 21: Measure launch/attach switching cost and close the supervised-terminal decision

**Files:**
- Create parent directory if absent: `docs/adr/`
- Create: `scripts/context-tree/run-evobuddy-launch-attach-usability-eval.mjs`
- Create: `test/eval/evobuddy-launch-attach-usability-eval.test.mjs`
- Create: `docs/adr/evobuddy-supervised-terminal-mode-decision.md`
- Modify: `package.json`

**Example:** preserves the design's reject criterion for premature terminal emulation.

**Interfaces:**
- Produces measured attach latency, detach-return latency, error rate, terminal corruption incidents, and user-step count.

- [ ] **Step 1: Define an objective decision schema and failing test**

```js
assert.deepEqual(report.metrics.sort(), [
  'attachLatencyMs', 'detachReturnLatencyMs', 'failedAttachRate',
  'terminalRestoreFailureRate', 'interactionStepCount',
].sort());
```

- [ ] **Step 2: Run the focused test and observe the missing runner failure**

Run: `node --test test/eval/evobuddy-launch-attach-usability-eval.test.mjs`

Expected: FAIL because the report producer/script does not exist.

- [ ] **Step 3: Implement the measurement runner over the tmux PTY scenarios**

Do not record conversation content or secrets.

Add:

```json
"evobuddy:eval-launch-attach-usability:live": "node scripts/context-tree/run-evobuddy-launch-attach-usability-eval.mjs"
```

- [ ] **Step 4: Write the decision ADR**

Create `docs/adr/` if absent. Default decision is NO-GO for embedded/supervised terminal mode unless measured launch/attach cost violates an explicit threshold and tmux fixes cannot resolve it. A GO decision requires a new design/spec; this plan must not implement a terminal emulator.

- [ ] **Step 5: Run tests and produce a local report**

Run:

```bash
node --test test/eval/evobuddy-launch-attach-usability-eval.test.mjs
npm run evobuddy:eval-launch-attach-usability:live -- --project . --out /tmp/evobuddy-launch-attach-usability
```

- [ ] **Step 6: Commit**

```bash
git add scripts/context-tree/run-evobuddy-launch-attach-usability-eval.mjs test/eval/evobuddy-launch-attach-usability-eval.test.mjs docs/adr/evobuddy-supervised-terminal-mode-decision.md package.json
git commit -m "docs: close supervised terminal decision gate"
```

---

## Milestone 10: Documentation, Release Gates, and Final Correction Loop

### Task 22: Update user, operator, and architecture documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/evobuddy-workbench-team-taskroom-mvp.md`
- Modify: `docs/workbuddy-style-tui-workbench-v0.md`
- Modify: `docs/contracts/evobuddy-workbench-tui-contract.md`
- Modify: `docs/contracts/evobuddy-taskroom-proof-contract.md`
- Create: `docs/evobuddy-native-tui-runbook.md`
- Create: `docs/evobuddy-native-session-recovery-runbook.md`
- Modify: `docs/release-mvp.md`
- Modify: `test/docs/evobuddy-workbench-tui-contract.test.mjs`
- Create: `test/docs/evobuddy-native-tui-runbook.test.mjs`

**Example:** documents all examples and preserves ownership boundaries.

**Interfaces:**
- Produces exact commands, supported/unsupported capabilities, recovery steps, safety semantics, and proof boundaries.

- [ ] **Step 1: Write failing docs contract tests**

Require the docs to state: TaskRoom-first, no persistent input, no hidden orchestrator, native permissions remain native, tmux prerequisite, detach shortcut, exact/context labels, read-only compatibility, evidence limitations, and recovery commands.

- [ ] **Step 2: Run docs tests and observe failure**

Run: `node --test test/docs/evobuddy-workbench-tui-contract.test.mjs test/docs/evobuddy-native-tui-runbook.test.mjs`

- [ ] **Step 3: Update docs and runbooks**

Document installation/probe, create/open/attach/detach/stop/archive, descriptor paths, stale/orphan recovery, runtime capability matrix, tmux namespace, and evidence refresh.

- [ ] **Step 4: Run docs tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/evobuddy-workbench-team-taskroom-mvp.md docs/workbuddy-style-tui-workbench-v0.md docs/contracts/evobuddy-workbench-tui-contract.md docs/contracts/evobuddy-taskroom-proof-contract.md docs/evobuddy-native-tui-runbook.md docs/evobuddy-native-session-recovery-runbook.md docs/release-mvp.md test/docs/evobuddy-workbench-tui-contract.test.mjs test/docs/evobuddy-native-tui-runbook.test.mjs
git commit -m "docs: document taskroom native tui orchestration"
```

### Task 23: Add the final release-readiness aggregate and correction loop

**Files:**
- Modify: `scripts/context-tree/run-product-release-readiness-eval.mjs`
- Create: `test/eval/product-release-readiness-eval.test.mjs`
- Modify: `package.json`
- Modify: `docs/release-mvp.md`

**Example:** verifies all examples and invariants.

**Interfaces:**
- Consumes all focused reports.
- Produces one release report that distinguishes `pass`, `blocked`, and `fail` per substrate/runtime and never upgrades blocked runtime coverage into product pass.

- [ ] **Step 1: Write failing aggregate-gate tests**

Require these gates:

```text
baselineTests
taskRoomContracts
nativeSessionStore
taskRoomFirstUi
scopedInputNoOrchestrator
terminalModeGuard
tmuxSubstrate
nativeAttachPty
runtimeCapabilities
forkHandoffClosure
evidenceIntegrity
security
documentation
```

- [ ] **Step 2: Run the aggregate test and observe missing gates**

Run: `node --test test/eval/product-release-readiness-eval.test.mjs`

- [ ] **Step 3: Integrate report inputs without report-only pass logic**

Each gate must point to concrete test/eval artifacts and digests. A missing tmux environment may block the tmux gate but cannot pass release readiness when native attach is required.

- [ ] **Step 4: Run full static verification**

Run:

```bash
npm test
cargo test --workspace
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo build --workspace --release
```

Expected: all exit 0.

- [ ] **Step 5: Run full live verification**

Run:

```bash
npm run evobuddy:rust-tui-smoke
npm run evobuddy:eval-workbench-interactive-pty:live -- --project . --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-readonly-pty-final
npm run evobuddy:eval-rust-tui-pty:live -- --project . --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-rust-pty-final
npm run evobuddy:eval-tmux-substrate:live -- --out /tmp/evobuddy-tmux-final
npm run evobuddy:eval-native-tui-tmux:live -- --project . --out /tmp/evobuddy-native-tmux-final
npm run evobuddy:eval-native-runtime-capabilities:live -- --project . --out /tmp/evobuddy-runtime-final
npm run evobuddy:run-product-release-readiness-eval -- --project . --out /tmp/evobuddy-release-final --require-runtimes opencode,claude,codex
```

Expected: required product gates PASS; unavailable optional runtime capabilities remain explicit blocked rows. The release command must exit nonzero for required blocked/fail gates.

- [ ] **Step 6: If verification fails, run the correction loop**

For each failure:

1. Retain the failing command output, report path, descriptor/session refs, process tree, and exact terminal evidence.
2. Classify the root cause as implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal root-cause fix. Do not rewrite reports, weaken proof gates, relabel heuristic resume, or count terminal output as completion.
5. Run the focused test/check. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS or the same honest external blocker with retained evidence.
7. Compare the new artifact/process/session evidence to the original. If underlying behavior did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is required, or the same external blocker repeats.

- [ ] **Step 7: Request independent post-implementation review**

Run the repository's review-work/requesting-code-review workflow against the complete diff. Require architecture, security, evidence/proof, terminal QA, and product-boundary review.

- [ ] **Step 8: Commit the aggregate gate**

```bash
git add scripts/context-tree/run-product-release-readiness-eval.mjs test/eval/product-release-readiness-eval.test.mjs package.json docs/release-mvp.md
git commit -m "test: gate native tui orchestration release"
```

---

## Completion Definition

This plan is complete only when all of the following are true:

1. The existing read-only Workbench remains usable and honestly labeled.
2. The Rust TUI opens on a TaskRoom/attention work inbox with contextual action bars and no persistent open-ended input.
3. No hidden orchestrator exists; an optional coordinator is represented and used as a normal TeamAgent.
4. TaskRoom, AgentInstance, ForkRecord, HandoffRecord, native-session descriptor, evidence-refresh, and lock records are durable, versioned, validated, and linked.
5. TerminalModeGuard restores terminal state after detach, failure, interruption, and panic/error cleanup.
6. tmux create, inspect, list, attach, detach-return, terminate, collision, and reconciliation behavior is proven by real integration/PTY tests.
7. OpenCode, Claude Code, Codex CLI, and Gemini CLI expose capability-derived actions; unsupported capabilities degrade honestly.
8. Exact resume, heuristic resume, context continuation, and fresh session are visibly distinct and tested.
9. Runtime-owned questions/permissions stay in native TUIs; EvoBuddy never uses terminal input injection for orchestration.
10. Evidence refresh uses runtime/provider evidence and durable records, not screen scraping or idleness.
11. Native terminal sessions support but do not replace fork/handoff/result-return proof.
12. Security tests block shell injection, unsafe workspaces/names, secret persistence, stale descriptor trust, and destructive-action ambiguity.
13. Static tests, clippy, formatting, release build, PTY evals, tmux evals, and release-readiness gates pass for required environments.
14. Zellij/cmux and supervised-terminal decisions are closed through explicit ADR gates without falsely claiming unimplemented backends.
