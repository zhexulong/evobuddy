use anyhow::{Context, Result};
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers};
use ratatui::backend::CrosstermBackend;
use ratatui::backend::TestBackend;
use ratatui::Terminal;
use std::io::Write;
use std::io::{self, Stdout};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::app::{WorkbenchApp, WorkbenchEffect};
use crate::backend::{
    load_workbench_state, run_backend_command, taskroom_archive_command, taskroom_create_command,
    taskroom_handoff_create_command, taskroom_message_send_command,
    taskroom_participant_add_command, taskroom_session_stop_command, BackendOptions,
};
use crate::views::DetailView;
use crate::input::{handle_key_event, KeyInput};
use crate::terminal_mode::{CrosstermTerminalControl, TerminalControl};
use crate::views::ViewMode;
use crate::widgets::command_palette::render_command_palette;
use crate::widgets::confirm_action::render_confirm_action;
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
            ViewMode::ConfirmAction => render_confirm_action(frame, app, frame.area()),
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

pub fn render_frame(frame: &mut ratatui::Frame<'_>, app: &WorkbenchApp) {
    match app.view_mode.clone() {
        ViewMode::Dashboard | ViewMode::Search => render_dashboard(frame, app),
        ViewMode::TeamMemberWorkspace => render_team_member_workspace(frame, app, frame.area()),
        ViewMode::FocusedBuddyWorkspace => render_focused_buddy_workspace(frame, app, frame.area()),
        ViewMode::TaskRoomWorkspace => render_task_room_workspace(frame, app, frame.area()),
        ViewMode::TaskRoomForm => render_task_room_form(frame, app, frame.area()),
        ViewMode::HandoffForm => render_handoff_form(frame, app, frame.area()),
        ViewMode::StructuredQuestion => render_structured_question(frame, app, frame.area()),
        ViewMode::ConfirmAction => render_confirm_action(frame, app, frame.area()),
        ViewMode::CommandPalette => render_command_palette(frame, app, frame.area()),
        ViewMode::TraceDrawer => render_trace_drawer(frame, app, frame.area()),
        ViewMode::ActionProgress => render_task_composer(frame, app, frame.area()),
        ViewMode::Help => render_help(frame, frame.area()),
        ViewMode::Detail(detail) => render_detail(frame, app, frame.area(), detail),
    }
}

fn is_text_entry_view(app: &WorkbenchApp) -> bool {
    matches!(
        app.view_mode,
        ViewMode::TaskRoomForm
            | ViewMode::HandoffForm
            | ViewMode::Search
            | ViewMode::CommandPalette
            | ViewMode::Detail(DetailView::TaskRoom)
            | ViewMode::StructuredQuestion
    )
}

fn is_immediate_quit_chord(key: KeyEvent) -> bool {
    matches!(
        key.code,
        KeyCode::Char('c') | KeyCode::Char('d') if key.modifiers.contains(KeyModifiers::CONTROL)
    )
}

fn is_soft_quit_chord(key: KeyEvent) -> bool {
    match key.code {
        KeyCode::Char('q') if key.modifiers.contains(KeyModifiers::CONTROL) => true,
        KeyCode::Char('q') if key.modifiers.is_empty() => true,
        _ => false,
    }
}

fn map_key_event(app: &WorkbenchApp, key: KeyEvent) -> Option<KeyInput> {
    if is_immediate_quit_chord(key) {
        return Some(KeyInput::Quit);
    }

    if is_text_entry_view(app) {
        return match key.code {
            KeyCode::Enter => Some(KeyInput::Enter),
            KeyCode::Esc => Some(KeyInput::Escape),
            KeyCode::Backspace | KeyCode::Delete => Some(KeyInput::Backspace),
            KeyCode::Tab if key.modifiers.contains(KeyModifiers::CONTROL) => {
                Some(KeyInput::NextField)
            }
            KeyCode::Tab => Some(if key.modifiers.contains(KeyModifiers::SHIFT) {
                KeyInput::ShiftTab
            } else {
                KeyInput::Tab
            }),
            KeyCode::Char('a') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                Some(KeyInput::Actions)
            }
            KeyCode::Char(ch)
                if key.modifiers.is_empty() || key.modifiers == KeyModifiers::SHIFT =>
            {
                Some(KeyInput::Char(ch))
            }
            _ => None,
        };
    }

    if is_soft_quit_chord(key) {
        return Some(KeyInput::SoftQuit);
    }

    match key.code {
        KeyCode::Up => Some(KeyInput::Up),
        KeyCode::Down => Some(KeyInput::Down),
        KeyCode::Left => Some(KeyInput::Left),
        KeyCode::Right => Some(KeyInput::Right),
        KeyCode::Enter => Some(KeyInput::Enter),
        KeyCode::Esc => Some(KeyInput::Escape),
        KeyCode::Backspace | KeyCode::Delete => Some(KeyInput::Backspace),
        KeyCode::Tab if key.modifiers.contains(KeyModifiers::CONTROL) => Some(KeyInput::NextField),
        KeyCode::Tab => Some(if key.modifiers.contains(KeyModifiers::SHIFT) {
            KeyInput::ShiftTab
        } else {
            KeyInput::Tab
        }),
        KeyCode::Char('j') if key.modifiers.is_empty() => Some(KeyInput::Down),
        KeyCode::Char('k') if key.modifiers.is_empty() => Some(KeyInput::Up),
        KeyCode::Char('/')
            if key.modifiers.contains(KeyModifiers::CONTROL) || key.modifiers.is_empty() =>
        {
            Some(KeyInput::Search)
        }
        KeyCode::Char(':') if key.modifiers.is_empty() || key.modifiers == KeyModifiers::SHIFT => {
            Some(KeyInput::Commands)
        }
        KeyCode::Char('p') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            Some(KeyInput::Commands)
        }
        KeyCode::Char('n') if key.modifiers.is_empty() => Some(KeyInput::NewRoom),
        KeyCode::Char('m') if key.modifiers.is_empty() => Some(KeyInput::ChooseSeat),
        KeyCode::Char('h') if key.modifiers.is_empty() => Some(KeyInput::Handoff),
        KeyCode::Char('?') if key.modifiers.is_empty() => Some(KeyInput::Help),
        KeyCode::Char('a') if key.modifiers.is_empty() => Some(KeyInput::Actions),
        KeyCode::Char('r') if key.modifiers.is_empty() => Some(KeyInput::Trace),
        KeyCode::Char('u') if key.modifiers.is_empty() => Some(KeyInput::Updates),
        KeyCode::Char('b') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            Some(KeyInput::ToggleTaskRooms)
        }
        KeyCode::Char('t') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            Some(KeyInput::ToggleUpdates)
        }
        KeyCode::Char(ch @ '1'..='9') if key.modifiers.is_empty() => Some(
            KeyInput::StructuredAnswer(ch.to_digit(10).unwrap_or(1) as u8),
        ),
        KeyCode::Char(ch) if key.modifiers.is_empty() || key.modifiers == KeyModifiers::SHIFT => {
            Some(KeyInput::Char(ch))
        }
        _ => None,
    }
}

pub fn soft_quit_confirms(
    armed_at: Option<std::time::Instant>,
    now: std::time::Instant,
    window: Duration,
) -> bool {
    armed_at
        .map(|prev| now.duration_since(prev) <= window)
        .unwrap_or(false)
}

#[cfg(test)]
mod key_map_tests {
    use super::*;
    use crate::model::parse_workbench_state;
    use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
    use std::fs;
    use std::path::PathBuf;

    fn sample_app() -> WorkbenchApp {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/evobuddy-workbench-state-v1.json");
        let text = fs::read_to_string(path).expect("fixture");
        WorkbenchApp::new(parse_workbench_state(&text).expect("parse"))
    }

    #[test]
    fn ctrl_c_d_always_immediate_quit() {
        let app = sample_app();
        for (code, mods) in [
            (KeyCode::Char('c'), KeyModifiers::CONTROL),
            (KeyCode::Char('d'), KeyModifiers::CONTROL),
        ] {
            assert_eq!(
                map_key_event(&app, KeyEvent::new(code, mods)),
                Some(KeyInput::Quit)
            );
        }
    }

    #[test]
    fn text_entry_types_letters_instead_of_commands() {
        let mut app = sample_app();
        app.push_view(ViewMode::Detail(DetailView::TaskRoom));
        assert_eq!(
            map_key_event(&app, KeyEvent::new(KeyCode::Char('n'), KeyModifiers::NONE)),
            Some(KeyInput::Char('n'))
        );
        assert_eq!(
            map_key_event(&app, KeyEvent::new(KeyCode::Char('q'), KeyModifiers::NONE)),
            Some(KeyInput::Char('q'))
        );
        assert_eq!(
            map_key_event(&app, KeyEvent::new(KeyCode::Char('j'), KeyModifiers::NONE)),
            Some(KeyInput::Char('j'))
        );
        assert_eq!(
            map_key_event(&app, KeyEvent::new(KeyCode::Char('a'), KeyModifiers::NONE)),
            Some(KeyInput::Char('a'))
        );
    }

    #[test]
    fn dashboard_q_and_ctrl_q_are_soft_quit() {
        let app = sample_app();
        assert_eq!(
            map_key_event(&app, KeyEvent::new(KeyCode::Char('q'), KeyModifiers::NONE)),
            Some(KeyInput::SoftQuit)
        );
        assert_eq!(
            map_key_event(
                &app,
                KeyEvent::new(KeyCode::Char('q'), KeyModifiers::CONTROL)
            ),
            Some(KeyInput::SoftQuit)
        );
    }

    #[test]
    fn soft_quit_double_tap_within_window() {
        let t0 = std::time::Instant::now();
        let t1 = t0 + Duration::from_millis(400);
        let t2 = t0 + Duration::from_millis(1500);
        assert!(!soft_quit_confirms(None, t0, Duration::from_secs(1)));
        assert!(soft_quit_confirms(Some(t0), t1, Duration::from_secs(1)));
        assert!(!soft_quit_confirms(Some(t0), t2, Duration::from_secs(1)));
    }
}

pub fn run_interactive_app(app: &mut WorkbenchApp) -> Result<()> {
    let mut control = CrosstermTerminalControl;
    control.restore()?;
    let stdout: Stdout = io::stdout();
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend).context("failed to create terminal")?;

    let result = (|| -> Result<()> {
        let soft_quit_window = Duration::from_secs(1);
        let mut soft_quit_armed_at: Option<std::time::Instant> = None;
        loop {
            terminal
                .draw(|frame| render_frame(frame, app))
                .context("failed to draw interactive frame")?;
            maybe_dump_frame(app, terminal.size()?.width, terminal.size()?.height)?;
            if event::poll(Duration::from_millis(100)).context("failed to poll terminal events")? {
                if let Event::Key(key) = event::read().context("failed to read terminal event")? {
                    if let Some(mapped) = map_key_event(app, key) {
                        if mapped == KeyInput::Quit {
                            break;
                        }
                        if mapped == KeyInput::SoftQuit {
                            let now = std::time::Instant::now();
                            if soft_quit_confirms(soft_quit_armed_at, now, soft_quit_window) {
                                break;
                            }
                            soft_quit_armed_at = Some(now);
                            app.action_status =
                                Some("press q again to quit".to_string());
                            continue;
                        }
                        soft_quit_armed_at = None;
                        let effect = handle_key_event(app, mapped);
                        execute_workbench_effect(app, &mut terminal, &mut control, effect)?;
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

fn project_root(app: &WorkbenchApp) -> PathBuf {
    PathBuf::from(&app.state.project_root)
}

fn iso_now() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("1970-01-01T00:00:{:012}.000Z", millis % 1_000_000_000_000)
}

fn execute_workbench_effect(
    app: &mut WorkbenchApp,
    terminal: &mut Terminal<CrosstermBackend<Stdout>>,
    control: &mut CrosstermTerminalControl,
    effect: WorkbenchEffect,
) -> Result<()> {
    match effect {
        WorkbenchEffect::None | WorkbenchEffect::RequestConfirmation(_) => Ok(()),
        WorkbenchEffect::ExecuteCommand(_) | WorkbenchEffect::AnswerQuestion(_) => Ok(()),
        WorkbenchEffect::OpenNativeRuntime {
            room_id,
            instance_id,
        } => crate::native_attach::execute_open_native_runtime(
            app,
            terminal,
            control,
            &room_id,
            &instance_id,
        ),
        WorkbenchEffect::CreateTaskRoom(draft) => {
            let project = project_root(app);
            let room_id = format!(
                "taskroom:{}",
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|duration| duration.as_millis())
                    .unwrap_or(0)
            );
            let objective = if draft.objective.trim().is_empty() {
                "new room".to_string()
            } else {
                draft.objective.clone()
            };
            let title = crate::backend::title_from_objective(&objective, &room_id);
            let runtime = if draft.runtime.trim().is_empty() {
                "pi"
            } else {
                draft.runtime.as_str()
            };
            let command = taskroom_create_command(
                &project,
                &room_id,
                &title,
                &objective,
                Some(runtime),
                Some(&iso_now()),
            );
            run_backend_command(&command, &project)?;
            app.durable_writes.push(format!("created {room_id}"));
            app.action_status = Some(format!("created {room_id} · type a message"));
            if let Ok(state) = load_workbench_state(&BackendOptions {
                project: project.clone(),
                state_json: None,
                input_root: None,
                aggregate_report: None,
                plan1_report: None,
                plan2_report: None,
                taskroom_reports: vec![],
                backend_command: None,
            }) {
                app.state = state;
                if let Some(idx) = app.state.task_rooms.iter().position(|r| r.id == room_id) {
                    app.selected_task_room = idx;
                } else if !app.state.task_rooms.is_empty() {
                    app.selected_task_room = app.state.task_rooms.len() - 1;
                }
            }
            app.focus = crate::app::FocusPane::TaskRooms;
            app.room_composer.clear();
            app.push_view(ViewMode::Detail(DetailView::TaskRoom));
            Ok(())
        }
        WorkbenchEffect::SendRoomMessage { room_id, body } => {
            let project = project_root(app);
            let command = taskroom_message_send_command(&project, &room_id, &body, None);
            run_backend_command(&command, &project)?;
            app.durable_writes
                .push(format!("message in {room_id}"));
            app.action_status = Some("message sent".to_string());
            if let Ok(state) = load_workbench_state(&BackendOptions {
                project: project.clone(),
                state_json: None,
                input_root: None,
                aggregate_report: None,
                plan1_report: None,
                plan2_report: None,
                taskroom_reports: vec![],
                backend_command: None,
            }) {
                let selected_id = room_id.clone();
                app.state = state;
                if let Some(idx) = app.state.task_rooms.iter().position(|r| r.id == selected_id) {
                    app.selected_task_room = idx;
                }
            }
            Ok(())
        }
        WorkbenchEffect::CreateHandoff(draft) => {
            let project = project_root(app);
            let room = app.selected_task_room();
            let room_id = room
                .map(|room| room.id.clone())
                .unwrap_or_else(|| "taskroom:unknown".to_string());
            let builder_id = room
                .and_then(|r| {
                    r.participants
                        .iter()
                        .find(|p| p.role.eq_ignore_ascii_case("builder"))
                        .or_else(|| r.participants.first())
                        .map(|p| p.id.clone())
                })
                .unwrap_or_default();
            let reviewer_id = room
                .and_then(|r| {
                    r.participants
                        .iter()
                        .find(|p| p.role.eq_ignore_ascii_case("reviewer"))
                        .or_else(|| r.participants.get(1))
                        .map(|p| p.id.clone())
                })
                .unwrap_or_default();
            let from = if draft.sender.trim().is_empty() {
                builder_id
            } else {
                draft.sender.clone()
            };
            let to = if draft.receiver.trim().is_empty() {
                reviewer_id
            } else {
                draft.receiver.clone()
            };
            let body = if draft.body.trim().is_empty() {
                "review requested".to_string()
            } else {
                draft.body.clone()
            };
            let handoff_id = format!(
                "handoff:{}",
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|duration| duration.as_millis())
                    .unwrap_or(0)
            );
            let command = taskroom_handoff_create_command(
                &project,
                &room_id,
                &handoff_id,
                &from,
                &to,
                "review-request",
                Some(&body),
                Some(&iso_now()),
            );
            run_backend_command(&command, &project)?;
            app.durable_writes.push(format!("handoff {handoff_id}"));
            app.action_status = Some(format!("created {handoff_id}"));
            Ok(())
        }
        WorkbenchEffect::AddParticipant {
            room_id,
            participant_id,
            actor_name,
            actor_kind,
            role,
            runtime,
        } => {
            let project = project_root(app);
            let command = taskroom_participant_add_command(
                &project,
                &room_id,
                &participant_id,
                &actor_name,
                &actor_kind,
                &role,
                runtime.as_deref(),
            );
            run_backend_command(&command, &project)?;
            app.durable_writes
                .push(format!("participant {participant_id}"));
            app.action_status = Some(format!("added {participant_id}"));
            Ok(())
        }
        WorkbenchEffect::StopSession {
            room_id,
            instance_id,
        } => {
            let project = project_root(app);
            let command =
                taskroom_session_stop_command(&project, &room_id, &instance_id, "user-stop");
            run_backend_command(&command, &project)?;
            app.durable_writes
                .push(format!("stopped session {instance_id}"));
            app.action_status = Some(format!("stopped {instance_id}"));
            Ok(())
        }
        WorkbenchEffect::ArchiveTaskRoom { room_id } => {
            let project = project_root(app);
            let command = taskroom_archive_command(&project, &room_id);
            run_backend_command(&command, &project)?;
            app.durable_writes.push(format!("archived {room_id}"));
            app.action_status = Some(format!("archived {room_id}"));
            Ok(())
        }
    }
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
