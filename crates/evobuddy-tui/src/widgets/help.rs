use ratatui::text::Line;
use ratatui::widgets::{Block, Borders, Paragraph};
use ratatui::Frame;

use crate::theme::pane_border_style;

pub fn render_help(frame: &mut Frame<'_>, area: ratatui::layout::Rect) {
    let lines = vec![
        Line::from("EvoBuddy TaskRoom workbench"),
        Line::from("Home: n new room · Enter open/attach · / search · ? help · q quit"),
        Line::from("j/k or ↑/↓ move · Esc back · Tab fields on forms"),
        Line::from("Room: Enter attach · Esc back (handoff/evidence are not Home keys)"),
        Line::from("Detach native runtime with Ctrl+B d (process keeps running)"),
        Line::from("Create and attach mutate durable .evobuddy state"),
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
