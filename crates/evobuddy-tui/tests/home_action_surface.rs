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
fn home_e_key_does_not_emit_refresh_evidence() {
    let mut app = load_app();
    let effect = handle_key_event(&mut app, KeyInput::Evidence);
    assert!(
        matches!(effect, WorkbenchEffect::None),
        "Home must not use e as evidence console, got {effect:?}"
    );
    assert_eq!(app.view_mode, ViewMode::Dashboard);
}

#[test]
fn home_r_key_does_not_open_trace_drawer() {
    let mut app = load_app();
    let _ = handle_key_event(&mut app, KeyInput::Trace);
    assert_eq!(
        app.view_mode,
        ViewMode::Dashboard,
        "Home must not open TraceDrawer via r"
    );
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
