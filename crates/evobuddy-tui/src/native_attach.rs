use anyhow::{Context, Result};
use ratatui::backend::CrosstermBackend;
use ratatui::Terminal;
use std::io::Stdout;
use std::path::PathBuf;

use crate::app::WorkbenchApp;
use crate::backend::{load_workbench_state, BackendOptions};
use crate::router::{
    build_open_request, default_tmux_socket_name, RuntimeSessionAction, RuntimeSessionResult,
    RuntimeSessionRouter,
};
use crate::session::NodeNativeSessionBackend;
use crate::substrate::tmux::{format_pre_attach_notice, write_pre_attach_notice, TmuxSubstrate};
use crate::substrate::SessionDisplayMetadata;
use crate::terminal_mode::{CrosstermTerminalControl, TerminalModeGuard};
use crate::ui::render_frame;

pub fn execute_open_native_runtime(
    app: &mut WorkbenchApp,
    terminal: &mut Terminal<CrosstermBackend<Stdout>>,
    control: &mut CrosstermTerminalControl,
    room_id: &str,
    instance_id: &str,
) -> Result<()> {
    let snapshot = app.selection_snapshot();
    let Some(context) = app.native_open_context(room_id, instance_id) else {
        app.action_status = Some("native runtime unavailable for selection".to_string());
        return Ok(());
    };

    let project_root = PathBuf::from(&context.project_root);
    let workspace = PathBuf::from(&context.workspace);
    let backend = NodeNativeSessionBackend::new(project_root.clone());
    let substrate = TmuxSubstrate::new("tmux", default_tmux_socket_name());
    let router = RuntimeSessionRouter::new(backend, substrate);

    let request = build_open_request(
        &project_root,
        &context.room_id,
        &context.agent_instance_id,
        &context.runtime,
        &workspace,
        Some(&context.participant_name),
        Some(&context.safety_mode),
    );

    let open_result = match router.open_native_session(&request) {
        Ok(result) => result,
        Err(error) => {
            app.action_status = Some(format!("native open failed: {error:#}"));
            app.restore_selection(&snapshot);
            return Ok(());
        }
    };

    match open_result {
        RuntimeSessionResult::NeedsChoice { plan } => {
            app.action_status = Some(format!(
                "choose continuation ({} candidates)",
                plan.continuation.candidate_count
            ));
            app.restore_selection(&snapshot);
            return Ok(());
        }
        RuntimeSessionResult::Unsupported { reason, .. } => {
            app.action_status = Some(format!("native runtime disabled: {reason}"));
            app.restore_selection(&snapshot);
            return Ok(());
        }
        RuntimeSessionResult::Ready {
            action,
            plan,
            session_facts,
            ..
        } => {
            let RuntimeSessionAction::Attach { session_ref } = action else {
                app.action_status = Some("native runtime action is not attachable".to_string());
                app.restore_selection(&snapshot);
                return Ok(());
            };

            let display = SessionDisplayMetadata {
                participant: plan.create_session_request.display.participant.clone(),
                runtime: plan.create_session_request.display.runtime.clone(),
                workspace: plan.create_session_request.display.workspace.clone(),
                safety_mode: plan.create_session_request.display.safety_mode.clone(),
                detach_shortcut: plan.create_session_request.display.detach_shortcut.clone(),
            };
            let notice = format_pre_attach_notice(&display, &session_ref);

            terminal
                .draw(|frame| render_frame(frame, app))
                .context("failed to draw pre-attach frame")?;

            let attach_outcome = {
                let mut guard = TerminalModeGuard::enter(control)?;
                write_pre_attach_notice(&notice)?;
                let outcome = router.attach_session(&session_ref);
                guard.restore()?;
                outcome
            };

            match attach_outcome {
                Ok(outcome) => {
                    app.action_status = Some(format!(
                        "returned from {} ({outcome:?}); session exists={}",
                        session_facts.session_ref.0, session_facts.exists
                    ));
                }
                Err(error) => {
                    app.action_status = Some(format!("attach failed: {error:#}"));
                }
            }
        }
    }

    if let Ok(state) = load_workbench_state(&BackendOptions {
        project: project_root,
        state_json: None,
        backend_command: None,
        input_root: None,
        aggregate_report: None,
        plan1_report: None,
        plan2_report: None,
        taskroom_reports: Vec::new(),
    }) {
        app.replace_state_preserving_selection(state, &snapshot);
    } else {
        app.restore_selection(&snapshot);
    }

    terminal.clear().ok();
    Ok(())
}
