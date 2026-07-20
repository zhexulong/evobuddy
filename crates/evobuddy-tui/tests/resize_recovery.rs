use std::fs;
use std::path::PathBuf;

use evobuddy_tui::app::WorkbenchApp;
use evobuddy_tui::model::parse_workbench_state;
use evobuddy_tui::ui::render_dashboard_snapshot;

fn load_app() -> WorkbenchApp {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures")
        .join("evobuddy-workbench-state-v1.json");
    let text = fs::read_to_string(path).expect("read fixture");
    let state = parse_workbench_state(&text).expect("parse state");
    WorkbenchApp::new(state)
}

#[test]
fn resize_keeps_inbox_and_action_bar_landmarks() {
    let app = load_app();
    for (w, h) in [(120u16, 40u16), (80, 24), (60, 20)] {
        let frame = render_dashboard_snapshot(&app, w, h).expect("render");
        assert!(
            frame.contains("Work inbox") || frame.contains("TaskRoom"),
            "missing inbox at {w}x{h}:\n{frame}"
        );
        assert!(
            frame.contains("New room") || frame.contains("Help") || frame.contains("Search"),
            "missing action bar at {w}x{h}:\n{frame}"
        );
        assert!(!frame.contains("Read-only boundary"));
    }
}

#[test]
fn restart_reloads_durable_rooms_from_fixture_state() {
    let app = load_app();
    assert!(!app.state.task_rooms.is_empty());
    let again = load_app();
    assert_eq!(app.state.task_rooms.len(), again.state.task_rooms.len());
    assert_eq!(app.state.task_rooms[0].id, again.state.task_rooms[0].id);
}
