use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::theme::{muted_style, selected_style, surface_block};

pub fn render_handoff_form(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4),
            Constraint::Min(6),
            Constraint::Length(2),
        ])
        .split(area);

    frame.render_widget(
        Paragraph::new(vec![
            Line::from(Span::styled("Handoff · message", selected_style())),
            Line::from("Body only · defaults builder → reviewer · Enter sends"),
        ])
        .block(surface_block("Compose", true)),
        rows[0],
    );

    let body = if app.handoff_form.body.is_empty() {
        "What should the reviewer know…".to_string()
    } else {
        app.handoff_form.body.clone()
    };
    frame.render_widget(
        Paragraph::new(body).block(surface_block("Message", false)),
        rows[1],
    );
    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(
            "Enter send · Esc cancel",
            muted_style(),
        ))),
        rows[2],
    );
}
