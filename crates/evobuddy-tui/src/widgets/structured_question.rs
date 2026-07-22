use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{List, ListItem, Paragraph};
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::widgets::form_kit::{place_form_cursor, render_form, FormFieldView};

fn surface_block(title: &str, focused: bool) -> ratatui::widgets::Block<'static> {
    use ratatui::widgets::{Block, Borders};
    let border = if focused {
        Style::default()
            .fg(Color::Cyan)
            .add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(Color::DarkGray)
    };
    Block::default()
        .title(title.to_string())
        .borders(Borders::ALL)
        .border_style(border)
}

fn selected_style() -> Style {
    Style::default()
        .fg(Color::Yellow)
        .add_modifier(Modifier::BOLD)
}

fn muted_style() -> Style {
    Style::default().fg(Color::DarkGray)
}

pub fn render_structured_question(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let Some(question) = &app.structured_question else {
        frame.render_widget(
            Paragraph::new("No structured question active")
                .block(surface_block("Structured Question", true)),
            area,
        );
        return;
    };

    if question.allows_free_text {
        let fields = [FormFieldView {
            label: "Free text",
            value: question.free_text.clone(),
            active: true,
            error: None,
        }];
        let rows = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(6),
                Constraint::Min(6),
                Constraint::Length(2),
            ])
            .split(area);

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

        render_form(
            frame,
            rows[1],
            "Free text answer",
            &fields,
            "Type answer · Enter confirm · Esc cancel",
        );
        place_form_cursor(frame, rows[1], &fields);
        frame.render_widget(
            Paragraph::new(Line::from(Span::styled(
                "1-9 answer · Enter confirm · Esc cancel",
                muted_style(),
            ))),
            rows[2],
        );
        return;
    }

    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(6),
            Constraint::Min(6),
            Constraint::Length(2),
        ])
        .split(area);

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
            let prefix = if index == question.selected_choice {
                "❯"
            } else {
                " "
            };
            ListItem::new(format!("{prefix} {}. {}", index + 1, choice.label))
        })
        .collect::<Vec<_>>();
    frame.render_widget(
        List::new(items).block(surface_block("Choices", false)),
        rows[1],
    );

    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(
            "1-9 answer · Enter confirm · Esc cancel",
            muted_style(),
        ))),
        rows[2],
    );
}
