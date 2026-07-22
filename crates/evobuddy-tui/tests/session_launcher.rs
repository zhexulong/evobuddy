use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;

use evobuddy_tui::launcher::{
    build_launcher_command, load_launch_plan, write_launch_plan, LaunchPlan,
};

fn temp_root() -> PathBuf {
    let path = std::env::temp_dir().join(format!(
        "evobuddy-launcher-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ));
    fs::create_dir_all(path.join(".evobuddy/native-session-launch-plans"))
        .expect("create temp root");
    path
}

fn sample_plan() -> LaunchPlan {
    LaunchPlan {
        schema: "evobuddy.runtime-launch-plan.v1".to_string(),
        descriptor_id: "session-1".to_string(),
        plan_id: "launch-plan-1".to_string(),
        program: "/usr/bin/env".to_string(),
        args: vec!["codex".to_string(), "danger; rm -rf /".to_string()],
        cwd: "/repo".to_string(),
        environment_policy_ref: "env-policy-1".to_string(),
        context_packet_ref: Some("context-packet-1".to_string()),
        safety_mode: "workspace-write".to_string(),
        digest: String::new(),
        consumed: false,
        consumed_at: None,
    }
}

#[test]
fn launcher_command_contains_only_safe_project_and_plan_refs() {
    let command = build_launcher_command(PathBuf::from("/repo root"), "launch-plan-1")
        .expect("build launcher command");

    assert!(command.contains("evobuddy-session-launcher"));
    assert!(command.contains("--project-root"));
    assert!(command.contains("--plan-id"));
    assert!(!command.contains("codex"));
    assert!(!command.contains("danger; rm -rf /"));
}

#[test]
fn launcher_rejects_path_traversal_plan_ids() {
    let error = build_launcher_command(PathBuf::from("/repo"), "../evil")
        .expect_err("path traversal must fail");

    assert!(error.to_string().contains("invalid plan id"));
}

#[test]
fn launch_plan_round_trip_uses_owner_only_permissions_and_digest_validation() {
    let root = temp_root();
    let plan = sample_plan();
    let path = write_launch_plan(&root, &plan).expect("write plan");

    let mode = fs::metadata(&path).expect("metadata").permissions().mode() & 0o777;
    assert_eq!(mode, 0o600);

    let loaded = load_launch_plan(&root, "launch-plan-1").expect("load plan");
    assert_eq!(loaded.plan_id, "launch-plan-1");
    assert_eq!(loaded.args[1], "danger; rm -rf /");

    let text = fs::read_to_string(&path)
        .expect("read plan")
        .replace("workspace-write", "workspace-read");
    fs::write(&path, text).expect("tamper plan");
    let error = load_launch_plan(&root, "launch-plan-1").expect_err("digest mismatch should fail");
    assert!(error.to_string().contains("digest mismatch"));
}
