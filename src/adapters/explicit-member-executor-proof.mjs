import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const FIXTURE_KIND = 'fixture-isolated-member-executor';
const FIXTURE_BASENAME = 'explicit-member-executor-fixture.mjs';
const METHOD = 'context-tree-explicit-member-executor';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

export function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

export function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

export function validateExecutorSelection({ executorPath, executorAuthority, executorKind }) {
  requireString(executorPath, 'executorPath');
  requireString(executorAuthority, 'executorAuthority');
  requireString(executorKind, 'executorKind');
  if (!['fixture', 'agent-runtime'].includes(executorAuthority)) {
    throw new Error('--executor-authority must be fixture or agent-runtime');
  }
}

export async function runExplicitMemberExecutor({
  executorPath,
  executorInputPath,
  executorOutputPath,
  executorObservationPath,
  executorAuthority = 'fixture',
  parentInvocationPath,
  invocationId,
  executorKind,
}) {
  const startedAt = new Date().toISOString();
  const argv = [
    resolve(executorPath),
    '--input', resolve(executorInputPath),
    '--output', resolve(executorOutputPath),
  ];
  if (executorAuthority === 'fixture') {
    argv.push('--observation', resolve(executorObservationPath));
  } else {
    if (hasResolvableRef(parentInvocationPath)) argv.push('--parent-invocation', resolve(parentInvocationPath));
    if (hasResolvableRef(invocationId)) argv.push('--invocation-id', invocationId);
    if (hasResolvableRef(executorKind)) argv.push('--executor-kind', executorKind);
  }
  const result = spawnSync(process.execPath, argv, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 120000,
  });
  const completedAt = new Date().toISOString();
  if (result.status !== 0) {
    throw new Error(`explicit member executor failed: ${result.stderr || result.stdout}`.trim());
  }
  if (executorAuthority === 'agent-runtime') {
    const executorInput = JSON.parse(await readFile(executorInputPath, 'utf8'));
    const executorOutput = JSON.parse(await readFile(executorOutputPath, 'utf8'));
    await writeFile(executorObservationPath, `${JSON.stringify({
      kind: 'explicit-member-executor-observation',
      authoritySource: 'adapter-observed',
      fixture: false,
      executorKind,
      invocationId,
      parentInvocationRef: resolve(parentInvocationPath),
      inputRef: resolve(executorInputPath),
      outputRef: resolve(executorOutputPath),
      inputDigest: executorInput.inputDigest,
      outputDigest: executorOutput.answerDigest,
      answerDigest: executorOutput.answerDigest,
      startedAt,
      completedAt,
      status: 'completed',
      executionRef: `process:${result.pid ?? 'spawnSync'}`,
      observedAt: completedAt,
    }, null, 2)}\n`, 'utf8');
  }
  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export async function loadExecutorArtifacts({ executorInputPath, executorOutputPath, executorObservationPath }) {
  return {
    executorInput: JSON.parse(await readFile(executorInputPath, 'utf8')),
    executorOutput: JSON.parse(await readFile(executorOutputPath, 'utf8')),
    executorObservation: JSON.parse(await readFile(executorObservationPath, 'utf8')),
  };
}

function nonFixtureKind(kind) {
  return typeof kind === 'string' && kind.trim().length > 0 && kind !== FIXTURE_KIND && kind !== 'fixture';
}

function hasResolvableRef(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function createExecutorProof({
  executorPath,
  executorAuthority,
  executorKind,
  executorInputPath,
  executorOutputPath,
  executorObservationPath,
  executorInput,
  executorOutput,
  executorObservation,
}) {
  requireObject(executorInput, 'executorInput');
  requireObject(executorOutput, 'executorOutput');
  requireObject(executorObservation, 'executorObservation');
  const inputDigest = executorInput.inputDigest ?? sha256Json(executorInput.preparedChildInput ?? executorInput);
  const outputDigest = executorOutput.answerDigest ?? sha256Text(executorOutput.answer ?? '');
  return {
    authority: executorAuthority,
    authoritySource: executorObservation.authoritySource ?? (executorAuthority === 'fixture' ? 'fixture' : 'unverified'),
    fixture: executorObservation.fixture === true,
    kind: executorKind,
    executorKind,
    method: METHOD,
    api: METHOD,
    executorPath: resolve(executorPath),
    outputRef: resolve(executorOutputPath),
    observationRef: resolve(executorObservationPath),
    inputRef: resolve(executorInputPath),
    inputDigest,
    outputDigest,
    observedInputDigest: executorObservation.inputDigest,
    observedOutputDigest: executorObservation.outputDigest,
    answerDigest: outputDigest,
    ...(hasResolvableRef(executorObservation.parentInvocationRef) ? { parentInvocationRef: executorObservation.parentInvocationRef } : {}),
  };
}

export function validateExecutorProofForAuthority({ executorProof, executorPath, executorAuthority, executorKind }) {
  validateExecutorSelection({ executorPath, executorAuthority, executorKind });
  if (executorAuthority === 'fixture' && executorKind !== FIXTURE_KIND) {
    throw new Error('fixture authority cannot be used with a non-fixture kind');
  }
  if (executorAuthority !== 'agent-runtime') return;
  if (executorKind === FIXTURE_KIND) throw new Error('agent-runtime cannot use fixture-isolated-member-executor');
  if (basename(executorPath) === FIXTURE_BASENAME) throw new Error('agent-runtime cannot use fixture executor path');
  if (executorProof.authoritySource !== 'adapter-observed') throw new Error('agent-runtime requires adapter-observed executor proof');
  if (executorProof.fixture !== false) throw new Error('agent-runtime requires fixture=false observation proof');
  if (!nonFixtureKind(executorProof.executorKind)) throw new Error('agent-runtime requires non-fixture executorKind');
  if (!hasResolvableRef(executorProof.observationRef)) throw new Error('agent-runtime requires resolvable observationRef');
  if (!hasResolvableRef(executorProof.parentInvocationRef)) throw new Error('agent-runtime requires resolvable parent invocation ref');
  if (executorProof.inputDigest !== executorProof.observedInputDigest) throw new Error('agent-runtime observation input digest must match executor input digest');
  if (executorProof.outputDigest !== executorProof.observedOutputDigest) throw new Error('agent-runtime observation output digest must match executor output digest');
}

export async function writeExecutorInput(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export const EXPLICIT_MEMBER_EXECUTOR_METHOD = METHOD;
export const FIXTURE_EXECUTOR_KIND = FIXTURE_KIND;
