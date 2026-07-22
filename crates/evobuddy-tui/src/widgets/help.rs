use ratatui::text::Line;
use ratatui::widgets::{Block, Borders, Paragraph};
use ratatui::Frame;

use crate::theme::pane_border_style;

pub fn render_help(frame: &mut Frame<'_>, area: ratatui::layout::Rect) {
    let lines = vec![
        Line::from("EvoBuddy TaskRoom workbench"),
        Line::from("Home: n new room · Enter open · m seats · a attach · / search · ? help"),
        Line::from("Quit: q · Ctrl+C · Ctrl+D · Ctrl+Q"),
        Line::from("In room: type freely · Enter send · Esc back · Ctrl+A attach"),
        Line::from("While typing, letter shortcuts are disabled so n/j/q insert as text"),
        Line::from("Activity: Ready / Working / Needs you"),
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
