use std::fs;
use std::path::PathBuf;

use evobuddy_tui::app::{
    StructuredQuestion, StructuredQuestionChoice, WorkbenchApp, WorkbenchEffect,
};
use evobuddy_tui::model::parse_workbench_state;

fn fixture_app() -> WorkbenchApp {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures")
        .join("evobuddy-workbench-state-v1.json");
    let text = fs::read_to_string(path).expect("read fixture");
    let state = parse_workbench_state(&text).expect("parse state");
    WorkbenchApp::new(state)
}

fn effect_names_handled_by_ui() -> Vec<&'static str> {
    vec!["OpenNativeRuntime"]
}

#[test]
fn create_task_room_effect_is_executed_not_discarded() {
    let mut app = fixture_app();
    let effect = app.submit_task_room_form();
    assert!(matches!(effect, WorkbenchEffect::CreateTaskRoom(_)));
    let handled = effect_names_handled_by_ui();
    assert!(
        handled.contains(&"CreateTaskRoom"),
        "CreateTaskRoom must be executed by the interactive UI, not discarded after mock queue status"
    );
    assert!(
        !app.durable_writes.is_empty()
            || app.action_status.as_deref() != Some("taskroom creation queued"),
        "CreateTaskRoom must not stop at mock-only queue status without durable execution"
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
fn create_handoff_and_answer_question_effects_are_typed_and_must_be_handled() {
    let mut app = fixture_app();
    app.open_handoff_form();
    app.handoff_form.sender = "builder".to_string();
    app.handoff_form.receiver = "reviewer".to_string();
    app.handoff_form.body = "ship".to_string();
    let handoff = app.submit_handoff_form();
    assert!(matches!(handoff, WorkbenchEffect::CreateHandoff(_)));

    let mut app = fixture_app();
    app.structured_question = Some(StructuredQuestion {
        prompt: "Choose runtime".to_string(),
        choices: vec![StructuredQuestionChoice {
            id: "codex".to_string(),
            label: "Codex".to_string(),
        }],
        selected_choice: 0,
        allows_free_text: false,
        free_text: String::new(),
        destination_label: "Runtime".to_string(),
        effect_label: "Continue".to_string(),
    });
    let answer = app.submit_structured_answer(0);
    assert!(matches!(answer, WorkbenchEffect::AnswerQuestion(_)));

    let handled = effect_names_handled_by_ui();
    assert!(
        handled.contains(&"CreateHandoff") && handled.contains(&"AnswerQuestion"),
        "typed mutation effects must be handled by the UI executor, not discarded"
    );
}
