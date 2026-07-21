#![allow(clippy::type_complexity)]
use std::path::PathBuf;

use anyhow::Result;
use serde_json::Value;

use crate::app::{
    CreateHandoffDraft, CreateTaskRoomDraft, StructuredQuestion, WorkbenchApp, WorkbenchEffect,
};
use crate::backend::{
    load_workbench_state, run_backend_command, taskroom_create_command,
    taskroom_handoff_create_command, taskroom_refresh_command, BackendCommand, BackendOptions,
};
use crate::model::WorkbenchState;
use crate::views::ViewMode;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EffectOutcome {
    None,
    StateReloaded,
    OpenedNativeRuntime,
    NeedsUserChoice(StructuredQuestion),
    Failed { message: String },
}

pub type OpenNativeFn = Box<dyn FnMut(&mut WorkbenchApp, &str, &str) -> Result<EffectOutcome>>;

pub struct EffectDeps {
    pub project: PathBuf,
    pub run_command: Box<dyn FnMut(&BackendCommand) -> Result<String>>,
    pub load_state: Box<dyn FnMut() -> Result<WorkbenchState>>,
    pub open_native: Option<OpenNativeFn>,
}

impl EffectDeps {
    pub fn production(project: PathBuf) -> Self {
        let project_for_run = project.clone();
        let project_for_load = project.clone();
        Self {
            project,
            run_command: Box::new(move |cmd: &BackendCommand| {
                run_backend_command(&project_for_run, cmd)
            }),
            load_state: Box::new(move || {
                load_workbench_state(&BackendOptions {
                    project: project_for_load.clone(),
                    state_json: None,
                    backend_command: None,
                    input_root: None,
                    aggregate_report: None,
                    plan1_report: None,
                    plan2_report: None,
                    taskroom_reports: Vec::new(),
                })
            }),
            open_native: None,
        }
    }
}

pub fn execute_effect(
    app: &mut WorkbenchApp,
    effect: WorkbenchEffect,
    deps: &mut EffectDeps,
) -> Result<EffectOutcome> {
    match effect {
        WorkbenchEffect::None => Ok(EffectOutcome::None),
        WorkbenchEffect::ExecuteCommand(_) => Ok(EffectOutcome::None),
        WorkbenchEffect::CreateTaskRoom(draft) => execute_create_task_room(app, draft, deps),
        WorkbenchEffect::CreateHandoff(draft) => execute_create_handoff(app, draft, deps),
        WorkbenchEffect::AnswerQuestion(answer) => execute_answer_question(app, answer, deps),
        WorkbenchEffect::OpenNativeRuntime {
            room_id,
            instance_id,
        } => execute_open_native(app, &room_id, &instance_id, deps),
        WorkbenchEffect::RefreshEvidence { room_id } => {
            execute_refresh_evidence(app, &room_id, deps)
        }
    }
}

fn fail(app: &mut WorkbenchApp, message: String) -> Result<EffectOutcome> {
    if app.view_mode == ViewMode::ActionProgress {
        app.pop_view();
    }
    app.action_status = Some(format!("failed: {message}"));
    if app.view_mode == ViewMode::TaskRoomForm {
        app.task_room_form_field_errors[0] = Some(message.clone());
    }
    Ok(EffectOutcome::Failed { message })
}

fn json_string_field(stdout: &str, keys: &[&str]) -> Option<String> {
    let value: Value = serde_json::from_str(stdout.trim()).ok()?;
    for key in keys {
        if let Some(s) = value.get(*key).and_then(|v| v.as_str()) {
            return Some(s.to_string());
        }
    }
    None
}

fn after_mutation_reload(
    app: &mut WorkbenchApp,
    deps: &mut EffectDeps,
    select_room_id: Option<&str>,
    status: String,
    durable_ref: String,
) -> Result<EffectOutcome> {
    app.durable_writes.push(durable_ref);
    app.action_status = Some(status);
    let snapshot = app.selection_snapshot();
    match (deps.load_state)() {
        Ok(state) => {
            app.replace_state_preserving_selection(state, &snapshot);
            if let Some(room_id) = select_room_id {
                app.select_task_room_by_id(room_id);
            }
            if app.view_mode == ViewMode::ActionProgress {
                app.pop_view();
            }
            Ok(EffectOutcome::StateReloaded)
        }
        Err(error) => fail(app, format!("reload after mutation failed: {error:#}")),
    }
}

fn execute_create_task_room(
    app: &mut WorkbenchApp,
    draft: CreateTaskRoomDraft,
    deps: &mut EffectDeps,
) -> Result<EffectOutcome> {
    let command = taskroom_create_command(&deps.project, &draft);
    let stdout = match (deps.run_command)(&command) {
        Ok(out) => out,
        Err(error) => return fail(app, format!("{error:#}")),
    };
    let Some(room_id) = json_string_field(&stdout, &["roomId", "id"]) else {
        return fail(app, "taskroom create response missing roomId".to_string());
    };
    let title = json_string_field(&stdout, &["title", "objective"])
        .unwrap_or_else(|| draft.objective.trim().to_string());
    let label = if title.is_empty() {
        room_id.clone()
    } else {
        title
    };
    after_mutation_reload(
        app,
        deps,
        Some(&room_id),
        format!("Created TaskRoom {label}"),
        format!("taskroom:{room_id}"),
    )
}

fn execute_create_handoff(
    app: &mut WorkbenchApp,
    draft: CreateHandoffDraft,
    deps: &mut EffectDeps,
) -> Result<EffectOutcome> {
    let room_id = app
        .selected_task_room()
        .map(|room| room.id.clone())
        .unwrap_or_default();
    if room_id.is_empty() {
        return fail(app, "no task room selected for handoff".to_string());
    }
    let command = taskroom_handoff_create_command(&deps.project, &room_id, &draft);
    let stdout = match (deps.run_command)(&command) {
        Ok(out) => out,
        Err(error) => return fail(app, format!("{error:#}")),
    };
    let Some(handoff_id) = json_string_field(&stdout, &["handoffId", "id"]) else {
        return fail(
            app,
            "taskroom handoff create response missing handoffId".to_string(),
        );
    };
    after_mutation_reload(
        app,
        deps,
        Some(&room_id),
        format!("Created handoff {handoff_id}"),
        format!("handoff:{handoff_id}"),
    )
}

fn execute_answer_question(
    app: &mut WorkbenchApp,
    answer: String,
    deps: &mut EffectDeps,
) -> Result<EffectOutcome> {
    app.structured_question = None;
    let room_id = app
        .selected_task_room()
        .map(|room| room.id.clone())
        .unwrap_or_default();
    if let Some(open_native) = deps.open_native.as_mut() {
        let outcome = open_native(app, &room_id, &answer)?;
        if matches!(outcome, EffectOutcome::OpenedNativeRuntime) {
            app.action_status = Some(format!("continued with candidate {answer}"));
        }
        return Ok(outcome);
    }
    app.action_status = Some(format!("answered: {answer}"));
    if app.view_mode == ViewMode::ActionProgress || app.view_mode == ViewMode::StructuredQuestion {
        app.pop_view();
    }
    Ok(EffectOutcome::None)
}

fn execute_open_native(
    app: &mut WorkbenchApp,
    room_id: &str,
    instance_id: &str,
    deps: &mut EffectDeps,
) -> Result<EffectOutcome> {
    if let Some(open_native) = deps.open_native.as_mut() {
        return open_native(app, room_id, instance_id);
    }
    app.action_status = Some(format!("open native runtime {room_id}/{instance_id}"));
    Ok(EffectOutcome::OpenedNativeRuntime)
}

fn execute_refresh_evidence(
    app: &mut WorkbenchApp,
    room_id: &str,
    deps: &mut EffectDeps,
) -> Result<EffectOutcome> {
    let command = taskroom_refresh_command(&deps.project, room_id);
    match (deps.run_command)(&command) {
        Ok(_) => after_mutation_reload(
            app,
            deps,
            Some(room_id),
            format!("Refreshed evidence for {room_id}"),
            format!("refresh:{room_id}"),
        ),
        Err(error) => fail(app, format!("{error:#}")),
    }
}
