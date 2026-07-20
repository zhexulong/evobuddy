use ratatui::text::Line;
use ratatui::widgets::{Block, Borders, Paragraph};
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::theme::pane_border_style;
use crate::views::DetailView;

pub fn render_detail(
    frame: &mut Frame<'_>,
    app: &WorkbenchApp,
    area: ratatui::layout::Rect,
    detail: DetailView,
) {
    let title = match detail {
        DetailView::TeamAgent => "TeamAgent Detail",
        DetailView::FocusedBuddy => "FocusedBuddy Detail",
        DetailView::TaskRoom => "TaskRoom Detail",
        DetailView::RuntimeSetup => "Runtime Setup Detail",
        DetailView::Updates => "Updates Detail",
    };
    let body = match detail {
        DetailView::TeamAgent | DetailView::FocusedBuddy => app.selected_actor_lines(),
        DetailView::TaskRoom => app
            .selected_task_room()
            .map(|room| vec![room.title.clone(), room.summary.clone()])
            .unwrap_or_else(|| vec!["No TaskRoom selected".to_string()]),
        DetailView::RuntimeSetup => app
            .runtime_setup()
            .iter()
            .map(|entry| format!("{} {}", entry.runtime, entry.status.as_label()))
            .collect(),
        DetailView::Updates => app
            .updates()
            .iter()
            .take(6)
            .map(|entry| entry.text.clone())
            .collect(),
    };
    frame.render_widget(
        Paragraph::new(body.into_iter().map(Line::from).collect::<Vec<_>>()).block(
            Block::default()
                .title(title)
                .borders(Borders::ALL)
                .border_style(pane_border_style(true)),
        ),
        area,
    );
}
