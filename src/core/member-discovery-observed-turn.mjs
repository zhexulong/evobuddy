import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function resolveUnderRoot(root, ref, label) {
  const cleanRef = cleanString(ref);
  if (!cleanRef) throw new Error(`${label} is required`);
  if (cleanRef.startsWith('/') || cleanRef.includes('\0')) throw new Error(`${label} must be a relative path under root`);
  const resolvedRoot = resolve(root);
  const resolved = resolve(resolvedRoot, cleanRef);
  if (!(resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}/`))) throw new Error(`${label} must resolve under root`);
  return resolved;
}

function runtimeSourceIssue(source, expectedProjectIdentity, expectedSessionExportRef) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return 'observed turn requires runtime source provenance';
  if (!/runtime-observer|exporter|opencode-parent-turn/i.test(cleanString(source.captureKind) ?? '')) return 'observed turn source.captureKind must be a runtime observer/exporter';
  for (const field of ['sourceThreadId', 'parentTurnId', 'sessionPartId', 'sessionExportRef']) {
    if (!cleanString(source[field])) return `observed turn source.${field} is required`;
  }
  if (cleanString(expectedProjectIdentity) && source.observedProjectIdentity !== expectedProjectIdentity) return 'observed turn project identity mismatch';
  if (cleanString(expectedSessionExportRef) && source.sessionExportRef !== expectedSessionExportRef) return 'observed turn source.sessionExportRef must match DB/exporter evidence';
  return null;
}

export function createObservedParentAgentTurn({ phase, requestRef, requestText, answerRef, answerText, answerCaptureKind, source, projectIdentity, observedAt } = {}) {
  const cleanPhase = cleanString(phase);
  const cleanRequestRef = cleanString(requestRef);
  const cleanAnswerRef = cleanString(answerRef);
  if (!['gate', 'extractor'].includes(cleanPhase)) throw new Error('observed parent-agent turn phase must be gate or extractor');
  if (!cleanRequestRef) throw new Error('observed parent-agent turn requires requestRef');
  if (!cleanAnswerRef) throw new Error('observed parent-agent turn requires answerRef');
  if (typeof requestText !== 'string') throw new Error('observed parent-agent turn requires requestText');
  if (typeof answerText !== 'string') throw new Error('observed parent-agent turn requires answerText');
  return {
    kind: 'observed-parent-agent-turn',
    phase: cleanPhase,
    requestRef: cleanRequestRef,
    requestDigest: sha256Text(requestText),
    answerRef: cleanAnswerRef,
    answerDigest: sha256Text(answerText),
    answer: answerText.trim(),
    ...(cleanString(answerCaptureKind) ? { answerCaptureKind: cleanString(answerCaptureKind) } : {}),
    source: source && typeof source === 'object' && !Array.isArray(source) ? { ...source, ...(cleanString(projectIdentity) && !source.observedProjectIdentity ? { observedProjectIdentity: cleanString(projectIdentity) } : {}) } : { runtime: 'unknown' },
    observedAt: cleanString(observedAt) ?? new Date().toISOString(),
  };
}

export async function validateObservedParentAgentTurn({ root, turnRef, expectedPhase, expectedRequestRef, expectedAnswerRef, expectedProjectIdentity, expectedSessionExportRef } = {}) {
  const cleanRoot = resolve(cleanString(root) ?? '.');
  const cleanTurnRef = cleanString(turnRef);
  if (!cleanTurnRef) return { status: 'fail', reason: 'observed turn ref is required' };
  let turnRaw;
  let turn;
  try {
    turnRaw = await readFile(resolveUnderRoot(cleanRoot, cleanTurnRef, 'observed turn ref'), 'utf8');
    turn = JSON.parse(turnRaw);
  } catch (error) {
    return { status: 'fail', reason: `observed turn artifact must resolve to JSON: ${error.message}` };
  }
  if (turn?.kind !== 'observed-parent-agent-turn') return { status: 'fail', reason: 'observed turn kind must be observed-parent-agent-turn' };
  if (turn.phase !== expectedPhase) return { status: 'fail', reason: `observed turn phase must be ${expectedPhase}` };
  if (turn.requestRef !== expectedRequestRef) return { status: 'fail', reason: 'observed turn requestRef mismatch' };
  if (turn.answerRef !== expectedAnswerRef) return { status: 'fail', reason: 'observed turn answerRef mismatch' };
  const sourceIssue = runtimeSourceIssue(turn.source, expectedProjectIdentity, expectedSessionExportRef);
  if (sourceIssue) return { status: 'fail', reason: sourceIssue };
  let requestText;
  let answerText;
  try {
    requestText = await readFile(resolveUnderRoot(cleanRoot, turn.requestRef, 'observed turn requestRef'), 'utf8');
    answerText = await readFile(resolveUnderRoot(cleanRoot, turn.answerRef, 'observed turn answerRef'), 'utf8');
  } catch (error) {
    return { status: 'fail', reason: `observed turn request and answer refs must resolve: ${error.message}` };
  }
  if (turn.requestDigest !== sha256Text(requestText)) return { status: 'fail', reason: 'observed turn requestDigest mismatch' };
  if (turn.answerDigest !== sha256Text(answerText)) return { status: 'fail', reason: 'observed turn answerDigest mismatch' };
  if (turn.answer !== answerText.trim()) return { status: 'fail', reason: 'observed turn answer must match retained answer bytes' };
  return { status: 'pass', digest: sha256Text(turnRaw), turn };
}
