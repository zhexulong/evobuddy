use std::fs;
use std::path::{Path, PathBuf};

use evobuddy_tui::app::{SelectedActor, WorkbenchApp};
use evobuddy_tui::backend::{
    adapter_task_command, backend_state_command, load_workbench_state, parse_adapter_task_result,
    AdapterActorKind, AdapterTaskRequest, BackendCommand, BackendOptions,
};
use evobuddy_tui::model::parse_workbench_state;

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures")
        .join(name)
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("repo root")
}

fn load_app(name: &str) -> WorkbenchApp {
    let text = fs::read_to_string(fixture_path(name)).expect("read fixture");
    let state = parse_workbench_state(&text).expect("parse state");
    WorkbenchApp::new(state)
}

#[test]
fn focused_buddy_action_command_uses_buddies_invoke() {
    let project = Path::new("/repo");
    let request = AdapterTaskRequest {
        actor_id: "explore".to_string(),
        actor_kind: AdapterActorKind::FocusedBuddy,
        task: "Map durable evolution signals.".to_string(),
        project_root: project.to_path_buf(),
    };

    assert_eq!(
        adapter_task_command(&request),
        vec![
            "node",
            "scripts/evobuddy/evobuddy.mjs",
            "buddies",
            "invoke",
            "explore",
            "--task",
            "Map durable evolution signals.",
            "--project",
            "/repo",
            "--json",
        ]
    );
}

#[test]
fn team_agent_action_command_uses_members_invoke_when_capable() {
    let request = AdapterTaskRequest {
        actor_id: "reviewer".to_string(),
        actor_kind: AdapterActorKind::TeamAgent,
        task: "Review the command center.".to_string(),
        project_root: PathBuf::from("/repo"),
    };

    assert_eq!(
        adapter_task_command(&request),
        vec![
            "node",
            "scripts/evobuddy/evobuddy.mjs",
            "members",
            "invoke",
            "reviewer",
            "--task",
            "Review the command center.",
            "--project",
            "/repo",
            "--json",
        ]
    );
}

#[test]
fn adapter_task_result_parser_maps_json_stdout() {
    let result =
        parse_adapter_task_result(r#"{"memberName":"explore","returnedTo":"parent-agent"}"#)
            .expect("parse result");

    assert_eq!(result.member_name, "explore");
    assert_eq!(result.returned_to, "parent-agent");
    assert_eq!(result.stdout_summary, "Explore · Returned to parent-agent");
}

#[test]
fn selected_focused_buddy_advertises_task_composer_action() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.selected_actor = Some(SelectedActor::FocusedBuddy(0));

    assert!(app.selected_actor_can_start_adapter_task());
}

#[test]
fn backend_state_command_uses_argv_not_shell_string_for_default_exporter() {
    let options = BackendOptions {
        project: PathBuf::from("/repo with spaces; rm -rf nope"),
        state_json: None,
        backend_command: None,
        input_root: Some(PathBuf::from("fixtures/input root")),
        aggregate_report: None,
        plan1_report: Some(PathBuf::from("reports/plan one.json")),
        plan2_report: None,
        taskroom_reports: vec![PathBuf::from("reports/task room.json")],
    };

    let command = backend_state_command(&options).expect("resolve package export command");
    assert_eq!(command.program, "node");
    assert!(
        Path::new(&command.args[0]).is_absolute(),
        "export script must be package-absolute, got {}",
        command.args[0]
    );
    assert!(
        command.args[0].ends_with("scripts/context-tree/export-evobuddy-workbench-state.mjs"),
        "unexpected export script {}",
        command.args[0]
    );
    assert_eq!(
        &command.args[1..],
        &[
            "--project".to_string(),
            "/repo with spaces; rm -rf nope".to_string(),
            "--input-root".to_string(),
            "fixtures/input root".to_string(),
            "--plan1-report".to_string(),
            "reports/plan one.json".to_string(),
            "--taskroom-report".to_string(),
            "reports/task room.json".to_string(),
        ]
    );
}

#[test]
fn load_workbench_state_from_external_project_without_state_json() {
    use std::process::Command;
    use std::time::{SystemTime, UNIX_EPOCH};

    let package = repo_root();
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let external = std::env::temp_dir().join(format!("evobuddy-tui-external-{stamp}"));
    fs::create_dir_all(&external).expect("create external project");

    let setup = Command::new("node")
        .args([
            package
                .join("scripts/evobuddy/evobuddy.mjs")
                .to_str()
                .expect("utf8 path"),
            "setup",
            "--project",
            external.to_str().expect("utf8 path"),
            "--runtime",
            "opencode",
            "--json",
        ])
        .current_dir(&external)
        .output()
        .expect("run setup");
    assert!(
        setup.status.success(),
        "setup failed: {}",
        String::from_utf8_lossy(&setup.stderr)
    );

    let options = BackendOptions {
        project: external.clone(),
        state_json: None,
        backend_command: None,
        input_root: None,
        aggregate_report: None,
        plan1_report: None,
        plan2_report: None,
        taskroom_reports: vec![],
    };
    let state = load_workbench_state(&options)
        .expect("export workbench state from external project without --state-json");
    assert_eq!(state.schema, "evobuddy.workbench.state.v1");
    assert!(
        state
            .project_root
            .contains(external.file_name().unwrap().to_str().unwrap()),
        "project_root should reflect external dir, got {}",
        state.project_root
    );

    let _ = fs::remove_dir_all(&external);
}

#[test]
fn explicit_backend_command_override_uses_structured_program_and_args() {
    let fixture = fixture_path("evobuddy-workbench-state-v1.json");
    let options = BackendOptions {
        project: repo_root(),
        state_json: None,
        backend_command: Some(BackendCommand {
            program: "node".to_string(),
            args: vec![
                "-e".to_string(),
                "process.stdout.write(require('node:fs').readFileSync(process.argv[1], 'utf8'))"
                    .to_string(),
                fixture.display().to_string(),
            ],
        }),
        input_root: None,
        aggregate_report: None,
        plan1_report: None,
        plan2_report: None,
        taskroom_reports: vec![],
    };

    let state = load_workbench_state(&options).expect("load state from explicit argv override");
    assert_eq!(state.schema, "evobuddy.workbench.state.v1");
    assert_eq!(state.task_rooms.len(), 2);
}

#[test]
fn session_plan_open_command_uses_structured_argv_not_shell_string() {
    use evobuddy_tui::backend::session_plan_open_command;

    let command = session_plan_open_command(
        Path::new("/repo with spaces; rm -rf nope"),
        "taskroom:alpha",
        "instance-1",
        "codex",
        Path::new("/repo with spaces; rm -rf nope"),
        Some("fresh-session"),
        Some("Builder"),
    );

    assert_eq!(command.program, "node");
    assert_eq!(
        command.args,
        vec![
            "scripts/evobuddy/evobuddy.mjs",
            "taskroom",
            "session",
            "plan-open",
            "--project",
            "/repo with spaces; rm -rf nope",
            "--room",
            "taskroom:alpha",
            "--instance",
            "instance-1",
            "--runtime",
            "codex",
            "--workspace",
            "/repo with spaces; rm -rf nope",
            "--json",
            "--mode",
            "fresh-session",
            "--participant",
            "Builder",
        ]
    );
    assert!(!command.args.iter().any(|arg| arg.contains("sh -lc")));
}
