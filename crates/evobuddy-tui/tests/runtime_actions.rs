use evobuddy_tui::model::{
    ActionAvailability, ActorStatus, AttentionSource, Handoff, NativeSessionLifecycle,
    NativeSessionSummary, Participant, Round, RuntimeCapabilitySummary, StatusSummary, TaskRoom,
    TaskRoomStatus,
};
use evobuddy_tui::runtime_actions::{
    classify_recovery, derive_runtime_session_actions, RecoveryDiagnostic, RuntimeActionContext,
};

fn sample_room() -> TaskRoom {
    TaskRoom {
        id: "taskroom:alpha".to_string(),
        title: "Alpha".to_string(),
        runtime: "codex".to_string(),
        status: TaskRoomStatus::Working,
        objective: "Ship the room".to_string(),
        acceptance_criteria: "Evidence-backed".to_string(),
        participants: vec![Participant {
            id: "builder".to_string(),
            display_name: "Builder".to_string(),
            kind: "team-agent".to_string(),
            status: ActorStatus::Working,
            role: "builder".to_string(),
            runtime: "pi".to_string(),
            native_session_descriptor_id: Some("session-1".to_string()),
        }],
        rounds: vec![Round {
            id: "round:1".to_string(),
            builder_summary: "working".to_string(),
            reviewer_summary: "pending".to_string(),
            prior_review_linked: false,
        }],
        handoffs: vec![Handoff {
            from: "builder".to_string(),
            to: "reviewer".to_string(),
            summary: "review".to_string(),
        }],
        reviewer_continuity: StatusSummary {
            status: "unknown".to_string(),
            summary: String::new(),
        },
        evolution_handoff: StatusSummary {
            status: "unknown".to_string(),
            summary: String::new(),
        },
        attention: Some(AttentionSource {
            state: "NeedsInput".to_string(),
            source_kind: "runtime-hook".to_string(),
            source_ref: "hook:1".to_string(),
            observed_at: "2026-07-20T00:00:00.000Z".to_string(),
            confidence: "high".to_string(),
            stale_after: "2026-07-20T01:00:00.000Z".to_string(),
        }),
        available_actions: Vec::new(),
        returned_to: None,
        artifacts_summary: Vec::new(),
        summary: "active".to_string(),
        timeline: Vec::new(),
    }
}

fn sample_capability() -> RuntimeCapabilitySummary {
    RuntimeCapabilitySummary {
        capability_id: "runtime-capability:codex".to_string(),
        runtime: "codex".to_string(),
        supports_fresh_session: true,
        supports_context_continuation: true,
        exact_resume_supported: true,
        heuristic_resume_supported: true,
        unsupported_reason: None,
    }
}

fn sample_session() -> NativeSessionSummary {
    NativeSessionSummary {
        descriptor_id: "session-1".to_string(),
        room_id: "taskroom:alpha".to_string(),
        agent_instance_id: "instance-1".to_string(),
        runtime: "codex".to_string(),
        lifecycle: NativeSessionLifecycle::Attachable,
        terminal_substrate: "tmux".to_string(),
        terminal_session_ref: "evb-alpha-instance".to_string(),
        workspace: "/repo".to_string(),
        safety_mode: "workspace-write".to_string(),
    }
}

fn labels(actions: &[ActionAvailability]) -> Vec<&str> {
    actions.iter().map(|action| action.label.as_str()).collect()
}

#[test]
fn exact_resume_requires_validated_provider_identity() {
    let room = sample_room();
    let capability = sample_capability();
    let session = sample_session();
    let recovery = classify_recovery(true, Some(&session), Some("NeedsInput"), true, false);
    let actions = derive_runtime_session_actions(&RuntimeActionContext {
        room: &room,
        capability: Some(&capability),
        session: Some(&session),
        provider_conversation_ref_validated: false,
        heuristic_candidate_count: 1,
        substrate_available: true,
        recovery: &recovery,
    });
    let resume = actions
        .iter()
        .find(|action| action.id == "resume-conversation")
        .expect("resume action");
    assert!(!resume.enabled);
    assert!(resume
        .disabled_reason
        .as_deref()
        .unwrap_or("")
        .contains("validated provider conversation identity"));
}

#[test]
fn heuristic_and_context_and_fresh_labels_are_distinct() {
    let room = sample_room();
    let capability = sample_capability();
    let session = sample_session();
    let recovery = Vec::new();
    let actions = derive_runtime_session_actions(&RuntimeActionContext {
        room: &room,
        capability: Some(&capability),
        session: Some(&session),
        provider_conversation_ref_validated: true,
        heuristic_candidate_count: 2,
        substrate_available: true,
        recovery: &recovery,
    });
    let labels = labels(&actions);
    assert!(labels.contains(&"Open session"));
    assert!(labels.contains(&"Resume conversation"));
    assert!(labels.contains(&"Heuristic resume"));
    assert!(labels.contains(&"Continue with TaskRoom context"));
    assert!(labels.contains(&"Start new session"));
    assert!(labels.contains(&"View evidence"));
    assert!(labels.contains(&"Retry"));
    let start_new = actions
        .iter()
        .find(|action| action.id == "start-new-session")
        .expect("fresh");
    assert_eq!(start_new.label, "Start new session");
    assert!(start_new.enabled);
}

#[test]
fn recovery_classifies_missing_tmux_and_stale_evidence() {
    let recovery = classify_recovery(false, None, Some("stale"), true, false);
    assert!(recovery.contains(&RecoveryDiagnostic::MissingTmux));
    assert!(recovery.contains(&RecoveryDiagnostic::EvidenceStale));
    assert!(recovery.contains(&RecoveryDiagnostic::UnsupportedExactResume));
}
