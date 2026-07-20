use ratatui::text::Line;
use ratatui::widgets::{Block, Borders, Paragraph};
use ratatui::Frame;

use crate::app::{FocusPane, WorkbenchApp};
use crate::theme::pane_border_style;

pub fn render_peek(frame: &mut Frame<'_>, app: &WorkbenchApp, area: ratatui::layout::Rect) {
    let lines = app
        .selected_actor_lines()
        .into_iter()
        .map(Line::from)
        .collect::<Vec<_>>();
    frame.render_widget(
        Paragraph::new(lines).block(
            Block::default()
                .title("Peek")
                .borders(Borders::ALL)
                .border_style(pane_border_style(app.focus == FocusPane::TeamBuddies)),
        ),
        area,
    );
}
