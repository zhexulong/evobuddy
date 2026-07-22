use std::fs;
use std::path::PathBuf;

use evobuddy_tui::app::WorkbenchApp;
use evobuddy_tui::input::{handle_key_event, KeyInput};
use evobuddy_tui::model::parse_workbench_state;
use evobuddy_tui::ui::render_dashboard_snapshot;

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures")
        .join(name)
}

fn load_app(name: &str) -> WorkbenchApp {
    let text = fs::read_to_string(fixture_path(name)).expect("read fixture");
    let state = parse_workbench_state(&text).expect("parse state");
    WorkbenchApp::new(state)
}

#[test]
fn dashboard_snapshot_120x40_shows_full_panes() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let snapshot = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");
    assert!(snapshot.contains("EvoBuddy"));
    assert!(snapshot.contains("❯"));
    assert!(snapshot.contains("Work inbox") || snapshot.contains("TaskRoom inbox"));
    assert!(
        snapshot.contains("Room") || snapshot.contains("Selected"),
        "home dual-pane room peek missing:\n{snapshot}"
    );
    assert!(
        snapshot.contains("Work ·") || snapshot.contains("Work:") || snapshot.contains("Members ·"),
        "room peek content missing:\n{snapshot}"
    );
    assert!(snapshot.contains("New room") || snapshot.contains("n  New") || snapshot.contains("new"));
    assert!(!snapshot.contains("Read-only boundary"));
    assert!(!snapshot.contains("Acceptance criteria"));
}

#[test]
fn dashboard_snapshot_120x40_shows_agent_command_center() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let snapshot = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");
    for landmark in ["Needs you", "Work inbox", "Attach"] {
        assert!(
            snapshot.contains(landmark),
            "missing inbox landmark `{landmark}`:\n{snapshot}"
        );
    }
    assert!(
        snapshot.contains("Room") || snapshot.contains("Members ·") || snapshot.contains("Work ·"),
        "dual-pane room column missing:\n{snapshot}"
    );
    assert!(
        snapshot.contains("new") || snapshot.contains("New"),
        "new room affordance missing:\n{snapshot}"
    );
    assert!(
        snapshot.contains("Search") || snapshot.contains("Choose seat"),
        "home bar should keep Search or multi-seat Choose seat:\n{snapshot}"
    );
    assert!(!snapshot.contains("Read-only boundary"));
}

#[test]
fn dashboard_snapshot_attention_strip_counts_taskrooms() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let snapshot = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");
    assert!(
        snapshot.contains("need input")
            || snapshot.contains("Needs you")
            || snapshot.contains("Needs")
    );
    assert!(
        snapshot.contains("Working")
            || snapshot.contains("Ready")
            || snapshot.contains("Returned")
    );
    assert!(snapshot.contains("Returned"));
}

#[test]
fn dashboard_snapshot_search_summary_counts_results() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.search_query = "Claude".to_string();
    let snapshot = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");
    assert!(snapshot.contains("Search: Claude"));
    assert!(snapshot.contains("results"));
}

#[test]
fn dashboard_snapshot_80x24_compacts_but_preserves_inbox() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let snapshot = render_dashboard_snapshot(&app, 80, 24).expect("render snapshot");
    assert!(snapshot.contains("Work inbox") || snapshot.contains("TaskRoom"));
    assert!(
        snapshot.contains("Room")
            || snapshot.contains("Work ·")
            || snapshot.contains("Members ·")
            || snapshot.contains("Work:")
    );
    assert!(!snapshot.contains("Read-only boundary"));
}

#[test]
fn dashboard_snapshot_prioritizes_selected_taskroom_attention_and_actions() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let snapshot = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");
    for landmark in [
        "OpenCode review loop",
        "Returned",
        "Now ·",
        "Members ·",
        "Work ·",
        "Session ·",
        "Attach",
        "attachable",
    ] {
        assert!(
            snapshot.contains(landmark),
            "missing landmark `{landmark}`:\n{snapshot}"
        );
    }
    assert!(
        snapshot.contains("Complete the retained OpenCode")
            || snapshot.contains("OpenCode review"),
        "selected room work text missing:\n{snapshot}"
    );
    assert!(
        !snapshot.contains("Primary action"),
        "Home peek must not use old Primary action chrome:\n{snapshot}"
    );
    assert!(
        !snapshot.contains("Open native runtime"),
        "Home must short-label open-native-runtime as Attach:\n{snapshot}"
    );
}

#[test]
fn dashboard_snapshot_is_taskroom_first_not_team_dashboard() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let snapshot = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");
    assert!(snapshot.contains("Work inbox"));
    assert!(
        snapshot.contains("Room") || snapshot.contains("Members ·"),
        "taskroom-first dual pane missing:\n{snapshot}"
    );
    assert!(!snapshot.contains("Team · Members"));
    assert!(!snapshot.contains("Delegates · OMO specialists"));
    assert!(!snapshot.contains("Read-only boundary"));
}

#[test]
fn dashboard_snapshot_60x20_uses_narrow_layout_and_avoids_plaintext_report_shape() {
    let app = load_app("evobuddy-workbench-state-current.json");
    let snapshot = render_dashboard_snapshot(&app, 60, 20).expect("render snapshot");
    assert!(snapshot.contains("EvoBuddy"));
    assert!(snapshot.contains("Work inbox") || snapshot.contains("TaskRoom"));
    assert!(!snapshot.contains("EvoBuddy Workbench\n\nTeam Agents\n-"));
    assert!(!snapshot.contains("Read-only boundary"));
}

#[test]
fn narrow_dashboard_uses_selected_sorted_taskroom_not_raw_first_room() {
    let mut app = load_app("evobuddy-workbench-state-unsorted-taskrooms.json");
    let snapshot = render_dashboard_snapshot(&app, 60, 20).expect("render snapshot");
    assert!(snapshot.contains("Urgent room sorted-first"), "{snapshot}");
    // Inbox list may show both rooms; selected detail must prioritize Needs input first.
    assert!(snapshot.contains("Urgent room sorted-first"), "{snapshot}");
    handle_key_event(&mut app, KeyInput::Down);
    let moved = render_dashboard_snapshot(&app, 60, 20).expect("moved");
    assert!(moved.contains("Completed room raw-first"), "{moved}");
}

#[test]
fn home_is_taskroom_inbox_not_debug_dashboard() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let frame = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");
    assert!(
        frame.contains("need input") || frame.contains("Needs input") || frame.contains("Needs")
    );
    assert!(frame.contains("Work inbox") || frame.contains("TaskRoom inbox"));
    assert!(!frame.contains("Read-only boundary"));
    assert!(
        frame.contains("Detach:")
            || frame.contains("Enter Attach")
            || frame.contains("Enter  Attach")
            || frame.contains("Attach")
            || frame.contains("New room")
    );
}

#[test]
fn action_bar_shows_contextual_dashboard_hints() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let snapshot = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");
    assert!(
        snapshot.contains("New room") && snapshot.contains("Help"),
        "missing contextual action bar landmarks:
{snapshot}"
    );
    assert!(
        !snapshot.to_lowercase().contains("handoff"),
        "Home must not promote handoff:
{snapshot}"
    );
    assert!(
        !snapshot.contains("Evidence"),
        "Home must not promote Evidence:
{snapshot}"
    );
    assert!(
        !snapshot.contains("Commands"),
        "Home bar must not show Commands landmark:
{snapshot}"
    );
}
