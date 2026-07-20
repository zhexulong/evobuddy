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

pub fn session_list_command(project: &Path) -> BackendCommand {
    BackendCommand {
        program: "node".to_string(),
        args: vec![
            "scripts/evobuddy/evobuddy.mjs".to_string(),
            "taskroom".to_string(),
            "session".to_string(),
            "list".to_string(),
            "--project".to_string(),
            project.display().to_string(),
            "--json".to_string(),
        ],
    }
}
