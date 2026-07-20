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
    assert!(snapshot.contains("Team"));
    assert!(snapshot.contains("Delegates"));
    assert!(snapshot.contains("TaskRooms"));
    assert!(snapshot.contains("Runtime Setup"));
    assert!(snapshot.contains("Updates"));
    assert!(snapshot.contains("[/ search]"));
    assert!(snapshot.contains("Objective"));
    assert!(snapshot.contains("Acceptance"));
}

#[test]
fn dashboard_snapshot_120x40_shows_agent_command_center() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let snapshot = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");

    for landmark in [
        "Attention",
        "TaskRooms",
        "Selected TaskRoom",
        "Objective",
        "Acceptance",
        "Active Workspace",
        "Inspector",
        "Trace",
        "/ search",
        ": commands",
        "Open TaskRoom",
        "Open native runtime",
    ] {
        assert!(
            snapshot.contains(landmark),
            "missing v2 command-center landmark `{landmark}` in snapshot:\n{snapshot}"
        );
    }

    assert!(
        !(snapshot.contains("Team & Buddies")
            && snapshot.contains("Peek")
            && !snapshot.contains("Active Workspace")),
        "dashboard must not remain the raw v0 Team & Buddies + Peek shell"
    );
}

#[test]
fn dashboard_snapshot_groups_agents_by_attention_status() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let snapshot = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");

    for group in ["Needs you", "Working", "Returned", "Available"] {
        assert!(
            snapshot.contains(group),
            "missing grouped roster heading `{group}` in snapshot:\n{snapshot}"
        );
    }

    let returned_index = snapshot.find("Returned").expect("returned group exists");
    let available_index = snapshot.find("Available").expect("available group exists");
    assert!(
        returned_index < available_index,
        "returned actors should be listed before available actors"
    );
    assert!(snapshot.contains("returned · 2"));
    assert!(snapshot.contains("available · 4"));
}

#[test]
fn dashboard_snapshot_search_summary_counts_multi_domain_results() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.search_query = "Claude".to_string();
    let snapshot = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");

    assert!(snapshot.contains("Search: Claude"));
    assert!(snapshot.contains("results"));
    assert!(snapshot.contains("product context retained"));
    assert!(snapshot.contains("Team"));
    assert!(snapshot.contains("Delegates"));
    assert!(snapshot.contains("TaskRooms"));
    assert!(!snapshot.contains("Experts"));
}

#[test]
fn dashboard_snapshot_80x24_compacts_but_preserves_sections() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let snapshot = render_dashboard_snapshot(&app, 80, 24).expect("render snapshot");

    assert!(snapshot.contains("TaskRooms"));
    assert!(snapshot.contains("Active Workspace"));
    assert!(snapshot.contains("[/ search]"));
    assert!(snapshot.contains("Codex"));
    assert!(snapshot.contains("OpenCode"));
    assert!(!snapshot.contains("Experts"));
}

#[test]
fn dashboard_snapshot_prioritizes_selected_taskroom_attention_and_actions() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let snapshot = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");

    for landmark in [
        "OpenCode review loop",
        "Returned",
        "runtime-exporter",
        "Objective",
        "Complete the retained OpenCode review loop",
        "Acceptance",
        "Reviewer continuity passes",
        "Open native runtime",
    ] {
        assert!(
            snapshot.contains(landmark),
            "missing taskroom-first landmark `{landmark}` in snapshot:\n{snapshot}"
        );
    }
}

#[test]
fn dashboard_snapshot_separates_team_members_from_omo_delegates() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let snapshot = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");

    assert!(
        snapshot.contains("Team · Members"),
        "missing team member surface:\n{snapshot}"
    );
    assert!(
        snapshot.contains("Delegates · OMO specialists"),
        "missing OMO delegate surface:\n{snapshot}"
    );
    assert!(
        snapshot.contains("TeamMember"),
        "team rows must identify member semantics:\n{snapshot}"
    );
    assert!(
        snapshot.contains("FocusedBuddy"),
        "delegate rows must identify buddy semantics:\n{snapshot}"
    );
    assert!(
        !snapshot.contains("Experts"),
        "TeamAgents and FocusedBuddies must not be merged under Experts:\n{snapshot}"
    );
    assert!(
        !snapshot.contains("Raft"),
        "TUI must not explicitly name external design references:\n{snapshot}"
    );
}

#[test]
fn dashboard_snapshot_60x20_uses_narrow_layout_and_avoids_plaintext_report_shape() {
    let app = load_app("evobuddy-workbench-state-current.json");
    let snapshot = render_dashboard_snapshot(&app, 60, 20).expect("render snapshot");

    assert!(snapshot.contains("EvoBuddy"));
    assert!(snapshot.contains("TaskRooms"));
    assert!(snapshot.contains("Updates"));
    assert!(!snapshot.contains("EvoBuddy Workbench\n\nTeam Agents\n-"));
}

#[test]
fn narrow_dashboard_uses_selected_sorted_taskroom_not_raw_first_room() {
    let mut app = load_app("evobuddy-workbench-state-unsorted-taskrooms.json");
    let snapshot = render_dashboard_snapshot(&app, 60, 20).expect("render snapshot");

    assert!(snapshot.contains("Urgent room sorted-first"), "{snapshot}");
    assert!(!snapshot.contains("Completed room raw-first"), "{snapshot}");

    handle_key_event(&mut app, KeyInput::Down);
    let moved_snapshot = render_dashboard_snapshot(&app, 60, 20).expect("render moved snapshot");
    assert!(moved_snapshot.contains("Completed room raw-first"), "{moved_snapshot}");
}

#[test]
fn home_is_taskroom_inbox_not_debug_dashboard() {
    let app = load_app("evobuddy-workbench-state-v1.json");
    let frame = render_dashboard_snapshot(&app, 120, 40).expect("render snapshot");
    assert!(frame.contains("Needs input") || frame.contains("Needs Input"));
    assert!(frame.contains("Work inbox") || frame.contains("TaskRoom inbox"));
    assert!(!frame.contains("Read-only boundary"));
    assert!(frame.contains("Detach:") || frame.contains("Enter Open") || frame.contains("Enter  Open"));
}
