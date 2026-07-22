use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::theme::{muted_style, selected_style, surface_block};

pub fn render_task_room_form(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
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
            Line::from(Span::styled("New room · message", selected_style())),
            Line::from("Type intent · Enter sends as task · runtime defaults to pi"),
        ])
        .block(surface_block("Compose", true)),
        rows[0],
    );

    let objective = if app.task_room_form.objective.is_empty() {
        "Describe the work…".to_string()
    } else {
        app.task_room_form.objective.clone()
    };
    let title_hint = if app.task_room_form.objective.is_empty() {
        String::new()
    } else if app.task_room_form.objective.chars().count() > 80 {
        format!(
            "Title: {}...",
            app.task_room_form
                .objective
                .chars()
                .take(77)
                .collect::<String>()
        )
    } else {
        format!("Title: {}", app.task_room_form.objective)
    };
    let body = [objective, title_hint]
        .into_iter()
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
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
