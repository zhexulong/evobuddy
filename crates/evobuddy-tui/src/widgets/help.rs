use ratatui::text::Line;
use ratatui::widgets::{Block, Borders, Paragraph};
use ratatui::Frame;

use crate::theme::pane_border_style;

pub fn render_help(frame: &mut Frame<'_>, area: ratatui::layout::Rect) {
    let lines = vec![
        Line::from("EvoBuddy TaskRoom workbench"),
        Line::from("n new room · Enter open/attach · Esc back · Tab fields"),
        Line::from("/ search · : commands · h handoff · e evidence · r trace"),
        Line::from("j/k or ↑/↓ move · ? help · q quit"),
        Line::from("Detach native runtime with Ctrl+B d (process keeps running)"),
        Line::from("Create and attach mutate durable .evobuddy state — not read-only"),
    ];
    frame.render_widget(
        Paragraph::new(lines).block(
            Block::default()
                .title("Help")
                .borders(Borders::ALL)
                .border_style(pane_border_style(true)),
        ),
        area,
    );
}
