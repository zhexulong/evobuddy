use ratatui::text::Line;
use ratatui::widgets::{Block, Borders, Paragraph};
use ratatui::Frame;

use crate::theme::pane_border_style;

pub fn render_help(frame: &mut Frame<'_>, area: ratatui::layout::Rect) {
    let lines = vec![
        Line::from("EvoBuddy TaskRoom workbench"),
        Line::from("Home: n new work · Enter Attach · / search · ? help"),
        Line::from("Quit: q · Ctrl+C · Ctrl+D · Ctrl+Q"),
        Line::from("j/k select room · Enter attach · Esc back"),
        Line::from("n opens compose box (type work, Enter create)"),
        Line::from("Detach native session: Ctrl+B d"),
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
