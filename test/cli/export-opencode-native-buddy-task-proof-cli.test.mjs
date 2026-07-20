import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXPORT_CORPUS_CLI = join(REPO_ROOT, 'scripts/context-tree/export-opencode-session-corpus.mjs');
const EXPORT_PROOF_CLI = join(REPO_ROOT, 'scripts/context-tree/export-opencode-native-buddy-task-proof.mjs');
const PACKET_DIGEST = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';

function runNode(script, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function runSqlite(dbPath, statements) {
  const result = spawnSync('sqlite3', [dbPath], { input: statements, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function makeDb(root, {
  projectIdentity = root,
  childParentId = 'ses-parent',
  childTitle = 'Child task',
  childAgent = 'member-bootstrap-curator',
  parentUserText = 'Please review native Buddy execution boundaries.',
  recentParentUserText,
  childPromptText = `Context Tree Buddy: member-bootstrap-curator\nInvocation packet digest: ${PACKET_DIGEST}\nReview the implementation plan.`,
  includeParentResultReturn = true,
  includeOnlyAdapterParentCall = false,
} = {}) {
  const dbPath = join(root, 'opencode.db');
  runSqlite(dbPath, `
    create table session (id text primary key, project_id text not null, parent_id text, slug text not null, directory text not null, title text not null, agent text, version text not null, time_created integer not null, time_updated integer not null, metadata text);
    create table message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    create table part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);

    insert into session values ('ses-parent','project-a',null,'parent','${projectIdentity}','Parent session','build','1.2.0',1783600000000,1783600005000,null);
    insert into session values ('ses-child','project-a','${childParentId}','child','${projectIdentity}','${childTitle}','${childAgent}','1.2.0',1783600002000,1783600007000,null);

    insert into message values ('msg-parent-user','ses-parent',1783600000100,1783600000100,'{"role":"user","time":{"created":1783600000100}}');
    insert into message values ('msg-parent-assistant-before','ses-parent',1783600000200,1783600000200,'{"role":"assistant","time":{"created":1783600000200}}');
    ${recentParentUserText ? "insert into message values ('msg-parent-user-recent','ses-parent',1783600002000,1783600002000,'{\"role\":\"user\",\"time\":{\"created\":1783600002000}}');" : ''}
    insert into message values ('msg-child-user','ses-child',1783600002100,1783600002100,'{"role":"user","time":{"created":1783600002100}}');
    insert into message values ('msg-child-assistant','ses-child',1783600002200,1783600002200,'{"role":"assistant","time":{"created":1783600002200}}');
    ${includeParentResultReturn || includeOnlyAdapterParentCall ? "insert into message values ('msg-parent-result','ses-parent',1783600008000,1783600008000,'{\"role\":\"assistant\",\"time\":{\"created\":1783600008000}}');" : ''}

    insert into part values ('prt-parent-user','msg-parent-user','ses-parent',1783600000100,1783600000100,'{"type":"text","text":${JSON.stringify(parentUserText)}}');
    insert into part values ('prt-parent-assistant-before','msg-parent-assistant-before','ses-parent',1783600000200,1783600000200,'{"type":"text","text":"Creating a native child task now."}');
    ${recentParentUserText ? `insert into part values ('prt-parent-user-recent','msg-parent-user-recent','ses-parent',1783600002000,1783600002000,'{"type":"text","text":${JSON.stringify(recentParentUserText)}}');` : ''}
    insert into part values ('prt-child-prompt','msg-child-user','ses-child',1783600002100,1783600002100,'{"type":"text","text":${JSON.stringify(childPromptText)}}');
    insert into part values ('prt-child-answer','msg-child-assistant','ses-child',1783600002200,1783600002200,'{"type":"text","text":"The native proof boundary looks correct."}');
    ${includeParentResultReturn ? "insert into part values ('prt-parent-result','msg-parent-result','ses-parent',1783600008000,1783600008000,'{\"type\":\"tool\",\"toolName\":\"task\",\"state\":{\"output\":\"Child result returned to parent\"},\"text\":\"Child result returned to parent\"}');" : ''}
    ${includeOnlyAdapterParentCall ? "insert into part values ('prt-parent-adapter','msg-parent-result','ses-parent',1783600008000,1783600008000,'{\"type\":\"text\",\"text\":\"Run npm run context-tree:invoke-buddy for native proof fallback.\"}');" : ''}
  `);
  return dbPath;
}

function exportCapabilityRoot({ dbPath, projectIdentity, outDir }) {
  const corpusResult = runNode(EXPORT_CORPUS_CLI, ['--db', dbPath, '--project-identity', projectIdentity, '--out', outDir]);
  assert.equal(corpusResult.status, 0, corpusResult.stderr || corpusResult.stdout);
  writeJson(join(outDir, 'opencode-native-buddy-task-capability-report.json'), {
    status: 'pass',
    capability: 'opencode-native-task-child-session-observable',
    observedSignals: {
      childSessionParentId: true,
      childPromptLineage: true,
      parentResultReturnCandidate: true,
      exporterDbDigest: true,
    },
  });
}

function writePreparedRoot(outDir) {
  mkdirSync(outDir, { recursive: true });
  writeJson(join(outDir, 'opencode-native-buddy-task-preparation.json'), {
    kind: 'opencode-native-buddy-task-preparation',
    buddyName: 'member-bootstrap-curator',
    projectIdentity: '/tmp/placeholder',
    invocationPacketDigest: PACKET_DIGEST,
    status: 'prepared',
    executionProof: 'not-run',
    nativeSubagent: false,
    message: 'Prepared native OpenCode task prompt only; product proof requires observed child session evidence.',
  });
}

describe('export-opencode-native-buddy-task-proof CLI', () => {
  it('writes proof and summary artifacts from prepared and capability roots', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-export-native-buddy-proof-'));
    try {
      const projectIdentity = join(root, 'project');
      const capabilityRoot = join(root, 'capability');
      const preparedRoot = join(root, 'prepared');
      const outPath = join(root, 'native-proof', 'opencode-native-buddy-task-proof.json');
      const runtimeNativeOutPath = join(root, 'native-proof', 'runtime-native-buddy-surface-proof.json');

      mkdirSync(projectIdentity, { recursive: true });
      const dbPath = makeDb(root, { projectIdentity });
      exportCapabilityRoot({ dbPath, projectIdentity, outDir: capabilityRoot });
      writePreparedRoot(preparedRoot);
      writeJson(join(projectIdentity, 'context-tree-subagent-baseline-install-report.json'), {
        reportKind: 'context-tree-subagent-baseline-install-report',
        projectionOnly: true,
        members: [{
          memberName: 'member-bootstrap-curator',
          runtimeAgentName: 'member-bootstrap-curator',
          baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          runtimeFile: {
            path: '.opencode/agents/member-bootstrap-curator.md',
            digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        }],
      });

      const result = runNode(EXPORT_PROOF_CLI, [
        '--capability-root', capabilityRoot,
        '--prepared-root', preparedRoot,
        '--project-identity', projectIdentity,
        '--buddy-name', 'member-bootstrap-curator',
        '--out', outPath,
        '--runtime-native-out', runtimeNativeOutPath,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(existsSync(outPath), true);
      assert.equal(existsSync(runtimeNativeOutPath), true);
      assert.equal(existsSync(join(dirname(outPath), 'opencode-native-buddy-task-proof-summary.json')), true);
      assert.equal(existsSync(join(dirname(runtimeNativeOutPath), 'runtime-native-buddy-surface-proof-summary.json')), true);

      const proof = readJson(outPath);
      const runtimeNativeProof = readJson(runtimeNativeOutPath);
      const summary = readJson(join(dirname(outPath), 'opencode-native-buddy-task-proof-summary.json'));
      const runtimeNativeSummary = readJson(join(dirname(runtimeNativeOutPath), 'runtime-native-buddy-surface-proof-summary.json'));
      assert.equal(proof.kind, 'opencode-native-buddy-task-proof');
      assert.equal(proof.runtime, 'opencode');
      assert.equal(proof.buddyName, 'member-bootstrap-curator');
      assert.equal(proof.expectedInputDigest, PACKET_DIGEST);
      assert.equal(proof.parentSessionId, 'ses-parent');
      assert.equal(proof.childSessionId, 'ses-child');
      assert.equal(proof.childParentSessionId, 'ses-parent');
      assert.equal(proof.childPromptLineageKind, 'opencode-task-child-prompt');
      assert.equal(proof.resultReturnedToParent, true);
      assert.equal(proof.resultReturnEvidenceRef, 'opencode-session:ses-parent:msg-parent-result:prt-parent-result');
      assert.match(proof.resultReturnEvidenceDigest, /^sha256:[a-f0-9]{64}$/);
      assert.match(proof.exporterManifestDigest, /^sha256:[a-f0-9]{64}$/);
      assert.match(proof.dbDigest, /^sha256:[a-f0-9]{64}$/);
      assert.equal(runtimeNativeProof.runtime, 'opencode');
      assert.equal(runtimeNativeProof.runtimeSurface, 'opencode-task');
      assert.equal(runtimeNativeProof.negativeControls.projectionOnly, false);
      assert.equal(runtimeNativeProof.negativeControls.adapterOnly, false);
      assert.equal(summary.status, 'pass');
      assert.equal(summary.validationStatus, 'pass');
      assert.equal(runtimeNativeSummary.status, 'pass');
      assert.equal(runtimeNativeSummary.validationStatus, 'pass');
      assert.equal(runtimeNativeSummary.taskProofValidationStatus, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks validation when parent result return is missing instead of inferring from child completion', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-export-native-buddy-proof-blocked-'));
    try {
      const projectIdentity = join(root, 'project');
      const capabilityRoot = join(root, 'capability');
      const preparedRoot = join(root, 'prepared');
      const outPath = join(root, 'native-proof', 'opencode-native-buddy-task-proof.json');

      mkdirSync(projectIdentity, { recursive: true });
      const dbPath = makeDb(root, { projectIdentity, includeParentResultReturn: false });
      exportCapabilityRoot({ dbPath, projectIdentity, outDir: capabilityRoot });
      writePreparedRoot(preparedRoot);

      const result = runNode(EXPORT_PROOF_CLI, [
        '--capability-root', capabilityRoot,
        '--prepared-root', preparedRoot,
        '--project-identity', projectIdentity,
        '--buddy-name', 'member-bootstrap-curator',
        '--out', outPath,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const proof = readJson(outPath);
      const summary = readJson(join(dirname(outPath), 'opencode-native-buddy-task-proof-summary.json'));
      assert.equal(proof.resultReturnedToParent, false);
      assert.equal(summary.status, 'blocked');
      assert.equal(summary.validationStatus, 'blocked');
      assert.match(summary.blockedReasons.join('\n'), /result return/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when the matched child prompt names adapter commands', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-export-native-buddy-proof-adapter-'));
    try {
      const projectIdentity = join(root, 'project');
      const capabilityRoot = join(root, 'capability');
      const preparedRoot = join(root, 'prepared');
      const outPath = join(root, 'native-proof', 'opencode-native-buddy-task-proof.json');

      mkdirSync(projectIdentity, { recursive: true });
      const dbPath = makeDb(root, {
        projectIdentity,
        childPromptText: `Run npm run context-tree:invoke-buddy for ${PACKET_DIGEST}`,
      });
      exportCapabilityRoot({ dbPath, projectIdentity, outDir: capabilityRoot });
      writePreparedRoot(preparedRoot);
      writeJson(join(projectIdentity, 'context-tree-subagent-baseline-install-report.json'), {
        reportKind: 'context-tree-subagent-baseline-install-report',
        projectionOnly: true,
        members: [{
          memberName: 'member-bootstrap-curator',
          runtimeAgentName: 'member-bootstrap-curator',
          baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          runtimeFile: {
            path: '.opencode/agents/member-bootstrap-curator.md',
            digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        }],
      });

      const result = runNode(EXPORT_PROOF_CLI, [
        '--capability-root', capabilityRoot,
        '--prepared-root', preparedRoot,
        '--project-identity', projectIdentity,
        '--buddy-name', 'member-bootstrap-curator',
        '--out', outPath,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr || result.stdout, /adapter command/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('prefers the exported child session agent over a misleading title-derived runtime agent name', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-export-native-buddy-proof-wrong-agent-'));
    try {
      const projectIdentity = join(root, 'project');
      const capabilityRoot = join(root, 'capability');
      const preparedRoot = join(root, 'prepared');
      const outPath = join(root, 'native-proof', 'opencode-native-buddy-task-proof.json');

      mkdirSync(projectIdentity, { recursive: true });
      const dbPath = makeDb(root, {
        projectIdentity,
        childTitle: 'Oracle proof verdict (@oracle subagent)',
      });
      exportCapabilityRoot({ dbPath, projectIdentity, outDir: capabilityRoot });
      writePreparedRoot(preparedRoot);
      writeJson(join(projectIdentity, 'context-tree-subagent-baseline-install-report.json'), {
        reportKind: 'context-tree-subagent-baseline-install-report',
        projectionOnly: true,
        members: [{
          memberName: 'member-bootstrap-curator',
          runtimeAgentName: 'member-bootstrap-curator',
          baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          runtimeFile: {
            path: '.opencode/agents/member-bootstrap-curator.md',
            digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        }],
      });

      const result = runNode(EXPORT_PROOF_CLI, [
        '--capability-root', capabilityRoot,
        '--prepared-root', preparedRoot,
        '--project-identity', projectIdentity,
        '--buddy-name', 'member-bootstrap-curator',
        '--out', outPath,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const proof = readJson(outPath);
      const summary = readJson(join(dirname(outPath), 'opencode-native-buddy-task-proof-summary.json'));
      assert.equal(proof.observedRuntimeAgentName, 'member-bootstrap-curator');
      assert.equal(summary.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes an honest failing runtime-native proof when the observed child session belongs to a different runtime agent', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-export-native-buddy-proof-honest-fail-'));
    try {
      const projectIdentity = join(root, 'project');
      const capabilityRoot = join(root, 'capability');
      const preparedRoot = join(root, 'prepared');
      const outPath = join(root, 'native-proof', 'opencode-native-buddy-task-proof.json');
      const runtimeNativeOutPath = join(root, 'native-proof', 'runtime-native-buddy-surface-proof.json');

      mkdirSync(projectIdentity, { recursive: true });
      const dbPath = makeDb(root, {
        projectIdentity,
        childTitle: 'Oracle proof verdict (@oracle subagent)',
      });
      exportCapabilityRoot({ dbPath, projectIdentity, outDir: capabilityRoot });
      writePreparedRoot(preparedRoot);
      writeJson(join(projectIdentity, 'context-tree-subagent-baseline-install-report.json'), {
        reportKind: 'context-tree-subagent-baseline-install-report',
        projectionOnly: true,
        members: [{
          memberName: 'member-bootstrap-curator',
          runtimeAgentName: 'member-bootstrap-curator',
          baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          runtimeFile: {
            path: '.opencode/agents/member-bootstrap-curator.md',
            digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        }],
      });

      const result = runNode(EXPORT_PROOF_CLI, [
        '--capability-root', capabilityRoot,
        '--prepared-root', preparedRoot,
        '--project-identity', projectIdentity,
        '--buddy-name', 'member-bootstrap-curator',
        '--out', outPath,
        '--runtime-native-out', runtimeNativeOutPath,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const runtimeNativeProof = readJson(runtimeNativeOutPath);
      assert.equal(runtimeNativeProof.runtimeEvidence.observedRuntimeAgentName, 'member-bootstrap-curator');
      assert.equal(runtimeNativeProof.runtimeAgentName, 'member-bootstrap-curator');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when parent result-return parts are not observable and only adapter-parent text exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-export-native-buddy-proof-unobservable-'));
    try {
      const projectIdentity = join(root, 'project');
      const capabilityRoot = join(root, 'capability');
      const preparedRoot = join(root, 'prepared');
      const outPath = join(root, 'native-proof', 'opencode-native-buddy-task-proof.json');

      mkdirSync(projectIdentity, { recursive: true });
      const dbPath = makeDb(root, { projectIdentity, includeParentResultReturn: false, includeOnlyAdapterParentCall: true });
      exportCapabilityRoot({ dbPath, projectIdentity, outDir: capabilityRoot });
      writeJson(join(capabilityRoot, 'opencode-native-buddy-task-capability-report.json'), {
        status: 'blocked',
        capability: 'opencode-native-task-child-session-observable',
        observedSignals: {
          childSessionParentId: true,
          childPromptLineage: true,
          parentResultReturnCandidate: false,
          exporterDbDigest: true,
        },
        blockedReasons: ['parent-result-return-not-observable'],
      });
      writePreparedRoot(preparedRoot);

      const result = runNode(EXPORT_PROOF_CLI, [
        '--capability-root', capabilityRoot,
        '--prepared-root', preparedRoot,
        '--project-identity', projectIdentity,
        '--buddy-name', 'member-bootstrap-curator',
        '--out', outPath,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = readJson(join(dirname(outPath), 'opencode-native-buddy-task-proof-summary.json'));
      assert.equal(summary.status, 'blocked');
      assert.match(summary.blockedReasons.join('\n'), /parent-result-return-not-observable/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes a naturalUse runtime-native proof when --proof-layer naturalUse is requested', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-export-native-buddy-proof-natural-'));
    try {
      const projectIdentity = join(root, 'project');
      const capabilityRoot = join(root, 'capability');
      const preparedRoot = join(root, 'prepared');
      const outPath = join(root, 'native-proof', 'opencode-native-buddy-task-proof.json');
      const runtimeNativeOutPath = join(root, 'native-proof', 'runtime-native-buddy-surface-proof.json');

      mkdirSync(projectIdentity, { recursive: true });
      const dbPath = makeDb(root, { projectIdentity });
      exportCapabilityRoot({ dbPath, projectIdentity, outDir: capabilityRoot });
      writePreparedRoot(preparedRoot);
      writeJson(join(projectIdentity, 'context-tree-subagent-baseline-install-report.json'), {
        reportKind: 'context-tree-subagent-baseline-install-report',
        projectionOnly: true,
        members: [{
          memberName: 'member-bootstrap-curator',
          runtimeAgentName: 'member-bootstrap-curator',
          baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          runtimeFile: {
            path: '.opencode/agents/member-bootstrap-curator.md',
            digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        }],
      });

      const result = runNode(EXPORT_PROOF_CLI, [
        '--capability-root', capabilityRoot,
        '--prepared-root', preparedRoot,
        '--project-identity', projectIdentity,
        '--buddy-name', 'member-bootstrap-curator',
        '--out', outPath,
        '--runtime-native-out', runtimeNativeOutPath,
        '--proof-layer', 'naturalUse',
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const runtimeNativeProof = readJson(runtimeNativeOutPath);
      assert.equal(runtimeNativeProof.proofLayer, 'naturalUse');
      assert.equal(runtimeNativeProof.naturalUsePass, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes a naturalUse proof without prepared packet text when the routed child agent matches and prompts stay mechanism-clean', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-export-native-buddy-proof-natural-route-'));
    try {
      const projectIdentity = join(root, 'project');
      const capabilityRoot = join(root, 'capability');
      const preparedRoot = join(root, 'prepared');
      const outPath = join(root, 'native-proof', 'opencode-native-buddy-task-proof.json');
      const runtimeNativeOutPath = join(root, 'native-proof', 'runtime-native-buddy-surface-proof.json');

      mkdirSync(projectIdentity, { recursive: true });
      const dbPath = makeDb(root, {
        projectIdentity,
        childTitle: 'Review skill design (@member-bootstrap-curator subagent)',
        childAgent: 'member-bootstrap-curator',
        parentUserText: 'Earlier context mentioned subagent-driven proof work, but it is not the request that spawned this child.',
        recentParentUserText: 'Review the skill wording and return the result in this conversation.',
        childPromptText: 'Review the skill wording against runtime standards and return findings with file references.',
      });
      exportCapabilityRoot({ dbPath, projectIdentity, outDir: capabilityRoot });
      writePreparedRoot(preparedRoot);
      writeJson(join(projectIdentity, 'context-tree-subagent-baseline-install-report.json'), {
        reportKind: 'context-tree-subagent-baseline-install-report',
        projectionOnly: true,
        members: [{
          memberName: 'member-bootstrap-curator',
          runtimeAgentName: 'member-bootstrap-curator',
          baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          runtimeFile: {
            path: '.opencode/agents/member-bootstrap-curator.md',
            digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        }],
      });

      const result = runNode(EXPORT_PROOF_CLI, [
        '--capability-root', capabilityRoot,
        '--prepared-root', preparedRoot,
        '--project-identity', projectIdentity,
        '--buddy-name', 'member-bootstrap-curator',
        '--out', outPath,
        '--runtime-native-out', runtimeNativeOutPath,
        '--proof-layer', 'naturalUse',
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const proof = readJson(outPath);
      const runtimeNativeProof = readJson(runtimeNativeOutPath);
      assert.equal(proof.preparedPacketDigestRequired, false);
      assert.equal(proof.observedRuntimeAgentName, 'member-bootstrap-curator');
      assert.equal(proof.parentPromptText, 'Review the skill wording and return the result in this conversation.');
      assert.equal(runtimeNativeProof.proofLayer, 'naturalUse');
      assert.equal(runtimeNativeProof.naturalUsePass, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails naturalUse export when the parent prompt names mechanisms instead of staying natural', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-export-native-buddy-proof-natural-parent-mechanism-'));
    try {
      const projectIdentity = join(root, 'project');
      const capabilityRoot = join(root, 'capability');
      const preparedRoot = join(root, 'prepared');
      const outPath = join(root, 'native-proof', 'opencode-native-buddy-task-proof.json');
      const runtimeNativeOutPath = join(root, 'native-proof', 'runtime-native-buddy-surface-proof.json');

      mkdirSync(projectIdentity, { recursive: true });
      const dbPath = makeDb(root, {
        projectIdentity,
        childTitle: 'Review skill design (@member-bootstrap-curator subagent)',
        childAgent: 'member-bootstrap-curator',
        parentUserText: 'Use the subagent and return proof for this review.',
        childPromptText: 'Review the skill wording against runtime standards and return findings with file references.',
      });
      exportCapabilityRoot({ dbPath, projectIdentity, outDir: capabilityRoot });
      writePreparedRoot(preparedRoot);

      writeJson(join(projectIdentity, 'context-tree-subagent-baseline-install-report.json'), {
        reportKind: 'context-tree-subagent-baseline-install-report',
        projectionOnly: true,
        members: [{
          memberName: 'member-bootstrap-curator',
          runtimeAgentName: 'member-bootstrap-curator',
          baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          runtimeFile: {
            path: '.opencode/agents/member-bootstrap-curator.md',
            digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        }],
      });

      const result = runNode(EXPORT_PROOF_CLI, [
        '--capability-root', capabilityRoot,
        '--prepared-root', preparedRoot,
        '--project-identity', projectIdentity,
        '--buddy-name', 'member-bootstrap-curator',
        '--out', outPath,
        '--runtime-native-out', runtimeNativeOutPath,
        '--proof-layer', 'naturalUse',
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = readJson(join(dirname(outPath), 'opencode-native-buddy-task-proof-summary.json'));
      const runtimeNativeSummary = readJson(join(dirname(runtimeNativeOutPath), 'runtime-native-buddy-surface-proof-summary.json'));
      assert.equal(summary.status, 'fail');
      assert.match(summary.failedReasons.join('\n'), /parentPromptText.*mechanism-clean/i);
      assert.equal(runtimeNativeSummary.status, 'fail');
      assert.equal(runtimeNativeSummary.taskProofValidationStatus, 'fail');
      assert.match(runtimeNativeSummary.failedReasons.join('\n'), /parentPromptText.*mechanism-clean/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails naturalUse export when the observed child agent is oracle instead of the requested buddy', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-export-native-buddy-proof-natural-wrong-agent-'));
    try {
      const projectIdentity = join(root, 'project');
      const capabilityRoot = join(root, 'capability');
      const preparedRoot = join(root, 'prepared');
      const outPath = join(root, 'native-proof', 'opencode-native-buddy-task-proof.json');

      mkdirSync(projectIdentity, { recursive: true });
      const dbPath = makeDb(root, {
        projectIdentity,
        childTitle: 'Oracle review (@oracle subagent)',
        childAgent: 'oracle',
        parentUserText: 'Review the skill wording and return the result in this conversation.',
        childPromptText: 'Review the skill wording against runtime standards and return findings with file references.',
      });
      exportCapabilityRoot({ dbPath, projectIdentity, outDir: capabilityRoot });
      writePreparedRoot(preparedRoot);

      const result = runNode(EXPORT_PROOF_CLI, [
        '--capability-root', capabilityRoot,
        '--prepared-root', preparedRoot,
        '--project-identity', projectIdentity,
        '--buddy-name', 'member-bootstrap-curator',
        '--out', outPath,
        '--proof-layer', 'naturalUse',
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = readJson(join(dirname(outPath), 'opencode-native-buddy-task-proof-summary.json'));
      assert.equal(summary.status, 'fail');
      assert.match(summary.failedReasons.join('\n'), /observedRuntimeAgentName/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts an explicit baseline report path instead of assuming the current project report matches the retained runtime evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-export-native-buddy-proof-explicit-baseline-'));
    try {
      const projectIdentity = join(root, 'project');
      const capabilityRoot = join(root, 'capability');
      const preparedRoot = join(root, 'prepared');
      const retainedBaselineRoot = join(root, 'retained-baseline');
      const outPath = join(root, 'native-proof', 'opencode-native-buddy-task-proof.json');
      const runtimeNativeOutPath = join(root, 'native-proof', 'runtime-native-buddy-surface-proof.json');

      mkdirSync(projectIdentity, { recursive: true });
      mkdirSync(retainedBaselineRoot, { recursive: true });
      const dbPath = makeDb(root, { projectIdentity });
      exportCapabilityRoot({ dbPath, projectIdentity, outDir: capabilityRoot });
      writePreparedRoot(preparedRoot);
      writeJson(join(projectIdentity, 'context-tree-subagent-baseline-install-report.json'), {
        reportKind: 'context-tree-subagent-baseline-install-report',
        projectionOnly: true,
        members: [{
          memberName: 'evolution-buddy',
          runtimeAgentName: 'evolution-buddy',
          baselineDigest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
          runtimeFile: {
            path: '.opencode/agents/evolution-buddy.md',
            digest: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          },
        }],
      });
      writeJson(join(retainedBaselineRoot, 'context-tree-subagent-baseline-install-report.json'), {
        reportKind: 'context-tree-subagent-baseline-install-report',
        projectionOnly: true,
        members: [{
          memberName: 'member-bootstrap-curator',
          runtimeAgentName: 'member-bootstrap-curator',
          baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          runtimeFile: {
            path: '.opencode/agents/member-bootstrap-curator.md',
            digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        }],
      });

      const result = runNode(EXPORT_PROOF_CLI, [
        '--capability-root', capabilityRoot,
        '--prepared-root', preparedRoot,
        '--project-identity', projectIdentity,
        '--baseline-report', join(retainedBaselineRoot, 'context-tree-subagent-baseline-install-report.json'),
        '--buddy-name', 'member-bootstrap-curator',
        '--out', outPath,
        '--runtime-native-out', runtimeNativeOutPath,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const runtimeNativeProof = readJson(runtimeNativeOutPath);
      assert.equal(runtimeNativeProof.baselineDigest, 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      assert.match(runtimeNativeProof.baselineDefinitionRef, /retained-baseline\/\.opencode\/agents\/member-bootstrap-curator\.md$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
