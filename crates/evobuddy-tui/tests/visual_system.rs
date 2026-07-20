use std::fs;
use std::path::PathBuf;

use anyhow::Result;
use evobuddy_tui::app::WorkbenchApp;
use evobuddy_tui::model::parse_workbench_state;
use evobuddy_tui::ui::render_dashboard_snapshot;

fn app_with_rooms() -> WorkbenchApp {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures")
        .join("evobuddy-workbench-state-v1.json");
    let text = fs::read_to_string(path).expect("read fixture");
    let state = parse_workbench_state(&text).expect("parse state");
    WorkbenchApp::new(state)
}

fn render_snapshot(app: &WorkbenchApp, width: u16, height: u16) -> Result<String> {
    render_dashboard_snapshot(app, width, height)
}

#[test]
fn home_is_taskroom_inbox_not_debug_dashboard() {
    let frame = render_snapshot(&app_with_rooms(), 120, 40).unwrap();
    assert!(frame.contains("Needs input") || frame.contains("Needs Input"));
    assert!(frame.contains("Work inbox") || frame.contains("TaskRoom inbox"));
    assert!(!frame.contains("Read-only boundary"));
    assert!(frame.contains("Detach:") || frame.contains("Enter Open") || frame.contains("Enter  Open"));
}

#[test]
fn home_forbids_equal_weight_debug_chrome_as_primary_surface() {
    let frame = render_snapshot(&app_with_rooms(), 120, 40).unwrap();
    assert!(
        frame.contains("Work inbox")
            || frame.contains("TaskRoom inbox")
            || frame.contains("Selected TaskRoom"),
        "missing TaskRoom-first primary surface landmarks:\n{frame}"
    );
    assert!(
        !frame.contains("Read-only boundary"),
        "home must not advertise read-only once mutation path is the product goal:\n{frame}"
    );
}
