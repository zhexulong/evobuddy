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
            Constraint::Length(5),
            Constraint::Min(5),
            Constraint::Length(2),
        ])
        .split(area);
    frame.render_widget(
        Paragraph::new(vec![
            Line::from(Span::styled("Action Progress", selected_style())),
            Line::from("Destination: typed workbench effect"),
            Line::from("Effect: deterministic command or durable draft only"),
        ])
        .block(surface_block("Action Progress", true)),
        rows[0],
    );
    let body = app.action_status.clone().unwrap_or_else(|| "No action recorded".to_string());
    frame.render_widget(
        Paragraph::new(body).block(surface_block("Status", false)),
        rows[1],
    );
    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(
            "Esc back",
            muted_style(),
        ))),
        rows[2],
    );
}
