# EvoBuddy TUI ↔ Backend Raft Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close TUI daily write paths so create → multi pi seats → attach/choose → handoff wake → re-attach is Raft-aligned, and earn **FINAL PASS** per `docs/superpowers/specs/2026-07-22-evobuddy-tui-backend-raft-alignment-audit.md` (G0–G4, F1–F8).

**Architecture:** Reuse existing Pi-first factory (`createPiFirstTaskRoom`) and `handoffWithWake`. Wire default CLI create + TUI create to that factory; fix seat-choice submit to `OpenNativeRuntime`; project durable `.evobuddy/taskrooms` into workbench export so Home sees seats; land L1 joint eval J1–J5 with independent report rows. No Raft Web clone; no dual orchestrator.

**Tech Stack:** Node ESM (CLI/store/export/eval), Rust `evobuddy-tui`, node:test + cargo test, report JSON gates.

## Global Constraints

- Default multi-seat runtime is **`pi`**; heavy runtimes only when user explicitly chooses.
- Wake is **content-free** (reason enum only; no body on wake record).
- EvoBuddy owns team state; no `pi-team-agents` dual orchestrator path.
- **Skip ≠ pass** on live-only asserts; L1 joint (store/command) is enough for G4 CI.
- One eval ID → one evidence chain; no batch-stamping J1–J5 from undifferentiated cargo green.
- Do not claim FINAL PASS until G0–G4 and F1–F8 hold with report artifacts.
- Keep G0/G1 regressions green while landing G2–G4.

## Concrete Examples

### Example 1: Create yields team seats (J1 / G2.1–G2.3)

- **Example:** TUI create or same CLI `taskroom create` with objective "ship wire-through"
- **Expected result:** room on disk; ≥2 participants roles builder+reviewer; runtime `pi`; title derived (truncate + `...` if long)
- **Verification:** joint eval **J1** + `node --test test/core/evobuddy-taskroom-cli-create-pi-first.test.mjs` (or equiv)
- **Failure signal:** `participants: []`; draft runtime discarded; title ignores objective
- **If it fails:** CLI factory + TUI `ui.rs` create path; re-run J1

### Example 2: Enter attach + choose seat (J2–J3 / G2.4–G2.6)

- **Example:** Home Enter on multi-seat room; `m` → select reviewer → confirm
- **Expected result:** Enter → `OpenNativeRuntime` with builder (or primary) id; choose seat → `OpenNativeRuntime` with **selected** participant id; **no** ActionProgress fake Working
- **Verification:** cargo tests + **J2/J3** L1 (command/argv intent + participant id assert)
- **Failure signal:** AnswerQuestion + ActionProgress on seat choose; always builder on choose
- **If it fails:** `submit_structured_answer` / `present_seat_choice`; re-run J2/J3

### Example 3: Handoff wakes reviewer (J4–J5 / G3)

- **Example:** product handoff body "please review" builder→reviewer
- **Expected result:** durable body; wake reason only; Home/export shows Needs review / Needs you; stop seat keeps room; re-enter works
- **Verification:** **J4**, **J5**; backend wake tests remain green
- **Failure signal:** skeleton handoff without body/wake; status stuck Ready; room deleted on stop
- **If it fails:** CLI handoff → `handoffWithWake`; export status projection; re-run J4/J5

### Invariants

- Ready ≠ Working without session evidence
- Default create never spawns OpenCode
- Stop seat ≠ delete room
- G0 `evobuddy:eval-pi-first-raft-room` stays gate pass (S3 honest skip OK)

---

## File map (create/modify)

| Path | Responsibility |
|---|---|
| `scripts/evobuddy/evobuddy.mjs` | `taskroomCreate` → `createPiFirstTaskRoom`; handoff → `handoffWithWake` + `--body` |
| `src/core/evobuddy-taskroom-pi-defaults.mjs` | Factory + handoffWithWake (extend status/projection hook if needed) |
| `src/core/evobuddy-workbench-state-contract.mjs` | Project durable taskrooms into `taskRooms` with role/runtime |
| `src/core/evobuddy-taskroom-store.mjs` | Optional `updateTaskRoomStatus` / read helpers if export needs them |
| `crates/evobuddy-tui/src/backend.rs` | Create argv + handoff argv (`--runtime`, `--body`) |
| `crates/evobuddy-tui/src/ui.rs` | Honor draft on create; handoff body |
| `crates/evobuddy-tui/src/app_forms.rs` | Seat submit → OpenNativeRuntime; no ActionProgress |
| `crates/evobuddy-tui/src/app_types.rs` | StructuredQuestion intent / room_id for seat attach |
| `crates/evobuddy-tui/src/app_effects.rs` | present_seat_choice tags intent |
| `crates/evobuddy-tui/tests/*` | J2/J3 unit regressions |
| `test/core/evobuddy-taskroom-cli-create-pi-first.test.mjs` | CLI create multi-seat |
| `test/core/evobuddy-workbench-durable-rooms.test.mjs` | Export projects durable seats |
| `scripts/context-tree/run-evobuddy-tui-backend-joint-eval.mjs` | J1–J5 L1 report |
| `package.json` | `evobuddy:eval-tui-backend-joint` |

---

### Task 1: Default CLI create → createPiFirstTaskRoom (G2.1–G2.2)

**Files:**
- Modify: `scripts/evobuddy/evobuddy.mjs` (`taskroomCreate`, imports, help)
- Test: Create `test/core/evobuddy-taskroom-cli-create-pi-first.test.mjs`

**Example:** implements Example 1 | preserves Invariant default-pi

**Interfaces:**
- Consumes: `createPiFirstTaskRoom(projectRoot, draft)` from `evobuddy-taskroom-pi-defaults.mjs`
- Produces: CLI `taskroom create --project --room --title --objective [--runtime pi] [--created-at] [--json]` yields ≥2 seats

- [ ] **Step 1: Write the failing test**

```js
// test/core/evobuddy-taskroom-cli-create-pi-first.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readTaskRoom } from '../../src/core/evobuddy-taskroom-store.mjs';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('CLI taskroom create yields builder+reviewer with pi runtime', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-cli-create-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const roomId = 'taskroom:cli-create-1';
  const r = spawnSync(process.execPath, [
    join(REPO, 'scripts/evobuddy/evobuddy.mjs'),
    'taskroom', 'create',
    '--project', projectRoot,
    '--room', roomId,
    '--title', 'wire through',
    '--objective', 'ship G2 create path',
    '--json',
  ], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const room = await readTaskRoom(projectRoot, roomId);
  assert.ok(room.participants.length >= 2);
  const roles = room.participants.map((p) => p.role).sort();
  assert.deepEqual(roles, ['builder', 'reviewer']);
  assert.ok(room.participants.every((p) => p.runtime === 'pi'));
});
```

- [ ] **Step 2: Run test — expect FAIL** (empty participants)

Run: `node --test test/core/evobuddy-taskroom-cli-create-pi-first.test.mjs`

- [ ] **Step 3: Implement CLI create via factory**

In `scripts/evobuddy/evobuddy.mjs`:
- Import `createPiFirstTaskRoom` from `../../src/core/evobuddy-taskroom-pi-defaults.mjs`
- Replace `taskroomCreate` body:

```js
async function taskroomCreate(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { stdout: taskroomSessionHelp() };
  const args = parseFlags(argv);
  if (!args.project) throw new Error('missing value for --project');
  if (!args.room) throw new Error('missing value for --room');
  if (!args.objective && !args.title) throw new Error('missing value for --objective or --title');
  const objective = args.objective ?? args.title;
  const runtime = String(args.runtime ?? 'pi').toLowerCase();
  const room = await createPiFirstTaskRoom(resolve(args.project), {
    roomId: args.room,
    title: args.title,
    objective,
    runtime,
    createdAt: args.createdAt ?? isoNow(),
  });
  return { stdout: args.json ? `${JSON.stringify(room)}\n` : `${room.roomId}\n` };
}
```

Update help line for create to document optional `--runtime` (default pi).

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit** `fix: default taskroom create uses createPiFirstTaskRoom`

---

### Task 2: Project durable TaskRooms into workbench export (G2 attach visibility)

**Files:**
- Modify: `src/core/evobuddy-workbench-state-contract.mjs`
- Test: Create `test/core/evobuddy-workbench-durable-rooms.test.mjs`

**Example:** implements Example 1 + enables Example 2 | technical-only for export plumbing

**Interfaces:**
- Consumes: `listTaskRooms`, `listWakes` (or read wakes jsonl), room participants
- Produces: `exportEvobuddyWorkbenchState` `taskRooms[]` includes durable rooms with `participants[].id|role|runtime`, `availableActions` including `open-native-runtime` when seats exist; status Queued/Ready-ish until handoff then NeedsReview when wake present

- [ ] **Step 1: Failing test** — createPiFirstTaskRoom then export → taskRooms has room with ≥2 seats and roles

```js
// test/core/evobuddy-workbench-durable-rooms.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createPiFirstTaskRoom, handoffWithWake } from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';
import { exportEvobuddyWorkbenchState } from '../../src/core/evobuddy-workbench-state-contract.mjs';

test('export includes durable pi-first room seats', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-export-durable-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, { objective: 'export seats' });
  const state = await exportEvobuddyWorkbenchState({ projectRoot });
  const projected = state.taskRooms.find((r) => r.id === room.roomId);
  assert.ok(projected, 'durable room missing from export');
  assert.ok(projected.participants.length >= 2);
  assert.ok(projected.participants.some((p) => p.role === 'builder'));
  assert.ok(projected.participants.some((p) => p.role === 'reviewer'));
  assert.equal(projected.runtime, 'pi');
  assert.ok(projected.availableActions?.some((a) => a.id === 'open-native-runtime' && a.enabled));
});

test('export marks NeedsReview after handoff wake', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-export-nr-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, { objective: 'needs review' });
  const builder = room.participants.find((p) => p.role === 'builder');
  const reviewer = room.participants.find((p) => p.role === 'reviewer');
  await handoffWithWake(projectRoot, {
    roomId: room.roomId,
    from: builder.participantId,
    to: reviewer.participantId,
    body: 'please review',
  });
  const state = await exportEvobuddyWorkbenchState({ projectRoot });
  const projected = state.taskRooms.find((r) => r.id === room.roomId);
  assert.equal(projected.status, 'NeedsReview');
});
```

- [ ] **Step 2: Run — expect FAIL** (`readDirectoryJsonFiles` returns `[]` and never maps durable rooms)

- [ ] **Step 3: Implement durable projection**

In `exportEvobuddyWorkbenchState` / `readArtifactsForWorkbenchState` path when no external reports:
1. `import { listTaskRooms } from './evobuddy-taskroom-store.mjs'`
2. `import { listWakes } from './evobuddy-taskroom-wake-store.mjs'` (or equivalent)
3. Build synthetic reports **or** merge via new `projectDurableTaskRooms(projectRoot)`:

```js
async function projectDurableTaskRooms(projectRoot, generatedAt) {
  const rooms = await listTaskRooms(projectRoot);
  const out = [];
  for (const room of rooms) {
    if (room.status === 'archived') continue;
    let wakes = [];
    try { wakes = await listWakes(projectRoot, room.roomId); } catch { wakes = []; }
    const hasHandoffWake = wakes.some((w) => w.reason === 'handoff-ready' || w.reason === 'review-needed');
    const status = hasHandoffWake ? 'NeedsReview' : 'Queued';
    const runtime = room.participants.find((p) => p.runtime)?.runtime ?? 'pi';
    out.push({
      id: room.roomId,
      title: room.title,
      runtime: normalizeRuntime(runtime) ?? 'pi',
      status,
      objective: room.objective ?? room.title,
      acceptanceCriteria: room.objective ?? '',
      participants: (room.participants ?? []).map((p) => ({
        id: p.participantId,
        displayName: p.actorName ?? p.participantId,
        kind: p.actorKind ?? 'team-agent',
        status,
        role: p.role ?? '',
        runtime: p.runtime ?? runtime ?? 'pi',
      })),
      rounds: [],
      handoffs: [],
      reviewerContinuity: { status: 'unknown', summary: '' },
      evolutionHandoff: { status: 'unknown', summary: '' },
      attention: {
        state: status,
        sourceKind: 'durable-taskroom',
        sourceRef: room.roomId,
        observedAt: generatedAt,
        confidence: 'high',
        staleAfter: generatedAt,
      },
      availableActions: (room.participants?.length ?? 0) > 0
        ? [{ id: 'open-native-runtime', label: 'Open native runtime', enabled: true, disabledReason: null }]
        : [{ id: 'open-native-runtime', label: 'Open native runtime', enabled: false, disabledReason: 'No seats in room' }],
      returnedTo: null,
      artifactsSummary: [],
      summary: room.objective ?? room.title,
    });
  }
  return out;
}
```

Merge: `taskRooms = [...normalizeTaskRooms(...), ...await projectDurableTaskRooms(...)]` dedupe by id (durable wins or reports win — prefer durable when both).

Fix participant mapping for report path too: include `role` and `runtime` when present in proof (non-blocking if fixtures lack them — defaults empty).

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit** `feat: project durable taskrooms into workbench export`

---

### Task 3: TUI create honors draft (G2.3)

**Files:**
- Modify: `crates/evobuddy-tui/src/backend.rs` — `taskroom_create_command` add optional `runtime`
- Modify: `crates/evobuddy-tui/src/ui.rs` — CreateTaskRoom uses draft.runtime + titleFromObjective
- Test: extend `crates/evobuddy-tui/tests/workbench_effects.rs` or unit on command builder if pure

**Example:** implements Example 1

- [ ] **Step 1: Failing assert** — `taskroom_create_command` includes `--runtime pi` when runtime passed; title truncation helper

```rust
// In backend.rs or a small pure helper in ui/backend:
// title from objective: if empty use room_id; if len>80 then first 77 + "..."
```

Update signature:

```rust
pub fn taskroom_create_command(
    project: &Path,
    room_id: &str,
    title: &str,
    objective: &str,
    runtime: Option<&str>,
    created_at: Option<&str>,
) -> BackendCommand
```

Append when runtime Some: `"--runtime", runtime`.

In `ui.rs` CreateTaskRoom:

```rust
WorkbenchEffect::CreateTaskRoom(draft) => {
    let project = project_root(app);
    let room_id = format!("taskroom:{}", /* millis */);
    let objective = draft.objective.clone();
    let title = if draft.objective.is_empty() {
        room_id.clone()
    } else if draft.objective.chars().count() > 80 {
        format!("{}...", draft.objective.chars().take(77).collect::<String>())
    } else {
        draft.objective.clone()
    };
    let runtime = if draft.runtime.is_empty() { "pi" } else { draft.runtime.as_str() };
    let command = taskroom_create_command(
        &project, &room_id, &title, &objective, Some(runtime), Some(&iso_now()),
    );
    // do NOT `let _ = draft;`
    run_backend_command(&command, &project)?;
    ...
}
```

Fix all call sites of `taskroom_create_command`.

- [ ] **Step 2–4: cargo test -p evobuddy-tui` focused; commit** `fix: TUI create passes runtime and titleFromObjective`

---

### Task 4: Choose seat submit → OpenNativeRuntime (G2.5–G2.6)

**Files:**
- Modify: `crates/evobuddy-tui/src/app_types.rs` — tag seat questions
- Modify: `crates/evobuddy-tui/src/app_effects.rs` — set tag in `present_seat_choice`
- Modify: `crates/evobuddy-tui/src/app_forms.rs` — `submit_structured_answer`
- Test: `crates/evobuddy-tui/tests/home_action_surface.rs`, `input_flow.rs`

**Example:** implements Example 2

**Interfaces:**
- Add to `StructuredQuestion`:

```rust
pub attach_room_id: Option<String>, // Some => answer id is instance_id for OpenNativeRuntime
```

- [ ] **Step 1: Failing tests**

```rust
#[test]
fn seat_choice_submit_opens_selected_participant_without_action_progress() {
    let mut app = load_app(); // multi-seat fixture
    app.present_seat_choice();
    let reviewer_id = app.structured_question.as_ref().unwrap()
        .choices.iter()
        .find(|c| c.label.to_lowercase().contains("reviewer"))
        .map(|c| c.id.clone())
        .expect("reviewer choice");
    let index = app.structured_question.as_ref().unwrap()
        .choices.iter().position(|c| c.id == reviewer_id).unwrap();
    let effect = app.submit_structured_answer(index);
    match effect {
        WorkbenchEffect::OpenNativeRuntime { instance_id, .. } => {
            assert_eq!(instance_id, reviewer_id);
        }
        other => panic!("expected OpenNativeRuntime, got {other:?}"),
    }
    assert_ne!(app.view_mode, ViewMode::ActionProgress);
}

#[test]
fn generic_structured_answer_still_records_answer() {
    // existing numbered answer test: keep AnswerQuestion + may keep ActionProgress for non-seat
}
```

Update `present_seat_choice` to set `attach_room_id: Some(room.id.clone())`.

Update `submit_structured_answer`:

```rust
pub fn submit_structured_answer(&mut self, index: usize) -> WorkbenchEffect {
    let Some(question) = self.structured_question.clone() else {
        return WorkbenchEffect::None;
    };
    let answer = /* same choice resolution */;
    let Some(answer) = answer else { return WorkbenchEffect::None; };
    if let Some(room_id) = question.attach_room_id {
        self.structured_question = None;
        self.pop_view_or_dashboard(); // or go back to Dashboard without ActionProgress
        self.action_status = Some(format!("opening seat…"));
        return WorkbenchEffect::OpenNativeRuntime {
            room_id,
            instance_id: answer,
        };
    }
    self.action_status = Some("structured answer recorded".to_string());
    self.push_view(ViewMode::ActionProgress);
    WorkbenchEffect::AnswerQuestion(answer)
}
```

Use existing back-stack pop if available (`handle Escape` pattern); if no helper, set `view_mode = ViewMode::Dashboard` and clear structured_question.

Fix all `StructuredQuestion { ... }` construction sites to include `attach_room_id: None`.

Update `input_flow` generic test if it asserts ActionProgress only for non-seat cases.

- [ ] **Step 2–4: cargo test; commit** `fix: choose seat attaches selected participant`

---

### Task 5: Product handoff → body + content-free wake (G3.1–G3.2)

**Files:**
- Modify: `scripts/evobuddy/evobuddy.mjs` `taskroomHandoffCreate` → `handoffWithWake`
- Modify: `parseFlags` add `--body` if missing
- Modify: `crates/evobuddy-tui/src/backend.rs` handoff command include `--body`
- Modify: `crates/evobuddy-tui/src/ui.rs` CreateHandoff pass `draft.body` (default short body if empty: `"review requested"`)
- Test: extend wake tests + CLI spawn test

**Example:** implements Example 3

- [ ] **Step 1: Failing CLI test**

```js
test('CLI handoff create writes body + content-free wake', async () => {
  // createPiFirstTaskRoom, then spawn handoff create with --body, assert listWakes + pull
});
```

- [ ] **Step 2: Implement**

```js
import { handoffWithWake } from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';
// parseFlags: else if (arg === '--body') parsed.body = requireValue(...)

async function taskroomHandoffCreate(argv) {
  const args = parseFlags(argv);
  // required: project, room, fromInstance, toInstance; body default 'review requested'
  // handoffId optional
  const result = await handoffWithWake(resolve(args.project), {
    roomId: args.room,
    handoffId: args.handoffId,
    from: args.fromInstance,
    to: args.toInstance,
    body: args.body ?? 'review requested',
    handoffKind: args.handoffKind ?? 'review-request',
    createdAt: args.createdAt ?? isoNow(),
  });
  return { stdout: args.json ? `${JSON.stringify(result)}\n` : `${result.handoffId}\n` };
}
```

TUI `taskroom_handoff_create_command` adds body param and `--body` arg.

Prefer defaults for empty sender/receiver: resolve builder/reviewer from selected room when form fields empty (optional polish if time — min bar: pass form fields; joint test can pass ids).

- [ ] **Step 3: Tests PASS; commit** `feat: product handoff writes body and content-free wake`

---

### Task 6: Home/export Needs you after handoff + stop keeps room (G3.3–G3.5)

**Files:**
- Covered partly by Task 2 NeedsReview projection
- Stop already backend; joint J5 asserts room remains after `taskroom session stop`
- Optional: Home handoff entry — audit wants handoff from Home; minimum for G3.5 is surface Needs you without Workspace hop (projection + attention). Soft: allow `h` on Home only when multi-seat room selected (may conflict with home_action_surface tests that forbid `h` on bar — **do not** put handoff on first-paint bar; palette/command `create handoff` is enough if Needs you shows).

**Example:** observes Example 3

- [ ] **Step 1:** Ensure Task 2 NeedsReview test green
- [ ] **Step 2:** J5 in joint harness (Task 7)
- [ ] **Step 3:** Commit if any extra copy for empty seats / attach failure human message in `open_native_runtime_effect` when no participants:

```rust
if room.participants.is_empty() {
  self.action_status = Some("No seats in this room — create a Pi team room or add seats.".into());
  return WorkbenchEffect::None;
}
```

---

### Task 7: Joint eval L1 J1–J5 harness (G4)

**Files:**
- Create: `scripts/context-tree/run-evobuddy-tui-backend-joint-eval.mjs`
- Create: `test/core/evobuddy-tui-backend-joint-l1.test.mjs` (optional; harness can inline)
- Modify: `package.json` script `evobuddy:eval-tui-backend-joint`
- Output: `evobuddy-tui-backend-joint-eval-report.json`

**Example:** observes Examples 1–3 | G4

**Report shape:**

```json
{
  "schema": "evobuddy.tui-backend-joint-eval.v1",
  "gate": "pass|fail",
  "results": [
    { "id": "J1", "status": "pass|fail|skip", "method": "l1-contract", "...": "..." },
    { "id": "J2", "status": "..." },
    { "id": "J3", "status": "..." },
    { "id": "J4", "status": "..." },
    { "id": "J5", "status": "..." }
  ]
}
```

**Per-ID L1 proof (no full PTY required):**

| ID | Drive | Assert |
|---|---|---|
| J1 | Same CLI create TUI uses (`taskroom create` via node spawn) | ≥2 seats, runtime pi, status Ready/Queued/active projection |
| J2 | Export room; simulate Enter target = builder participant id; plan-open program pi | builder id + pi program |
| J3 | Select reviewer id; assert attach target ≠ builder when multi-seat | reviewer participantId |
| J4 | handoff CLI with body | wake content-free; pull body; export status NeedsReview |
| J5 | session stop on builder instance; list rooms | room still listed; seats remain |

Gate: `pass` iff all J1–J5 status `pass` (no fail). Live-only extras may skip without failing L1.

Also re-run cargo seat tests and `npm run evobuddy:eval-pi-first-raft-room` for G0.

- [ ] **Step 1: Implement harness + write package.json**
- [ ] **Step 2: Run until gate pass**
- [ ] **Step 3: Commit** `test: tui-backend joint eval J1–J5 L1`

---

### Task 8: FINAL verification correction loop

- [ ] **Step 1:** `cargo test -p evobuddy-tui`
- [ ] **Step 2:** `npm run evobuddy:eval-pi-first-raft-room` → G0 pass
- [ ] **Step 3:** `npm run evobuddy:eval-tui-backend-joint` → G4 pass (J1–J5)
- [ ] **Step 4:** Confirm checklists G2/G3/G4 from audit §8–§9
- [ ] **Step 5: If verification fails, run the correction loop**

For each failure:

1. Retain failing evidence: command output, report path, artifact path.
2. Classify: implementation / test / environment / design mismatch.
3. Write or update failing regression for implementation defects.
4. Minimal root-cause fix; do not weaken gates.
5. Focused re-test then full joint + pi-first eval.
6. Compare evidence; do not claim pass without artifact change.
7. Repeat until FINAL PASS announcement template can be filled honestly.

**FINAL PASS announcement (fill when green):**

```text
FINAL PASS — Raft-aligned daily loop
- G0 pi-first backend gate: pass (S3: pass|skip+reason)
- G1 Raft Home shell: pass
- G2 wire-through: pass (J1–J3)
- G3 product comms: pass (J4–J5)
- G4 joint L1: pass (report: <path>)
- Claims: TUI create→multi pi seats→attach/choose→handoff wake→re-attach
- Non-claims: full OpenCode tree density; Raft web clone
```

---

## Spec coverage checklist

| Gate / ID | Tasks |
|---|---|
| G2.1–G2.3 create seats + runtime + draft | 1, 3 |
| G2.4–G2.6 attach / choose / no fake Working | 2, 4 |
| G3 handoff body/wake/NeedsReview/J5 | 5, 6 |
| G4 J1–J5 independent report | 7 |
| G0 regression | 8 |
| FINAL F1–F8 | 8 |

## Explicit non-goals (this plan)

- Raft Web / PWA visual clone
- L2 full PTY joint (recommended only)
- J6 live spawn-on-wake required for FINAL
- P2 compose UI polish (soft)

## Self-review notes

- Spec G2–G4 and J1–J5 each map to tasks above.
- Examples 1–3 preserved with verification and failure signals.
- Durable export gap is in-plan (Task 2) — without it, create seats never appear for attach.
- No placeholder steps; commands and code sketches are concrete.
