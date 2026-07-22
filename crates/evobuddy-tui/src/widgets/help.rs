use ratatui::text::Line;
use ratatui::widgets::{Block, Borders, Paragraph};
use ratatui::Frame;

use crate::theme::pane_border_style;

pub fn render_help(frame: &mut Frame<'_>, area: ratatui::layout::Rect) {
    let lines = vec![
        Line::from("EvoBuddy TaskRoom workbench"),
        Line::from("Home: n new room · Enter open thread · m choose seat · a attach · / search"),
        Line::from("Quit: q · Ctrl+C · Ctrl+D · Ctrl+Q (works while typing)"),
        Line::from("j/k select room · Enter open room · Esc back"),
        Line::from("n creates room and opens thread; type message in room composer"),
        Line::from("Activity: Ready / Working / Needs you (Queued ≠ Working)"),
        Line::from("Leave pi/session: F10 or Ctrl+\\  (also Ctrl+B d)"),
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
