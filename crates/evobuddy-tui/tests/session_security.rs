use std::fs;
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use evobuddy_tui::backend::{
    confirm_lifecycle_action, describe_lifecycle_action, DestructiveLifecycleAction,
};
use evobuddy_tui::launcher::{
    build_launcher_argv, build_launcher_command, consume_launch_plan, load_launch_plan,
    parse_launcher_plan_ref, sanitize_display_name, sanitize_session_name, validate_plan_id,
    write_launch_plan, LaunchPlan,
};
use evobuddy_tui::substrate::tmux::TmuxSubstrate;
use evobuddy_tui::substrate::{CreateSessionRequest, SessionDisplayMetadata, SubstrateSessionRef};

fn temp_root() -> PathBuf {
    let path = std::env::temp_dir().join(format!(
        "evobuddy-session-security-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ));
    fs::create_dir_all(path.join(".evobuddy/native-session-launch-plans"))
        .expect("create temp root");
    path
}

fn sample_plan(plan_id: &str) -> LaunchPlan {
    LaunchPlan {
        schema: "evobuddy.runtime-launch-plan.v1".to_string(),
        descriptor_id: "session-1".to_string(),
        plan_id: plan_id.to_string(),
        program: "/usr/bin/env".to_string(),
        args: vec![
            "codex".to_string(),
            "danger; rm -rf /".to_string(),
            "token-secret".to_string(),
        ],
        cwd: "/tmp".to_string(),
        environment_policy_ref: "environment-policy:workspace-write".to_string(),
        context_packet_ref: Some("context-packet-1".to_string()),
        safety_mode: "workspace-write".to_string(),
        digest: String::new(),
        consumed: false,
        consumed_at: None,
    }
}

fn create_request(root: &Path, session_ref: &str, plan_id: &str) -> CreateSessionRequest {
    CreateSessionRequest {
        descriptor_id: "session-1".to_string(),
        session_ref: SubstrateSessionRef(session_ref.to_string()),
        launcher_plan_ref: format!("launch-plan:{plan_id}"),
        program: PathBuf::from("codex"),
        args: vec!["resume".into(), "danger; rm -rf /".into()],
        cwd: PathBuf::from("/tmp"),
        environment_policy_ref: "environment-policy:workspace-write".to_string(),
        display: SessionDisplayMetadata {
            participant: "Builder; rm -rf /".to_string(),
            runtime: "codex".to_string(),
            workspace: "/tmp".to_string(),
            safety_mode: "workspace-write".to_string(),
            detach_shortcut: "Ctrl+B d".to_string(),
        },
        project_root: root.to_path_buf(),
    }
}

#[test]
fn sanitizes_display_and_session_names_rejecting_control_bytes_and_metacharacters() {
    assert!(sanitize_display_name("Builder Alpha").is_ok());
    assert!(sanitize_display_name("Builder\nAlpha").is_err());
    assert!(sanitize_display_name("Builder\0Alpha").is_err());
    assert!(sanitize_session_name("evb-room-builder-a1b2c3d4").is_ok());
    assert!(sanitize_session_name("room; rm -rf /").is_err());
    assert!(sanitize_session_name("room\nname").is_err());
    assert!(sanitize_session_name("room:name").is_err());
    let slug =
        sanitize_session_name("Room Title!! / weird").expect("slug should sanitize when possible");
    assert!(!slug.contains(' '));
    assert!(!slug.contains(';'));
    assert!(!slug.contains('/'));
}

#[test]
fn plan_ids_and_launcher_refs_reject_traversal_and_control_bytes() {
    assert!(validate_plan_id("launch-plan-1").is_ok());
    assert!(validate_plan_id("../evil").is_err());
    assert!(validate_plan_id("plan\nid").is_err());
    assert!(validate_plan_id("plan\0id").is_err());
    assert_eq!(
        parse_launcher_plan_ref("launch-plan:launch-plan-1").expect("parse"),
        "launch-plan-1"
    );
    assert!(parse_launcher_plan_ref("launch-plan:../evil").is_err());
    assert!(parse_launcher_plan_ref("/tmp/evil.json").is_err());
    assert!(parse_launcher_plan_ref("launch-plan:plan\nid").is_err());
}

#[test]
fn launcher_argv_is_fixed_binary_plus_sanitized_plan_ref_only() {
    let root = temp_root();
    let argv = build_launcher_argv(&root, "launch-plan-1").expect("argv");
    assert_eq!(argv[0], "evobuddy-session-launcher");
    assert_eq!(argv[1], "--project-root");
    assert_eq!(argv[2], root.display().to_string());
    assert_eq!(argv[3], "--plan-id");
    assert_eq!(argv[4], "launch-plan-1");
    assert!(!argv.iter().any(|part| part.contains("codex")));
    assert!(!argv.iter().any(|part| part.contains("rm -rf")));

    let command = build_launcher_command(root.clone(), "launch-plan-1").expect("command");
    assert!(command.contains("evobuddy-session-launcher"));
    assert!(!command.contains("codex"));
    assert!(!command.contains("danger; rm -rf /"));
}

#[test]
fn tmux_create_argv_uses_only_fixed_launcher_and_plan_ref() {
    let root = temp_root();
    let _ = write_launch_plan(&root, &sample_plan("launch-plan-1")).expect("write plan");
    let substrate = TmuxSubstrate::new("tmux", "evobuddy-security");
    let request = create_request(&root, "evb-room-builder-a1b2c3d4", "launch-plan-1");
    let argv = substrate
        .build_new_session_argv(&request)
        .expect("build new-session argv");

    assert_eq!(argv[0], "tmux");
    assert!(argv.iter().any(|part| part == "new-session"));
    assert!(argv.iter().any(|part| part == "-d"));
    assert!(argv.iter().any(|part| part == "-s"));
    assert!(argv.iter().any(|part| part == "evb-room-builder-a1b2c3d4"));

    let launcher_index = argv
        .iter()
        .position(|part| part == "evobuddy-session-launcher")
        .expect("fixed launcher present");
    assert_eq!(argv[launcher_index + 1], "--project-root");
    assert_eq!(argv[launcher_index + 2], root.display().to_string());
    assert_eq!(argv[launcher_index + 3], "--plan-id");
    assert_eq!(argv[launcher_index + 4], "launch-plan-1");

    assert!(!argv.iter().any(|part| part == "codex"));
    assert!(!argv.iter().any(|part| part.contains("rm -rf")));
    assert!(!argv.iter().any(|part| part.contains("token-secret")));
    assert!(!argv
        .iter()
        .any(|part| part == "sh" || part == "bash" || part == "/bin/sh"));
    let cwd_index = argv
        .iter()
        .position(|part| part == "-c")
        .expect("tmux cwd flag");
    assert_eq!(argv.get(cwd_index + 1).map(String::as_str), Some("/tmp"));
    assert!(!argv[cwd_index + 1..].iter().any(|part| part == "-c"));
}

#[test]
fn launch_plan_rejects_symlinks_permission_widening_digest_mismatch_and_replay() {
    let root = temp_root();
    let plan = sample_plan("launch-plan-once");
    let path = write_launch_plan(&root, &plan).expect("write plan");
    let mode = fs::metadata(&path).expect("metadata").permissions().mode() & 0o777;
    assert_eq!(mode, 0o600);

    let mut perms = fs::metadata(&path).expect("metadata").permissions();
    perms.set_mode(0o644);
    fs::set_permissions(&path, perms).expect("widen");
    let widened = load_launch_plan(&root, "launch-plan-once");
    assert!(widened.is_err(), "permission widening must fail");
    let widened_msg = widened.unwrap_err().to_string().to_lowercase();
    assert!(
        widened_msg.contains("permission") || widened_msg.contains("owner"),
        "unexpected error: {widened_msg}"
    );

    let path2 = write_launch_plan(&root, &sample_plan("launch-plan-digest")).expect("write");
    let text = fs::read_to_string(&path2)
        .expect("read")
        .replace("workspace-write", "workspace-read");
    fs::OpenOptions::new()
        .write(true)
        .truncate(true)
        .mode(0o600)
        .open(&path2)
        .and_then(|mut file| {
            use std::io::Write;
            file.write_all(text.as_bytes())
        })
        .expect("tamper");
    let mismatch = load_launch_plan(&root, "launch-plan-digest");
    assert!(mismatch.is_err());
    assert!(mismatch
        .unwrap_err()
        .to_string()
        .contains("digest mismatch"));

    let outside = root.join("outside.json");
    fs::write(&outside, "{}").expect("outside");
    let symlink_path = root.join(".evobuddy/native-session-launch-plans/symlink-plan.json");
    #[cfg(unix)]
    std::os::unix::fs::symlink(&outside, &symlink_path).expect("symlink");
    let symlink_err = load_launch_plan(&root, "symlink-plan");
    assert!(symlink_err.is_err());
    assert!(symlink_err
        .unwrap_err()
        .to_string()
        .to_lowercase()
        .contains("symlink"));

    let once_path = write_launch_plan(&root, &sample_plan("launch-plan-replay")).expect("write");
    let _ = once_path;
    let first = consume_launch_plan(&root, "launch-plan-replay").expect("consume once");
    assert_eq!(first.plan_id, "launch-plan-replay");
    let second = consume_launch_plan(&root, "launch-plan-replay");
    assert!(second.is_err());
    let message = second.unwrap_err().to_string().to_lowercase();
    assert!(
        message.contains("one-use") || message.contains("consumed") || message.contains("replay")
    );
}

#[test]
fn lifecycle_actions_separate_detach_stop_terminate_and_archive_with_confirmation() {
    let detach = describe_lifecycle_action(DestructiveLifecycleAction::Detach);
    assert_eq!(detach.action, "detach");
    assert!(!detach.requires_confirmation);
    assert_eq!(detach.effects.process, "retained");
    assert_eq!(detach.effects.provider_conversation, "retained");
    assert_eq!(detach.effects.worktree, "retained");
    assert_eq!(detach.effects.evidence, "retained");

    let stop = describe_lifecycle_action(DestructiveLifecycleAction::StopProcess);
    assert!(stop.requires_confirmation);
    assert_eq!(stop.effects.process, "stopped");
    assert_eq!(stop.effects.provider_conversation, "retained");

    let terminate = describe_lifecycle_action(DestructiveLifecycleAction::TerminateSession);
    assert!(terminate.requires_confirmation);
    assert_eq!(terminate.effects.process, "stopped");
    assert_eq!(terminate.effects.provider_conversation, "retained");
    assert_eq!(terminate.effects.worktree, "retained");
    assert_eq!(terminate.effects.evidence, "retained");

    let archive = describe_lifecycle_action(DestructiveLifecycleAction::Archive);
    assert!(archive.requires_confirmation);
    assert_eq!(archive.effects.process, "stopped-if-running");
    assert_eq!(archive.effects.provider_conversation, "archived-reference");
    assert_eq!(archive.effects.worktree, "retained");
    assert_eq!(archive.effects.evidence, "retained");

    assert!(confirm_lifecycle_action(DestructiveLifecycleAction::TerminateSession, false).is_err());
    assert!(confirm_lifecycle_action(DestructiveLifecycleAction::TerminateSession, true).is_ok());
    assert!(confirm_lifecycle_action(DestructiveLifecycleAction::Detach, false).is_ok());
}

#[test]
fn rejects_unsafe_session_names_in_tmux_create_argv() {
    let root = temp_root();
    let _ = write_launch_plan(&root, &sample_plan("launch-plan-1")).expect("write plan");
    let substrate = TmuxSubstrate::new("tmux", "evobuddy-security");
    let mut request = create_request(&root, "evil; rm -rf /", "launch-plan-1");
    request.session_ref = SubstrateSessionRef("evil; rm -rf /".to_string());
    let error = substrate
        .build_new_session_argv(&request)
        .expect_err("unsafe session name must fail");
    assert!(
        error.to_string().to_lowercase().contains("session")
            || error.to_string().to_lowercase().contains("unsafe")
            || error.to_string().to_lowercase().contains("invalid")
    );
}
