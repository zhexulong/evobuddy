use ratatui::layout::{Constraint, Direction, Layout, Margin, Rect};
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Paragraph};
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::theme::{muted_style, selected_style, theme};

pub fn render_task_room_form(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let t = theme();
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(5),
            Constraint::Length(2),
        ])
        .split(area);

    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(
            " New work ",
            Style::default()
                .fg(t.text_inverse)
                .bg(t.accent)
                .add_modifier(Modifier::BOLD),
        )))
        .style(Style::default().bg(t.surface)),
        rows[0],
    );

    let body = app.task_room_form.objective.as_str();
    let error = app
        .task_room_form_field_errors
        .first()
        .and_then(|e| e.as_ref());

    let mut lines: Vec<Line> = Vec::new();
    if body.is_empty() {
        lines.push(Line::from(Span::styled(
            "Type what the team should do, then Enter…█",
            muted_style(),
        )));
    } else {
        let width = rows[1].width.saturating_sub(4).max(16) as usize;
        let mut rest = body;
        while !rest.is_empty() {
            let take = rest
                .char_indices()
                .nth(width)
                .map(|(i, _)| i)
                .unwrap_or(rest.len());
            let (chunk, next) = rest.split_at(take);
            lines.push(Line::from(Span::styled(chunk.to_string(), selected_style())));
            rest = next;
        }
        if let Some(last) = lines.last_mut() {
            last.spans.push(Span::styled("█", selected_style()));
        }
    }
    if let Some(err) = error {
        lines.push(Line::from(""));
        lines.push(Line::from(Span::styled(
            err.clone(),
            Style::default().fg(t.danger).add_modifier(Modifier::BOLD),
        )));
    }

    let runtime = if app.task_room_form.runtime.is_empty() {
        "default"
    } else {
        app.task_room_form.runtime.as_str()
    };
    let block = Block::default()
        .title(" compose ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(t.border_focus))
        .style(Style::default().bg(t.bg).fg(t.text));

    frame.render_widget(Paragraph::new(lines).block(block), rows[1]);

    let help = format!(" Enter create · Esc cancel · Ctrl+C quit · runtime {runtime} ");
    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(help, muted_style())))
            .style(Style::default().bg(t.surface)),
        rows[2],
    );

    let inner = rows[1].inner(Margin {
        horizontal: 1,
        vertical: 1,
    });
    if inner.width > 0 && inner.height > 0 {
        let col = if body.is_empty() {
            0u16
        } else {
            (body.chars().count() as u16).min(inner.width.saturating_sub(1))
        };
        frame.set_cursor_position((inner.x + col, inner.y));
    }
}
