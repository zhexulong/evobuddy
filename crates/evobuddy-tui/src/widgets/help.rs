use ratatui::text::Line;
use ratatui::widgets::{Block, Borders, Paragraph};
use ratatui::Frame;

use crate::theme::pane_border_style;

pub fn render_help(frame: &mut Frame<'_>, area: ratatui::layout::Rect) {
    let lines = vec![
        Line::from("EvoBuddy — crew rooms"),
        Line::from("Home: n new room · Enter opens room (not attach) · m seats · a attach"),
        Line::from("Palette: : or Ctrl+P · Help: ? · Quit: Ctrl+C/D immediate · q twice"),
        Line::from("In room: type freely · Enter send · Esc back · Ctrl+A attach"),
        Line::from("While typing, letter shortcuts are off (n/j/q insert as text)"),
        Line::from("Tab stays on work inbox; Runtime/Buddies via palette or u / keys"),
        Line::from("Crew grows on the project; subagents stay inside the runtime"),
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
