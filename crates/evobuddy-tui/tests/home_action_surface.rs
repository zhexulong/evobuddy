use evobuddy_tui::action_hints::action_hints;
use evobuddy_tui::app::{WorkbenchApp, WorkbenchEffect};
use evobuddy_tui::input::{handle_key_event, KeyInput};
use evobuddy_tui::model::parse_workbench_state;
use evobuddy_tui::ui::render_dashboard_snapshot;
use evobuddy_tui::views::ViewMode;
use std::fs;
use std::path::PathBuf;

fn load_app() -> WorkbenchApp {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures/evobuddy-workbench-state-v1.json");
    let state = parse_workbench_state(&fs::read_to_string(path).unwrap()).unwrap();
    WorkbenchApp::new(state)
}

#[test]
fn home_action_hints_allowlist_max_four_without_handoff_evidence_trace() {
    let app = load_app();
    assert_eq!(app.view_mode, ViewMode::Dashboard);
    assert!(app.selected_task_room().is_some());
    let hints = action_hints(&app);
    assert!(
        hints.len() <= 4,
        "Home bar must have ≤4 hints, got {}: {:?}",
        hints.len(),
        hints.iter().map(|h| h.key).collect::<Vec<_>>()
    );
    let keys: Vec<&str> = hints.iter().map(|h| h.key).collect();
    assert!(keys.iter().any(|k| *k == "Enter" || k.starts_with("Enter")));
    assert!(keys.contains(&"n"));
    assert!(keys.contains(&"?"));
    assert!(!keys.contains(&"h"), "no handoff key: {keys:?}");
    assert!(!keys.contains(&"e"), "no evidence key: {keys:?}");
    assert!(!keys.contains(&"r"), "no trace key: {keys:?}");
    assert!(
        !keys.contains(&":"),
        "no Commands on first-paint bar: {keys:?}"
    );
    for h in &hints {
        let label = h.label.to_lowercase();
        assert!(!label.contains("handoff"), "forbidden {}", h.label);
        assert!(!label.contains("evidence"), "forbidden {}", h.label);
        assert!(
            !label.contains("commands"),
            "forbidden bar label {}",
            h.label
        );
    }
}

#[test]
fn home_h_key_does_not_open_handoff_form() {
    let mut app = load_app();
    let effect = handle_key_event(&mut app, KeyInput::Handoff);
    assert!(matches!(effect, WorkbenchEffect::None));
    assert_eq!(app.view_mode, ViewMode::Dashboard);
}



#[test]
fn home_snapshot_omits_promoted_handoff_and_evidence_actions() {
    let app = load_app();
    let frame = render_dashboard_snapshot(&app, 120, 40).unwrap();
    assert!(!frame.to_lowercase().contains("handoff"), "{frame}");
    assert!(
        !frame.contains("Evidence") && !frame.contains("evidence"),
        "Home chrome must not promote Evidence action label:\n{frame}"
    );
}

#[test]
fn home_enter_hint_is_short_attach_not_open_native_runtime() {
    use evobuddy_tui::action_hints::{action_hints, short_primary_action_label};
    use evobuddy_tui::model::ActionAvailability;

    let mapped = short_primary_action_label(&ActionAvailability {
        id: "open-native-runtime".to_string(),
        label: "Open native runtime".to_string(),
        enabled: true,
        disabled_reason: None,
    });
    assert_eq!(mapped, "Attach");

    let app = load_app();
    let enter = action_hints(&app)
        .into_iter()
        .find(|h| h.key == "Enter")
        .expect("Enter hint");
    assert_eq!(enter.label, "Attach");
    assert!(enter.enabled);

    let frame = render_dashboard_snapshot(&app, 120, 40).unwrap();
    assert!(frame.contains("Attach"), "{frame}");
    assert!(
        !frame.contains("Open native runtime"),
        "bar/peek must short-label open-native-runtime:\n{frame}"
    );
}

#[test]
fn empty_home_teaches_n_without_handoff() {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures/evobuddy-workbench-state-v1.json");
    let mut state = parse_workbench_state(&fs::read_to_string(path).unwrap()).unwrap();
    state.task_rooms.clear();
    let app = WorkbenchApp::new(state);
    let frame = render_dashboard_snapshot(&app, 120, 40).unwrap();
    assert!(
        frame.contains("No TaskRooms yet") || frame.contains("Press n"),
        "{frame}"
    );
    assert!(!frame.to_lowercase().contains("handoff"), "{frame}");
}

#[test]
fn multi_seat_present_seat_choice_lists_builder_and_reviewer() {
    let mut app = load_app();
    let room = app.selected_task_room().expect("room");
    assert!(
        room.participants.len() >= 2,
        "fixture room should be multi-seat for D3"
    );
    let effect = app.present_seat_choice();
    assert_eq!(effect, WorkbenchEffect::None);
    assert_eq!(app.view_mode, ViewMode::StructuredQuestion);
    let question = app.structured_question.as_ref().expect("seat question");
    assert!(question.prompt.contains("Choose seat"));
    assert!(question.choices.len() >= 2);
    let labels = question
        .choices
        .iter()
        .map(|c| c.label.to_lowercase())
        .collect::<Vec<_>>();
    assert!(
        labels.iter().any(|l| l.contains("builder") || l.contains("reviewer")),
        "seat labels should surface builder/reviewer: {labels:?}"
    );
}

#[test]
fn home_m_key_opens_seat_choice_for_multi_seat_room() {
    let mut app = load_app();
    assert!(
        app.selected_task_room()
            .map(|room| room.participants.len() >= 2)
            .unwrap_or(false)
    );
    let effect = handle_key_event(&mut app, KeyInput::ChooseSeat);
    assert_eq!(effect, WorkbenchEffect::None);
    assert_eq!(app.view_mode, ViewMode::StructuredQuestion);
}

#[test]
fn home_attention_labels_include_ready_working_needs_copy() {
    let app = load_app();
    let text = render_dashboard_snapshot(&app, 100, 24).expect("render home");
    assert!(
        text.contains("Needs you") || text.contains("need"),
        "Home should show Needs-style copy: {text}"
    );
    assert!(
        text.contains("Working") || text.contains("working"),
        "Home should show Working copy: {text}"
    );
    assert!(
        text.contains("Ready") || text.contains("ready"),
        "Home should show Ready copy: {text}"
    );
}
