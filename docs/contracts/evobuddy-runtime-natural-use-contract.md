# Evobuddy Runtime Natural Use Contract

Runtime projection installs Buddy definitions and parent-agent instructions. Projection is definition-only and is not invocation, packet delivery, model-visible material, native spawn, or result return proof.

## Preferred Product Entry

The preferred Evobuddy product entry is `invoke-buddy`. Existing `invoke-member` remains a compatibility route during migration.

For the release-grade fresh OpenCode rerun chain, the product-facing entrypoint is `npm run evobuddy:invoke-buddy -- --buddy-name <buddy> --task "<real parent-agent delegated task>" --project-identity <project> --out <invocation-root> --json`. Old `context-tree:*` invoke forms and `ctree buddies invoke` are compatibility evidence only for this path, not release-grade authority.

Direct CLI execution alone is not natural-use product proof. Product proof requires an observed parent-agent call transcript showing the parent runtime called the entrypoint and a matching invocation digest.

Proof tiers:

- `direct-cli`: user or eval runner executed the adapter directly; never product natural-use proof.
- `agent-instructed-adapter-call`: parent agent executed the adapter after the prompt explicitly named `ctree buddies invoke`, `invoke-buddy`, or an equivalent command. This is product-observed adapter proof, but not strong natural routing proof.
- `natural-routing-agent-call`: parent agent selected a Buddy from installed routing/projection/instructions without the user prompt naming the adapter command. This is the stronger natural-use target.
- `runtime-native-subagent`: runtime records native subagent/spawn/team-member evidence. Only claim this when the observed transcript contains native runtime evidence.

## Product Proof

A product-observed runtime natural-use proof requires:

- observed parent-agent call transcript;
- parent-call record with runtime refs;
- matching `buddyName`/`memberName`;
- matching invocation digest;
- finalized product root;
- parent-visible result evidence;
- focused Buddy product report pass.

Release-grade fresh OpenCode benchmark closure must sequence the real artifact chain: product-facing `evobuddy` invocation, OpenCode session corpus export, OpenCode parent-call transcript export, explicit parent-call record capture, finalized product root creation, focused Buddy product eval, `assemble-natural-use-benchmark-input` input assembly, natural-use benchmark execution, three-runtime release eval, and final product readiness eval.

Old `/tmp/product/...` placeholder flows are not valid release-grade proof. They are placeholders only and must not be presented as fresh product-facing evidence.

Release-grade benchmark closure requires digest/ref-bound proof validation. File-exists checks are only an initial fail-closed guard against dangling refs; they are not sufficient release-grade authority.

Project identity mismatch must fail closed.

## Runtime Status

OpenCode is the first live product-observed target. Claude Code and Codex may report `blocked`, `limited`, or `not-run` until a runtime exporter captures observed parent-agent calls for those surfaces.

There is no native spawn claim unless runtime-native spawn evidence is present in the observed transcript.
