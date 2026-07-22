use ratatui::layout::{Constraint, Direction, Layout};
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Padding, Paragraph, Wrap};
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::theme::{muted_style, pane_border_style, theme};
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
        DetailView::TeamAgent => "Team agent",
        DetailView::FocusedBuddy => "Focused buddy",
        DetailView::TaskRoom => "Room",
        DetailView::RuntimeSetup => "Runtime setup",
        DetailView::Updates => "Updates",
    };
    let body = match detail {
        DetailView::TeamAgent | DetailView::FocusedBuddy => app.selected_actor_lines(),
        DetailView::TaskRoom => app
            .selected_task_room()
            .map(|room| vec![room.title.clone(), room.summary.clone()])
            .unwrap_or_else(|| vec!["No room selected".to_string()]),
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
                .border_style(pane_border_style(true))
                .padding(Padding::horizontal(1)),
        ),
        area,
    );
}

fn render_task_room_thread(frame: &mut Frame<'_>, app: &WorkbenchApp, area: ratatui::layout::Rect) {
    let t = theme();
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(2),
            Constraint::Min(4),
            Constraint::Length(3),
        ])
        .split(area);

    let room = app.selected_task_room();
    let header = match room {
        Some(room) => {
            let seats = room.participants.len();
            let status = room.status.as_label();
            Line::from(vec![
                Span::styled(
                    room.title.clone(),
                    Style::default().fg(t.text).add_modifier(Modifier::BOLD),
                ),
                Span::raw("  "),
                Span::styled(
                    format!("{status} · {seats} seats"),
                    Style::default().fg(t.text_muted),
                ),
            ])
        }
        None => Line::from(Span::styled("No room selected", muted_style())),
    };
    frame.render_widget(
        Paragraph::new(header).block(
            Block::default()
                .borders(Borders::BOTTOM)
                .border_style(Style::default().fg(t.border))
                .padding(Padding::horizontal(1)),
        ),
        rows[0],
    );

    let mut thread_lines: Vec<Line> = Vec::new();
    if let Some(room) = room {
        if room.timeline.is_empty() {
            thread_lines.push(Line::from(""));
            thread_lines.push(Line::from(Span::styled(
                "  Start typing below. First message becomes the work.",
                muted_style(),
            )));
        } else {
            for entry in room
                .timeline
                .iter()
                .rev()
                .take(32)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
            {
                let kind = if entry.kind.is_empty() {
                    "msg"
                } else {
                    entry.kind.as_str()
                };
                let (prefix, style) = match kind {
                    "user-request" | "msg" | "message" => (
                        "you",
                        Style::default().fg(t.text).add_modifier(Modifier::BOLD),
                    ),
                    "handoff" => ("handoff", Style::default().fg(t.warning)),
                    "wake" => ("wake", Style::default().fg(t.info)),
                    other => (other, Style::default().fg(t.text_muted)),
                };
                thread_lines.push(Line::from(vec![
                    Span::styled(format!("  {prefix:<8}"), Style::default().fg(t.text_muted)),
                    Span::styled(entry.summary.clone(), style),
                ]));
                thread_lines.push(Line::from(""));
            }
        }
    }
    frame.render_widget(
        Paragraph::new(thread_lines)
            .wrap(Wrap { trim: false })
            .block(Block::default().borders(Borders::NONE).padding(Padding::horizontal(0))),
        rows[1],
    );

    let focused = Style::default()
        .fg(t.border_focus)
        .add_modifier(Modifier::BOLD);
    let draft_style = if app.room_composer.is_empty() {
        muted_style()
    } else {
        Style::default().fg(t.text)
    };
    let draft = if app.room_composer.is_empty() {
        "Message…".to_string()
    } else {
        format!("{}█", app.room_composer)
    };
    frame.render_widget(
        Paragraph::new(Line::from(vec![
            Span::styled(" › ", focused),
            Span::styled(draft, draft_style),
        ]))
        .block(
            Block::default()
                .borders(Borders::TOP)
                .border_style(Style::default().fg(t.border_focus))
                .title(Span::styled(
                    " enter send · esc back · ctrl+a attach ",
                    muted_style(),
                )),
        ),
        rows[2],
    );
}
