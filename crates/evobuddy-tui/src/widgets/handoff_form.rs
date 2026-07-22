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
            Constraint::Length(5),
            Constraint::Min(8),
            Constraint::Length(2),
        ])
        .split(area);

    frame.render_widget(
        Paragraph::new(vec![
            Line::from(Span::styled("Handoff Form", selected_style())),
            Line::from("Destination: durable HandoffRecord"),
            Line::from("Effect: record handoff only"),
        ])
        .block(surface_block("Handoff Form", true)),
        rows[0],
    );

    let body = [
        format!("Sender: {}", app.handoff_form.sender),
        format!("Receiver: {}", app.handoff_form.receiver),
        format!("Body: {}", app.handoff_form.body),
        format!("Artifact refs: {}", app.handoff_form.artifact_refs),
        format!(
            "Expected next action: {}",
            app.handoff_form.expected_next_action
        ),
        format!(
            "Return destination: {}",
            app.handoff_form.return_destination
        ),
    ]
    .join("\n");
    frame.render_widget(
        Paragraph::new(body).block(surface_block("Fields", false)),
        rows[1],
    );
    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(
            "Enter submit · Esc cancel · Ctrl+Tab next field",
            muted_style(),
        ))),
        rows[2],
    );
}
