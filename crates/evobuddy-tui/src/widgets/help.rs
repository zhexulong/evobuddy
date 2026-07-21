use ratatui::text::Line;
use ratatui::widgets::{Block, Borders, Paragraph};
use ratatui::Frame;

use crate::theme::pane_border_style;

pub fn render_help(frame: &mut Frame<'_>, area: ratatui::layout::Rect) {
    let lines = vec![
        Line::from("EvoBuddy TaskRoom workbench"),
        Line::from("Home: n new room · Enter Attach · / search · ? help · q quit"),
        Line::from("j/k or ↑/↓ select room · ←/→ do not open pages · Esc back"),
        Line::from("Enter attaches/opens the selected room's native session"),
        Line::from("Detach with Ctrl+B d (process keeps running)"),
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
