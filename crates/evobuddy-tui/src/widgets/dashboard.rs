use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use ratatui::Frame;

use crate::action_hints::action_hints;
use crate::app::{FocusPane, WorkbenchApp};
use crate::model::RuntimeSetupStatus;
use crate::theme::{attention_style, muted_style, pane_block, selected_style};
use crate::widgets::action_bar::render_action_bar;
use crate::widgets::inbox::{
    attention_counts, render_selected_task_room_detail, render_work_inbox,
};

pub fn render_dashboard(frame: &mut Frame<'_>, app: &WorkbenchApp) {
    let area = frame.area();
    if area.width < 70 {
        render_narrow(frame, app, area);
    } else if area.width < 100 {
        render_compact(frame, app, area);
    } else {
        render_wide(frame, app, area);
    }
}

fn render_header(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let readiness = runtime_readiness_summary(app);
    let header = Paragraph::new(vec![Line::from(format!(
        "EvoBuddy · {} rooms · {}",
        app.state.task_rooms.len(),
        readiness
    ))])
    .block(pane_block("EvoBuddy Workbench", true));
    frame.render_widget(header, area);
}

fn render_attention_strip(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let (needs, working, returned) = attention_counts(app);
    let line = if app.search_query.trim().is_empty() {
        format!("Needs input {needs} · Working {working} · Returned {returned}")
    } else {
        format!(
            "Search: {} · {} results",
            app.search_query,
            app.unified_search_results().len()
        )
    };
    frame.render_widget(Paragraph::new(line).style(attention_style()), area);
}

fn render_wide(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(1),
            Constraint::Min(12),
            Constraint::Length(5),
            Constraint::Length(3),
        ])
        .split(area);
    render_header(frame, app, rows[0]);
    render_attention_strip(frame, app, rows[1]);
    let body = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(58), Constraint::Percentage(42)])
        .split(rows[2]);
    render_work_inbox(frame, app, body[0], app.focus == FocusPane::TaskRooms);
    render_selected_task_room_detail(frame, app, body[1], app.focus == FocusPane::TaskRooms);
    render_secondary(frame, app, rows[3]);
    render_footer(frame, app, rows[4]);
}

fn render_compact(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(1),
            Constraint::Min(10),
            Constraint::Length(3),
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
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(1),
            Constraint::Min(8),
            Constraint::Length(6),
            Constraint::Length(3),
        ])
        .split(area);
    render_header(frame, app, rows[0]);
    render_attention_strip(frame, app, rows[1]);
    render_work_inbox(frame, app, rows[2], true);
    render_selected_task_room_detail(frame, app, rows[3], false);
    render_footer(frame, app, rows[4]);
}

fn render_secondary(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let mut lines = vec![Line::from(Span::styled(
        "Runtimes",
        selected_style(),
    ))];
    for setup in app.state.runtime_setup.iter().take(3) {
        lines.push(Line::from(format!(
            "  {} · {}",
            setup.runtime,
            runtime_status_label(&setup.status)
        )));
    }
    if app.state.runtime_setup.is_empty() {
        lines.push(Line::from(Span::styled(
            "  No runtime setup rows",
            muted_style(),
        )));
    }
    for room in app
        .state
        .task_rooms
        .iter()
        .filter(|r| {
            matches!(
                r.status,
                crate::model::TaskRoomStatus::Returned | crate::model::TaskRoomStatus::Completed
            )
        })
        .take(2)
    {
        lines.push(Line::from(format!("  Returned · {}", room.title)));
    }
    frame.render_widget(
        Paragraph::new(lines).block(pane_block("Context", false)),
        area,
    );
}

fn render_footer(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let hints = action_hints(app);
    render_action_bar(frame, area, &hints, app.action_status.as_deref());
}

fn runtime_readiness_summary(app: &WorkbenchApp) -> String {
    if app.state.runtime_setup.is_empty() {
        return "runtime readiness unknown".to_string();
    }
    let ready = app
        .state
        .runtime_setup
        .iter()
        .filter(|r| matches!(r.status, RuntimeSetupStatus::Ready))
        .count();
    format!("{ready}/{} runtimes ready", app.state.runtime_setup.len())
}

fn runtime_status_label(status: &RuntimeSetupStatus) -> &'static str {
    match status {
        RuntimeSetupStatus::Ready => "Ready",
        RuntimeSetupStatus::Partial => "Partial",
        RuntimeSetupStatus::Blocked => "Blocked",
        RuntimeSetupStatus::Working => "Working",
        RuntimeSetupStatus::Returned => "Returned",
        RuntimeSetupStatus::Available => "Available",
        RuntimeSetupStatus::Archived => "Archived",
        RuntimeSetupStatus::Unknown => "Unknown",
    }
}
