#!/usr/bin/env node

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { sha256Text } from '../../src/eval/evobuddy-release-grade-provenance.mjs';

const ADAPTER_COMMAND_PATTERNS = [
  /ctree\s+buddies\s+invoke/i,
  /invoke-buddy/i,
  /invoke-member/i,
  /scripts\/context-tree/i,
];

function hasAdapterCommand(prompt) {
  const text = String(prompt ?? '');
  return ADAPTER_COMMAND_PATTERNS.some((pat) => pat.test(text));
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') parsed.out = argv[++i];
    else if (arg === '--selected-buddy') parsed.selectedBuddy = argv[++i];
    else if (arg === '--observed-turn') parsed.observedTurn = argv[++i];
    else if (arg === '--model-output') parsed.modelOutput = argv[++i];
    else if (arg === '--prompt-text') parsed.promptText = argv[++i];
    else if (arg === '--prompt-ref') parsed.promptRef = argv[++i];
    else throw new Error(`unknown argument: ${arg}`);
  }
  return parsed;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const argv = process.argv.slice(2);

let args;
try {
  args = parseArgs(argv);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const outDir = args.out ? resolve(args.out) : undefined;
if (!outDir) fail('missing required argument: --out');

const selectedBuddy = args.selectedBuddy;
if (!selectedBuddy) fail('missing required argument: --selected-buddy');

const observedTurnRef = args.observedTurn;
if (!observedTurnRef) fail('missing required argument: --observed-turn');

const modelOutputRef = args.modelOutput;
if (!modelOutputRef) fail('missing required argument: --model-output');

const promptText = args.promptText;
const promptRef = args.promptRef;

if (!promptText && !promptRef) {
  fail('missing required argument: must provide --prompt-text or --prompt-ref');
}

if (promptText && promptRef) {
  fail('cannot provide both --prompt-text and --prompt-ref');
}

// Resolve prompt content
let promptBody;
let promptDigest;
if (promptText) {
  promptBody = promptText;
  promptDigest = sha256Text(promptText);
  if (hasAdapterCommand(promptText)) {
    fail('adapter command named in prompt: prompt text must not name adapter commands (ctree buddies invoke, invoke-buddy, invoke-member, scripts/context-tree)');
  }
} else {
  const resolved = resolve(promptRef);
  try {
    promptBody = readFileSync(resolved, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') fail(`--prompt-ref file not found: ${resolved}`);
    throw error;
  }
  promptDigest = sha256Text(promptBody);
  if (hasAdapterCommand(promptBody)) {
    fail('adapter command named in prompt: prompt text loaded from --prompt-ref must not name adapter commands (ctree buddies invoke, invoke-buddy, invoke-member, scripts/context-tree)');
  }
}

// Load observed turn artifact
let observedTurn;
try {
  observedTurn = JSON.parse(readFileSync(resolve(observedTurnRef), 'utf8'));
} catch (error) {
  if (error?.code === 'ENOENT') fail(`--observed-turn file not found: ${observedTurnRef}`);
  if (error instanceof SyntaxError) fail(`--observed-turn is not valid JSON: ${error.message}`);
  throw error;
}

const observedTurnRaw = readFileSync(resolve(observedTurnRef), 'utf8');
const observedTurnDigest = sha256Text(observedTurnRaw);

// Load model output
let modelOutputRaw;
try {
  modelOutputRaw = readFileSync(resolve(modelOutputRef), 'utf8');
} catch (error) {
  if (error?.code === 'ENOENT') fail(`--model-output file not found: ${modelOutputRef}`);
  throw error;
}

const modelOutputDigest = sha256Text(modelOutputRaw);

// Validate observed turn outputDigest if present
if (observedTurn.outputDigest) {
  if (observedTurn.outputDigest !== modelOutputDigest) {
    fail(`observed-turn outputDigest mismatch: observed turn declares ${observedTurn.outputDigest}, but actual model output digest is ${modelOutputDigest}`);
  }
}

// Ensure output directory exists
mkdirSync(outDir, { recursive: true });

// Check for existing artifact
const routingDecisionPath = join(outDir, 'routing-decision.json');
if (existsSync(routingDecisionPath)) {
  fail(`routing-decision.json already exists at ${routingDecisionPath}`);
}

// Build artifact
const artifact = {
  artifactKind: 'evobuddy-routing-decision',
  selectedBuddyName: selectedBuddy,
  selectedMemberName: selectedBuddy,
  selectionSource: 'host-model-routing',
  adapterCommandNamedInPrompt: false,
  hostModelTurnRef: observedTurnRef,
  observedTurnDigest,
  modelOutputRef,
  modelOutputDigest,
  promptDigest,
  createdAt: new Date().toISOString(),
};

const artifactRaw = `${JSON.stringify(artifact, null, 2)}\n`;
writeFileSync(routingDecisionPath, artifactRaw, 'utf8');

const routingDecisionDigest = sha256Text(artifactRaw);

const stdout = JSON.stringify({
  routingDecisionRef: routingDecisionPath,
  routingDecisionDigest,
  selectedBuddyName: selectedBuddy,
  adapterCommandNamedInPrompt: false,
  observedTurnDigest,
  modelOutputDigest,
});

process.stdout.write(`${stdout}\n`);
