# Corroborated Explicit Member Activation Product Fixture

This retained bundle is a portable regression fixture derived from the corroborated OpenCode observer-export acceptance run on 2026-07-09.

It locks the explicit product-proof boundary only:

- the retained `observed-parent-call-transcript.json` exists and contains the same normalized `parent-agent-tool-call-record` as `parent-call-record.json`;
- `explicit-member-parent-invocation-source.json` uses `sourceKind: "observed-parent-agent-call"`;
- parent source and parent invocation provenance digests close over `sha256(JSON.stringify(parent-call-record.json))`;
- `acceptance-proof.json` does not set `testEligibilityOnly: true`;
- retained eval output records `summary.explicitMemberActivationPass === true` and `summary.acceptanceTiers["authorized-explicit-member-activation"] === "pass"`;
- native/provider tiers remain not-run and `nativeSpawnPass` / `spawnPass` remain false.

This is not native-spawn evidence. Do not use this fixture to satisfy `authorized-natural-native-spawn`, `spawnPass`, `nativeSpawnPass`, or natural model-choice claims. It is retained regression evidence for the already-reviewed explicit transcript seam product boundary, not fresh runtime evidence by itself.
