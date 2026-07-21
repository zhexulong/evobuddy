# EvoBuddy Workbench Interactive TUI Acceptance Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Workbench TUI from a reducer-proven snapshot surface into an honestly interactive, full-screen, read-only management surface with a separate PTY-backed acceptance proof.

**Architecture:** Keep the existing artifact reader, model builder, renderer, and pure interaction reducer as the product-state source of truth. Harden only the interactive terminal adapter and acceptance boundary: the existing render eval remains the proof for fresh artifact rendering plus reducer navigation, while a new PTY eval becomes the only proof for real terminal-loop behavior such as repainting, open/back navigation, quit, and terminal cleanup.

**Tech Stack:** Node.js ESM, existing `scripts/context-tree/render-evobuddy-workbench.mjs`, `scripts/context-tree/run-evobuddy-workbench-team-taskroom-live-eval.mjs`, `src/tui/evobuddy-workbench-interactive-terminal.mjs`, `src/tui/evobuddy-workbench-interaction.mjs`, `src/report/evobuddy-workbench-terminal.mjs`, Node test runner, Unix `script(1)` PTY wrapper for acceptance proof, retained fixture inputs, fresh `/tmp/*current` reports.

## Global Constraints

- The primary work surface remains the user's runtime agent; the TUI is a secondary visibility and management surface.
- TUI visibility is not product proof. Reducer simulation is not PTY proof. PTY proof is not runtime-native TaskRoom proof.
- The existing `evobuddy:eval-workbench-team-taskroom:live` script must stay honest: it proves fresh-artifact rendering and reducer navigation only.
- The interactive proof must launch the real product entrypoint `scripts/evobuddy/evobuddy.mjs workbench --project <path> --interactive`; direct helper invocation alone is not enough. The product entrypoint must preserve the PTY for the interactive child path; spawning the renderer through piped `spawnSync(..., { encoding })` is not acceptable for interactive proof.
- First-level UI must remain work-oriented and read-only. No proof taxonomies, artifact refs, session ids, digests, or suggested shell commands on the primary surface.
- Full-screen polish is in scope only when it improves real interactive behavior or makes PTY acceptance observable. Do not redesign the model or invent write actions.
- Interactive state remains ephemeral UI state and must not write durable EvoBuddy project state.
- If PTY capability is unavailable, the PTY eval may report `blocked`, but it must never relabel reducer-only evidence as an interactive pass. If the product entrypoint falls back to non-interactive mode because stdin/stdout is piped, that is a product defect (`fail`), not PTY-unavailable.

---

## Concrete Examples

### Example 1: Honest proof-scope split

- **Example:** Run `npm run evobuddy:eval-workbench-team-taskroom:live -- --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-workbench-team-taskroom-live`.
- **Expected result:** The report still passes for retained/fresh render coverage, but it exposes `renderEval`, `interactionReducerEval`, and `interactivePtyEval` as separate sections. `interactivePtyEval.status` is `not-run`, and the report still says it does not prove runtime execution.
- **Verification:** `node --test "test/cli/run-evobuddy-workbench-team-taskroom-live-eval-cli.test.mjs"`.
- **Failure signal:** A single top-level pass still implies “interactive TUI proven,” or the report hides that PTY coverage was not run.
- **If it fails:** Fix the eval report structure and its tests. Do not weaken the non-claims.

### Example 2: Real interactive PTY session

- **Example:** Run `npm run evobuddy:eval-workbench-interactive-pty:live -- --project /home/prosumer/agent/context-tree --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-workbench-interactive-pty-live`.
- **Expected result:** The eval launches `evobuddy workbench --interactive` in a PTY, sees alternate-screen/full-screen repaint escape sequences, sends key input for open/back/toggle/quit, and records a report that passes with transcript evidence, fails for observed product defects, or honestly blocks because PTY support is unavailable.
- **Verification:** `node --test "test/cli/run-evobuddy-workbench-interactive-pty-live-eval-cli.test.mjs"` plus manual run of the npm command.
- **Failure signal:** The eval only instantiates the reducer, the terminal output appends snapshots instead of repainting in place, or the terminal modes are not cleaned up on quit.
- **If it fails:** Fix the interactive terminal adapter or PTY harness. Do not change the report to pretend the missing PTY behaviors were observed.

### Example 3: Read-only interactive chrome

- **Example:** Start `node scripts/evobuddy/evobuddy.mjs workbench --project /home/prosumer/agent/context-tree --input-root fixtures/evobuddy-workbench/team-taskroom-retained --interactive` and press `Tab`, `→`, `←`, `u`, `?`, then `q`.
- **Expected result:** The screen clearly identifies itself as a read-only management surface, shows current focus/selection/help in interactive chrome, repaints in place, and restores the terminal on exit.
- **Verification:** PTY eval asserts the banner, focus/help text, repaint behavior, and cleanup bytes; a unit test covers the same chrome in deterministic rendering.
- **Failure signal:** Users only see append-only snapshots, cannot tell what pane is focused, or leave the terminal with mouse/raw mode still enabled.
- **If it fails:** Fix interactive rendering or screen lifecycle. Do not add fake write actions or move product ownership into the TUI.

### Invariants

- Invariant 1: `TeamAgent`, `SubagentBuddy`, and `TaskRoom` ownership stays in the existing Workbench model, not in the PTY harness.
- Invariant 2: `evobuddy:eval-workbench-team-taskroom:live` remains a render/reducer proof, never an interactive proof.
- Invariant 3: `evobuddy:eval-workbench-interactive-pty:live` is the only acceptance proof for real interactive terminal behavior.
- Invariant 4: The TUI remains read-only and secondary to the runtime agent.

## File Structure

### Create

- `scripts/context-tree/run-evobuddy-workbench-interactive-pty-live-eval.mjs` — launches the real interactive product entrypoint through a PTY wrapper, sends key bytes, captures transcript evidence, and writes an honest PTY acceptance report.
- `src/tui/evobuddy-workbench-terminal-screen.mjs` — owns alternate-screen enter/render/exit byte sequences and cleanup helpers so the interactive adapter stops appending snapshots.
- `src/tui/evobuddy-workbench-pty-session.mjs` — small Unix `script(1)` wrapper that runs a command in a PTY, sends scripted input bytes, and returns captured output or blocked capability details.
- `test/tui/evobuddy-workbench-terminal-screen.test.mjs` — unit tests for alternate-screen enter/render/cleanup bytes.
- `test/cli/run-evobuddy-workbench-interactive-pty-live-eval-cli.test.mjs` — PTY eval CLI test with pass/fail/blocked assertions that distinguish product defects from missing PTY capability.

### Modify

- `scripts/context-tree/run-evobuddy-workbench-team-taskroom-live-eval.mjs` — split render/reducer/PTY proof sections without changing its core artifact-reading role.
- `src/tui/evobuddy-workbench-interactive-terminal.mjs` — use the new screen helper, guarantee cleanup in `finally`, and expose enough result metadata for the PTY eval.
- `src/tui/evobuddy-workbench-interaction.mjs` — make help/focus chrome renderable in deterministic output instead of being hidden reducer state.
- `src/report/evobuddy-workbench-terminal.mjs` — add minimal read-only banner and interactive summary hooks without changing snapshot ownership.
- `scripts/context-tree/render-evobuddy-workbench.mjs` — keep the current entrypoint but thread any small interactive options needed by the hardened adapter.
- `scripts/evobuddy/evobuddy.mjs` — keep `workbench --project <path> --interactive` as the product route, preserve stdio/TTY for the interactive renderer path, and document the read-only interactive surface in help text if needed.
- `package.json` — add `evobuddy:eval-workbench-interactive-pty:live`.
- `test/cli/run-evobuddy-workbench-team-taskroom-live-eval-cli.test.mjs` — assert the honest proof split.
- `test/cli/evobuddy-cli.test.mjs` and `test/cli/render-evobuddy-workbench-cli.test.mjs` — assert the product entrypoint still reaches the interactive adapter.
- `docs/contracts/evobuddy-workbench-tui-contract.md` — add the explicit PTY acceptance boundary and full-screen cleanup requirements.
- `README.md` — document the interactive launch command and distinguish render eval from PTY eval.
- `.superpowers/sdd/progress.md` — update only after the final correction loop passes or honestly blocks with retained evidence.

---

## Task 1: Split the proof scopes without changing product ownership

**Files:**
- Modify: `scripts/context-tree/run-evobuddy-workbench-team-taskroom-live-eval.mjs`
- Modify: `test/cli/run-evobuddy-workbench-team-taskroom-live-eval-cli.test.mjs`
- Modify: `docs/contracts/evobuddy-workbench-tui-contract.md`
- Modify: `README.md`

**Example:** implements Example 1; preserves Invariants 1-3.

**Interfaces:**
- Consumes: `renderEvobuddyWorkbenchTerminal(model, options)`, `createEvobuddyWorkbenchInteractionState(model, options)`, `reduceEvobuddyWorkbenchInteraction(state, event)`, `renderInteractiveEvobuddyWorkbench(model, state)`.
- Produces: report sections `renderEval`, `interactionReducerEval`, `interactivePtyEval`, and top-level `status`, `proofScope`, `nonClaims` used by later tests and docs.

- [ ] **Step 1: Write the failing CLI assertions for the proof split**

```js
assert.equal(report.renderEval.status, 'pass');
assert.equal(report.interactionReducerEval.status, 'pass');
assert.equal(report.interactivePtyEval.status, 'not-run');
assert.match(report.interactivePtyEval.reason, /separate PTY eval/i);
assert.equal(report.proofScope, 'fresh-artifact-render-eval');
assert.equal(report.nonClaims.includes('does not prove runtime execution'), true);
```

Run: `node --test "test/cli/run-evobuddy-workbench-team-taskroom-live-eval-cli.test.mjs"`

Expected: FAIL because the current report only exposes `views` and `interaction`.

- [ ] **Step 2: Refactor the live eval report into explicit proof sections**

```js
const renderEval = {
  status: Object.values(views).every((view) => view.status === 'pass') && forbiddenHits.length === 0 ? 'pass' : 'fail',
  views,
  forbiddenFirstLevel: { status: forbiddenHits.length === 0 ? 'pass' : 'fail', hits: forbiddenHits },
};

const interactionReducerEval = {
  status: interactionState.history?.some((entry) => entry.view === 'taskroom') && interactionState.collapsed?.updates === true ? 'pass' : 'fail',
  visitedViews: interactionState.history?.map((entry) => entry.view) ?? [],
  durableWrites: interactionState.durableWrites?.length ?? 0,
};

const interactivePtyEval = {
  status: 'not-run',
  proofScope: 'interactive-pty-runtime-eval',
  reason: 'Run evobuddy:eval-workbench-interactive-pty:live for terminal-loop proof.',
};
```

Update `status` so this script still passes only when `renderEval` and `interactionReducerEval` pass and no blocked reasons exist.

- [ ] **Step 3: Re-run the focused CLI test**

Run: `node --test "test/cli/run-evobuddy-workbench-team-taskroom-live-eval-cli.test.mjs"`

Expected: PASS.

- [ ] **Step 4: Update the contract and README to name the proof boundary explicitly**

Add this contract text under `## Proof boundary`:

```md
Render/reducer evaluation and PTY evaluation are separate proof scopes.

- `evobuddy:eval-workbench-team-taskroom:live` proves fresh-artifact rendering plus deterministic reducer navigation.
- `evobuddy:eval-workbench-interactive-pty:live` proves real terminal-loop behavior: alternate-screen entry, in-place repaint, key-driven open/back/toggle/quit, and terminal cleanup.

Neither proof satisfies runtime-native TaskRoom or release-parity proof.
```

Add this README block near the Workbench commands:

```md
Interactive Workbench acceptance uses two different checks:

- `npm run evobuddy:eval-workbench-team-taskroom:live -- --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-workbench-team-taskroom-live`
- `npm run evobuddy:eval-workbench-interactive-pty:live -- --project /home/prosumer/agent/context-tree --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-workbench-interactive-pty-live`

The first proves rendering/reducer behavior. The second proves real PTY interaction.
```

- [ ] **Step 5: Leave changes uncommitted for review**

Do not commit unless the user explicitly asks. Record changed files and test output for review.

## Task 1A: Make the product Workbench entrypoint preserve the interactive PTY

**Files:**
- Modify: `scripts/evobuddy/evobuddy.mjs`
- Modify: `test/cli/evobuddy-cli.test.mjs`
- Modify: `test/cli/render-evobuddy-workbench-cli.test.mjs` if needed

**Example:** required by Examples 2 and 3; preserves Invariants 2-4.

**Problem to fix:** current `evobuddy workbench --interactive` routes through `spawnNode()`, which uses `spawnSync(..., { encoding: 'utf8' })`. That pipes stdin/stdout, so the renderer sees `input.isTTY === false` and exits through the non-interactive fallback. A PTY eval through this route would not prove a real interactive TUI.

- [ ] **Step 1: Add failing product-entrypoint tests**

Add assertions that the interactive route does not use the piped `spawnNode()` path and preserves stdio for the renderer. The test can inspect a small exported helper or run a controlled child process; it must fail if `workbench --interactive` can only reach the renderer through piped stdio.

Required behavior:

```text
evobuddy workbench --project <project> --interactive --input-root <root>
```

forwards to the actor-aware Workbench while preserving the caller's TTY/PTY.

- [ ] **Step 2: Implement interactive stdio preservation**

In `scripts/evobuddy/evobuddy.mjs`, split the Workbench dispatch:

- non-interactive legacy/render paths may continue to use the existing capture-oriented `spawnNode()` behavior;
- interactive Workbench path must either:
  - spawn the renderer with `stdio: 'inherit'`, or
  - directly import/call the actor-aware Workbench modules in the current process.

If using child spawn, use this shape rather than `spawnSync(..., { encoding })`:

```js
function spawnNodeInteractive(scriptRel, args) {
  const result = spawnSync(process.execPath, [join(REPO_ROOT, scriptRel), ...args], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  return { code: result.status ?? 0 };
}
```

The route must still require `--project <path>` for product binding. Artifact-only inputs such as `--input-root`, `--aggregate-report`, and `--taskroom-report` remain passthrough inputs, not replacements for project identity.

- [ ] **Step 3: Verify the product entrypoint**

Run:

```bash
node --test "test/cli/evobuddy-cli.test.mjs" "test/cli/render-evobuddy-workbench-cli.test.mjs"
```

Expected: PASS.

- [ ] **Step 4: Leave changes uncommitted for review**

Do not commit unless the user explicitly asks.

## Task 2: Harden the interactive terminal into a real full-screen surface

**Files:**
- Create: `src/tui/evobuddy-workbench-terminal-screen.mjs`
- Modify: `src/tui/evobuddy-workbench-interactive-terminal.mjs`
- Modify: `src/tui/evobuddy-workbench-interaction.mjs`
- Modify: `src/report/evobuddy-workbench-terminal.mjs`
- Create: `test/tui/evobuddy-workbench-terminal-screen.test.mjs`

**Example:** implements Example 3; preserves Invariants 1 and 4.

**Interfaces:**
- Consumes: `renderEvobuddyWorkbenchTerminal(model, options)` and current interaction state.
- Produces: `enterWorkbenchScreen(output)`, `renderWorkbenchScreen(output, text)`, `exitWorkbenchScreen(output)`, and interactive render text that includes read-only/focus/help chrome.

- [ ] **Step 1: Write failing unit tests for full-screen lifecycle bytes**

```js
import assert from 'node:assert/strict';
import { enterWorkbenchScreen, renderWorkbenchScreen, exitWorkbenchScreen } from '../../src/tui/evobuddy-workbench-terminal-screen.mjs';

it('writes alternate-screen enter, repaint, and cleanup bytes', () => {
  const writes = [];
  const output = { write(chunk) { writes.push(String(chunk)); } };

  enterWorkbenchScreen(output);
  renderWorkbenchScreen(output, 'hello');
  exitWorkbenchScreen(output);

  assert.equal(writes[0], '\u001b[?1049h\u001b[?25l\u001b[?1000h\u001b[?1006h');
  assert.equal(writes[1], '\u001b[H\u001b[2Jhello');
  assert.equal(writes[2], '\u001b[?1000l\u001b[?1006l\u001b[?25h\u001b[?1049l');
});
```

Run: `node --test "test/tui/evobuddy-workbench-terminal-screen.test.mjs"`

Expected: FAIL because the screen helper does not exist.

- [ ] **Step 2: Implement the screen helper**

```js
export function enterWorkbenchScreen(output) {
  output.write('\u001b[?1049h\u001b[?25l\u001b[?1000h\u001b[?1006h');
}

export function renderWorkbenchScreen(output, text) {
  output.write(`\u001b[H\u001b[2J${text}`);
}

export function exitWorkbenchScreen(output) {
  output.write('\u001b[?1000l\u001b[?1006l\u001b[?25h\u001b[?1049l');
}
```

- [ ] **Step 3: Move the interactive adapter onto the screen helper and guarantee cleanup**

Replace the append-only writes in `runEvobuddyWorkbenchInteractiveTerminal()` with this shape. This must be reached through a real TTY/PTY when launched from `evobuddy workbench --interactive`:

```js
enterWorkbenchScreen(output);
renderWorkbenchScreen(output, renderInteractiveEvobuddyWorkbench(model, state));

try {
  // existing input setup and event loop
} finally {
  if (restoreRawMode) input.setRawMode(false);
  exitWorkbenchScreen(output);
}
```

Return extra metadata for the PTY eval:

```js
resolve({
  exitReason: 'quit',
  transcript: state.transcript,
  finalView: state.view,
  collapsed: state.collapsed,
});
```

- [ ] **Step 4: Make the interactive renderer visibly interactive and explicitly read-only**

Add this chrome in `renderInteractiveEvobuddyWorkbench()` before the shortcut footer:

```js
const focusLabel = state.focusedPane;
const selection = state.view === 'taskroom'
  ? model.taskRooms[state.selected.taskRoomIndex]?.displayTitle ?? 'none'
  : visibleModel.selected.actor?.name ?? 'none';

return [
  'Read-only management surface | Runtime agent remains primary work surface',
  `Focus: ${focusLabel} | View: ${state.view} | Selected: ${selection}`,
  state.helpOpen ? 'Help: Tab focus | ↑/↓ move | → open | ← back | Ctrl+B task rooms | Ctrl+T todos | u updates | r runtime setup | q quit' : '',
  body,
  '',
  'Tab focus | ↑/↓ move | → open | ← back | Ctrl+B task rooms | Ctrl+T todos | u updates | r runtime setup | ? help | q quit',
].filter(Boolean).join('\n');
```

This is enough polish for acceptance because it makes focus/help/read-only state observable without redesigning the product surface.

- [ ] **Step 5: Run the focused unit tests**

Run: `node --test "test/tui/evobuddy-workbench-terminal-screen.test.mjs" "test/cli/render-evobuddy-workbench-cli.test.mjs" "test/cli/evobuddy-cli.test.mjs"`

Expected: PASS.

- [ ] **Step 6: Leave changes uncommitted for review**

Do not commit unless the user explicitly asks. Record changed files and focused test output.

## Task 3: Add a PTY-backed acceptance harness for the real product entrypoint

**Files:**
- Create: `src/tui/evobuddy-workbench-pty-session.mjs`
- Create: `scripts/context-tree/run-evobuddy-workbench-interactive-pty-live-eval.mjs`
- Modify: `package.json`
- Create: `test/cli/run-evobuddy-workbench-interactive-pty-live-eval-cli.test.mjs`
- Modify: `.superpowers/sdd/progress.md`

**Example:** implements Example 2; preserves Invariants 2-4.

**Interfaces:**
- Consumes: `evobuddy workbench --interactive` product route, retained/fresh input roots, and the screen helper behavior from Task 2.
- Produces: `runWorkbenchPtySession(options)`, PTY eval report `evobuddy-workbench-interactive-pty-live-eval-report.json`, npm script `evobuddy:eval-workbench-interactive-pty:live`.

- [ ] **Step 1: Write the failing PTY eval CLI test**

```js
assert.match(report.reportKind, /interactive-pty-live-eval/);
assert.ok(['pass', 'fail', 'blocked'].includes(report.status));
assert.equal(report.productEntrypoint.command[0], 'node');
assert.match(report.productEntrypoint.command.join(' '), /scripts\/evobuddy\/evobuddy\.mjs workbench --project/);
assert.match(report.productEntrypoint.command.join(' '), /--interactive/);

if (report.status === 'pass') {
  assert.equal(report.escapeSequences.enterAlternateScreen, true);
  assert.equal(report.escapeSequences.exitAlternateScreen, true);
  assert.equal(report.navigation.openTaskroomObserved, true);
  assert.equal(report.navigation.backToOverviewObserved, true);
  assert.equal(report.navigation.quitObserved, true);
} else if (report.status === 'fail') {
  assert.equal(Array.isArray(report.failures), true);
  assert.ok(report.failures.length > 0);
} else {
  assert.match(report.blockedReasons.join('\n'), /script\(1\)|PTY capability/i);
}
```

Run: `node --test "test/cli/run-evobuddy-workbench-interactive-pty-live-eval-cli.test.mjs"`

Expected: FAIL because the script and report do not exist.

- [ ] **Step 2: Implement a tiny Unix PTY wrapper with honest blocking**

Create `src/tui/evobuddy-workbench-pty-session.mjs` around `script(1)`:

```js
import { spawn } from 'node:child_process';

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function shellQuoteCommand(parts) {
  return parts.map(shellQuote).join(' ');
}

export async function runWorkbenchPtySession({ command, args, cwd, env, inputChunks, timeoutMs = 8000 }) {
  if (process.platform === 'win32') {
    return { status: 'blocked', blockedReasons: ['PTY capability unavailable: script(1) is not supported on win32.'] };
  }

  const child = spawn('script', ['-qfec', shellQuoteCommand([command, ...args]), '/dev/null'], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', (chunk) => stdout.push(String(chunk)));
  child.stderr.on('data', (chunk) => stderr.push(String(chunk)));

  for (const { afterMs, data } of inputChunks) {
    setTimeout(() => child.stdin.write(data), afterMs);
  }

  return await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ status: 'blocked', blockedReasons: ['PTY capability timeout while waiting for interactive output.'], stdout: stdout.join(''), stderr: stderr.join('') });
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ status: 'observed', exitCode: code ?? 0, stdout: stdout.join(''), stderr: stderr.join('') });
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ status: 'blocked', blockedReasons: [`PTY capability unavailable: ${error.message}`], stdout: stdout.join(''), stderr: stderr.join('') });
    });
  });
}
```

- [ ] **Step 3: Implement the PTY eval against the real product entrypoint**

The eval script should require `--project` and launch:

```js
function buildWorkbenchArgs(argv) {
  if (!argv.project) throw new Error('missing value for --project');
  const args = ['scripts/evobuddy/evobuddy.mjs', 'workbench', '--project', argv.project, '--interactive'];
  if (argv.inputRoot) args.push('--input-root', argv.inputRoot);
  if (argv.aggregateReport) args.push('--aggregate-report', argv.aggregateReport);
  if (argv.plan1Report) args.push('--plan1-report', argv.plan1Report);
  if (argv.plan2Report) args.push('--plan2-report', argv.plan2Report);
  for (const taskroomReport of argv.taskroomReports) args.push('--taskroom-report', taskroomReport);
  return args;
}

const command = 'node';
const args = buildWorkbenchArgs({
  project,
  inputRoot,
  aggregateReport,
  plan1Report,
  plan2Report,
  taskroomReports,
});
```

Send this sequence:

```js
const inputChunks = [
  { afterMs: 200, data: '\t' },
  { afterMs: 350, data: '\t' },
  { afterMs: 500, data: '\u001b[C' },
  { afterMs: 700, data: '\u001b[D' },
  { afterMs: 900, data: 'u' },
  { afterMs: 1100, data: '?' },
  { afterMs: 1300, data: 'q' },
];
```

And evaluate the transcript with concrete checks:

```js
const text = session.stdout;
const failures = [];
if (session.exitCode !== 0) failures.push(`interactive entrypoint exited with code ${session.exitCode}`);
const enterAlternateScreenCount = (text.match(/\u001b\[\?1049h/g) ?? []).length;
const exitAlternateScreenCount = (text.match(/\u001b\[\?1049l/g) ?? []).length;
const repaintCount = (text.match(/\u001b\[H\u001b\[2J/g) ?? []).length;
if (enterAlternateScreenCount !== 1) failures.push(`expected exactly one alternate-screen enter sequence, observed ${enterAlternateScreenCount}`);
if (exitAlternateScreenCount !== 1) failures.push(`expected exactly one alternate-screen exit sequence, observed ${exitAlternateScreenCount}`);
if (repaintCount < 2) failures.push(`expected at least two in-place repaints, observed ${repaintCount}`);
if (!/TaskRoom:/.test(text)) failures.push('missing TaskRoom detail after open input');
if (!/Read-only management surface/.test(text)) failures.push('missing read-only banner');
if (!/Focus:/.test(text)) failures.push('missing visible focus chrome');

const status = session.status === 'blocked'
  ? 'blocked'
  : failures.length === 0
    ? 'pass'
    : 'fail';

const report = {
  reportKind: 'evobuddy-workbench-interactive-pty-live-eval-report',
  status,
  proofScope: 'interactive-pty-runtime-eval',
  productEntrypoint: { command: [command, ...args] },
  escapeSequences: {
    enterAlternateScreen: enterAlternateScreenCount === 1,
    exitAlternateScreen: exitAlternateScreenCount === 1,
    repaintHome: repaintCount >= 2,
    enterAlternateScreenCount,
    exitAlternateScreenCount,
    repaintCount,
  },
  navigation: {
    readOnlyBannerObserved: /Read-only management surface/.test(text),
    visibleFocusObserved: /Focus:/.test(text),
    openTaskroomObserved: /TaskRoom:/.test(text),
    backToOverviewObserved: /EvoBuddy Workbench/.test(text),
    helpObserved: /Help: Tab focus/.test(text),
    quitObserved: session.exitCode === 0,
  },
  ...(status === 'fail' ? { failures } : {}),
  ...(status === 'blocked' ? { blockedReasons: session.blockedReasons } : {}),
};
```

- [ ] **Step 4: Add the npm script and keep progress tracking honest**

Add to `package.json`:

```json
"evobuddy:eval-workbench-interactive-pty:live": "node scripts/context-tree/run-evobuddy-workbench-interactive-pty-live-eval.mjs"
```

Update `.superpowers/sdd/progress.md` only after the PTY eval is actually run and recorded as pass or blocked with its output path.

- [ ] **Step 5: Run the focused acceptance checks**

Run:

```bash
node --test "test/cli/run-evobuddy-workbench-interactive-pty-live-eval-cli.test.mjs"
npm run evobuddy:eval-workbench-interactive-pty:live -- --project /home/prosumer/agent/context-tree --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-workbench-interactive-pty-live
```

Expected: test PASS; PTY eval either PASS with the required navigation and escape-sequence evidence, FAIL with explicit missing-behavior evidence, or BLOCKED with explicit PTY capability reasons.

- [ ] **Step 6: Leave changes uncommitted for review**

Do not commit unless the user explicitly asks. Record changed files and test/eval output.

## Task 4: Run the final correction loop until the proof boundary is honest and green

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Verify: `scripts/context-tree/run-evobuddy-workbench-team-taskroom-live-eval.mjs`
- Verify: `scripts/context-tree/run-evobuddy-workbench-interactive-pty-live-eval.mjs`
- Verify: `scripts/evobuddy/evobuddy.mjs`

**Example:** corrects Examples 1-3; preserves all Invariants.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: final retained/fresh eval reports, passing tests, and progress evidence.

- [ ] **Step 1: Run the full focused verification suite**

Run:

```bash
node --test "test/tui/evobuddy-workbench-terminal-screen.test.mjs" "test/cli/evobuddy-cli.test.mjs" "test/cli/render-evobuddy-workbench-cli.test.mjs" "test/cli/run-evobuddy-workbench-team-taskroom-live-eval-cli.test.mjs" "test/cli/run-evobuddy-workbench-interactive-pty-live-eval-cli.test.mjs"
```

Expected: PASS.

- [ ] **Step 2: Run the retained acceptance commands**

Run:

```bash
npm run evobuddy:eval-workbench-team-taskroom:live -- --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-workbench-team-taskroom-live
npm run evobuddy:eval-workbench-interactive-pty:live -- --project /home/prosumer/agent/context-tree --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-workbench-interactive-pty-live
```

Expected: the first command PASS with `interactivePtyEval.status: "not-run"`; the second command PASS, honest FAIL for product defects, or honest BLOCKED for PTY capability absence.

- [ ] **Step 3: Run the fresh acceptance commands**

Run:

```bash
npm run evobuddy:eval-workbench-team-taskroom:live -- --aggregate-report /tmp/evobuddy-july17-readiness-current/aggregate/evobuddy-july17-mvp-readiness-report.json --plan1-report /tmp/evobuddy-july17-readiness-current/plan1/evobuddy-team-agent-substrate-live-eval-report.json --plan2-report /tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json --taskroom-report /tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json --taskroom-report /tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json --out /tmp/evobuddy-workbench-team-taskroom-live-current
npm run evobuddy:eval-workbench-interactive-pty:live -- --project /home/prosumer/agent/context-tree --aggregate-report /tmp/evobuddy-july17-readiness-current/aggregate/evobuddy-july17-mvp-readiness-report.json --plan1-report /tmp/evobuddy-july17-readiness-current/plan1/evobuddy-team-agent-substrate-live-eval-report.json --plan2-report /tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json --taskroom-report /tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json --taskroom-report /tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json --out /tmp/evobuddy-workbench-interactive-pty-live-current
```

Expected: render/reducer eval PASS; PTY eval PASS, honest FAIL for observed interactive defects, or honest BLOCKED if the environment lacks PTY capability.

- [ ] **Step 4: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, transcript snippet, or exact missing escape sequence.
2. Classify the root cause: implementation defect, verification defect, environment/PTY capability issue, unclear requirement, or design mismatch.
3. Write or update the smallest failing regression test for implementation or verification defects before changing product code.
4. Implement the minimal root-cause fix. Do not make report-only changes unless the report/check itself is wrong.
5. Re-run the focused test or PTY check that proves the fix.
6. Re-run the original failing verification command.
7. Compare the new evidence to the old evidence. If the screen lifecycle, navigation transcript, or cleanup bytes did not change, do not claim success.
8. Repeat until the suite passes, the PTY environment is honestly blocked, or a human decision is required.

- [ ] **Step 5: Record the final evidence in progress tracking**

Add the final report paths and statuses to `.superpowers/sdd/progress.md`, including whether the PTY eval passed or honestly blocked.

- [ ] **Step 6: Leave changes uncommitted for review**

Do not commit unless the user explicitly asks.
