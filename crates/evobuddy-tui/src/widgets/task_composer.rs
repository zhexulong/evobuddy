use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::theme::{muted_style, selected_style, surface_block};

pub fn render_task_composer(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(6),
            Constraint::Min(5),
            Constraint::Length(2),
        ])
        .split(area);

    let status = app
        .action_status
        .clone()
        .unwrap_or_else(|| "No action recorded".to_string());
    let destination = if status.contains("Created TaskRoom") {
        "Durable TaskRoom store"
    } else if status.contains("Created handoff") {
        "Durable handoff record"
    } else if status.contains("opening native") || status.contains("returned from") {
        "Native runtime / tmux session"
    } else if status.contains("refresh") || status.contains("evidence") {
        "Evidence refresh"
    } else if status.contains("continued with candidate") {
        "Heuristic resume candidate"
    } else {
        "Workbench action"
    };

    frame.render_widget(
        Paragraph::new(vec![
            Line::from(Span::styled("Action Progress", selected_style())),
            Line::from(format!("Destination: {destination}")),
            Line::from("Result updates from durable store and native session evidence"),
        ])
        .block(surface_block("Action Progress", true)),
        rows[0],
    );
    frame.render_widget(
        Paragraph::new(status).block(surface_block("Status", false)),
        rows[1],
    );
    frame.render_widget(
        Paragraph::new(Line::from(Span::styled("Esc back", muted_style()))),
        rows[2],
    );
}
