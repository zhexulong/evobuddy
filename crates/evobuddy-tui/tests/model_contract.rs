use std::fs;
use std::path::PathBuf;

use evobuddy_tui::model::{parse_workbench_state, RuntimeSetupStatus, TaskRoomStatus, WorkbenchState};

fn fixture_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures/evobuddy-workbench-state-v1.json")
}

#[test]
fn parses_v1_workbench_state_fixture() {
    let text = fs::read_to_string(fixture_path()).expect("read fixture");
    let state = parse_workbench_state(&text).expect("parse state");

    assert_eq!(state.schema, "evobuddy.workbench.state.v1");
    assert_eq!(state.actors.team_agents.len(), 3);
    assert_eq!(state.actors.focused_buddies.len(), 3);
    assert_eq!(state.task_rooms.len(), 2);
    assert_eq!(state.native_sessions.len(), 1);
    assert_eq!(state.runtime_capabilities.len(), 3);
    assert_eq!(state.task_rooms[0].status, TaskRoomStatus::Returned);
    assert_eq!(state.task_rooms[0].available_actions[0].id, "open-native-runtime");
    assert_eq!(state.task_rooms[0].attention.as_ref().expect("attention").source_kind, "runtime-exporter");
    assert!(state
        .runtime_setup
        .iter()
        .any(|entry| entry.runtime == "Codex" && entry.status == RuntimeSetupStatus::Partial));
}

#[test]
fn rejects_missing_required_product_fields() {
    let invalid = r#"{
      "schema": "evobuddy.workbench.state.v1",
      "projectRoot": "/tmp/repo"
    }"#;

    let error = parse_workbench_state(invalid).expect_err("missing fields should fail");
    let rendered = error.to_string();
    assert!(
        rendered.contains("actors")
            || rendered.contains("taskRooms")
            || rendered.contains("runtimeSetup")
    );
}

#[test]
fn allows_unknown_additive_fields() {
    let text = fs::read_to_string(fixture_path()).expect("read fixture");
    let mut value: serde_json::Value = serde_json::from_str(&text).expect("json value");
    value["futureField"] = serde_json::json!({"safe": true});
    let state = parse_workbench_state(&serde_json::to_string(&value).expect("json string"))
        .expect("parse state with additive fields");

    assert_eq!(state.schema, "evobuddy.workbench.state.v1");
}

#[test]
fn parses_current_exported_state_fixture() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let current = root.join("../../test/fixtures/evobuddy-workbench-state-current.json");
    let text = fs::read_to_string(current).expect("read current exported state fixture");
    let state: WorkbenchState = parse_workbench_state(&text).expect("parse current state");

    assert_eq!(state.project_root, "/home/prosumer/agent/context-tree");
    assert!(state.actors.team_agents.is_empty());
    assert!(state.task_rooms.is_empty());
    assert!(!state.diagnostics.blocked_reasons.is_empty());
    assert!(!state.updates.is_empty());
}
