use anyhow::{Context, Result};
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers};
use ratatui::backend::CrosstermBackend;
use ratatui::backend::TestBackend;
use ratatui::Terminal;
use std::io::Write;
use std::io::{self, Stdout};
use std::path::PathBuf;
use std::time::Duration;

use crate::app::{WorkbenchApp, WorkbenchEffect};
use crate::backend::{load_workbench_state, BackendOptions};
use crate::effects::{execute_effect, EffectDeps, EffectOutcome};
use crate::input::{handle_key_event, KeyInput};
use crate::router::{
    build_open_request, default_tmux_socket_name, RuntimeSessionAction, RuntimeSessionResult,
    RuntimeSessionRouter,
};
use crate::session::NodeNativeSessionBackend;
use crate::substrate::tmux::{format_pre_attach_notice, write_pre_attach_notice, TmuxSubstrate};
use crate::substrate::SessionDisplayMetadata;
use crate::terminal_mode::{CrosstermTerminalControl, TerminalControl, TerminalModeGuard};
use crate::views::ViewMode;
use crate::widgets::command_palette::render_command_palette;
use crate::widgets::dashboard::render_dashboard;
use crate::widgets::detail::render_detail;
use crate::widgets::handoff_form::render_handoff_form;
use crate::widgets::help::render_help;
use crate::widgets::structured_question::render_structured_question;
use crate::widgets::task_composer::render_task_composer;
use crate::widgets::task_room_form::render_task_room_form;
use crate::widgets::trace::render_trace_drawer;
use crate::widgets::workspace::{
    render_focused_buddy_workspace, render_task_room_workspace, render_team_member_workspace,
};

pub fn render_dashboard_snapshot(app: &WorkbenchApp, width: u16, height: u16) -> Result<String> {
    render_current_snapshot(app, width, height)
}

pub fn render_current_snapshot(app: &WorkbenchApp, width: u16, height: u16) -> Result<String> {
    let backend = TestBackend::new(width, height);
    let mut terminal = Terminal::new(backend).context("failed to create headless terminal")?;
    terminal
        .draw(|frame| match app.view_mode.clone() {
            ViewMode::Dashboard | ViewMode::Search => render_dashboard(frame, app),
            ViewMode::TeamMemberWorkspace => render_team_member_workspace(frame, app, frame.area()),
            ViewMode::FocusedBuddyWorkspace => {
                render_focused_buddy_workspace(frame, app, frame.area())
            }
            ViewMode::TaskRoomWorkspace => render_task_room_workspace(frame, app, frame.area()),
            ViewMode::TaskRoomForm => render_task_room_form(frame, app, frame.area()),
            ViewMode::HandoffForm => render_handoff_form(frame, app, frame.area()),
            ViewMode::StructuredQuestion => render_structured_question(frame, app, frame.area()),
            ViewMode::CommandPalette => render_command_palette(frame, app, frame.area()),
            ViewMode::TraceDrawer => render_trace_drawer(frame, app, frame.area()),
            ViewMode::ActionProgress => render_task_composer(frame, app, frame.area()),
            ViewMode::Help => render_help(frame, frame.area()),
            ViewMode::Detail(detail) => render_detail(frame, app, frame.area(), detail),
        })
        .context("failed to render dashboard")?;
    let buffer = terminal.backend().buffer();
    let snapshot = (0..height)
        .map(|y| {
            let mut line = String::new();
            for x in 0..width {
                line.push_str(buffer[(x, y)].symbol());
            }
            line.trim_end().to_string()
        })
        .collect::<Vec<_>>()
        .join("\n");
    Ok(format!("{snapshot}\n"))
}

fn render_current(frame: &mut ratatui::Frame<'_>, app: &WorkbenchApp) {
    match app.view_mode.clone() {
        ViewMode::Dashboard | ViewMode::Search => render_dashboard(frame, app),
        ViewMode::TeamMemberWorkspace => render_team_member_workspace(frame, app, frame.area()),
        ViewMode::FocusedBuddyWorkspace => render_focused_buddy_workspace(frame, app, frame.area()),
        ViewMode::TaskRoomWorkspace => render_task_room_workspace(frame, app, frame.area()),
        ViewMode::TaskRoomForm => render_task_room_form(frame, app, frame.area()),
        ViewMode::HandoffForm => render_handoff_form(frame, app, frame.area()),
        ViewMode::StructuredQuestion => render_structured_question(frame, app, frame.area()),
        ViewMode::CommandPalette => render_command_palette(frame, app, frame.area()),
        ViewMode::TraceDrawer => render_trace_drawer(frame, app, frame.area()),
        ViewMode::ActionProgress => render_task_composer(frame, app, frame.area()),
        ViewMode::Help => render_help(frame, frame.area()),
        ViewMode::Detail(detail) => render_detail(frame, app, frame.area(), detail),
    }
}

fn is_text_entry_view(app: &WorkbenchApp) -> bool {
    match app.view_mode {
        ViewMode::TaskRoomForm
        | ViewMode::HandoffForm
        | ViewMode::Search
        | ViewMode::CommandPalette => true,
        ViewMode::StructuredQuestion => app
            .structured_question
            .as_ref()
            .is_some_and(|question| question.allows_free_text),
        _ => false,
    }
}

fn map_key_event(key: KeyEvent) -> Option<KeyInput> {
    match key.code {
        KeyCode::Up => Some(KeyInput::Up),
        KeyCode::Down => Some(KeyInput::Down),
        KeyCode::Left => Some(KeyInput::Left),
        KeyCode::Right => Some(KeyInput::Right),
        KeyCode::Enter => Some(KeyInput::Enter),
        KeyCode::Esc => Some(KeyInput::Escape),
        KeyCode::Backspace => Some(KeyInput::Backspace),
        KeyCode::Delete => Some(KeyInput::Delete),
        KeyCode::Tab if key.modifiers.contains(KeyModifiers::CONTROL) => Some(KeyInput::NextField),
        KeyCode::Tab => Some(if key.modifiers.contains(KeyModifiers::SHIFT) {
            KeyInput::ShiftTab
        } else {
            KeyInput::Tab
        }),
        KeyCode::Char('j') => Some(KeyInput::Down),
        KeyCode::Char('k') => Some(KeyInput::Up),
        KeyCode::Char('/')
            if key.modifiers.contains(KeyModifiers::CONTROL) || key.modifiers.is_empty() =>
        {
            Some(KeyInput::Search)
        }
        KeyCode::Char(':') if key.modifiers.is_empty() || key.modifiers == KeyModifiers::SHIFT => {
            Some(KeyInput::Commands)
        }
        KeyCode::Char('n') if key.modifiers.is_empty() => Some(KeyInput::NewRoom),
        KeyCode::Char('h') if key.modifiers.is_empty() => Some(KeyInput::Handoff),
        KeyCode::Char('?') => Some(KeyInput::Help),
        KeyCode::Char('a') if key.modifiers.is_empty() => Some(KeyInput::Actions),
        KeyCode::Char('r') => Some(KeyInput::Trace),
        KeyCode::Char('e') if key.modifiers.is_empty() => Some(KeyInput::Evidence),
        KeyCode::Char('u') if key.modifiers.is_empty() => Some(KeyInput::Updates),
        KeyCode::Char('b') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            Some(KeyInput::ToggleTaskRooms)
        }
        KeyCode::Char('t') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            Some(KeyInput::ToggleUpdates)
        }
        KeyCode::Char('q') if key.modifiers.is_empty() => Some(KeyInput::Quit),
        KeyCode::Char(ch @ '1'..='9') if key.modifiers.is_empty() => Some(
            KeyInput::StructuredAnswer(ch.to_digit(10).unwrap_or(1) as u8),
        ),
        KeyCode::Char(ch) if key.modifiers.is_empty() || key.modifiers == KeyModifiers::SHIFT => {
            Some(KeyInput::Char(ch))
        }
        _ => None,
    }
}

pub fn map_key_event_for_app(app: &WorkbenchApp, key: KeyEvent) -> Option<KeyInput> {
    if is_text_entry_view(app) {
        match key.code {
            KeyCode::Up => Some(KeyInput::Up),
            KeyCode::Down => Some(KeyInput::Down),
            KeyCode::Left => Some(KeyInput::Left),
            KeyCode::Right => Some(KeyInput::Right),
            KeyCode::Enter => Some(KeyInput::Enter),
            KeyCode::Esc => Some(KeyInput::Escape),
            KeyCode::Backspace => Some(KeyInput::Backspace),
            KeyCode::Delete => Some(KeyInput::Delete),
            KeyCode::Tab if key.modifiers.contains(KeyModifiers::CONTROL) => {
                Some(KeyInput::NextField)
            }
            KeyCode::Tab => Some(if key.modifiers.contains(KeyModifiers::SHIFT) {
                KeyInput::ShiftTab
            } else {
                KeyInput::Tab
            }),
            KeyCode::Char(ch)
                if key.modifiers.is_empty() || key.modifiers == KeyModifiers::SHIFT =>
            {
                Some(KeyInput::Char(ch))
            }
            _ => None,
        }
    } else {
        map_key_event(key)
    }
}

pub fn effect_names_handled_by_ui() -> Vec<&'static str> {
    vec![
        "CreateTaskRoom",
        "CreateHandoff",
        "AnswerQuestion",
        "RefreshEvidence",
        "OpenNativeRuntime",
        "ExecuteCommand",
        "None",
    ]
}

pub fn run_interactive_app(app: &mut WorkbenchApp) -> Result<()> {
    let mut control = CrosstermTerminalControl;
    control.restore()?;
    let stdout: Stdout = io::stdout();
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend).context("failed to create terminal")?;

    let project = PathBuf::from(&app.state.project_root);
    let mut deps = EffectDeps::production(project);
    deps.open_native = Some(Box::new(
        move |app: &mut WorkbenchApp, room_id: &str, instance_id: &str| {
            app.action_status = Some(format!("opening native runtime {room_id}/{instance_id}"));
            Ok(EffectOutcome::OpenedNativeRuntime)
        },
    ));

    let result = (|| -> Result<()> {
        loop {
            terminal
                .draw(|frame| render_current(frame, app))
                .context("failed to draw interactive frame")?;
            maybe_dump_frame(app, terminal.size()?.width, terminal.size()?.height)?;
            if event::poll(Duration::from_millis(100)).context("failed to poll terminal events")? {
                if let Event::Key(key) = event::read().context("failed to read terminal event")? {
                    if let Some(mapped) = map_key_event_for_app(app, key) {
                        if mapped == KeyInput::Quit {
                            break;
                        }
                        let effect = handle_key_event(app, mapped);
                        let pending_open = match &effect {
                            WorkbenchEffect::OpenNativeRuntime {
                                room_id,
                                instance_id,
                            } => Some((room_id.clone(), instance_id.clone())),
                            WorkbenchEffect::AnswerQuestion(answer) => app
                                .selected_task_room()
                                .map(|room| (room.id.clone(), answer.clone())),
                            _ => None,
                        };
                        let outcome = execute_effect(app, effect, &mut deps)?;
                        if let EffectOutcome::OpenedNativeRuntime = outcome {
                            if let Some((room_id, instance_id)) = pending_open {
                                execute_open_native_runtime(
                                    app,
                                    &mut terminal,
                                    &mut control,
                                    &room_id,
                                    &instance_id,
                                )?;
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    })();

    terminal.show_cursor().ok();
    drop(terminal);
    control.suspend()?;
    result
}

fn execute_open_native_runtime(
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
            app.restore_selection(&snapshot);
            app.present_continuation_choice(&plan);
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
                .draw(|frame| render_current(frame, app))
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

    let refresh_room = room_id.to_string();
    {
        let mut deps = EffectDeps::production(project_root.clone());
        let _ = execute_effect(
            app,
            WorkbenchEffect::RefreshEvidence {
                room_id: refresh_room,
            },
            &mut deps,
        );
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

fn maybe_dump_frame(app: &WorkbenchApp, width: u16, height: u16) -> Result<()> {
    if std::env::var("EVOBUDDY_TUI_FRAME_DUMP").ok().as_deref() != Some("1") {
        return Ok(());
    }
    let snapshot = render_current_snapshot(app, width.max(60), height.max(20))?;
    if let Ok(path) = std::env::var("EVOBUDDY_TUI_FRAME_DUMP_PATH") {
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .context("failed to open frame dump path")?;
        writeln!(file, "<FRAME>\n{snapshot}</FRAME>").context("failed to write frame dump")?;
    } else {
        eprintln!("\n<FRAME>\n{snapshot}</FRAME>");
    }
    Ok(())
}
