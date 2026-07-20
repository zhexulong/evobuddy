//! Capability matrix: unsupported substrate features must disable actions with reasons.
//! Does not claim Zellij or cmux backends are implemented.

use evobuddy_tui::substrate::{
    action_gates_from_matrix, SubstrateAction, SubstrateCapabilityKind, SubstrateCapabilityMatrix,
    SubstratePlatform,
};

fn tmux_full_matrix() -> SubstrateCapabilityMatrix {
    SubstrateCapabilityMatrix::full("tmux", SubstratePlatform::LinuxMacOs)
}

fn zellij_evaluation_matrix() -> SubstrateCapabilityMatrix {
    // Evaluation projection only: not a production backend claim.
    // Source: zellij CLI attach/create-background, list-sessions, list-panes --json,
    // list-clients, kill-session, session resurrection (docs.zellij.dev).
    SubstrateCapabilityMatrix::evaluated(
        "zellij",
        SubstratePlatform::LinuxMacOs,
        &[
            (SubstrateCapabilityKind::InteractiveAttach, true, None),
            (SubstrateCapabilityKind::DetachedPersistence, true, None),
            (SubstrateCapabilityKind::ExactInspect, true, None),
            (SubstrateCapabilityKind::ClientSwitching, true, None),
            (SubstrateCapabilityKind::RemoteAvailability, true, None),
            (SubstrateCapabilityKind::PlatformSupport, true, None),
            (SubstrateCapabilityKind::Recovery, true, None),
            (SubstrateCapabilityKind::CreateSession, true, None),
            (SubstrateCapabilityKind::ListSessions, true, None),
            (SubstrateCapabilityKind::Terminate, true, None),
        ],
    )
}

fn cmux_evaluation_matrix() -> SubstrateCapabilityMatrix {
    SubstrateCapabilityMatrix::evaluated(
        "cmux",
        SubstratePlatform::MacOsOnly,
        &[
            (
                SubstrateCapabilityKind::InteractiveAttach,
                false,
                Some("cmux is workspace focus, not a PTY session substrate"),
            ),
            (
                SubstrateCapabilityKind::DetachedPersistence,
                false,
                Some("not a detached multi-session PTY server"),
            ),
            (
                SubstrateCapabilityKind::ExactInspect,
                false,
                Some("no substrate inspect contract for managed PTY sessions"),
            ),
            (SubstrateCapabilityKind::ClientSwitching, true, None),
            (
                SubstrateCapabilityKind::RemoteAvailability,
                false,
                Some("macOS-local workspace tool"),
            ),
            (
                SubstrateCapabilityKind::PlatformSupport,
                false,
                Some("macOS-only; not a cross-platform substrate"),
            ),
            (
                SubstrateCapabilityKind::Recovery,
                false,
                Some("recovery is host app lifecycle, not substrate resurrection"),
            ),
            (
                SubstrateCapabilityKind::CreateSession,
                false,
                Some("does not create EvoBuddy-managed PTY sessions"),
            ),
            (
                SubstrateCapabilityKind::ListSessions,
                false,
                Some("workspace list is not TerminalSubstrate session inventory"),
            ),
            (
                SubstrateCapabilityKind::Terminate,
                false,
                Some("no terminate_session substrate operation"),
            ),
        ],
    )
}

#[test]
fn tmux_matrix_enables_core_actions() {
    let gates = action_gates_from_matrix(&tmux_full_matrix());

    for action in [
        SubstrateAction::OpenInteractive,
        SubstrateAction::CreateDetached,
        SubstrateAction::InspectExact,
        SubstrateAction::RecoverSession,
        SubstrateAction::ListManagedSessions,
        SubstrateAction::TerminateSession,
    ] {
        let gate = gates
            .iter()
            .find(|gate| gate.action == action)
            .unwrap_or_else(|| panic!("missing gate for {action:?}"));
        assert!(
            gate.enabled,
            "tmux should enable {action:?}, got disabled: {:?}",
            gate.disabled_reason
        );
        assert!(gate.disabled_reason.is_none());
    }
}

#[test]
fn unsupported_capability_disables_dependent_action_with_reason() {
    let matrix = SubstrateCapabilityMatrix::evaluated(
        "fake-partial",
        SubstratePlatform::LinuxMacOs,
        &[
            (
                SubstrateCapabilityKind::InteractiveAttach,
                false,
                Some("attach not wired"),
            ),
            (SubstrateCapabilityKind::DetachedPersistence, true, None),
            (
                SubstrateCapabilityKind::ExactInspect,
                false,
                Some("inspect unsupported"),
            ),
            (
                SubstrateCapabilityKind::ClientSwitching,
                false,
                Some("no multi-client"),
            ),
            (
                SubstrateCapabilityKind::RemoteAvailability,
                false,
                Some("local only"),
            ),
            (SubstrateCapabilityKind::PlatformSupport, true, None),
            (
                SubstrateCapabilityKind::Recovery,
                false,
                Some("no resurrection"),
            ),
            (SubstrateCapabilityKind::CreateSession, true, None),
            (SubstrateCapabilityKind::ListSessions, true, None),
            (SubstrateCapabilityKind::Terminate, true, None),
        ],
    );

    let gates = action_gates_from_matrix(&matrix);

    let open = gates
        .iter()
        .find(|gate| gate.action == SubstrateAction::OpenInteractive)
        .expect("open gate");
    assert!(!open.enabled);
    assert_eq!(open.disabled_reason.as_deref(), Some("attach not wired"));

    let inspect = gates
        .iter()
        .find(|gate| gate.action == SubstrateAction::InspectExact)
        .expect("inspect gate");
    assert!(!inspect.enabled);
    assert_eq!(
        inspect.disabled_reason.as_deref(),
        Some("inspect unsupported")
    );

    let recover = gates
        .iter()
        .find(|gate| gate.action == SubstrateAction::RecoverSession)
        .expect("recover gate");
    assert!(!recover.enabled);
    assert_eq!(recover.disabled_reason.as_deref(), Some("no resurrection"));

    let create = gates
        .iter()
        .find(|gate| gate.action == SubstrateAction::CreateDetached)
        .expect("create gate");
    assert!(create.enabled);
    assert!(create.disabled_reason.is_none());
}

#[test]
fn unsupported_status_requires_reason_and_rejects_silent_overclaim() {
    let err = SubstrateCapabilityMatrix::try_evaluated(
        "bad",
        SubstratePlatform::LinuxMacOs,
        &[(SubstrateCapabilityKind::InteractiveAttach, false, None)],
    )
    .expect_err("unsupported without reason must fail");
    assert!(
        err.to_string()
            .contains("unsupported capability requires reason"),
        "unexpected error: {err}"
    );

    let overclaim = SubstrateCapabilityMatrix::try_evaluated(
        "bad",
        SubstratePlatform::LinuxMacOs,
        &[(
            SubstrateCapabilityKind::InteractiveAttach,
            true,
            Some("should not set reason when supported"),
        )],
    )
    .expect_err("supported with reason must fail");
    assert!(
        overclaim
            .to_string()
            .contains("supported capability must not carry unsupported_reason"),
        "unexpected error: {overclaim}"
    );
}

#[test]
fn zellij_evaluation_enables_contract_actions_but_is_not_production() {
    let matrix = zellij_evaluation_matrix();
    let gates = action_gates_from_matrix(&matrix);

    for action in [
        SubstrateAction::OpenInteractive,
        SubstrateAction::CreateDetached,
        SubstrateAction::InspectExact,
        SubstrateAction::RecoverSession,
        SubstrateAction::ListManagedSessions,
        SubstrateAction::TerminateSession,
        SubstrateAction::UseRemote,
        SubstrateAction::SwitchClient,
    ] {
        let gate = gates
            .iter()
            .find(|g| g.action == action)
            .unwrap_or_else(|| panic!("missing gate for {action:?}"));
        assert!(
            gate.enabled,
            "zellij evaluation should enable {action:?}: {:?}",
            gate.disabled_reason
        );
    }

    // Interface fit does not equal shipped backend.
    assert!(!matrix.is_production_backend());
    assert_eq!(matrix.implementation_status(), "evaluation-only");
}

#[test]
fn cmux_evaluation_disables_substrate_actions_and_stays_platform_gated() {
    let matrix = cmux_evaluation_matrix();
    assert_eq!(matrix.platform, SubstratePlatform::MacOsOnly);
    assert!(!matrix.is_production_backend());
    assert!(!matrix.is_cross_platform_substrate());

    let gates = action_gates_from_matrix(&matrix);
    for action in [
        SubstrateAction::OpenInteractive,
        SubstrateAction::CreateDetached,
        SubstrateAction::InspectExact,
        SubstrateAction::RecoverSession,
        SubstrateAction::ListManagedSessions,
        SubstrateAction::TerminateSession,
    ] {
        let gate = gates
            .iter()
            .find(|g| g.action == action)
            .unwrap_or_else(|| panic!("missing {action:?}"));
        assert!(
            !gate.enabled,
            "cmux must not enable substrate action {action:?}"
        );
        assert!(
            gate.disabled_reason.is_some(),
            "cmux must give a disable reason for {action:?}"
        );
    }

    let switch = gates
        .iter()
        .find(|g| g.action == SubstrateAction::SwitchWorkspaceFocus)
        .expect("workspace focus");
    assert!(switch.enabled);
    assert!(switch.disabled_reason.is_none());
}

#[test]
fn platform_gate_blocks_cmux_on_non_macos() {
    let matrix = cmux_evaluation_matrix();
    let on_linux = matrix.actions_for_host(SubstratePlatform::LinuxMacOs);
    let focus = on_linux
        .iter()
        .find(|g| g.action == SubstrateAction::SwitchWorkspaceFocus)
        .expect("focus");
    assert!(!focus.enabled);
    assert!(
        focus
            .disabled_reason
            .as_deref()
            .unwrap_or("")
            .contains("macOS"),
        "expected macOS platform reason, got {:?}",
        focus.disabled_reason
    );

    let on_macos = matrix.actions_for_host(SubstratePlatform::MacOsOnly);
    let focus_mac = on_macos
        .iter()
        .find(|g| g.action == SubstrateAction::SwitchWorkspaceFocus)
        .expect("focus mac");
    assert!(focus_mac.enabled);
}

#[test]
fn matrix_covers_required_capability_kinds() {
    let required = [
        SubstrateCapabilityKind::InteractiveAttach,
        SubstrateCapabilityKind::DetachedPersistence,
        SubstrateCapabilityKind::ExactInspect,
        SubstrateCapabilityKind::ClientSwitching,
        SubstrateCapabilityKind::RemoteAvailability,
        SubstrateCapabilityKind::PlatformSupport,
        SubstrateCapabilityKind::Recovery,
    ];
    for matrix in [
        tmux_full_matrix(),
        zellij_evaluation_matrix(),
        cmux_evaluation_matrix(),
    ] {
        for kind in required {
            assert!(
                matrix.status(kind).is_some(),
                "backend {} missing {:?}",
                matrix.backend_name,
                kind
            );
        }
    }
}

#[test]
fn evaluation_backends_are_not_claimed_implemented() {
    assert!(tmux_full_matrix().is_production_backend());
    assert!(!zellij_evaluation_matrix().is_production_backend());
    assert!(!cmux_evaluation_matrix().is_production_backend());
    assert_eq!(
        zellij_evaluation_matrix().implementation_status(),
        "evaluation-only"
    );
    assert_eq!(
        cmux_evaluation_matrix().implementation_status(),
        "evaluation-only"
    );
    assert_eq!(tmux_full_matrix().implementation_status(), "production");
}
