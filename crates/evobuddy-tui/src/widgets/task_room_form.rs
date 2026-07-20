use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::theme::{muted_style, selected_style, surface_block};

pub fn render_task_room_form(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(5), Constraint::Min(8), Constraint::Length(2)])
        .split(area);

    frame.render_widget(
        Paragraph::new(vec![
            Line::from(Span::styled("TaskRoom Form", selected_style())),
            Line::from("Destination: Create TaskRoom"),
            Line::from("Effect: durable TaskRoom draft"),
        ])
        .block(surface_block("TaskRoom Form", true)),
        rows[0],
    );

    let body = vec![
        format!("Objective: {}", app.task_room_form.objective),
        format!(
            "Acceptance criteria: {}",
            app.task_room_form.acceptance_criteria
        ),
        format!("Workspace: {}", app.task_room_form.workspace),
        format!("Actor: {}", app.task_room_form.actor),
        format!("Runtime: {}", app.task_room_form.runtime),
        format!("Safety mode: {}", app.task_room_form.safety_mode),
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
