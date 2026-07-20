#!/usr/bin/env node
import { constants } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { access, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateParentCallRecord } from '../../src/adapters/explicit-member-parent-call-record.mjs';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import { classifyPromptInjection, validateBenchmarkArm, validateScenarioKind } from '../../src/core/evobuddy-benchmark-scenarios.mjs';
import { sha256File } from '../../src/eval/evobuddy-release-grade-provenance.mjs';

const REQUIRED_OBSERVATIONS = Object.freeze([
  'relevantBuddySelected',
  'contextCollected',
  'resultReturnedToParent',
  'parentUsedBuddyResult',
  'verificationPerformed',
  'unnecessaryWorkflowOverheadAvoided',
  'focusedBuddyProductReportPassed',
  'matchingBuddyIdentity',
]);

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} is required`);
  return value;
}

function isSha256Digest(value) {
  return /^sha256:[a-f0-9]{64}$/u.test(String(value ?? ''));
}

function parseJsonFlag(raw, label) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function requireReadableFile(ref, label) {
  const path = resolve(ref);
  try {
    await access(path, constants.R_OK);
    const details = await stat(path);
    if (!details.isFile()) throw new Error(`${label} must resolve to a file`);
    return path;
  } catch (error) {
    if (error instanceof Error && error.message.includes('must resolve to a file')) throw error;
    throw new Error(`${label} must resolve to readable bytes`);
  }
}

async function requireReadableDirectory(ref, label) {
  const path = resolve(ref);
  try {
    await access(path);
    const details = await stat(path);
    if (!details.isDirectory()) throw new Error(`${label} must resolve to a directory`);
    return path;
  } catch (error) {
    if (error instanceof Error && error.message.includes('must resolve to a directory')) throw error;
    throw new Error(`${label} must resolve to a readable directory`);
  }
}

function validateObservations(observations) {
  const value = requireObject(observations, 'observations-json');
  for (const key of REQUIRED_OBSERVATIONS) {
    if (typeof value[key] !== 'boolean') throw new Error(`required observation boolean missing or invalid: ${key}`);
  }
  return Object.fromEntries(REQUIRED_OBSERVATIONS.map((key) => [key, value[key]]));
}

async function loadParentCallRecord(ref) {
  const path = await requireReadableFile(ref, 'parent-call-record-ref');
  const raw = await readFile(path, 'utf8');
  let record;
  try {
    record = JSON.parse(raw);
  } catch (error) {
    throw new Error(`parent-call-record-ref must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  validateParentCallRecord(record);
  const memberName = requireString(record.memberName, 'parent-call-record memberName');
  const projectIdentity = requireString(record.rawCall?.observedProjectIdentity, 'parent-call-record rawCall.observedProjectIdentity');
  const invocationDigest = requireString(record.expectedInputDigest, 'parent-call-record expectedInputDigest');
  return {
    path,
    record,
    refs: {
      buddyName: memberName,
      memberName,
      projectIdentity,
      invocationDigest,
      parentCallRecordDigest: createParentCallRecordDigest(record),
    },
  };
}

async function loadExporterManifest(ref, { trustExporterManifestDigest = false } = {}) {
  const path = await requireReadableFile(ref, 'exporter-manifest-ref');
  const raw = await readFile(path, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    throw new Error(`exporter-manifest-ref must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const source = requireObject(manifest.source, 'exporter manifest source');
  if (source.kind !== 'opencode-sqlite') throw new Error('exporter manifest source.kind must be opencode-sqlite');
  if (!isSha256Digest(source.dbDigest)) throw new Error('exporter manifest source.dbDigest must be a full sha256 digest');
  const dbPath = await requireReadableFile(resolve(dirname(path), requireString(source.dbPath, 'exporter manifest source.dbPath')), 'exporter manifest source.dbPath');
  const dbDigest = trustExporterManifestDigest ? source.dbDigest : await sha256File(dbPath);
  if (!trustExporterManifestDigest && dbDigest !== source.dbDigest) throw new Error('exporter manifest dbDigest mismatch');
  return { path, manifest, dbDigest: source.dbDigest };
}

export function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--scenario-kind') args.scenarioKind = requireValue(argv, index += 1, item);
    else if (item === '--arm') args.arm = requireValue(argv, index += 1, item);
    else if (item === '--prompt-text') args.promptText = requireValue(argv, index += 1, item);
    else if (item === '--host-metadata-json') args.hostMetadataJson = requireValue(argv, index += 1, item);
    else if (item === '--observations-json') args.observationsJson = requireValue(argv, index += 1, item);
    else if (item === '--coverage-summary-json') args.coverageSummaryJson = requireValue(argv, index += 1, item);
    else if (item === '--scenario-coverage-evidence-json') args.scenarioCoverageEvidenceJson = requireValue(argv, index += 1, item);
    else if (item === '--observed-parent-call-ref') args.observedParentCallRef = requireValue(argv, index += 1, item);
    else if (item === '--exporter-manifest-ref') args.exporterManifestRef = requireValue(argv, index += 1, item);
    else if (item === '--parent-call-record-ref') args.parentCallRecordRef = requireValue(argv, index += 1, item);
    else if (item === '--runtime-native-buddy-surface-proof-ref') args.runtimeNativeBuddySurfaceProofRef = requireValue(argv, index += 1, item);
    else if (item === '--trust-exporter-manifest-digest') args.trustExporterManifestDigest = true;
    else if (item === '--focused-buddy-product-report-ref') args.focusedBuddyProductReportRef = requireValue(argv, index += 1, item);
    else if (item === '--finalized-product-root-ref') args.finalizedProductRootRef = requireValue(argv, index += 1, item);
    else if (item === '--parent-visible-result-ref') args.parentVisibleResultRef = requireValue(argv, index += 1, item);
    else if (item === '--out') args.out = requireValue(argv, index += 1, item);
    else throw new Error(`unknown argument: ${item}`);
  }

  for (const [key, flag] of Object.entries({
    scenarioKind: '--scenario-kind',
    arm: '--arm',
    promptText: '--prompt-text',
    hostMetadataJson: '--host-metadata-json',
    observationsJson: '--observations-json',
    coverageSummaryJson: '--coverage-summary-json',
    scenarioCoverageEvidenceJson: '--scenario-coverage-evidence-json',
    exporterManifestRef: '--exporter-manifest-ref',
    focusedBuddyProductReportRef: '--focused-buddy-product-report-ref',
    finalizedProductRootRef: '--finalized-product-root-ref',
    parentVisibleResultRef: '--parent-visible-result-ref',
    out: '--out',
  })) {
    if (!args[key]) throw new Error(`${flag} is required`);
  }
  if (!args.observedParentCallRef) throw new Error('--observed-parent-call-ref is required');
  if (!args.parentCallRecordRef && !args.runtimeNativeBuddySurfaceProofRef) {
    throw new Error('--parent-call-record-ref is required unless --runtime-native-buddy-surface-proof-ref is provided');
  }
  return args;
}

export async function assembleNaturalUseBenchmarkInputCli(argv) {
  const args = parseArgs(argv);
  const scenarioKind = validateScenarioKind(args.scenarioKind);
  const arm = validateBenchmarkArm(args.arm);
  const host = requireObject(parseJsonFlag(args.hostMetadataJson, 'host-metadata-json'), 'host-metadata-json');
  const observations = validateObservations(parseJsonFlag(args.observationsJson, 'observations-json'));
  const coverageSummary = requireObject(parseJsonFlag(args.coverageSummaryJson, 'coverage-summary-json'), 'coverage-summary-json');
  const scenarioCoverageEvidence = requireObject(parseJsonFlag(args.scenarioCoverageEvidenceJson, 'scenario-coverage-evidence-json'), 'scenario-coverage-evidence-json');

  const observedParentCallRef = await requireReadableFile(args.observedParentCallRef, 'observed-parent-call-ref');
  const exporter = await loadExporterManifest(args.exporterManifestRef, {
    trustExporterManifestDigest: args.trustExporterManifestDigest === true,
  });
  const runtimeNativeBuddySurfaceProofRef = args.runtimeNativeBuddySurfaceProofRef ? await requireReadableFile(args.runtimeNativeBuddySurfaceProofRef, 'runtime-native-buddy-surface-proof-ref') : undefined;
  const parentCall = args.parentCallRecordRef ? await loadParentCallRecord(args.parentCallRecordRef) : undefined;
  const focusedBuddyProductReportRef = await requireReadableFile(args.focusedBuddyProductReportRef, 'focused-buddy-product-report-ref');
  const finalizedProductRootRef = await requireReadableDirectory(args.finalizedProductRootRef, 'finalized-product-root-ref');
  const parentVisibleResultRef = runtimeNativeBuddySurfaceProofRef
    ? resolve(args.parentVisibleResultRef)
    : await requireReadableFile(args.parentVisibleResultRef, 'parent-visible-result-ref');

  const output = {
    createdAt: new Date().toISOString(),
    scenarioKind,
    coverageSummary,
    scenarioCoverageEvidence,
    arms: [{
      arm,
      evidenceTier: 'product-observed',
      promptInjection: classifyPromptInjection({ promptText: args.promptText, host }),
      observations,
      refs: {
        observedParentCallRef,
        exporterManifestRef: exporter.path,
        ...(parentCall ? { parentCallRecordRef: parentCall.path } : {}),
        focusedBuddyProductReportRef,
        finalizedProductRootRef,
        parentVisibleResultRef,
        ...(runtimeNativeBuddySurfaceProofRef ? { runtimeNativeBuddySurfaceProofRef } : {}),
        ...(parentCall ? parentCall.refs : {}),
        transcriptDigest: await sha256File(observedParentCallRef),
        dbDigest: exporter.dbDigest,
        ...(args.trustExporterManifestDigest ? { trustExporterManifestDigest: true } : {}),
      },
    }],
  };

  const outPath = resolve(args.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  return { outPath, arms: output.arms.length };
}

async function main() {
  const result = await assembleNaturalUseBenchmarkInputCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
