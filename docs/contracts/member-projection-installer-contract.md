# Member Projection Installer Contract

The member projection installer writes and checks native runtime definition files for confirmed Context Tree members. It is definition-only.

## Inputs

- A canonical member registry loaded through `loadTeamMemberRegistry()`.
- A project root where runtime definition files may be written or checked.
- A runtime selection: `all`, `claude`, `opencode`, or `codex`.

## Outputs

- Runtime definition files for supported selected runtimes.
- `context-tree-member-runtime-projections.json` mapping `memberName` to runtime files, `runtimeAgentName` values, generator version, and last Context Tree-written file digests.
- `context-tree-member-projection-install-report.json` for setup/sync/doctor status.
- `member-runtime-projection-eval-report.json` from the projection-only eval helper/CLI when an install/sync/doctor report is checked against actual generated definition files.

## Boundaries

- Installed definitions are not packet delivery.
- Installed definitions are not model-visible target material evidence.
- Installed definitions are not member invocation evidence.
- Installed definitions are not result return evidence.
- Reports must not set `returnedTo`, `modelVisible`, `deliveryEvidence`, `resultReturnEvidence`, or `MemberTaskRun` success fields.
- Projection eval reports only verify report shape, selected definition file presence, filesystem digest matches, definition content boundaries, honest runtime discovery status, absence of invocation/result-return claims, and known projection losses. They are not invocation packet delivery, member invocation, model visibility, or result-return proof.
- `memberName` is the stable Context Tree identity; `runtimeAgentName` is runtime-specific mapping.
- Filesystem projection status is separate from runtime discovery status. Runtime discovery must remain `unverified` unless a runtime-specific discovery check actually ran.
- Mapping ownership is digest-based. A stale mapping that points at a user-edited file is not safe overwrite proof.

## Status Values

- `installed`: setup/sync wrote or confirmed the expected file.
- `upToDate`: doctor confirmed expected content without writing.
- `drift`: existing file differs from generated content.
- `missing`: expected file is absent.
- `blocked`: local file or directory state prevents a safe write/check.
- `unsupported`: runtime projection path is intentionally skipped by configuration or platform capability. V0 validates this status for report accounting, but the shipped CLI supports all three planned runtime file surfaces and does not yet implement a runtime-discovery probe that emits `unsupported`.
