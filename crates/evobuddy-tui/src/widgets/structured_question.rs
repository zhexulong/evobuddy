use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::text::{Line, Span};
use ratatui::widgets::{List, ListItem, Paragraph};
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::theme::{muted_style, selected_style, surface_block};

pub fn render_structured_question(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(6), Constraint::Min(6), Constraint::Length(2)])
        .split(area);

    let Some(question) = &app.structured_question else {
        frame.render_widget(
            Paragraph::new("No structured question active")
                .block(surface_block("Structured Question", true)),
            area,
        );
        return;
    };

    frame.render_widget(
        Paragraph::new(vec![
            Line::from(Span::styled("Structured Question", selected_style())),
            Line::from(question.prompt.clone()),
            Line::from(format!("Destination: {}", question.destination_label)),
            Line::from(format!("Effect: {}", question.effect_label)),
        ])
        .block(surface_block("Structured Question", true)),
        rows[0],
    );

    let items = question
        .choices
        .iter()
        .enumerate()
        .map(|(index, choice)| {
            let prefix = if index == question.selected_choice { "❯" } else { " " };
            ListItem::new(format!("{prefix} {}. {}", index + 1, choice.label))
        })
        .collect::<Vec<_>>();
    frame.render_widget(List::new(items).block(surface_block("Choices", false)), rows[1]);

    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(
            "1-9 answer · Enter confirm · Esc cancel",
            muted_style(),
        ))),
        rows[2],
    );
}
