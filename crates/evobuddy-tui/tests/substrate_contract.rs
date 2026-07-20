use std::collections::BTreeMap;
use std::path::PathBuf;

use evobuddy_tui::substrate::{
    AttachOutcome, CreateSessionRequest, FakeTerminalSubstrate, SessionDisplayMetadata,
    SessionScope, SubstrateCapabilities, SubstrateSessionFacts, SubstrateSessionRef,
    TerminalSubstrate,
};

fn session_request() -> CreateSessionRequest {
    CreateSessionRequest {
        descriptor_id: "session-1".to_string(),
        session_ref: SubstrateSessionRef("tmux:session-1".to_string()),
        launcher_plan_ref: "launch-plan-1".to_string(),
        program: PathBuf::from("/usr/bin/env"),
        args: vec!["codex".into(), "resume".into()],
        cwd: PathBuf::from("/repo"),
        environment_policy_ref: "env-policy-1".to_string(),
        display: SessionDisplayMetadata {
            participant: "Builder".to_string(),
            runtime: "codex".to_string(),
            workspace: "/repo".to_string(),
            safety_mode: "workspace-write".to_string(),
            detach_shortcut: "Ctrl+B d".to_string(),
        },
    }
}

#[test]
fn fake_substrate_probe_reports_capabilities() {
    let substrate = FakeTerminalSubstrate::default();

    let capabilities = substrate.probe().expect("probe");

    assert_eq!(
        capabilities,
        SubstrateCapabilities {
            backend_name: "fake".to_string(),
            supports_create: true,
            supports_attach: true,
            supports_inspect: true,
            supports_list: true,
            supports_terminate: true,
            unsupported_reason: None,
        }
    );
}

#[test]
fn fake_substrate_create_inspect_list_and_terminate_session() {
    let substrate = FakeTerminalSubstrate::default();
    let request = session_request();

    let created = substrate.create_session(&request).expect("create session");
    assert!(created.exists);
    assert!(created.child_process_alive);
    assert_eq!(created.session_ref, request.session_ref);
    assert_eq!(created.backend_metadata.get("participant"), Some(&"Builder".to_string()));

    let inspected = substrate.inspect(&request.session_ref).expect("inspect session");
    assert_eq!(inspected.session_ref, request.session_ref);
    assert_eq!(inspected.backend_metadata.get("runtime"), Some(&"codex".to_string()));

    let listed = substrate
        .list_sessions(&SessionScope::All)
        .expect("list sessions");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].session_ref, request.session_ref);

    substrate.terminate(&request.session_ref).expect("terminate session");
    let terminated = substrate.inspect(&request.session_ref).expect("inspect terminated session");
    assert_eq!(terminated.exit_state, Some("terminated".to_string()));
    assert!(!terminated.child_process_alive);
}

#[test]
fn fake_substrate_attach_is_typed_and_does_not_imply_taskroom_completion() {
    let substrate = FakeTerminalSubstrate::default();
    let request = session_request();
    substrate.create_session(&request).expect("create session");

    let attach = substrate
        .attach_interactive(&request.session_ref)
        .expect("attach session");
    assert_eq!(attach, AttachOutcome::Detached);

    let inspected = substrate.inspect(&request.session_ref).expect("inspect session");
    assert_eq!(inspected.attached_client_count, 0);
    assert_eq!(inspected.backend_metadata.get("taskroomStateDerived"), Some(&"false".to_string()));
}

#[test]
fn malformed_backend_facts_are_rejected_instead_of_guessed() {
    let substrate = FakeTerminalSubstrate::with_sessions(vec![SubstrateSessionFacts {
        session_ref: SubstrateSessionRef("tmux:bad".to_string()),
        exists: true,
        attached_client_count: 1,
        child_process_alive: true,
        last_activity_at: Some("2026-07-20T00:00:00.000Z".to_string()),
        exit_state: None,
        backend_metadata: BTreeMap::from([("malformed".to_string(), "true".to_string())]),
    }]);

    let error = substrate.inspect(&SubstrateSessionRef("tmux:bad".to_string())).expect_err("malformed facts should fail");

    assert!(error.to_string().contains("malformed substrate facts"));
}
