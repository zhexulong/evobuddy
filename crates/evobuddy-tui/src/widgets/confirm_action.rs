use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::theme::{muted_style, selected_style, surface_block};

pub fn render_confirm_action(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(8), Constraint::Length(2)])
        .split(area);

    let Some(pending) = &app.pending_confirmation else {
        frame.render_widget(
            Paragraph::new("No pending confirmation").block(surface_block("Confirm Action", true)),
            area,
        );
        return;
    };

    frame.render_widget(
        Paragraph::new(vec![
            Line::from(Span::styled("Confirm Action", selected_style())),
            Line::from(format!("Target: {}", pending.target)),
            Line::from(format!("Effect: {}", pending.effect_label)),
            Line::from(""),
            Line::from("Enter confirm · Esc cancel"),
            Line::from("Detach remains separate from stop."),
        ])
        .block(surface_block("Confirm Action", true)),
        rows[0],
    );

    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(
            "Typed effect only · no natural-language routing",
            muted_style(),
        ))),
        rows[1],
    );
}
