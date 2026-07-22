use std::path::PathBuf;

use evobuddy_tui::app::{
    ConfirmedAction, CreateHandoffDraft, CreateTaskRoomDraft, PendingConfirmation, WorkbenchApp,
    WorkbenchEffect,
};
use evobuddy_tui::backend::{
    taskroom_archive_command, taskroom_create_command, taskroom_handoff_create_command,
    taskroom_participant_add_command, taskroom_session_stop_command, BackendCommand,
};
use evobuddy_tui::input::{handle_key_event, KeyInput};
use evobuddy_tui::model::parse_workbench_state;
use evobuddy_tui::views::ViewMode;

fn load_app(name: &str) -> WorkbenchApp {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures")
        .join(name);
    let text = std::fs::read_to_string(path).expect("read fixture");
    let state = parse_workbench_state(&text).expect("parse state");
    WorkbenchApp::new(state)
}

#[test]
fn new_room_key_creates_without_confirmation_or_form() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    let effect = handle_key_event(&mut app, KeyInput::NewRoom);
    assert_ne!(app.view_mode, ViewMode::ConfirmAction);
    assert_ne!(app.view_mode, ViewMode::TaskRoomForm);
    match effect {
        WorkbenchEffect::CreateTaskRoom(draft) => {
            assert_eq!(draft.runtime, "pi");
        }
        other => panic!("expected CreateTaskRoom, got {other:?}"),
    }
    assert!(app.durable_writes.is_empty());
}

#[test]
fn confirming_create_emits_typed_create_effect_without_auto_routing() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    let draft = CreateTaskRoomDraft {
        objective: "Ship ownership".to_string(),
        acceptance_criteria: "Tests green".to_string(),
        workspace: "/repo".to_string(),
        actor: "builder".to_string(),
        runtime: "opencode".to_string(),
        safety_mode: "workspace-write".to_string(),
    };
    app.request_confirmation(PendingConfirmation {
        target: "taskroom create · Ship ownership".to_string(),
        effect_label: "Create TaskRoom".to_string(),
        action: ConfirmedAction::CreateTaskRoom(draft.clone()),
    });

    let effect = handle_key_event(&mut app, KeyInput::Enter);
    assert_eq!(effect, WorkbenchEffect::CreateTaskRoom(draft));
    assert_eq!(app.view_mode, ViewMode::ActionProgress);
    assert!(app.durable_writes.is_empty());
}

#[test]
fn cancelling_confirmation_does_not_emit_mutation_effect() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.request_confirmation(PendingConfirmation {
        target: "room-1".to_string(),
        effect_label: "Archive TaskRoom".to_string(),
        action: ConfirmedAction::ArchiveTaskRoom {
            room_id: "room-1".to_string(),
        },
    });

    let effect = handle_key_event(&mut app, KeyInput::Escape);
    assert_eq!(effect, WorkbenchEffect::None);
    assert_ne!(app.view_mode, ViewMode::ConfirmAction);
    assert!(app.pending_confirmation.is_none());
    assert!(app.durable_writes.is_empty());
}

#[test]
fn stop_and_archive_require_confirmation_and_are_not_detach() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    let room_id = app
        .selected_task_room()
        .map(|room| room.id.clone())
        .expect("fixture room");
    let instance_id = app
        .selected_task_room()
        .and_then(|room| room.participants.first().map(|p| p.id.clone()))
        .unwrap_or_else(|| "instance-1".to_string());

    let stop = app.request_stop_session(&room_id, &instance_id);
    match stop {
        WorkbenchEffect::RequestConfirmation(PendingConfirmation {
            effect_label,
            action,
            ..
        }) => {
            assert!(effect_label.to_lowercase().contains("stop"));
            assert!(!effect_label.to_lowercase().contains("detach"));
            assert!(matches!(action, ConfirmedAction::StopSession { .. }));
        }
        other => panic!("expected stop confirmation, got {other:?}"),
    }

    let archive = app.request_archive_task_room(&room_id);
    match archive {
        WorkbenchEffect::RequestConfirmation(PendingConfirmation {
            effect_label,
            action,
            ..
        }) => {
            assert!(effect_label.to_lowercase().contains("archive"));
            assert!(matches!(action, ConfirmedAction::ArchiveTaskRoom { .. }));
        }
        other => panic!("expected archive confirmation, got {other:?}"),
    }
}

#[test]
fn handoff_form_sends_immediately_without_confirmation() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.push_view(ViewMode::TaskRoomWorkspace);
    handle_key_event(&mut app, KeyInput::Handoff);
    handle_key_event(&mut app, KeyInput::Char('O'));
    handle_key_event(&mut app, KeyInput::Char('K'));

    let effect = handle_key_event(&mut app, KeyInput::Enter);
    assert_ne!(app.view_mode, ViewMode::ConfirmAction);
    match effect {
        WorkbenchEffect::CreateHandoff(draft) => {
            assert_eq!(draft.body, "OK");
        }
        other => panic!("expected CreateHandoff, got {other:?}"),
    }
}

#[test]
fn free_text_on_dashboard_never_auto_routes_or_creates_participants() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    handle_key_event(&mut app, KeyInput::Char('a'));
    handle_key_event(&mut app, KeyInput::Char('d'));
    handle_key_event(&mut app, KeyInput::Char('d'));
    handle_key_event(&mut app, KeyInput::Char(' '));
    handle_key_event(&mut app, KeyInput::Char('r'));
    handle_key_event(&mut app, KeyInput::Char('e'));
    handle_key_event(&mut app, KeyInput::Char('v'));
    handle_key_event(&mut app, KeyInput::Char('i'));
    handle_key_event(&mut app, KeyInput::Char('e'));
    handle_key_event(&mut app, KeyInput::Char('w'));
    handle_key_event(&mut app, KeyInput::Char('e'));
    handle_key_event(&mut app, KeyInput::Char('r'));

    assert_eq!(app.view_mode, ViewMode::Dashboard);
    assert!(app.pending_confirmation.is_none());
    assert!(app.durable_writes.is_empty());
}

#[test]
fn backend_commands_use_structured_argv_only() {
    let project = PathBuf::from("/repo");

    assert_eq!(
        taskroom_create_command(
            &project,
            "taskroom:alpha",
            "Alpha",
            "Ship ownership",
            Some("pi"),
            Some("2026-07-20T12:00:00.000Z"),
        ),
        BackendCommand {
            program: "node".to_string(),
            args: vec![
                "scripts/evobuddy/evobuddy.mjs".to_string(),
                "taskroom".to_string(),
                "create".to_string(),
                "--project".to_string(),
                "/repo".to_string(),
                "--room".to_string(),
                "taskroom:alpha".to_string(),
                "--title".to_string(),
                "Alpha".to_string(),
                "--objective".to_string(),
                "Ship ownership".to_string(),
                "--runtime".to_string(),
                "pi".to_string(),
                "--created-at".to_string(),
                "2026-07-20T12:00:00.000Z".to_string(),
                "--json".to_string(),
            ],
        }
    );

    assert_eq!(
        taskroom_participant_add_command(
            &project,
            "taskroom:alpha",
            "participant:builder:1",
            "builder",
            "team-agent",
            "builder",
            Some("opencode"),
        ),
        BackendCommand {
            program: "node".to_string(),
            args: vec![
                "scripts/evobuddy/evobuddy.mjs".to_string(),
                "taskroom".to_string(),
                "participant".to_string(),
                "add".to_string(),
                "--project".to_string(),
                "/repo".to_string(),
                "--room".to_string(),
                "taskroom:alpha".to_string(),
                "--participant-id".to_string(),
                "participant:builder:1".to_string(),
                "--actor-name".to_string(),
                "builder".to_string(),
                "--actor-kind".to_string(),
                "team-agent".to_string(),
                "--role".to_string(),
                "builder".to_string(),
                "--runtime".to_string(),
                "opencode".to_string(),
                "--json".to_string(),
            ],
        }
    );

    assert_eq!(
        taskroom_handoff_create_command(
            &project,
            "taskroom:alpha",
            "handoff:1",
            "instance:builder:1",
            "instance:reviewer:1",
            "review-request",
            Some("please review"),
            Some("2026-07-20T12:02:00.000Z"),
        ),
        BackendCommand {
            program: "node".to_string(),
            args: vec![
                "scripts/evobuddy/evobuddy.mjs".to_string(),
                "taskroom".to_string(),
                "handoff".to_string(),
                "create".to_string(),
                "--project".to_string(),
                "/repo".to_string(),
                "--room".to_string(),
                "taskroom:alpha".to_string(),
                "--handoff-id".to_string(),
                "handoff:1".to_string(),
                "--from-instance".to_string(),
                "instance:builder:1".to_string(),
                "--to-instance".to_string(),
                "instance:reviewer:1".to_string(),
                "--handoff-kind".to_string(),
                "review-request".to_string(),
                "--body".to_string(),
                "please review".to_string(),
                "--created-at".to_string(),
                "2026-07-20T12:02:00.000Z".to_string(),
                "--json".to_string(),
            ],
        }
    );

    assert_eq!(
        taskroom_session_stop_command(
            &project,
            "taskroom:alpha",
            "instance:builder:1",
            "user-stop"
        ),
        BackendCommand {
            program: "node".to_string(),
            args: vec![
                "scripts/evobuddy/evobuddy.mjs".to_string(),
                "taskroom".to_string(),
                "session".to_string(),
                "stop".to_string(),
                "--project".to_string(),
                "/repo".to_string(),
                "--room".to_string(),
                "taskroom:alpha".to_string(),
                "--instance".to_string(),
                "instance:builder:1".to_string(),
                "--reason".to_string(),
                "user-stop".to_string(),
                "--json".to_string(),
            ],
        }
    );

    assert_eq!(
        taskroom_archive_command(&project, "taskroom:alpha"),
        BackendCommand {
            program: "node".to_string(),
            args: vec![
                "scripts/evobuddy/evobuddy.mjs".to_string(),
                "taskroom".to_string(),
                "archive".to_string(),
                "--project".to_string(),
                "/repo".to_string(),
                "--room".to_string(),
                "taskroom:alpha".to_string(),
                "--json".to_string(),
            ],
        }
    );

    // stop argv must not include detach semantics
    let stop = taskroom_session_stop_command(&project, "r", "i", "user-stop");
    assert!(!stop.args.iter().any(|arg| arg.contains("detach")));
    assert!(stop.args.iter().any(|arg| arg == "stop"));
}

#[test]
fn create_handoff_draft_confirmation_preserves_explicit_fields() {
    let draft = CreateHandoffDraft {
        sender: "builder".to_string(),
        receiver: "reviewer".to_string(),
        body: "Please review".to_string(),
        artifact_refs: "artifact:1".to_string(),
        expected_next_action: "review".to_string(),
        return_destination: "builder".to_string(),
    };
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.request_confirmation(PendingConfirmation {
        target: "handoff builder → reviewer".to_string(),
        effect_label: "Create Handoff".to_string(),
        action: ConfirmedAction::CreateHandoff(draft.clone()),
    });
    let effect = handle_key_event(&mut app, KeyInput::Enter);
    assert_eq!(effect, WorkbenchEffect::CreateHandoff(draft));
}
