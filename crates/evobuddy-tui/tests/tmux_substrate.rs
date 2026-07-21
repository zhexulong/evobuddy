use std::ffi::OsString;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use evobuddy_tui::substrate::tmux::{
    format_pre_attach_notice, managed_status_line, map_attach_exit_status, AttachPath,
    TmuxSubstrate,
};
use evobuddy_tui::substrate::{
    AttachOutcome, CreateSessionRequest, SessionDisplayMetadata, SessionScope, SubstrateSessionRef,
    TerminalSubstrate,
};

fn unique_socket_name() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    format!("evobuddy-test-{nanos}")
}

fn tmux_available() -> bool {
    Command::new("tmux")
        .arg("-V")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn session_request(session_ref: &str) -> CreateSessionRequest {
    CreateSessionRequest {
        descriptor_id: "session-1".to_string(),
        session_ref: SubstrateSessionRef(session_ref.to_string()),
        launcher_plan_ref: "launch-plan-1".to_string(),
        program: PathBuf::from("/bin/sh"),
        args: vec![OsString::from("-c"), OsString::from("sleep 30")],
        cwd: PathBuf::from("/tmp"),
        environment_policy_ref: "env-policy-1".to_string(),
        display: SessionDisplayMetadata {
            participant: "Builder".to_string(),
            runtime: "codex".to_string(),
            workspace: "/tmp".to_string(),
            safety_mode: "workspace-write".to_string(),
            detach_shortcut: "Ctrl+B d".to_string(),
        },
    }
}

fn display_metadata() -> SessionDisplayMetadata {
    SessionDisplayMetadata {
        participant: "Builder".to_string(),
        runtime: "codex".to_string(),
        workspace: "/tmp/workspace".to_string(),
        safety_mode: "workspace-write".to_string(),
        detach_shortcut: "Ctrl+B d".to_string(),
    }
}

#[test]
fn tmux_substrate_probe_and_session_lifecycle_work_against_unique_socket() {
    if !tmux_available() {
        eprintln!("tmux-missing");
        return;
    }

    let socket = unique_socket_name();
    let substrate = TmuxSubstrate::new("tmux", &socket);
    let request = session_request("evobuddy-session-1");

    let capabilities = substrate.probe().expect("probe tmux");
    assert!(capabilities.supports_create);
    assert_eq!(capabilities.backend_name, "tmux");
    assert!(capabilities.unsupported_reason.is_none());

    let created = substrate.create_session(&request).expect("create session");
    assert!(created.exists);
    assert!(created.child_process_alive);
    assert_eq!(created.session_ref, request.session_ref);
    assert_eq!(
        created.backend_metadata.get("managedBy"),
        Some(&"evobuddy".to_string())
    );

    let listed = substrate
        .list_sessions(&SessionScope::All)
        .expect("list sessions");
    assert!(listed
        .iter()
        .any(|session| session.session_ref == request.session_ref));

    let inspected = substrate
        .inspect(&request.session_ref)
        .expect("inspect session");
    assert!(inspected.exists);
    assert!(inspected.child_process_alive);
    assert!(inspected.last_activity_at.is_some());

    substrate
        .terminate(&request.session_ref)
        .expect("terminate session");
    let terminated = substrate
        .inspect(&request.session_ref)
        .expect("inspect terminated session");
    assert!(!terminated.exists);
    assert_eq!(terminated.exit_state.as_deref(), Some("terminated"));
}

#[test]
fn tmux_substrate_rejects_malformed_list_output_instead_of_guessing() {
    let substrate = TmuxSubstrate::new("/bin/echo", &unique_socket_name());
    let error = substrate
        .list_sessions(&SessionScope::All)
        .expect_err("malformed output should fail");

    assert!(error.to_string().contains("malformed tmux output"));
}

#[test]
fn pre_attach_notice_includes_required_fields_and_detach_hint() {
    let notice = format_pre_attach_notice(
        &display_metadata(),
        &SubstrateSessionRef("tmux:evobuddy:session-1".to_string()),
    );
    assert!(notice.contains("Participant: Builder"));
    assert!(notice.contains("Runtime: codex"));
    assert!(notice.contains("Workspace: /tmp/workspace"));
    assert!(notice.contains("Safety mode: workspace-write"));
    assert!(notice.contains("Session: tmux:evobuddy:session-1"));
    assert!(
        notice.contains("F10") || notice.contains("Ctrl+") || notice.contains("Ctrl+B d"),
        "notice should teach a simple leave key, got {notice}"
    );
}

#[test]
fn managed_status_line_includes_exact_detach_hint() {
    let line = managed_status_line();
    assert!(
        line.contains("F10") || line.contains("Ctrl+B d"),
        "status line should teach leave keys: {line}"
    );
    assert!(
        line.contains("EvoBuddy"),
        "status line should mark EvoBuddy-managed sessions: {line}"
    );
}

#[test]
fn map_attach_exit_status_covers_detach_ended_failed_and_interrupted() {
    assert_eq!(
        map_attach_exit_status(true, true, false),
        AttachOutcome::Detached
    );
    assert_eq!(
        map_attach_exit_status(true, false, false),
        AttachOutcome::SessionEnded
    );
    assert_eq!(
        map_attach_exit_status(false, true, false),
        AttachOutcome::AttachFailed
    );
    assert_eq!(
        map_attach_exit_status(false, false, false),
        AttachOutcome::AttachFailed
    );
    assert_eq!(
        map_attach_exit_status(false, true, true),
        AttachOutcome::Interrupted
    );
}

#[test]
fn create_session_configures_managed_status_line_with_detach_hint() {
    if !tmux_available() {
        eprintln!("tmux-missing");
        return;
    }

    let socket = unique_socket_name();
    let substrate = TmuxSubstrate::new("tmux", &socket);
    let request = session_request("evobuddy-status-line");
    let _created = substrate.create_session(&request).expect("create session");

    let output = Command::new("tmux")
        .args([
            "-L",
            &socket,
            "display-message",
            "-p",
            "-t",
            &request.session_ref.0,
            "#{status-left}",
        ])
        .output()
        .expect("read status-left");
    let status_left = String::from_utf8_lossy(&output.stdout);
    assert!(
        status_left.contains("F10") || status_left.contains("Ctrl+B d"),
        "status-left missing detach hint: {status_left}"
    );
    assert!(
        status_left.contains("EvoBuddy"),
        "status-left missing managed marker: {status_left}"
    );

    substrate
        .terminate(&request.session_ref)
        .expect("terminate session");
    let _ = Command::new("tmux")
        .args(["-L", &socket, "kill-server"])
        .status();
}

#[test]
fn attach_interactive_missing_session_fails() {
    if !tmux_available() {
        eprintln!("tmux-missing");
        return;
    }

    let socket = unique_socket_name();
    let substrate = TmuxSubstrate::new("tmux", &socket);
    let error = substrate
        .attach_interactive(&SubstrateSessionRef("missing-session".to_string()))
        .expect_err("missing session should fail");
    assert!(
        error.to_string().contains("session not found")
            || error.to_string().to_lowercase().contains("not found")
    );
}

#[test]
fn attach_command_uses_blocking_attach_without_x_or_a_or_send_keys() {
    let socket = unique_socket_name();
    let substrate = TmuxSubstrate::new("tmux", &socket);
    let session = SubstrateSessionRef("evobuddy-attach-args".to_string());
    let args = substrate.attach_command_args(&session);
    assert_eq!(
        args,
        vec![
            "tmux".to_string(),
            "-L".to_string(),
            socket,
            "attach-session".to_string(),
            "-t".to_string(),
            "evobuddy-attach-args".to_string(),
        ]
    );
    assert!(!args
        .iter()
        .any(|arg| arg == "-x" || arg == "-A" || arg == "send-keys"));
}

#[test]
fn attach_interactive_detach_preserves_session_and_process() {
    if !tmux_available() {
        eprintln!("tmux-missing");
        return;
    }

    let socket = unique_socket_name();
    let substrate = TmuxSubstrate::new("tmux", &socket);
    let request = session_request("evobuddy-attach-detach");
    let created = substrate.create_session(&request).expect("create session");
    assert!(created.child_process_alive);
    let before_pid = pane_pid(&socket, &request.session_ref.0).expect("pane pid before");
    let before_count = session_count(&socket);

    let detach_socket = socket.clone();
    let detach_session = request.session_ref.0.clone();
    let detacher = thread::spawn(move || {
        thread::sleep(Duration::from_millis(250));
        let _ = Command::new("tmux")
            .args(["-L", &detach_socket, "detach-client", "-s", &detach_session])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    });

    let outcome = attach_with_script(&socket, &request.session_ref.0);
    detacher.join().expect("detach helper");
    let outcome = outcome.expect("attach interactive");
    assert_eq!(outcome, AttachOutcome::Detached);

    let after = substrate
        .inspect(&request.session_ref)
        .expect("inspect after detach");
    assert!(after.exists);
    assert!(after.child_process_alive);
    assert_eq!(session_count(&socket), before_count);
    assert_eq!(
        pane_pid(&socket, &request.session_ref.0).expect("pane pid after"),
        before_pid
    );

    substrate
        .terminate(&request.session_ref)
        .expect("terminate session");
    let _ = Command::new("tmux")
        .args(["-L", &socket, "kill-server"])
        .status();
}

#[test]
fn attach_interactive_maps_killed_session_to_session_ended() {
    if !tmux_available() {
        eprintln!("tmux-missing");
        return;
    }

    let socket = unique_socket_name();
    let substrate = TmuxSubstrate::new("tmux", &socket);
    let request = session_request("evobuddy-attach-kill");
    substrate.create_session(&request).expect("create session");

    let kill_socket = socket.clone();
    let kill_session = request.session_ref.0.clone();
    let killer = thread::spawn(move || {
        thread::sleep(Duration::from_millis(250));
        let _ = Command::new("tmux")
            .args(["-L", &kill_socket, "kill-session", "-t", &kill_session])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    });

    let outcome = attach_with_script(&socket, &request.session_ref.0);
    killer.join().expect("kill helper");
    let outcome = outcome.expect("attach interactive");
    assert_eq!(outcome, AttachOutcome::SessionEnded);

    let after = substrate
        .inspect(&request.session_ref)
        .expect("inspect after kill");
    assert!(!after.exists);

    let _ = Command::new("tmux")
        .args(["-L", &socket, "kill-server"])
        .status();
}

#[test]
fn nested_tmux_uses_dedicated_socket_path_without_unsetting_tmux() {
    let managed_socket = unique_socket_name();
    let substrate = TmuxSubstrate::new("tmux", &managed_socket);

    let previous_tmux = std::env::var_os("TMUX");
    unsafe {
        std::env::set_var("TMUX", format!("/tmp/tmux-nested/{managed_socket},123,0"));
    }

    assert_eq!(
        substrate.resolve_attach_path(),
        AttachPath::NestedTmuxDedicatedSocket
    );
    assert_eq!(
        substrate.resolve_attach_path().as_str(),
        "nested-tmux-dedicated-socket"
    );
    assert!(
        std::env::var_os("TMUX").is_some(),
        "TMUX must not be blindly unset"
    );

    let args = substrate.attach_command_args(&SubstrateSessionRef("nested".to_string()));
    assert!(args.iter().any(|arg| arg == "-L"));
    assert!(args.iter().any(|arg| arg == &managed_socket));
    assert!(!args.iter().any(|arg| arg == "-x" || arg == "-A"));

    match previous_tmux {
        Some(value) => unsafe { std::env::set_var("TMUX", value) },
        None => unsafe { std::env::remove_var("TMUX") },
    }
}

fn session_count(socket: &str) -> usize {
    let output = Command::new("tmux")
        .args(["-L", socket, "list-sessions", "-F", "#{session_name}"])
        .output()
        .expect("list sessions");
    if !output.status.success() {
        return 0;
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count()
}

fn pane_pid(socket: &str, session: &str) -> Option<String> {
    let output = Command::new("tmux")
        .args([
            "-L",
            socket,
            "list-panes",
            "-t",
            session,
            "-F",
            "#{pane_pid}",
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let pid = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()?
        .trim()
        .to_string();
    if pid.is_empty() {
        None
    } else {
        Some(pid)
    }
}

fn attach_with_script(socket: &str, session: &str) -> anyhow::Result<AttachOutcome> {
    let command = format!("tmux -L {socket} attach-session -t {session}");
    let status = Command::new("script")
        .args(["-q", "-c", &command, "/dev/null"])
        .status()
        .map_err(|error| anyhow::anyhow!("script attach failed: {error}"))?;
    let exists = Command::new("tmux")
        .args(["-L", socket, "has-session", "-t", session])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false);
    Ok(map_attach_exit_status(status.success(), exists, false))
}
