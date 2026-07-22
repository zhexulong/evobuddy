use std::fs;
use std::path::PathBuf;

use evobuddy_tui::app::{FocusPane, WorkbenchApp};
use evobuddy_tui::input::{handle_key_event, KeyInput};
use evobuddy_tui::model::parse_workbench_state;
use evobuddy_tui::ui::render_current_snapshot;
use evobuddy_tui::views::{DetailView, ViewMode};

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
fn team_member_workspace_snapshot_shows_structured_team_room_and_member_actions() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.focus = FocusPane::TeamBuddies;
    handle_key_event(&mut app, KeyInput::Down);
    handle_key_event(&mut app, KeyInput::Enter);

    let snapshot = render_current_snapshot(&app, 120, 40).expect("render workspace snapshot");
    for landmark in [
        "Team Member Workspace",
        "Visible team member",
        "Reviewer",
        "Role",
        "TaskRooms",
        "Handoffs",
        "Returned to",
        "Actions",
        "Start member adapter task",
        "Open Trace",
    ] {
        assert!(
            snapshot.contains(landmark),
            "missing team member workspace landmark `{landmark}` in snapshot:\n{snapshot}"
        );
    }
    assert!(!snapshot.contains("Agent Workspace"));
    assert!(!snapshot.contains("Start buddy adapter task"));
    assert!(!snapshot.contains("Raft"));
}

#[test]
fn trace_drawer_snapshot_shows_recovery_and_proof_taxonomy_only_in_trace() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.view_mode = ViewMode::TraceDrawer;
    let snapshot = render_current_snapshot(&app, 120, 40).expect("render trace");
    for landmark in [
        "Trace",
        "Claim ceiling",
        "Recovery diagnostics",
        "Proof taxonomy (trace only)",
        "exact-resume",
        "heuristic-resume",
        "continue-with-context",
        "fresh-session",
    ] {
        assert!(
            snapshot.contains(landmark),
            "missing trace landmark `{landmark}` in snapshot:\n{snapshot}"
        );
    }
    assert!(
        !snapshot
            .lines()
            .next()
            .unwrap_or("")
            .contains("PRODUCT PASS"),
        "proof taxonomy must not appear as first-level product pass"
    );
}

#[test]
fn focused_buddy_workspace_snapshot_shows_delegate_boundary_and_buddy_actions() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.focus = FocusPane::TeamBuddies;
    app.selected_actor = Some(evobuddy_tui::app::SelectedActor::FocusedBuddy(1));
    handle_key_event(&mut app, KeyInput::Enter);

    let snapshot =
        render_current_snapshot(&app, 120, 40).expect("render focused buddy workspace snapshot");
    for landmark in [
        "Focused Delegate Workspace",
        "OMO specialist delegate",
        "Librarian",
        "Routing",
        "Runtime surfaces",
        "TaskRoom links",
        "Actions",
        "Start buddy adapter task",
        "Open Trace",
    ] {
        assert!(
            snapshot.contains(landmark),
            "missing focused buddy workspace landmark `{landmark}` in snapshot:\n{snapshot}"
        );
    }
    assert!(!snapshot.contains("Agent Workspace"));
    assert!(!snapshot.contains("Start member adapter task"));
}

#[test]
fn task_room_workspace_snapshot_shows_collaborative_room_fields() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.push_view(ViewMode::TaskRoomWorkspace);

    let snapshot =
        render_current_snapshot(&app, 120, 40).expect("render taskroom workspace snapshot");
    for landmark in [
        "TaskRoom Workspace",
        "Participants",
        "Rounds",
        "Handoffs",
        "Reviewer continuity",
        "Evolution handoff",
        "Returned to",
        "Artifacts",
    ] {
        assert!(
            snapshot.contains(landmark),
            "missing taskroom workspace landmark `{landmark}` in snapshot:\n{snapshot}"
        );
    }
}

#[test]
fn command_palette_snapshot_shows_contextual_commands() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    handle_key_event(&mut app, KeyInput::Commands);

    let snapshot = render_current_snapshot(&app, 120, 40).expect("render command palette snapshot");
    for landmark in [
        "Command Palette",
        "open selected agent",
        "open selected task room",
        "show handoffs",
        "filter blocked",
        "show runtime setup",
        "create taskroom",
        "create handoff",
        "open trace",
        "Enter select",
        "Esc close",
    ] {
        assert!(
            snapshot.contains(landmark),
            "missing command palette landmark `{landmark}` in snapshot:\n{snapshot}"
        );
    }
}

#[test]
fn trace_drawer_snapshot_keeps_diagnostics_behind_drawer() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.view_mode = evobuddy_tui::views::ViewMode::TraceDrawer;

    let snapshot = render_current_snapshot(&app, 120, 40).expect("render trace drawer snapshot");
    for landmark in [
        "Trace",
        "Claim ceiling",
        "Proof fields hidden",
        "Generated",
        "Esc back",
    ] {
        assert!(
            snapshot.contains(landmark),
            "missing trace drawer landmark `{landmark}` in snapshot:\n{snapshot}"
        );
    }
}

#[test]
fn taskroom_form_snapshot_names_destination_fields_and_effect() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    handle_key_event(&mut app, KeyInput::NewRoom);
    handle_key_event(&mut app, KeyInput::Char('m'));
    handle_key_event(&mut app, KeyInput::Char('a'));
    handle_key_event(&mut app, KeyInput::Char('p'));

    let snapshot = render_current_snapshot(&app, 120, 40).expect("render task room form snapshot");
    for landmark in [
        "TaskRoom Form",
        "Destination: Create TaskRoom",
        "Effect: durable TaskRoom draft",
        "Objective",
        "Acceptance criteria",
        "Workspace",
        "Actor",
        "Runtime",
        "Safety mode",
        "map",
        "Enter submit",
        "Esc cancel",
    ] {
        assert!(
            snapshot.contains(landmark),
            "missing task composer landmark `{landmark}` in snapshot:\n{snapshot}"
        );
    }
}

#[test]
fn handoff_form_snapshot_names_destination_fields_and_effect() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.push_view(ViewMode::TaskRoomWorkspace);
    handle_key_event(&mut app, KeyInput::Handoff);
    handle_key_event(&mut app, KeyInput::Char('b'));

    let snapshot = render_current_snapshot(&app, 120, 40).expect("render handoff form snapshot");
    for landmark in [
        "Handoff Form",
        "Destination: durable HandoffRecord",
        "Effect: record handoff only",
        "Sender",
        "Receiver",
        "Body",
        "Artifact refs",
        "Expected next action",
        "Return destination",
        "b",
    ] {
        assert!(
            snapshot.contains(landmark),
            "missing handoff form landmark `{landmark}` in snapshot:\n{snapshot}"
        );
    }
}

#[test]
fn taskroom_detail_view_uses_sorted_selected_room_not_raw_fixture_order() {
    let mut app = load_app("evobuddy-workbench-state-unsorted-taskrooms.json");
    app.view_mode = ViewMode::Detail(DetailView::TaskRoom);

    let snapshot = render_current_snapshot(&app, 80, 20).expect("render detail snapshot");

    assert!(snapshot.contains("TaskRoom Detail"), "{snapshot}");
    assert!(snapshot.contains("Urgent room sorted-first"), "{snapshot}");
    assert!(!snapshot.contains("Completed room raw-first"), "{snapshot}");
}
