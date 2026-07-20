use std::fs;
use std::path::PathBuf;

use anyhow::{bail, Result};
use evobuddy_tui::app::{
    CreateHandoffDraft, CreateTaskRoomDraft, FocusPane, SelectedActor, StructuredQuestion,
    StructuredQuestionChoice, WorkbenchApp, WorkbenchEffect,
};
use evobuddy_tui::backend::BackendCommand;
use evobuddy_tui::effects::{execute_effect, EffectDeps, EffectOutcome};
use evobuddy_tui::input::{handle_key_event, KeyInput};
use evobuddy_tui::model::parse_workbench_state;
use evobuddy_tui::ui::effect_names_handled_by_ui;
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
    assert_eq!(app.focus, FocusPane::RuntimeSetup);
}

#[test]
fn enter_opens_detail_and_escape_returns_to_dashboard() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");

    handle_key_event(&mut app, KeyInput::Enter);
    assert_eq!(app.view_mode, ViewMode::TaskRoomWorkspace);

    handle_key_event(&mut app, KeyInput::Escape);
    assert_eq!(app.view_mode, ViewMode::Dashboard);
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
fn enter_on_task_rooms_opens_task_room_workspace() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");

    assert_eq!(app.focus, FocusPane::TaskRooms);
    handle_key_event(&mut app, KeyInput::Enter);

    assert_eq!(app.view_mode, ViewMode::TaskRoomWorkspace);
    assert_eq!(app.selected_task_room, 0);
    handle_key_event(&mut app, KeyInput::Escape);
    assert_eq!(app.view_mode, ViewMode::Dashboard);
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
fn new_room_form_opens_from_dashboard_and_submits_typed_effect() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");

    handle_key_event(&mut app, KeyInput::NewRoom);
    assert_eq!(app.view_mode, ViewMode::TaskRoomForm);

    handle_key_event(&mut app, KeyInput::Char('M'));
    handle_key_event(&mut app, KeyInput::Char('V'));
    handle_key_event(&mut app, KeyInput::NextField);
    handle_key_event(&mut app, KeyInput::Char('D'));
    handle_key_event(&mut app, KeyInput::Char('o'));
    handle_key_event(&mut app, KeyInput::NextField);
    handle_key_event(&mut app, KeyInput::NextField);
    handle_key_event(&mut app, KeyInput::NextField);
    handle_key_event(&mut app, KeyInput::Char('o'));
    handle_key_event(&mut app, KeyInput::Char('p'));

    let effect = handle_key_event(&mut app, KeyInput::Enter);

    assert_eq!(app.view_mode, ViewMode::ActionProgress);
    assert_eq!(
        effect,
        WorkbenchEffect::CreateTaskRoom(CreateTaskRoomDraft {
            objective: "MV".to_string(),
            acceptance_criteria: "Do".to_string(),
            workspace: String::new(),
            actor: String::new(),
            runtime: "op".to_string(),
            safety_mode: String::new(),
        })
    );
    assert!(app.durable_writes.is_empty());
}

#[test]
fn handoff_form_opens_from_taskroom_workspace_and_submits_typed_effect() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");

    handle_key_event(&mut app, KeyInput::Enter);
    assert_eq!(app.view_mode, ViewMode::TaskRoomWorkspace);

    handle_key_event(&mut app, KeyInput::Handoff);
    assert_eq!(app.view_mode, ViewMode::HandoffForm);

    handle_key_event(&mut app, KeyInput::Char('B'));
    handle_key_event(&mut app, KeyInput::NextField);
    handle_key_event(&mut app, KeyInput::Char('R'));
    handle_key_event(&mut app, KeyInput::NextField);
    handle_key_event(&mut app, KeyInput::Char('O'));

    let effect = handle_key_event(&mut app, KeyInput::Enter);
    assert_eq!(
        effect,
        WorkbenchEffect::CreateHandoff(CreateHandoffDraft {
            sender: "B".to_string(),
            receiver: "R".to_string(),
            body: "O".to_string(),
            artifact_refs: String::new(),
            expected_next_action: String::new(),
            return_destination: String::new(),
        })
    );
    assert_eq!(app.view_mode, ViewMode::ActionProgress);
}

#[test]
fn empty_task_room_form_fields_block_submit() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    handle_key_event(&mut app, KeyInput::NewRoom);
    let effect = handle_key_event(&mut app, KeyInput::Enter);
    assert_eq!(effect, WorkbenchEffect::None);
    assert_eq!(app.view_mode, ViewMode::TaskRoomForm);
    assert!(app.task_room_form_field_errors[0].is_some());
    assert!(app.task_room_form_field_errors[4].is_some());
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

    handle_key_event(&mut app, KeyInput::Enter);
    assert_eq!(app.view_mode, ViewMode::TaskRoomWorkspace);
    assert!(app.durable_writes.is_empty());
}

#[test]
fn create_task_room_effect_is_executed_not_discarded() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.task_room_form.objective = "obj".to_string();
    app.task_room_form.runtime = "opencode".to_string();
    let effect = app.submit_task_room_form();
    assert!(matches!(effect, WorkbenchEffect::CreateTaskRoom(_)));
    let handled = effect_names_handled_by_ui();
    assert!(
        handled.contains(&"CreateTaskRoom"),
        "CreateTaskRoom must be executed by the interactive UI, not discarded after mock queue status"
    );

    let reloaded = app.state.clone();
    let mut deps = EffectDeps {
        project: PathBuf::from(&app.state.project_root),
        run_command: Box::new(|cmd: &BackendCommand| -> Result<String> {
            if cmd.args.windows(2).any(|w| w == ["taskroom", "create"]) {
                Ok(r#"{"roomId":"taskroom:obj","title":"obj","objective":"obj"}"#.to_string())
            } else {
                bail!("unexpected command: {} {}", cmd.program, cmd.args.join(" "))
            }
        }),
        load_state: Box::new(move || Ok(reloaded.clone())),
        open_native: None,
    };
    let outcome = execute_effect(&mut app, effect, &mut deps).expect("execute");
    assert!(matches!(outcome, EffectOutcome::StateReloaded));
    assert!(
        !app.durable_writes.is_empty(),
        "CreateTaskRoom must signal durable write path (durable_writes must not be empty)"
    );
    assert!(
        app.action_status.as_deref() != Some("taskroom creation queued"),
        "CreateTaskRoom must not stop at mock-only queue status without durable execution"
    );
    assert!(
        app.action_status
            .as_deref()
            .is_some_and(|s| s.contains("Created TaskRoom")),
        "got {:?}",
        app.action_status
    );
}

#[test]
fn open_native_runtime_is_not_the_only_executed_effect() {
    let handled = effect_names_handled_by_ui();
    assert!(handled.contains(&"CreateTaskRoom"));
    assert!(handled.contains(&"CreateHandoff"));
    assert!(handled.contains(&"AnswerQuestion"));
    assert!(handled.contains(&"RefreshEvidence"));
}


#[test]
fn evidence_key_emits_refresh_evidence_effect() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.push_view(ViewMode::TaskRoomWorkspace);
    let effect = handle_key_event(&mut app, KeyInput::Evidence);
    assert!(
        matches!(effect, WorkbenchEffect::RefreshEvidence { .. }),
        "e should emit RefreshEvidence, got {effect:?}"
    );
}
