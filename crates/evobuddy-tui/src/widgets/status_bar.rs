use ratatui::Frame;

use crate::action_hints::action_hints;
use crate::app::WorkbenchApp;
use crate::widgets::action_bar::render_action_bar;

pub fn render_status_bar(frame: &mut Frame<'_>, app: &WorkbenchApp, area: ratatui::layout::Rect) {
    let hints = action_hints(app);
    render_action_bar(frame, area, &hints, app.action_status.as_deref());
}
