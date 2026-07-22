# Evobuddy Evolution Loop Contract

Patch existence is not behavior-change proof. An Evobuddy evolution loop pass requires a source-backed failure or correction, an `evolution-buddy` proposal, a host-applied patch, a new Buddy version, and a rerun that shows before/after behavior changed in the intended way.

## Reference Implementation Boundaries

Evobuddy follows Magic Context's maintenance discipline: maintenance work is task-scoped, evidence-backed, and host-applied. Proposal agents emit structured results; the host validates and applies them.

Evobuddy follows GenericAgent's agent-mediated update trigger: durable evolution starts when an agent identifies verified, future-useful learning. Evobuddy is not a silent background writer and does not update every task unconditionally.

## Required Evidence

- initial BuddyRun and returned-to-parent result;
- feedback, correction, repeated-failure, or verified-success source refs;
- EvolutionPatch with target decision and proposed change;
- host-applied mutation/version ref;
- rerun input and output;
- before/after behavior delta;
- negative controls for dirty evidence, one-off preferences, rejected/reverted patches, and docs-only guesses.

## Product Proof

Hermetic and retained scenario roots may prove implementation mechanics. Product live proof requires observed parent-agent call transcript evidence for the relevant Buddy calls. Direct CLI output alone is not product proof.

Rejected/reverted patches must not affect future active projection or invocation.
