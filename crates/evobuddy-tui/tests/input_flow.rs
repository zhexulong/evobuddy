use std::fs;
use std::path::PathBuf;

use evobuddy_tui::app::{
    CreateHandoffDraft, CreateTaskRoomDraft, FocusPane, SelectedActor, StructuredQuestion,
    StructuredQuestionChoice, WorkbenchApp, WorkbenchEffect,
};
use evobuddy_tui::input::{handle_key_event, KeyInput};
use evobuddy_tui::model::parse_workbench_state;
use evobuddy_tui::views::{DetailView, ViewMode};

fn load_app(name: &str) -> WorkbenchApp {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures")
        .join(name);
    let text = fs::read_to_string(path).expect("read fixture");
    let state = parse_workbench_state(&text).expect("parse state");
    WorkbenchApp::new(state)
}

#[test]
fn navigation_changes_selection_and_cycles_focus() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    assert_eq!(app.focus, FocusPane::TaskRooms);

    handle_key_event(&mut app, KeyInput::Down);
    assert_eq!(app.selected_task_room, 1);

    handle_key_event(&mut app, KeyInput::Tab);
    // Activity-first: Tab no longer cycles RuntimeSetup / TeamBuddies as peers.
    assert_eq!(app.focus, FocusPane::TaskRooms);
    handle_key_event(&mut app, KeyInput::ShiftTab);
    assert_eq!(app.focus, FocusPane::TaskRooms);
}

#[test]
fn home_enter_opens_room_detail_not_forced_attach() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    let effect = handle_key_event(&mut app, KeyInput::Enter);
    assert_eq!(effect, WorkbenchEffect::None);
    assert!(
        matches!(app.view_mode, ViewMode::Detail(_)),
        "Home Enter opens room thread/detail, got {:?}",
        app.view_mode
    );
    assert!(app.durable_writes.is_empty());
}

#[test]
fn enter_on_focused_buddy_opens_focused_delegate_workspace() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.focus = FocusPane::TeamBuddies;
    app.selected_actor = Some(SelectedActor::FocusedBuddy(0));

    handle_key_event(&mut app, KeyInput::Enter);

    assert_eq!(app.view_mode, ViewMode::FocusedBuddyWorkspace);
    handle_key_event(&mut app, KeyInput::Escape);
    assert_eq!(app.view_mode, ViewMode::Dashboard);
    assert!(app.durable_writes.is_empty());
}

#[test]
fn enter_on_task_rooms_opens_detail_attach_is_explicit_actions_key() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    assert_eq!(app.focus, FocusPane::TaskRooms);
    let effect = handle_key_event(&mut app, KeyInput::Enter);
    assert_eq!(app.selected_task_room, 0);
    assert_eq!(effect, WorkbenchEffect::None);
    assert!(matches!(app.view_mode, ViewMode::Detail(_)));
    handle_key_event(&mut app, KeyInput::Escape);
    assert_eq!(app.view_mode, ViewMode::Dashboard);
    let attach = handle_key_event(&mut app, KeyInput::Actions);
    assert!(
        matches!(attach, WorkbenchEffect::OpenNativeRuntime { .. }),
        "Actions key attaches, got {attach:?}"
    );
    assert!(app.durable_writes.is_empty());
}

#[test]
fn search_filters_rows_and_preserves_safe_selection() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");

    app.push_view(ViewMode::Search);
    handle_key_event(&mut app, KeyInput::Char('l'));
    handle_key_event(&mut app, KeyInput::Char('i'));
    handle_key_event(&mut app, KeyInput::Char('b'));

    assert_eq!(app.view_mode, ViewMode::Search);
    assert_eq!(app.filtered_actor_count(), 1);
    assert!(app.selected_actor_label().contains("Librarian"));
}

#[test]
fn search_counts_agents_task_rooms_updates_and_runtime_setup() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");

    app.search_query = "Claude".to_string();
    let results = app.unified_search_results();
    assert!(results
        .iter()
        .any(|result| result.kind == "TaskRoom" && result.label.contains("Claude")));
    assert!(results
        .iter()
        .any(|result| result.kind == "Runtime" && result.label.contains("Claude")));

    app.search_query = "review".to_string();
    let review_results = app.unified_search_results();
    assert!(review_results
        .iter()
        .any(|result| result.kind == "TaskRoom"));
    assert!(review_results.iter().any(|result| result.kind == "Update"));
}

#[test]
fn slash_opens_command_palette_filters_and_escape_restores_dashboard() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");

    handle_key_event(&mut app, KeyInput::Search);
    assert_eq!(app.view_mode, ViewMode::Search);

    handle_key_event(&mut app, KeyInput::Char('o'));
    handle_key_event(&mut app, KeyInput::Char('p'));
    assert_eq!(app.search_query, "op");

    handle_key_event(&mut app, KeyInput::Escape);
    assert_eq!(app.view_mode, ViewMode::Dashboard);
    assert!(app.durable_writes.is_empty());
}

#[test]
fn colon_opens_command_palette_filters_and_escape_restores_dashboard() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");

    handle_key_event(&mut app, KeyInput::Commands);
    assert_eq!(app.view_mode, ViewMode::CommandPalette);

    handle_key_event(&mut app, KeyInput::Char('o'));
    handle_key_event(&mut app, KeyInput::Char('p'));
    assert_eq!(app.command_query, "op");
    assert!(app
        .visible_commands()
        .iter()
        .all(|command| command.label.contains("op")));

    handle_key_event(&mut app, KeyInput::Escape);
    assert_eq!(app.view_mode, ViewMode::Dashboard);
    assert!(app.durable_writes.is_empty());
}

#[test]
fn dashboard_text_input_does_not_open_generic_prompt_or_capture_text() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");

    handle_key_event(&mut app, KeyInput::Char('m'));
    handle_key_event(&mut app, KeyInput::Char('a'));
    handle_key_event(&mut app, KeyInput::Char('p'));

    assert_eq!(app.view_mode, ViewMode::Dashboard);
    assert!(app.command_query.is_empty());
    assert!(app.search_query.is_empty());
    assert!(app.durable_writes.is_empty());
}

#[test]
fn new_room_creates_immediately_without_compose_modal() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    let effect = handle_key_event(&mut app, KeyInput::NewRoom);
    match effect {
        WorkbenchEffect::CreateTaskRoom(CreateTaskRoomDraft { objective, runtime, .. }) => {
            assert!(objective.is_empty() || objective == "new room");
            assert_eq!(runtime, "pi");
        }
        other => panic!("expected CreateTaskRoom on n, got {other:?}"),
    }
    assert_ne!(app.view_mode, ViewMode::TaskRoomForm);
    assert_ne!(app.view_mode, ViewMode::ConfirmAction);
    assert!(app.durable_writes.is_empty());
}

#[test]
fn room_detail_composer_sends_message_effect() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.push_view(ViewMode::Detail(DetailView::TaskRoom));
    for ch in "Ship it".chars() {
        handle_key_event(&mut app, KeyInput::Char(ch));
    }
    assert_eq!(app.room_composer, "Ship it");
    let effect = handle_key_event(&mut app, KeyInput::Enter);
    match effect {
        WorkbenchEffect::SendRoomMessage { body, room_id } => {
            assert_eq!(body, "Ship it");
            assert!(!room_id.is_empty());
        }
        other => panic!("expected SendRoomMessage, got {other:?}"),
    }
    assert!(app.room_composer.is_empty());
}

#[test]
fn compose_backspace_deletes_typed_chars_in_room_and_handoff() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.push_view(ViewMode::Detail(DetailView::TaskRoom));
    for ch in "abc".chars() {
        handle_key_event(&mut app, KeyInput::Char(ch));
    }
    assert_eq!(app.room_composer, "abc");
    handle_key_event(&mut app, KeyInput::Backspace);
    assert_eq!(app.room_composer, "ab");
    handle_key_event(&mut app, KeyInput::Backspace);
    handle_key_event(&mut app, KeyInput::Backspace);
    assert!(app.room_composer.is_empty());

    handle_key_event(&mut app, KeyInput::Escape);
    app.push_view(ViewMode::TaskRoomWorkspace);
    handle_key_event(&mut app, KeyInput::Handoff);
    for ch in "xy".chars() {
        handle_key_event(&mut app, KeyInput::Char(ch));
    }
    assert_eq!(app.handoff_form.body, "xy");
    handle_key_event(&mut app, KeyInput::Backspace);
    assert_eq!(app.handoff_form.body, "x");
}

#[test]
fn handoff_form_opens_from_taskroom_workspace_and_submits_typed_effect() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");

    app.push_view(ViewMode::TaskRoomWorkspace);
    assert_eq!(app.view_mode, ViewMode::TaskRoomWorkspace);

    handle_key_event(&mut app, KeyInput::Handoff);
    assert_eq!(app.view_mode, ViewMode::HandoffForm);

    for ch in "please review".chars() {
        handle_key_event(&mut app, KeyInput::Char(ch));
    }

    let effect = handle_key_event(&mut app, KeyInput::Enter);
    assert_ne!(app.view_mode, ViewMode::ConfirmAction);
    match effect {
        WorkbenchEffect::CreateHandoff(CreateHandoffDraft { body, .. }) => {
            assert_eq!(body, "please review");
        }
        other => panic!("expected CreateHandoff, got {other:?}"),
    }
}

#[test]
fn structured_question_accepts_numbered_answer_with_typed_effect() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.structured_question = Some(StructuredQuestion {
        prompt: "Choose runtime".to_string(),
        choices: vec![
            StructuredQuestionChoice {
                id: "opencode".to_string(),
                label: "OpenCode".to_string(),
            },
            StructuredQuestionChoice {
                id: "claude".to_string(),
                label: "Claude".to_string(),
            },
        ],
        selected_choice: 0,
        allows_free_text: false,
        free_text: String::new(),
        destination_label: "Runtime selection".to_string(),
        effect_label: "Open native runtime".to_string(),
        attach_room_id: None,
    });
    app.push_view(ViewMode::StructuredQuestion);

    let effect = handle_key_event(&mut app, KeyInput::StructuredAnswer(2));
    assert_eq!(
        effect,
        WorkbenchEffect::AnswerQuestion("claude".to_string())
    );
    assert_eq!(app.view_mode, ViewMode::ActionProgress);
}

#[test]
fn help_and_runtime_setup_open_without_durable_writes() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");

    handle_key_event(&mut app, KeyInput::Help);
    assert_eq!(app.view_mode, ViewMode::Help);

    handle_key_event(&mut app, KeyInput::Escape);
    handle_key_event(&mut app, KeyInput::RuntimeSetup);
    assert_eq!(app.view_mode, ViewMode::Detail(DetailView::RuntimeSetup));
    assert!(app.durable_writes.is_empty());
}

#[test]
fn taskroom_first_home_exposes_contextual_actions_from_selected_room() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");

    assert_eq!(app.focus, FocusPane::TaskRooms);
    assert_eq!(app.selected_task_room, 0);

    handle_key_event(&mut app, KeyInput::Down);
    assert_eq!(app.selected_task_room, 1);

    let effect = handle_key_event(&mut app, KeyInput::Enter);
    assert_eq!(effect, WorkbenchEffect::None);
    assert!(
        matches!(app.view_mode, ViewMode::Detail(_)),
        "selected room Enter opens detail/thread, got {:?}",
        app.view_mode
    );
    assert!(app.durable_writes.is_empty());
}
