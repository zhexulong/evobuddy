use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Clear, Paragraph};
use ratatui::Frame;

use crate::action_hints::action_hints;
use crate::app::{FocusPane, WorkbenchApp};
use crate::model::RuntimeSetupStatus;
use crate::theme::{compact_density, home_body_min_height, muted_style, theme};
use crate::widgets::action_bar::render_action_bar;
use crate::widgets::inbox::{
    attention_counts, render_selected_task_room_detail, render_work_inbox,
};

pub fn render_dashboard(frame: &mut Frame<'_>, app: &WorkbenchApp) {
    let area = frame.area();
    let t = theme();
    frame.render_widget(Clear, area);
    frame.render_widget(
        Block::default().style(Style::default().bg(t.bg).fg(t.text)),
        area,
    );

    if area.width < 70 {
        render_narrow(frame, app, area);
    } else if area.width < 100 {
        render_compact(frame, app, area);
    } else {
        render_wide(frame, app, area);
    }
}

fn render_header(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let t = theme();
    let readiness = runtime_readiness_summary(app);
    let title = Span::styled(
        " EvoBuddy ",
        Style::default()
            .fg(t.text)
            .bg(t.surface_alt)
            .add_modifier(Modifier::BOLD),
    );
    let meta = Span::styled(
        format!(" {} rooms · {} ", app.state.task_rooms.len(), readiness),
        Style::default().fg(t.text_muted).bg(t.surface),
    );
    frame.render_widget(
        Paragraph::new(Line::from(vec![title, meta])).style(Style::default().bg(t.surface)),
        area,
    );
}

fn render_attention_strip(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let t = theme();
    let (needs, working, returned) = attention_counts(app);
    let ready = app
        .state
        .task_rooms
        .iter()
        .filter(|room| matches!(room.status, crate::model::TaskRoomStatus::Queued))
        .count();
    let line = if app.search_query.trim().is_empty() {
        Line::from(vec![
            Span::styled(" ● ", Style::default().fg(t.danger).bg(t.bg)),
            Span::styled(
                format!("{needs} Needs you"),
                Style::default()
                    .fg(t.danger)
                    .bg(t.bg)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::styled("  ·  ", muted_style().bg(t.bg)),
            Span::styled(
                format!("{working} Working"),
                Style::default().fg(t.info).bg(t.bg),
            ),
            Span::styled("  ·  ", muted_style().bg(t.bg)),
            Span::styled(
                format!("{ready} Ready"),
                Style::default().fg(t.success).bg(t.bg),
            ),
            Span::styled("  ·  ", muted_style().bg(t.bg)),
            Span::styled(
                format!("{returned} returned"),
                Style::default().fg(t.warning).bg(t.bg),
            ),
        ])
    } else {
        Line::from(Span::styled(
            format!(
                " Search: {} · {} results ",
                app.search_query,
                app.unified_search_results().len()
            ),
            Style::default().fg(t.text).bg(t.bg),
        ))
    };
    frame.render_widget(Paragraph::new(line).style(Style::default().bg(t.bg)), area);
}

fn render_wide(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let min_body = home_body_min_height();
    let show_context = !compact_density();
    let rows = if show_context {
        Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(1),
                Constraint::Length(1),
                Constraint::Min(min_body),
                Constraint::Length(1),
                Constraint::Length(1),
            ])
            .split(area)
    } else {
        Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(1),
                Constraint::Length(1),
                Constraint::Min(min_body),
                Constraint::Length(1),
            ])
            .split(area)
    };
    render_header(frame, app, rows[0]);
    render_attention_strip(frame, app, rows[1]);
    let body = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(58), Constraint::Percentage(42)])
        .split(rows[2]);
    render_work_inbox(frame, app, body[0], app.focus == FocusPane::TaskRooms);
    render_selected_task_room_detail(frame, app, body[1], app.focus == FocusPane::TaskRooms);
    if show_context {
        render_context_line(frame, app, rows[3]);
        render_footer(frame, app, rows[4]);
    } else {
        render_footer(frame, app, rows[3]);
    }
}

fn render_compact(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let min_body = if compact_density() { 10 } else { 12 };
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Min(min_body),
            Constraint::Length(1),
        ])
        .split(area);
    render_header(frame, app, rows[0]);
    render_attention_strip(frame, app, rows[1]);
    let body = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(55), Constraint::Percentage(45)])
        .split(rows[2]);
    render_work_inbox(frame, app, body[0], true);
    render_selected_task_room_detail(frame, app, body[1], false);
    render_footer(frame, app, rows[3]);
}

fn render_narrow(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let peek_h = if compact_density() { 4 } else { 5 };
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Min(8),
            Constraint::Length(peek_h),
            Constraint::Length(1),
        ])
        .split(area);
    render_header(frame, app, rows[0]);
    render_attention_strip(frame, app, rows[1]);
    render_work_inbox(frame, app, rows[2], true);
    render_selected_task_room_detail(frame, app, rows[3], false);
    render_footer(frame, app, rows[4]);
}

fn render_context_line(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let t = theme();
    let team = team_roster_pills(app);
    let ready = app
        .state
        .runtime_setup
        .iter()
        .filter(|r| matches!(r.status, RuntimeSetupStatus::Ready))
        .count();
    let total = app.state.runtime_setup.len();
    let text = if !team.is_empty() {
        format!(" members · {team} ")
    } else if total > 0 {
        format!(" {ready}/{total} runtimes ready ")
    } else {
        " n new · enter open room ".to_string()
    };
    frame.render_widget(
        Paragraph::new(Span::styled(
            text,
            Style::default().fg(t.text_muted).bg(t.bg),
        )),
        area,
    );
}

fn team_roster_pills(app: &WorkbenchApp) -> String {
    let Some(room) = app.selected_task_room() else {
        return String::new();
    };
    room.participants
        .iter()
        .take(4)
        .map(|participant| {
            if participant.role.is_empty() {
                participant.display_name.clone()
            } else {
                format!("{}({})", participant.display_name, participant.role)
            }
        })
        .collect::<Vec<_>>()
        .join(" · ")
}

fn render_footer(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let hints = action_hints(app);
    render_action_bar(frame, area, &hints, app.action_status.as_deref());
}

fn runtime_readiness_summary(app: &WorkbenchApp) -> String {
    if app.state.runtime_setup.is_empty() {
        return "runtimes unknown".to_string();
    }
    let ready = app
        .state
        .runtime_setup
        .iter()
        .filter(|r| matches!(r.status, RuntimeSetupStatus::Ready))
        .count();
    format!("{ready}/{} ready", app.state.runtime_setup.len())
}


