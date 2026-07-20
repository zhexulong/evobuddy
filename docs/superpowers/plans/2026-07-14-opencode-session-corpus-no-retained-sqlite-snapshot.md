# OpenCode Session Corpus No Retained SQLite Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Completion status (2026-07-14): DONE.** Core implementation, artifact safety checks, real-export validation, and stale snapshot quarantine are complete. Historical checkbox items below are preserved as the original execution script; completion is governed by this banner plus the Task 5 completion record.

**Goal:** Stop EvoBuddy/Context Tree OpenCode corpus export and release flows from retaining full SQLite database snapshots while preserving consistent session-corpus extraction and digest-backed evidence.

**Architecture:** Change the OpenCode session-corpus exporter so retained artifacts are JSON corpus + manifest only. If SQLite consistency is needed, the exporter may create a temporary `.backup` under `/tmp`, read from it, record `snapshotRetention: "temporary-deleted"`, and delete it before returning; no product/release output may contain `opencode-session-corpus-source.sqlite`, `.db`, or `.sqlite` snapshots. Add release/output guards that fail if raw SQLite files appear in retained product artifacts.

**Tech Stack:** Node.js ESM, `node:test`, `sqlite3` CLI for optional temporary backup, existing `exportOpenCodeSqliteSessionCorpus()`, existing `scripts/context-tree/export-opencode-session-corpus.mjs`, release/readiness eval scripts.

## Global Constraints

- Do not retain full OpenCode SQLite snapshots in `.context-tree/`, `.evobuddy/`, release roots, corpus roots, product roots, or eval output roots.
- Do not add `--retain-db-snapshot`; retained full DB export is not a supported product/eval path.
- If snapshotting is used for consistency, it must be temporary under OS temp and deleted before the command exits.
- Manifest may record source DB digest and temporary snapshot retention status, but must not point to a retained SQLite artifact.
- Session corpus output remains `session-corpus-export.json` plus `session-corpus-export-manifest.json`.
- Release/product gates must fail or block if retained artifacts contain `.sqlite`, `.sqlite3`, or `.db` files.
- The fix must address the structural boundary: corpus export extracts selected session evidence; it does not archive the runtime database.
- Do not commit unless the user explicitly asks.

---

## Concrete Examples

### Example 1: Default export does not retain SQLite

- **Example:** Run `npm run context-tree:export-opencode-session-corpus -- --db /tmp/opencode.db --project-identity /repo --out /tmp/out` on a small test DB.
- **Expected result:** `/tmp/out/session-corpus-export.json` and `/tmp/out/session-corpus-export-manifest.json` exist; `/tmp/out/opencode-session-corpus-source.sqlite` does not exist; no `.sqlite`/`.db` file exists under `/tmp/out`.
- **Verification:** `node --test test/cli/export-opencode-session-corpus-cli.test.mjs test/core/opencode-session-corpus-export.test.mjs` passes.
- **Failure signal:** Export leaves a full DB copy in the output directory.
- **If it fails:** Fix exporter retention behavior; do not add an allowlist for the retained snapshot.

### Example 2: Temporary snapshot is deleted

- **Example:** Exporter runs with consistency mode that uses SQLite `.backup` internally.
- **Expected result:** Manifest records `snapshotRetention: "temporary-deleted"` and no snapshot path under output. The temporary directory is removed even if export succeeds.
- **Verification:** CLI test asserts no file named `opencode-session-corpus-source.sqlite` exists and no temp snapshot path is present in manifest.
- **Failure signal:** Manifest references a retained snapshot or temp files remain under output.
- **If it fails:** Move snapshot to `mkdtemp(tmpdir())` and delete in `finally`.

### Example 3: Release guard catches raw SQLite artifacts

- **Example:** A release/product output root contains `corpus/opencode-session-corpus-source.sqlite`.
- **Expected result:** Release/readiness guard reports `status: "fail"` or `"blocked"` with reason `retained-sqlite-artifact` and the offending path.
- **Verification:** Guard test creates a fake `.sqlite` file under a temp release root and expects non-pass.
- **Failure signal:** Release/readiness report passes despite retained raw DB snapshot.
- **If it fails:** Fix guard semantics; do not hide raw DB files behind trace/evidence labels.

### Invariants

- Corpus export extracts selected session evidence; it does not archive the OpenCode database.
- Digest-backed evidence is retained; raw runtime DB snapshots are not.
- Release/product outputs must be safe to retain without carrying the user's whole OpenCode DB.

---

## File Structure

- Modify `scripts/context-tree/export-opencode-session-corpus.mjs`: remove output-retained snapshot; use direct DB read or temporary deleted snapshot.
- Modify `src/core/opencode-session-corpus-export.mjs` if needed: accept manifest source metadata from CLI or expose digest helper without requiring copied DB.
- Create `src/core/retained-artifact-guard.mjs`: scan output roots for forbidden retained raw database files.
- Modify release/readiness scripts that write or validate product/release roots, especially `scripts/context-tree/run-product-release-readiness-eval.mjs` and `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs` if they aggregate release roots.
- Modify `test/cli/export-opencode-session-corpus-cli.test.mjs`: assert no retained SQLite snapshot.
- Modify/create `test/core/retained-artifact-guard.test.mjs`: guard positive/negative tests.
- Modify release/readiness CLI tests to include retained SQLite negative control.
- Optionally add docs note to the relevant eval/runbook docs that session-corpus export does not retain raw SQLite DB snapshots.

---

### Task 1: Add Regression Test For No Retained SQLite Snapshot

**Files:**
- Modify: `test/cli/export-opencode-session-corpus-cli.test.mjs`
- Inspect existing helper patterns in: `test/core/opencode-session-corpus-export.test.mjs`

**Example:** implements Examples 1-2

**Interfaces:**
- Consumes existing CLI `scripts/context-tree/export-opencode-session-corpus.mjs`.
- Produces failing assertions before implementation.

- [ ] **Step 1: Add failing CLI regression**

In `test/cli/export-opencode-session-corpus-cli.test.mjs`, add or update a test like:

```js
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function listFilesRecursive(root) {
  const out = [];
  for (const name of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, name.name);
    if (name.isDirectory()) out.push(...listFilesRecursive(path));
    else out.push(path);
  }
  return out;
}

it('does not retain a full sqlite snapshot in the export output', () => {
  const root = mkdtempSync(join(tmpdir(), 'opencode-corpus-no-snapshot-'));
  try {
    const dbPath = join(root, 'opencode.db');
    createOpenCodeFixtureDb(dbPath, { projectIdentity: '/repo/no-snapshot' });
    const out = join(root, 'out');
    const result = spawnSync(process.execPath, [
      join(REPO_ROOT, 'scripts/context-tree/export-opencode-session-corpus.mjs'),
      '--db', dbPath,
      '--project-identity', '/repo/no-snapshot',
      '--out', out,
    ], { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(join(out, 'session-corpus-export.json')), true);
    assert.equal(existsSync(join(out, 'session-corpus-export-manifest.json')), true);
    assert.equal(existsSync(join(out, 'opencode-session-corpus-source.sqlite')), false);
    const retainedDbFiles = listFilesRecursive(out).filter((path) => /\.(?:sqlite|sqlite3|db)$/i.test(path));
    assert.deepEqual(retainedDbFiles, []);
    const manifest = JSON.parse(readFileSync(join(out, 'session-corpus-export-manifest.json'), 'utf8'));
    assert.equal(manifest.source.dbSnapshotPath, undefined);
    assert.match(manifest.source.dbDigest, /^sha256:/);
    assert.match(['none', 'temporary-deleted'].includes(manifest.source.snapshotRetention), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

Use existing fixture DB helper names from the file. If the helper is named differently, adapt only the helper call; keep the assertions unchanged.

- [ ] **Step 2: Run the focused test and verify it fails now**

Run:

```bash
node --test test/cli/export-opencode-session-corpus-cli.test.mjs
```

Expected before implementation: FAIL because `opencode-session-corpus-source.sqlite` is currently retained in `out` and manifest has `source.dbSnapshotPath`.

---

### Task 2: Remove Retained Snapshot From Export CLI

**Files:**
- Modify: `scripts/context-tree/export-opencode-session-corpus.mjs`

**Example:** implements Examples 1-2

**Interfaces:**
- Keeps CLI arguments: `--db`, `--project-identity`, `--out`, caps, `--session-id`.
- Produces stdout JSON: `{ corpusPath, manifestPath, sessionCount, rootSessionCount, subagentSessionCount }` unchanged.
- Changes manifest source: no `dbSnapshotPath`; add `snapshotRetention: "none"` or `"temporary-deleted"`.

- [ ] **Step 1: Replace retained backup with non-retained source**

In `scripts/context-tree/export-opencode-session-corpus.mjs`, remove this retained-output behavior:

```js
const snapshotDbPath = join(out, 'opencode-session-corpus-source.sqlite');
await createSqliteBackup(sourceDbPath, snapshotDbPath);
const result = await exportOpenCodeSqliteSessionCorpus({ dbPath: snapshotDbPath, projectIdentity: args.projectIdentity, maxSessions: args.maxSessions, maxRootSessions: args.maxRootSessions, maxSubagentSessions: args.maxSubagentSessions, sessionIds: args.sessionIds });
result.manifest.source.dbPath = sourceDbPath;
result.manifest.source.dbSnapshotPath = 'opencode-session-corpus-source.sqlite';
```

Replace it with direct DB read first:

```js
const result = await exportOpenCodeSqliteSessionCorpus({
  dbPath: sourceDbPath,
  projectIdentity: args.projectIdentity,
  maxSessions: args.maxSessions,
  maxRootSessions: args.maxRootSessions,
  maxSubagentSessions: args.maxSubagentSessions,
  sessionIds: args.sessionIds,
});
result.manifest.source.dbPath = sourceDbPath;
delete result.manifest.source.dbSnapshotPath;
result.manifest.source.snapshotRetention = 'none';
```

Keep `createSqliteBackup()` only if another test still uses it; otherwise remove the function and unused imports.

- [ ] **Step 2: Optional consistency mode must be temporary-only if kept**

If direct DB read proves flaky against a live OpenCode DB, add internal temporary snapshot mode without a public retain option:

```js
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

async function withTemporarySqliteBackup(sourceDbPath, fn) {
  const tempRoot = await mkdtemp(join(tmpdir(), 'evobuddy-opencode-corpus-'));
  const snapshotDbPath = join(tempRoot, 'opencode-session-corpus-source.sqlite');
  try {
    await createSqliteBackup(sourceDbPath, snapshotDbPath);
    return await fn(snapshotDbPath);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
```

Then set:

```js
result.manifest.source.snapshotRetention = 'temporary-deleted';
delete result.manifest.source.dbSnapshotPath;
```

Do not expose `--retain-db-snapshot`.

- [ ] **Step 3: Run focused export tests**

Run:

```bash
node --test test/cli/export-opencode-session-corpus-cli.test.mjs test/core/opencode-session-corpus-export.test.mjs
```

Expected: PASS.

---

### Task 3: Add Retained Raw DB Artifact Guard

**Files:**
- Create: `src/core/retained-artifact-guard.mjs`
- Create: `test/core/retained-artifact-guard.test.mjs`

**Example:** implements Example 3

**Interfaces:**
- Produces: `scanForForbiddenRetainedArtifacts({ root, allowPatterns = [] })`.
- Produces: `assertNoForbiddenRetainedArtifacts({ root })`.
- For V0, forbidden extensions: `.sqlite`, `.sqlite3`, `.db`.

- [ ] **Step 1: Write failing guard tests**

Create `test/core/retained-artifact-guard.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertNoForbiddenRetainedArtifacts, scanForForbiddenRetainedArtifacts } from '../../src/core/retained-artifact-guard.mjs';

describe('retained artifact guard', () => {
  it('passes JSON-only corpus output', async () => {
    const root = mkdtempSync(join(tmpdir(), 'retained-guard-json-'));
    try {
      writeFileSync(join(root, 'session-corpus-export.json'), '{}\n', 'utf8');
      writeFileSync(join(root, 'session-corpus-export-manifest.json'), '{}\n', 'utf8');
      const result = await scanForForbiddenRetainedArtifacts({ root });
      assert.deepEqual(result.forbidden, []);
      assert.equal(result.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when a retained sqlite snapshot is present', async () => {
    const root = mkdtempSync(join(tmpdir(), 'retained-guard-sqlite-'));
    try {
      mkdirSync(join(root, 'corpus'), { recursive: true });
      writeFileSync(join(root, 'corpus/opencode-session-corpus-source.sqlite'), 'sqlite bytes', 'utf8');
      const result = await scanForForbiddenRetainedArtifacts({ root });
      assert.equal(result.status, 'fail');
      assert.equal(result.forbidden.length, 1);
      assert.match(result.forbidden[0].path, /opencode-session-corpus-source\.sqlite$/);
      assert.equal(result.forbidden[0].reason, 'retained-sqlite-artifact');
      await assert.rejects(() => assertNoForbiddenRetainedArtifacts({ root }), /retained-sqlite-artifact/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run guard tests and verify failure**

Run:

```bash
node --test test/core/retained-artifact-guard.test.mjs
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement guard**

Create `src/core/retained-artifact-guard.mjs`:

```js
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const FORBIDDEN_DB_RE = /\.(?:sqlite|sqlite3|db)$/i;

async function walk(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

export async function scanForForbiddenRetainedArtifacts({ root, allowPatterns = [] }) {
  const allow = allowPatterns.map((pattern) => new RegExp(pattern));
  const files = await walk(root);
  const forbidden = files
    .filter((path) => FORBIDDEN_DB_RE.test(path))
    .filter((path) => !allow.some((pattern) => pattern.test(path)))
    .map((path) => ({ path, reason: 'retained-sqlite-artifact' }));
  return { status: forbidden.length > 0 ? 'fail' : 'pass', forbidden };
}

export async function assertNoForbiddenRetainedArtifacts({ root }) {
  const result = await scanForForbiddenRetainedArtifacts({ root });
  if (result.status !== 'pass') {
    const first = result.forbidden[0];
    throw new Error(`${first.reason}: ${first.path}`);
  }
  return result;
}
```

- [ ] **Step 4: Run guard tests**

Run:

```bash
node --test test/core/retained-artifact-guard.test.mjs
```

Expected: PASS.

---

### Task 4: Wire Guard Into Release/Product Eval Outputs

**Files:**
- Modify: `scripts/context-tree/run-product-release-readiness-eval.mjs`
- Modify if applicable: `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs`
- Modify tests: `test/cli/run-product-release-readiness-eval-cli.test.mjs`, `test/cli/run-three-runtime-buddy-surface-release-eval-cli.test.mjs` if present/needed

**Example:** implements Example 3

**Interfaces:**
- Adds report gate: `retainedArtifactGuard: { status, forbidden }`.
- Aggregate cannot be `pass` when guard status is `fail`.

- [ ] **Step 1: Add release negative-control test**

In the release readiness CLI test, add a temp output/product root containing a fake raw DB file and assert non-pass:

```js
it('blocks release readiness when retained raw sqlite artifacts exist', () => {
  const root = mkdtempSync(join(tmpdir(), 'release-guard-sqlite-'));
  try {
    const productRoot = join(root, 'product');
    mkdirSync(join(productRoot, 'corpus'), { recursive: true });
    writeFileSync(join(productRoot, 'corpus/opencode-session-corpus-source.sqlite'), 'sqlite bytes', 'utf8');
    const out = join(root, 'out');
    const result = runReleaseReadiness(['--product-root', productRoot, '--out', out]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(readFileSync(join(out, 'product-release-readiness-report.json'), 'utf8'));
    assert.equal(report.gates.retainedArtifactGuard.status, 'fail');
    assert.notEqual(report.verdict, 'pass');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

Adapt `runReleaseReadiness()` and output report path to the existing test helper/schema. Keep the assertion that retained DB causes non-pass.

- [ ] **Step 2: Run release test and verify failure**

Run:

```bash
node --test test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: FAIL until the guard is wired.

- [ ] **Step 3: Wire guard into report**

In `scripts/context-tree/run-product-release-readiness-eval.mjs`, import:

```js
import { scanForForbiddenRetainedArtifacts } from '../../src/core/retained-artifact-guard.mjs';
```

When a product root, release root, or output root is available, run:

```js
const retainedArtifactGuard = await scanForForbiddenRetainedArtifacts({ root: productRootOrReleaseRoot });
report.gates.retainedArtifactGuard = retainedArtifactGuard;
if (retainedArtifactGuard.status !== 'pass') {
  report.verdict = report.verdict === 'fail' ? 'fail' : 'blocked';
}
```

If the script can inspect multiple roots, scan all retained roots and merge `forbidden` arrays. The gate passes only when every scanned root passes.

- [ ] **Step 4: Run release tests**

Run:

```bash
node --test test/core/retained-artifact-guard.test.mjs test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: PASS.

---

### Task 5: Final Cleanup, Existing Large Artifacts, And Verification Loop

**Files:**
- Modify if needed: docs/runbooks that mention `opencode-session-corpus-source.sqlite` as retained output
- Do not delete user files automatically from tests or product code

**Example:** observes Examples 1-3; preserves all invariants

**Interfaces:**
- Produces no retained SQLite snapshots in new runs.
- Provides manual cleanup guidance for existing 22G snapshots.

**Completion record (2026-07-14):**

- Retained-snapshot reference scan was rerun. Remaining matches were limited to:
  - negative-control tests,
  - this plan document,
  - historical/non-product docs,
  - and two stale retained snapshots under `.context-tree/release/...`.
- Focused bundle passed:

```bash
node --test \
  test/cli/export-opencode-session-corpus-cli.test.mjs \
  test/core/opencode-session-corpus-export.test.mjs \
  test/core/retained-artifact-guard.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs
```

- Real export against the live local OpenCode DB succeeded under `/tmp/evobuddy-opencode-corpus-no-snapshot-kmboa3_d` using a bounded session window (`--max-root-sessions 2 --max-subagent-sessions 2`) because the full local DB exceeded the exporter's SQLite JSON buffer in one unbounded run. The retained-artifact invariant still held on the real DB export:
  - `dbFiles: []`
  - largest output files were `session-corpus-export.json` and `session-corpus-export-manifest.json`
- Existing stale retained snapshots were quarantined to `/tmp/evobuddy-retained-sqlite-quarantine/`:
  - `opencode-natural-probe-clean.sqlite`
  - `opencode-natural-probe-native-spawn-wording.sqlite`
- Full verification passed:

```bash
npm test
git diff --check
```

- [ ] **Step 1: Find remaining retained snapshot references**

Run:

```bash
grep -R "opencode-session-corpus-source.sqlite\|dbSnapshotPath\|retain.*sqlite\|retain.*snapshot" -n scripts src test docs package.json
```

Expected after implementation:

- No product code writes `opencode-session-corpus-source.sqlite` under output roots.
- Tests may mention it only as a negative-control forbidden artifact.
- Docs must not describe retained SQLite snapshots as normal output.

- [ ] **Step 2: Run focused bundle**

Run:

```bash
node --test \
  test/cli/export-opencode-session-corpus-cli.test.mjs \
  test/core/opencode-session-corpus-export.test.mjs \
  test/core/retained-artifact-guard.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run a real export into `/tmp` and inspect size/contents**

Run with the real OpenCode DB only if available:

```bash
ROOT="$(mktemp -d /tmp/evobuddy-opencode-corpus-no-snapshot.XXXXXX)"
npm run context-tree:export-opencode-session-corpus -- \
  --db "$HOME/.local/share/opencode/opencode.db" \
  --project-identity /home/prosumer/agent/context-tree \
  --out "$ROOT/corpus"
find "$ROOT" -type f \( -name "*.sqlite" -o -name "*.sqlite3" -o -name "*.db" \) -print
find "$ROOT" -type f -maxdepth 3 -printf "%s %p\n" | sort -nr | head
```

Expected:

- The `find ... *.sqlite/*.db` command prints nothing.
- Largest files are JSON/manifest, not 22G database copies.

- [ ] **Step 4: Manual cleanup guidance for existing bloated snapshots**

After verifying the fix, manually remove or quarantine existing bad artifacts. Do not automate deletion in product code.

```bash
mkdir -p /tmp/evobuddy-retained-sqlite-quarantine
mv /home/prosumer/agent/context-tree/.context-tree/release/opencode-natural-probe-clean/corpus/opencode-session-corpus-source.sqlite /tmp/evobuddy-retained-sqlite-quarantine/opencode-natural-probe-clean.sqlite
mv /home/prosumer/agent/context-tree/.context-tree/release/opencode-natural-probe-native-spawn-wording/corpus/opencode-session-corpus-source.sqlite /tmp/evobuddy-retained-sqlite-quarantine/opencode-natural-probe-native-spawn-wording.sqlite
```

If the user approves deletion instead of quarantine, use `rm -f` on those exact two files. Do not delete broader directories.

- [ ] **Step 5: Full verification**

Run:

```bash
npm test
git diff --check
```

Expected: PASS and clean diff check.

- [ ] **Step 6: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, file path, size output, manifest source block, or exact error.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not add `--retain-db-snapshot` or allow retained raw DB artifacts to pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS, or the same honest blocking result with retained evidence.
7. Compare the new evidence to the original failing evidence. If retained SQLite files still appear in output roots, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

---

## Self-Review Notes

- Spec coverage: addresses the immediate 43G growth root cause, removes retained full DB snapshots, preserves optional temporary consistency snapshot without retained export, adds guard against future release/product raw DB artifacts, and includes manual cleanup guidance.
- Example verification: examples cover default export, temporary snapshot deletion, and release guard negative control.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: guard returns `{ status, forbidden }`; release gate uses `retainedArtifactGuard`.
- Architecture ownership: session corpus exporter owns selected evidence extraction, not runtime DB archival; release guard owns artifact safety, not session semantics.

## Inline Plan Review

**Status:** Approved.

**Issues found:** None blocking. The important architectural decision is explicit: no retained full SQLite snapshot path and no opt-in retained snapshot option.
