use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use anyhow::{bail, Result};
use evobuddy_tui::app::{
    CreateHandoffDraft, CreateTaskRoomDraft, StructuredQuestion, StructuredQuestionChoice,
    WorkbenchApp, WorkbenchEffect,
};
use evobuddy_tui::backend::BackendCommand;
use evobuddy_tui::effects::{execute_effect, EffectDeps, EffectOutcome};
use evobuddy_tui::model::{parse_workbench_state, WorkbenchState};
use evobuddy_tui::ui::effect_names_handled_by_ui;

fn fixture_state() -> WorkbenchState {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures")
        .join("evobuddy-workbench-state-v1.json");
    let text = fs::read_to_string(path).expect("read fixture");
    parse_workbench_state(&text).expect("parse state")
}

fn fixture_app() -> WorkbenchApp {
    WorkbenchApp::new(fixture_state())
}

fn room_id_from_app(app: &WorkbenchApp) -> String {
    app.selected_task_room()
        .map(|room| room.id.clone())
        .unwrap_or_else(|| "taskroom:missing".to_string())
}

#[test]
fn create_task_room_effect_is_executed_not_discarded() {
    let mut app = fixture_app();
    app.task_room_form = CreateTaskRoomDraft {
        objective: "ship-tui".to_string(),
        acceptance_criteria: "green tests".to_string(),
        workspace: "/tmp/ws".to_string(),
        actor: "builder".to_string(),
        runtime: "opencode".to_string(),
        safety_mode: "workspace-write".to_string(),
    };
    let effect = app.submit_task_room_form();
    assert!(matches!(effect, WorkbenchEffect::CreateTaskRoom(_)));

    let handled = effect_names_handled_by_ui();
    assert!(
        handled.contains(&"CreateTaskRoom"),
        "CreateTaskRoom must be executed by the interactive UI, not discarded after mock queue status"
    );

    let commands: Arc<Mutex<Vec<BackendCommand>>> = Arc::new(Mutex::new(Vec::new()));
    let commands_for_run = Arc::clone(&commands);
    let state = fixture_state();
    let mut reloaded = state.clone();
    reloaded.task_rooms.push(evobuddy_tui::model::TaskRoom {
        id: "taskroom:ship-tui".to_string(),
        title: "ship-tui".to_string(),
        runtime: "opencode".to_string(),
        status: reloaded.task_rooms[0].status.clone(),
        objective: "ship-tui".to_string(),
        acceptance_criteria: "green tests".to_string(),
        participants: reloaded.task_rooms[0].participants.clone(),
        rounds: Vec::new(),
        handoffs: Vec::new(),
        reviewer_continuity: reloaded.task_rooms[0].reviewer_continuity.clone(),
        evolution_handoff: reloaded.task_rooms[0].evolution_handoff.clone(),
        attention: None,
        available_actions: Vec::new(),
        returned_to: None,
        artifacts_summary: Vec::new(),
        summary: "ship-tui".to_string(),
    });
    let reloaded_for_load = reloaded.clone();

    let mut deps = EffectDeps {
        project: PathBuf::from(&app.state.project_root),
        run_command: Box::new(move |cmd: &BackendCommand| -> Result<String> {
            commands_for_run
                .lock()
                .expect("commands lock")
                .push(cmd.clone());
            if cmd.args.iter().any(|a| a == "create") && cmd.args.iter().any(|a| a == "taskroom") {
                Ok(
                    r#"{"roomId":"taskroom:ship-tui","title":"ship-tui","objective":"ship-tui"}"#
                        .to_string(),
                )
            } else {
                bail!("unexpected command: {} {}", cmd.program, cmd.args.join(" "))
            }
        }),
        load_state: Box::new(move || Ok(reloaded_for_load.clone())),
        open_native: None,
    };

    let outcome = execute_effect(&mut app, effect, &mut deps).expect("execute");
    assert!(matches!(outcome, EffectOutcome::StateReloaded));

    let ran = commands.lock().expect("commands lock");
    assert!(
        ran.iter().any(|cmd| {
            cmd.program == "node"
                && cmd.args.iter().any(|a| a.contains("evobuddy.mjs"))
                && cmd.args.windows(2).any(|w| w == ["taskroom", "create"])
                && cmd.args.iter().any(|a| a == "--json")
                && cmd.args.iter().any(|a| a == "ship-tui")
        }),
        "CreateTaskRoom must run taskroom create argv: {ran:?}"
    );
    assert!(
        !app.durable_writes.is_empty(),
        "CreateTaskRoom must signal durable write path (durable_writes must not be empty)"
    );
    assert!(
        app.action_status
            .as_deref()
            .is_some_and(|s| s.contains("Created TaskRoom") && s.contains("ship-tui")),
        "status must come from durable result, got {:?}",
        app.action_status
    );
    assert_ne!(
        app.action_status.as_deref(),
        Some("taskroom creation queued"),
        "CreateTaskRoom must not stop at mock-only queue status without durable execution"
    );
    let selected = app
        .selected_task_room()
        .expect("selected room after create");
    assert_eq!(selected.id, "taskroom:ship-tui");
}

#[test]
fn create_handoff_runs_durable_write_and_reloads() {
    let mut app = fixture_app();
    let room_id = room_id_from_app(&app);
    app.handoff_form = CreateHandoffDraft {
        sender: "builder".to_string(),
        receiver: "reviewer".to_string(),
        body: "ship".to_string(),
        artifact_refs: String::new(),
        expected_next_action: String::new(),
        return_destination: String::new(),
    };
    let effect = app.submit_handoff_form();
    assert!(matches!(effect, WorkbenchEffect::CreateHandoff(_)));

    let commands: Arc<Mutex<Vec<BackendCommand>>> = Arc::new(Mutex::new(Vec::new()));
    let commands_for_run = Arc::clone(&commands);
    let reloaded = fixture_state();
    let reloaded_for_load = reloaded.clone();
    let room_id_for_assert = room_id.clone();

    let mut deps = EffectDeps {
        project: PathBuf::from(&app.state.project_root),
        run_command: Box::new(move |cmd: &BackendCommand| -> Result<String> {
            commands_for_run
                .lock()
                .expect("commands lock")
                .push(cmd.clone());
            Ok(r#"{"handoffId":"handoff:1","roomId":"r1"}"#.to_string())
        }),
        load_state: Box::new(move || Ok(reloaded_for_load.clone())),
        open_native: None,
    };

    let outcome = execute_effect(&mut app, effect, &mut deps).expect("execute");
    assert!(matches!(outcome, EffectOutcome::StateReloaded));
    let ran = commands.lock().expect("commands lock");
    assert!(
        ran.iter().any(|cmd| {
            cmd.args
                .windows(3)
                .any(|w| w == ["taskroom", "handoff", "create"])
                && cmd.args.iter().any(|a| a == &room_id_for_assert)
                && cmd.args.iter().any(|a| a == "ship")
        }),
        "CreateHandoff must run durable handoff create: {ran:?}"
    );
    assert!(!app.durable_writes.is_empty());
    assert!(
        app.action_status
            .as_deref()
            .is_some_and(|s| s.contains("Created handoff") || s.contains("handoff")),
        "got {:?}",
        app.action_status
    );
}

#[test]
fn answer_question_continues_open_with_selected_candidate() {
    let mut app = fixture_app();
    app.structured_question = Some(StructuredQuestion {
        prompt: "Choose runtime".to_string(),
        choices: vec![StructuredQuestionChoice {
            id: "codex".to_string(),
            label: "Codex".to_string(),
        }],
        selected_choice: 0,
        allows_free_text: false,
        free_text: String::new(),
        destination_label: "Runtime".to_string(),
        effect_label: "Continue".to_string(),
    });
    let effect = app.submit_structured_answer(0);
    assert!(matches!(effect, WorkbenchEffect::AnswerQuestion(_)));

    let chosen: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let chosen_for_open = Arc::clone(&chosen);
    let mut deps = EffectDeps {
        project: PathBuf::from(&app.state.project_root),
        run_command: Box::new(|_cmd| bail!("answer should not run mutation command")),
        load_state: Box::new(|| bail!("answer should not reload via loader alone")),
        open_native: Some(Box::new(move |_app, _room, candidate| {
            *chosen_for_open.lock().expect("chosen lock") = Some(candidate.to_string());
            Ok(EffectOutcome::OpenedNativeRuntime)
        })),
    };

    let outcome = execute_effect(&mut app, effect, &mut deps).expect("execute");
    assert!(matches!(
        outcome,
        EffectOutcome::OpenedNativeRuntime | EffectOutcome::NeedsUserChoice(_)
    ));
    assert_eq!(
        chosen.lock().expect("chosen lock").as_deref(),
        Some("codex")
    );
}

#[test]
fn open_native_runtime_still_attaches() {
    let mut app = fixture_app();
    let room_id = room_id_from_app(&app);
    let instance_id = app
        .selected_task_room()
        .and_then(|r| r.participants.first().map(|p| p.id.clone()))
        .unwrap_or_default();
    let effect = WorkbenchEffect::OpenNativeRuntime {
        room_id: room_id.clone(),
        instance_id: instance_id.clone(),
    };

    let opened: Arc<Mutex<Option<(String, String)>>> = Arc::new(Mutex::new(None));
    let opened_for_cb = Arc::clone(&opened);
    let mut deps = EffectDeps {
        project: PathBuf::from(&app.state.project_root),
        run_command: Box::new(|_cmd| bail!("open native should not need command runner")),
        load_state: Box::new(|| bail!("open native should not need loader")),
        open_native: Some(Box::new(move |_app, room, instance| {
            *opened_for_cb.lock().expect("opened lock") =
                Some((room.to_string(), instance.to_string()));
            Ok(EffectOutcome::OpenedNativeRuntime)
        })),
    };

    let outcome = execute_effect(&mut app, effect, &mut deps).expect("execute");
    assert!(matches!(outcome, EffectOutcome::OpenedNativeRuntime));
    assert_eq!(
        opened.lock().expect("opened lock").clone(),
        Some((room_id, instance_id))
    );
}

#[test]
fn failed_command_surfaces_status_error_never_silent_success() {
    let mut app = fixture_app();
    app.task_room_form.objective = "obj".to_string();
    app.task_room_form.runtime = "opencode".to_string();
    let effect = app.submit_task_room_form();

    let mut deps = EffectDeps {
        project: PathBuf::from(&app.state.project_root),
        run_command: Box::new(|_cmd| bail!("backend exploded")),
        load_state: Box::new(|| bail!("should not load after failure")),
        open_native: None,
    };

    let outcome = execute_effect(&mut app, effect, &mut deps).expect("execute returns outcome");
    match outcome {
        EffectOutcome::Failed { message } => {
            assert!(
                message.contains("backend exploded") || message.contains("failed"),
                "message={message}"
            );
        }
        other => panic!("expected Failed, got {other:?}"),
    }
    assert!(
        app.action_status
            .as_deref()
            .is_some_and(|s| s.contains("failed") || s.contains("exploded") || s.contains("error")),
        "got {:?}",
        app.action_status
    );
    assert_ne!(
        app.action_status.as_deref(),
        Some("taskroom creation queued")
    );
}

#[test]
fn open_native_runtime_is_not_the_only_executed_effect() {
    let handled = effect_names_handled_by_ui();
    assert!(handled.contains(&"CreateTaskRoom"));
    assert!(handled.contains(&"CreateHandoff"));
    assert!(handled.contains(&"AnswerQuestion"));
    assert!(handled.contains(&"RefreshEvidence"));
    assert!(handled.contains(&"OpenNativeRuntime"));
}

#[test]
fn create_handoff_and_answer_question_effects_are_typed_and_must_be_handled() {
    let mut app = fixture_app();
    app.open_handoff_form();
    app.handoff_form.sender = "builder".to_string();
    app.handoff_form.receiver = "reviewer".to_string();
    app.handoff_form.body = "ship".to_string();
    let handoff = app.submit_handoff_form();
    assert!(matches!(handoff, WorkbenchEffect::CreateHandoff(_)));

    let mut app = fixture_app();
    app.structured_question = Some(StructuredQuestion {
        prompt: "Choose runtime".to_string(),
        choices: vec![StructuredQuestionChoice {
            id: "codex".to_string(),
            label: "Codex".to_string(),
        }],
        selected_choice: 0,
        allows_free_text: false,
        free_text: String::new(),
        destination_label: "Runtime".to_string(),
        effect_label: "Continue".to_string(),
    });
    let answer = app.submit_structured_answer(0);
    assert!(matches!(answer, WorkbenchEffect::AnswerQuestion(_)));

    let handled = effect_names_handled_by_ui();
    assert!(
        handled.contains(&"CreateHandoff") && handled.contains(&"AnswerQuestion"),
        "typed mutation effects must be handled by the UI executor, not discarded"
    );
}

#[test]
fn needs_choice_presents_structured_question_with_candidate_labels() {
    use evobuddy_tui::session::{
        ContinuationCandidate, ContinuationDecision, RuntimeSessionOpenPlan,
    };
    use evobuddy_tui::substrate::{
        CreateSessionRequest, SessionDisplayMetadata, SubstrateSessionRef,
    };
    use evobuddy_tui::views::ViewMode;
    use std::ffi::OsString;
    use std::path::PathBuf;

    let mut app = fixture_app();
    let plan = RuntimeSessionOpenPlan {
        schema: "evobuddy.runtime-session-open-plan.v1".to_string(),
        descriptor_id: "session-1".to_string(),
        continuation: ContinuationDecision {
            kind: "heuristic-resume".to_string(),
            heuristic_candidate_source: Some("resume --last".to_string()),
            candidate_count: 2,
            candidates: vec![
                ContinuationCandidate {
                    candidate_id: "candidate-1".to_string(),
                    label: "Latest".to_string(),
                    provider_conversation_ref: Some("uuid-1".to_string()),
                    source_ref: "session:1".to_string(),
                    observed_at: "2026-07-20T00:00:00.000Z".to_string(),
                    confidence: "medium".to_string(),
                },
                ContinuationCandidate {
                    candidate_id: "candidate-2".to_string(),
                    label: "Previous".to_string(),
                    provider_conversation_ref: Some("uuid-2".to_string()),
                    source_ref: "session:2".to_string(),
                    observed_at: "2026-07-20T00:10:00.000Z".to_string(),
                    confidence: "low".to_string(),
                },
            ],
            requires_structured_choice: true,
            disabled_reason: None,
        },
        intent: evobuddy_tui::session::RuntimeSessionIntent {
            room_id: "taskroom:alpha".to_string(),
            agent_instance_id: "instance-1".to_string(),
            runtime: "codex".to_string(),
            workspace: "/repo".to_string(),
            launch_mode: "heuristic-resume".to_string(),
            provider_conversation_ref: None,
            terminal_session_ref: "tmux:codex:taskroom:alpha:instance-1".to_string(),
            context_packet_ref: Some("context-packet:alpha".to_string()),
            safety_mode: "workspace-write".to_string(),
            expected_evidence_path: "/repo/.evobuddy/evidence-refresh/taskroom:alpha.json"
                .to_string(),
            recovery_hint: "reconcile-existing-before-creating-duplicate".to_string(),
        },
        create_session_request: CreateSessionRequest {
            descriptor_id: "session-1".to_string(),
            session_ref: SubstrateSessionRef("tmux:codex:taskroom:alpha:instance-1".to_string()),
            launcher_plan_ref: "launch-plan:launch-plan-1".to_string(),
            program: PathBuf::from("codex"),
            args: vec![OsString::from("resume")],
            cwd: PathBuf::from("/repo"),
            environment_policy_ref: "environment-policy:workspace-write".to_string(),
            display: SessionDisplayMetadata {
                participant: "Builder".to_string(),
                runtime: "codex".to_string(),
                workspace: "/repo".to_string(),
                safety_mode: "workspace-write".to_string(),
                detach_shortcut: "Ctrl+B d".to_string(),
            },
        },
        runtime_capability_ref: "runtime-capability:codex-v1".to_string(),
        launch_command_ref: "launch-command:codex:heuristic".to_string(),
    };

    app.present_continuation_choice(&plan);

    assert_eq!(app.view_mode, ViewMode::StructuredQuestion);
    let question = app.structured_question.as_ref().expect("question");
    assert_eq!(question.choices.len(), 2);
    assert_eq!(question.choices[0].id, "candidate-1");
    assert_eq!(question.choices[0].label, "Latest");
    assert_eq!(question.choices[1].id, "candidate-2");
    assert_eq!(question.choices[1].label, "Previous");
    assert!(
        !question.allows_free_text,
        "heuristic resume must not free-text pick silently"
    );
}

#[test]
fn refresh_evidence_runs_refresh_command_and_reloads() {
    let mut app = fixture_app();
    let room_id = room_id_from_app(&app);
    let effect = WorkbenchEffect::RefreshEvidence {
        room_id: room_id.clone(),
    };
    let reloaded = fixture_state();
    let mut deps = EffectDeps {
        project: PathBuf::from(&app.state.project_root),
        run_command: Box::new(move |cmd: &BackendCommand| -> Result<String> {
            assert!(
                cmd.args.windows(2).any(|w| w == ["taskroom", "refresh"]),
                "expected taskroom refresh argv, got {:?}",
                cmd.args
            );
            assert!(
                cmd.args.iter().any(|a| a == &room_id),
                "refresh must include room id"
            );
            Ok(r#"{"status":"ok"}"#.to_string())
        }),
        load_state: Box::new(move || Ok(reloaded.clone())),
        open_native: None,
    };
    let outcome = execute_effect(&mut app, effect, &mut deps).expect("execute");
    assert!(matches!(
        outcome,
        EffectOutcome::StateReloaded | EffectOutcome::None
    ));
}

#[test]
fn create_without_room_id_fails_not_silent_success() {
    let mut app = fixture_app();
    app.task_room_form = CreateTaskRoomDraft {
        objective: "ship".to_string(),
        acceptance_criteria: String::new(),
        workspace: String::new(),
        actor: "builder".to_string(),
        runtime: "opencode".to_string(),
        safety_mode: "workspace-write".to_string(),
    };
    let effect = app.submit_task_room_form();
    let mut deps = EffectDeps {
        project: PathBuf::from(&app.state.project_root),
        run_command: Box::new(|_cmd| Ok(r#"{"title":"no-id"}"#.to_string())),
        load_state: Box::new(|| bail!("should not reload on missing roomId")),
        open_native: None,
    };
    let outcome = execute_effect(&mut app, effect, &mut deps).expect("execute");
    assert!(matches!(outcome, EffectOutcome::Failed { .. }));
    assert!(
        app.action_status
            .as_deref()
            .is_some_and(|s| s.contains("roomId") || s.contains("failed")),
        "got {:?}",
        app.action_status
    );
}

#[test]
fn open_native_progress_status_is_not_mock_queued() {
    let mut app = fixture_app();
    let effect = app.open_native_runtime_effect();
    assert!(matches!(effect, WorkbenchEffect::OpenNativeRuntime { .. }));
    let status = app.action_status.as_deref().unwrap_or("");
    assert!(
        !status.contains("queued"),
        "must not use mock queue wording, got {status}"
    );
    assert!(
        status.contains("attaching")
            || status.contains("opening")
            || status.contains("native")
            || status.contains("attach"),
        "got {status}"
    );
}
