# Codex Context Fork Fixtures

This directory is reserved for fixed product workflow fixtures used after the Codex capability matrix is proven.

The current implementation only builds capability evals:

- native thread/session fork inheritance
- current-boundary spawn inheritance when reachable
- negative controls
- tool-result visibility or known loss
- compaction and rollback boundaries

Product workflow evals such as `design-complete -> before-implementation-plan` must not run until the capability report can distinguish inherited context from summary handoff.
