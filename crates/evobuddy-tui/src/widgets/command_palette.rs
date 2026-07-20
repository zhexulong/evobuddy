use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::text::{Line, Span};
use ratatui::widgets::{List, ListItem, Paragraph};
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::theme::{muted_style, selected_style, surface_block};

pub fn render_command_palette(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4),
            Constraint::Min(8),
            Constraint::Length(2),
        ])
        .split(area);

    let query = if app.command_query.is_empty() {
        "> /".to_string()
    } else {
        format!("> /{}", app.command_query)
    };
    frame.render_widget(
        Paragraph::new(vec![
            Line::from(Span::styled("Command Palette", selected_style())),
            Line::from(query),
        ])
        .block(surface_block("Command Palette", true)),
        rows[0],
    );

    let items = app
        .visible_commands()
        .iter()
        .enumerate()
        .map(|(index, command)| {
            let prefix = if index == app.selected_command {
                "❯"
            } else {
                " "
            };
            ListItem::new(format!("{prefix} {}", command.label)).style(
                if index == app.selected_command {
                    selected_style()
                } else {
                    muted_style()
                },
            )
        })
        .collect::<Vec<_>>();
    frame.render_widget(
        List::new(items).block(surface_block("Commands", false)),
        rows[1],
    );
    frame.render_widget(Paragraph::new("Enter select · Esc close"), rows[2]);
}
