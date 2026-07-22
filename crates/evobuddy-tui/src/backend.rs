use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{bail, Context, Result};
use serde::Deserialize;

use crate::model::{parse_workbench_state, WorkbenchState};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AdapterActorKind {
    TeamAgent,
    FocusedBuddy,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdapterTaskRequest {
    pub actor_id: String,
    pub actor_kind: AdapterActorKind,
    pub task: String,
    pub project_root: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdapterTaskResult {
    pub member_name: String,
    pub returned_to: String,
    pub stdout_summary: String,
}

#[derive(Debug, Deserialize)]
struct AdapterTaskResultJson {
    #[serde(rename = "memberName")]
    member_name: String,
    #[serde(rename = "returnedTo")]
    returned_to: String,
}

pub fn adapter_task_command(request: &AdapterTaskRequest) -> Vec<String> {
    let command_kind = match request.actor_kind {
        AdapterActorKind::TeamAgent => "members",
        AdapterActorKind::FocusedBuddy => "buddies",
    };
    vec![
        "node".to_string(),
        "scripts/evobuddy/evobuddy.mjs".to_string(),
        command_kind.to_string(),
        "invoke".to_string(),
        request.actor_id.clone(),
        "--task".to_string(),
        request.task.clone(),
        "--project".to_string(),
        request.project_root.display().to_string(),
        "--json".to_string(),
    ]
}

pub fn parse_adapter_task_result(stdout: &str) -> Result<AdapterTaskResult> {
    let parsed: AdapterTaskResultJson =
        serde_json::from_str(stdout).context("failed to parse adapter task JSON")?;
    Ok(AdapterTaskResult {
        stdout_summary: format!(
            "{} · Returned to {}",
            title_case_first(&parsed.member_name),
            parsed.returned_to
        ),
        member_name: parsed.member_name,
        returned_to: parsed.returned_to,
    })
}

fn title_case_first(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
        None => String::new(),
    }
}

#[derive(Debug, Clone)]
pub struct BackendOptions {
    pub project: PathBuf,
    pub state_json: Option<PathBuf>,
    pub backend_command: Option<BackendCommand>,
    pub input_root: Option<PathBuf>,
    pub aggregate_report: Option<PathBuf>,
    pub plan1_report: Option<PathBuf>,
    pub plan2_report: Option<PathBuf>,
    pub taskroom_reports: Vec<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackendCommand {
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TaskroomHandoffCreateRequest<'a> {
    pub room_id: &'a str,
    pub handoff_id: &'a str,
    pub from_instance: &'a str,
    pub to_instance: &'a str,
    pub handoff_kind: &'a str,
    pub body: Option<&'a str>,
    pub created_at: Option<&'a str>,
}

fn read_state_file(path: &Path) -> Result<WorkbenchState> {
    let text = fs::read_to_string(path)
        .with_context(|| format!("failed to read state JSON: {}", path.display()))?;
    parse_workbench_state(&text)
}

fn build_state_export_args(options: &BackendOptions) -> Vec<String> {
    let mut args = vec![
        "scripts/context-tree/export-evobuddy-workbench-state.mjs".to_string(),
        "--project".to_string(),
        options.project.display().to_string(),
    ];
    if let Some(input_root) = &options.input_root {
        args.push("--input-root".to_string());
        args.push(input_root.display().to_string());
    }
    if let Some(path) = &options.aggregate_report {
        args.push("--aggregate-report".to_string());
        args.push(path.display().to_string());
    }
    if let Some(path) = &options.plan1_report {
        args.push("--plan1-report".to_string());
        args.push(path.display().to_string());
    }
    if let Some(path) = &options.plan2_report {
        args.push("--plan2-report".to_string());
        args.push(path.display().to_string());
    }
    for path in &options.taskroom_reports {
        args.push("--taskroom-report".to_string());
        args.push(path.display().to_string());
    }
    args
}

pub fn backend_state_command(options: &BackendOptions) -> BackendCommand {
    BackendCommand {
        program: "node".to_string(),
        args: build_state_export_args(options),
    }
}

pub fn load_workbench_state(options: &BackendOptions) -> Result<WorkbenchState> {
    if let Some(state_json) = &options.state_json {
        return read_state_file(state_json);
    }

    let command = options
        .backend_command
        .clone()
        .unwrap_or_else(|| backend_state_command(options));

    let output = Command::new(&command.program)
        .args(&command.args)
        .current_dir(&options.project)
        .output()
        .with_context(|| {
            format!(
                "failed to run backend command: {} {}",
                command.program,
                command.args.join(" ")
            )
        })?;

    if !output.status.success() {
        bail!(
            "backend command failed with status {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        );
    }

    let stdout =
        String::from_utf8(output.stdout).context("backend command stdout was not valid UTF-8")?;
    parse_workbench_state(&stdout)
}

pub fn session_plan_open_command(
    project: &Path,
    room_id: &str,
    agent_instance_id: &str,
    runtime: &str,
    workspace: &Path,
    mode: Option<&str>,
    participant: Option<&str>,
) -> BackendCommand {
    let mut args = vec![
        "scripts/evobuddy/evobuddy.mjs".to_string(),
        "taskroom".to_string(),
        "session".to_string(),
        "plan-open".to_string(),
        "--project".to_string(),
        project.display().to_string(),
        "--room".to_string(),
        room_id.to_string(),
        "--instance".to_string(),
        agent_instance_id.to_string(),
        "--runtime".to_string(),
        runtime.to_string(),
        "--workspace".to_string(),
        workspace.display().to_string(),
        "--json".to_string(),
    ];
    if let Some(mode) = mode {
        args.push("--mode".to_string());
        args.push(mode.to_string());
    }
    if let Some(participant) = participant {
        args.push("--participant".to_string());
        args.push(participant.to_string());
    }
    BackendCommand {
        program: "node".to_string(),
        args,
    }
}

#[allow(clippy::too_many_arguments)]
pub fn session_reserve_command(
    project: &Path,
    room_id: &str,
    agent_instance_id: &str,
    runtime: &str,
    workspace: &Path,
    descriptor_id: Option<&str>,
    session_ref: Option<&str>,
    context_packet_ref: Option<&str>,
    safety_mode: Option<&str>,
    participant: Option<&str>,
) -> BackendCommand {
    let mut args = vec![
        "scripts/evobuddy/evobuddy.mjs".to_string(),
        "taskroom".to_string(),
        "session".to_string(),
        "reserve".to_string(),
        "--project".to_string(),
        project.display().to_string(),
        "--room".to_string(),
        room_id.to_string(),
        "--instance".to_string(),
        agent_instance_id.to_string(),
        "--runtime".to_string(),
        runtime.to_string(),
        "--workspace".to_string(),
        workspace.display().to_string(),
        "--json".to_string(),
    ];
    if let Some(descriptor_id) = descriptor_id {
        args.push("--descriptor".to_string());
        args.push(descriptor_id.to_string());
    }
    if let Some(session_ref) = session_ref {
        args.push("--session-ref".to_string());
        args.push(session_ref.to_string());
    }
    if let Some(context_packet_ref) = context_packet_ref {
        args.push("--context-packet-ref".to_string());
        args.push(context_packet_ref.to_string());
    }
    if let Some(safety_mode) = safety_mode {
        args.push("--safety-mode".to_string());
        args.push(safety_mode.to_string());
    }
    if let Some(participant) = participant {
        args.push("--participant".to_string());
        args.push(participant.to_string());
    }
    BackendCommand {
        program: "node".to_string(),
        args,
    }
}

pub fn session_commit_command(
    project: &Path,
    descriptor_id: &str,
    substrate_ref: &str,
) -> BackendCommand {
    BackendCommand {
        program: "node".to_string(),
        args: vec![
            "scripts/evobuddy/evobuddy.mjs".to_string(),
            "taskroom".to_string(),
            "session".to_string(),
            "commit".to_string(),
            "--project".to_string(),
            project.display().to_string(),
            "--descriptor".to_string(),
            descriptor_id.to_string(),
            "--substrate-ref".to_string(),
            substrate_ref.to_string(),
            "--json".to_string(),
        ],
    }
}

pub fn session_inspect_command(project: &Path, descriptor_id: &str) -> BackendCommand {
    BackendCommand {
        program: "node".to_string(),
        args: vec![
            "scripts/evobuddy/evobuddy.mjs".to_string(),
            "taskroom".to_string(),
            "session".to_string(),
            "inspect".to_string(),
            "--project".to_string(),
            project.display().to_string(),
            "--descriptor".to_string(),
            descriptor_id.to_string(),
            "--json".to_string(),
        ],
    }
}

pub fn session_reconcile_command(project: &Path) -> BackendCommand {
    BackendCommand {
        program: "node".to_string(),
        args: vec![
            "scripts/evobuddy/evobuddy.mjs".to_string(),
            "taskroom".to_string(),
            "session".to_string(),
            "reconcile".to_string(),
            "--project".to_string(),
            project.display().to_string(),
            "--json".to_string(),
        ],
    }
}

pub fn taskroom_create_command(
    project: &Path,
    room_id: &str,
    title: &str,
    objective: &str,
    runtime: Option<&str>,
    created_at: Option<&str>,
) -> BackendCommand {
    let mut args = vec![
        "scripts/evobuddy/evobuddy.mjs".to_string(),
        "taskroom".to_string(),
        "create".to_string(),
        "--project".to_string(),
        project.display().to_string(),
        "--room".to_string(),
        room_id.to_string(),
        "--title".to_string(),
        title.to_string(),
        "--objective".to_string(),
        objective.to_string(),
    ];
    if let Some(runtime) = runtime {
        args.push("--runtime".to_string());
        args.push(runtime.to_string());
    }
    if let Some(created_at) = created_at {
        args.push("--created-at".to_string());
        args.push(created_at.to_string());
    }
    args.push("--json".to_string());
    BackendCommand {
        program: "node".to_string(),
        args,
    }
}

pub fn taskroom_message_send_command(
    project: &Path,
    room_id: &str,
    body: &str,
    from: Option<&str>,
) -> BackendCommand {
    let mut args = vec![
        "scripts/evobuddy/evobuddy.mjs".to_string(),
        "taskroom".to_string(),
        "message".to_string(),
        "send".to_string(),
        "--project".to_string(),
        project.display().to_string(),
        "--room".to_string(),
        room_id.to_string(),
        "--body".to_string(),
        body.to_string(),
    ];
    if let Some(from) = from {
        args.push("--from".to_string());
        args.push(from.to_string());
    }
    args.push("--json".to_string());
    BackendCommand {
        program: "node".to_string(),
        args,
    }
}

pub fn title_from_objective(objective: &str, fallback: &str) -> String {
    let trimmed = objective.trim();
    if trimmed.is_empty() {
        return fallback.to_string();
    }
    if trimmed.chars().count() > 80 {
        format!("{}...", trimmed.chars().take(77).collect::<String>())
    } else {
        trimmed.to_string()
    }
}

pub fn taskroom_participant_add_command(
    project: &Path,
    room_id: &str,
    participant_id: &str,
    actor_name: &str,
    actor_kind: &str,
    role: &str,
    runtime: Option<&str>,
) -> BackendCommand {
    let mut args = vec![
        "scripts/evobuddy/evobuddy.mjs".to_string(),
        "taskroom".to_string(),
        "participant".to_string(),
        "add".to_string(),
        "--project".to_string(),
        project.display().to_string(),
        "--room".to_string(),
        room_id.to_string(),
        "--participant-id".to_string(),
        participant_id.to_string(),
        "--actor-name".to_string(),
        actor_name.to_string(),
        "--actor-kind".to_string(),
        actor_kind.to_string(),
        "--role".to_string(),
        role.to_string(),
    ];
    if let Some(runtime) = runtime {
        args.push("--runtime".to_string());
        args.push(runtime.to_string());
    }
    args.push("--json".to_string());
    BackendCommand {
        program: "node".to_string(),
        args,
    }
}

pub fn taskroom_handoff_create_command(
    project: &Path,
    request: TaskroomHandoffCreateRequest<'_>,
) -> BackendCommand {
    let mut args = vec![
        "scripts/evobuddy/evobuddy.mjs".to_string(),
        "taskroom".to_string(),
        "handoff".to_string(),
        "create".to_string(),
        "--project".to_string(),
        project.display().to_string(),
        "--room".to_string(),
        request.room_id.to_string(),
        "--handoff-id".to_string(),
        request.handoff_id.to_string(),
        "--from-instance".to_string(),
        request.from_instance.to_string(),
        "--to-instance".to_string(),
        request.to_instance.to_string(),
        "--handoff-kind".to_string(),
        request.handoff_kind.to_string(),
    ];
    if let Some(body) = request.body {
        args.push("--body".to_string());
        args.push(body.to_string());
    }
    if let Some(created_at) = request.created_at {
        args.push("--created-at".to_string());
        args.push(created_at.to_string());
    }
    args.push("--json".to_string());
    BackendCommand {
        program: "node".to_string(),
        args,
    }
}

pub fn taskroom_session_stop_command(
    project: &Path,
    room_id: &str,
    instance_id: &str,
    reason: &str,
) -> BackendCommand {
    BackendCommand {
        program: "node".to_string(),
        args: vec![
            "scripts/evobuddy/evobuddy.mjs".to_string(),
            "taskroom".to_string(),
            "session".to_string(),
            "stop".to_string(),
            "--project".to_string(),
            project.display().to_string(),
            "--room".to_string(),
            room_id.to_string(),
            "--instance".to_string(),
            instance_id.to_string(),
            "--reason".to_string(),
            reason.to_string(),
            "--json".to_string(),
        ],
    }
}

pub fn taskroom_archive_command(project: &Path, room_id: &str) -> BackendCommand {
    BackendCommand {
        program: "node".to_string(),
        args: vec![
            "scripts/evobuddy/evobuddy.mjs".to_string(),
            "taskroom".to_string(),
            "archive".to_string(),
            "--project".to_string(),
            project.display().to_string(),
            "--room".to_string(),
            room_id.to_string(),
            "--json".to_string(),
        ],
    }
}

pub fn run_backend_command(command: &BackendCommand, project: &Path) -> Result<String> {
    let output = Command::new(&command.program)
        .args(&command.args)
        .current_dir(project)
        .output()
        .with_context(|| {
            format!(
                "failed to run backend command: {} {}",
                command.program,
                command.args.join(" ")
            )
        })?;
    if !output.status.success() {
        bail!(
            "backend command failed with status {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        );
    }
    String::from_utf8(output.stdout).context("backend command stdout was not valid UTF-8")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DestructiveLifecycleAction {
    Detach,
    StopProcess,
    TerminateSession,
    Archive,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LifecycleActionEffects {
    pub process: &'static str,
    pub provider_conversation: &'static str,
    pub worktree: &'static str,
    pub evidence: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LifecycleActionDescription {
    pub action: &'static str,
    pub requires_confirmation: bool,
    pub effects: LifecycleActionEffects,
}

pub fn describe_lifecycle_action(action: DestructiveLifecycleAction) -> LifecycleActionDescription {
    match action {
        DestructiveLifecycleAction::Detach => LifecycleActionDescription {
            action: "detach",
            requires_confirmation: false,
            effects: LifecycleActionEffects {
                process: "retained",
                provider_conversation: "retained",
                worktree: "retained",
                evidence: "retained",
            },
        },
        DestructiveLifecycleAction::StopProcess => LifecycleActionDescription {
            action: "stop-process",
            requires_confirmation: true,
            effects: LifecycleActionEffects {
                process: "stopped",
                provider_conversation: "retained",
                worktree: "retained",
                evidence: "retained",
            },
        },
        DestructiveLifecycleAction::TerminateSession => LifecycleActionDescription {
            action: "terminate-session",
            requires_confirmation: true,
            effects: LifecycleActionEffects {
                process: "stopped",
                provider_conversation: "retained",
                worktree: "retained",
                evidence: "retained",
            },
        },
        DestructiveLifecycleAction::Archive => LifecycleActionDescription {
            action: "archive",
            requires_confirmation: true,
            effects: LifecycleActionEffects {
                process: "stopped-if-running",
                provider_conversation: "archived-reference",
                worktree: "retained",
                evidence: "retained",
            },
        },
    }
}

pub fn confirm_lifecycle_action(
    action: DestructiveLifecycleAction,
    confirmed: bool,
) -> Result<LifecycleActionDescription> {
    let description = describe_lifecycle_action(action);
    if description.requires_confirmation && !confirmed {
        bail!("confirmation required for {}", description.action);
    }
    Ok(description)
}
