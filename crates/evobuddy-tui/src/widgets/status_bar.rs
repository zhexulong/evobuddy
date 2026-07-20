use crate::app::WorkbenchApp;
use ratatui::widgets::Paragraph;
use ratatui::Frame;

pub fn render_status_bar(frame: &mut Frame<'_>, app: &WorkbenchApp, area: ratatui::layout::Rect) {
    frame.render_widget(Paragraph::new(app.status_bar_text()), area);
}
