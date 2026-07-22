use ratatui::layout::{Constraint, Direction, Layout};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Paragraph};
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::theme::{muted_style, pane_border_style, selected_style};
use crate::views::DetailView;

pub fn render_detail(
    frame: &mut Frame<'_>,
    app: &WorkbenchApp,
    area: ratatui::layout::Rect,
    detail: DetailView,
) {
    if detail == DetailView::TaskRoom {
        render_task_room_thread(frame, app, area);
        return;
    }

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

fn render_task_room_thread(frame: &mut Frame<'_>, app: &WorkbenchApp, area: ratatui::layout::Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(6),
            Constraint::Length(4),
            Constraint::Length(1),
        ])
        .split(area);

    let room = app.selected_task_room();
    let header = match room {
        Some(room) => vec![
            Line::from(Span::styled(room.title.clone(), selected_style())),
            Line::from(format!(
                "{} · {} seats · type below to message",
                room.status.as_label(),
                room.participants.len()
            )),
        ],
        None => vec![Line::from("No TaskRoom selected")],
    };
    frame.render_widget(
        Paragraph::new(header).block(
            Block::default()
                .title("Room")
                .borders(Borders::ALL)
                .border_style(pane_border_style(true)),
        ),
        rows[0],
    );

    let mut thread_lines: Vec<Line> = Vec::new();
    if let Some(room) = room {
        if room.timeline.is_empty() {
            thread_lines.push(Line::from(Span::styled(
                "No messages yet — describe the work below.",
                muted_style(),
            )));
        } else {
            for entry in room.timeline.iter().rev().take(24).collect::<Vec<_>>().into_iter().rev() {
                let kind = if entry.kind.is_empty() {
                    "msg"
                } else {
                    entry.kind.as_str()
                };
                thread_lines.push(Line::from(format!("[{kind}] {}", entry.summary)));
            }
        }
    }
    frame.render_widget(
        Paragraph::new(thread_lines).block(
            Block::default()
                .title("Thread")
                .borders(Borders::ALL)
                .border_style(pane_border_style(false)),
        ),
        rows[1],
    );

    let draft = if app.room_composer.is_empty() {
        "Message the room…".to_string()
    } else {
        app.room_composer.clone()
    };
    frame.render_widget(
        Paragraph::new(draft).block(
            Block::default()
                .title("Composer")
                .borders(Borders::ALL)
                .border_style(pane_border_style(true)),
        ),
        rows[2],
    );
    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(
            "Enter send · Esc back · a attach",
            muted_style(),
        ))),
        rows[3],
    );
}
