use ratatui::layout::{Constraint, Direction, Layout};
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Clear, Padding, Paragraph, Wrap};
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
    let t = theme();
    frame.render_widget(Clear, area);
    frame.render_widget(
        Block::default().style(Style::default().bg(t.bg).fg(t.text)),
        area,
    );

    if detail == DetailView::TaskRoom {
        render_task_room_surface(frame, app, area);
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
                .style(Style::default().bg(t.surface).fg(t.text))
                .padding(Padding::horizontal(1)),
        ),
        area,
    );
}

fn render_task_room_surface(
    frame: &mut Frame<'_>,
    app: &WorkbenchApp,
    area: ratatui::layout::Rect,
) {
    let t = theme();
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(2),
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
                    Style::default()
                        .fg(t.text)
                        .bg(t.surface)
                        .add_modifier(Modifier::BOLD),
                ),
                Span::styled("  ", Style::default().bg(t.surface)),
                Span::styled(
                    format!("{status} · {seats} seats"),
                    Style::default().fg(t.text_muted).bg(t.surface),
                ),
            ])
        }
        None => Line::from(Span::styled(
            "No room selected",
            muted_style().bg(t.surface),
        )),
    };
    frame.render_widget(
        Paragraph::new(header).block(
            Block::default()
                .borders(Borders::BOTTOM)
                .border_style(Style::default().fg(t.border).bg(t.surface))
                .style(Style::default().bg(t.surface).fg(t.text))
                .padding(Padding::horizontal(1)),
        ),
        rows[0],
    );

    let roster_line = match room {
        Some(room) if !room.participants.is_empty() => {
            let parts: Vec<String> = room
                .participants
                .iter()
                .map(|p| {
                    let role = if p.role.is_empty() {
                        ""
                    } else {
                        p.role.as_str()
                    };
                    let rt = if p.runtime.is_empty() {
                        "?"
                    } else {
                        p.runtime.as_str()
                    };
                    if role.is_empty() {
                        format!("{} ({rt})", p.display_name)
                    } else {
                        format!("{} · {role} · {rt}", p.display_name)
                    }
                })
                .collect();
            Line::from(vec![
                Span::styled(
                    "  members  ",
                    Style::default().fg(t.text_muted).bg(t.surface),
                ),
                Span::styled(parts.join("  ·  "), Style::default().fg(t.text).bg(t.surface)),
            ])
        }
        Some(_) => Line::from(Span::styled(
            "  members  (none yet)",
            Style::default().fg(t.text_muted).bg(t.surface),
        )),
        None => Line::from(Span::styled("", Style::default().bg(t.surface))),
    };
    frame.render_widget(
        Paragraph::new(roster_line).block(
            Block::default()
                .borders(Borders::BOTTOM)
                .border_style(Style::default().fg(t.border).bg(t.surface))
                .style(Style::default().bg(t.surface).fg(t.text)),
        ),
        rows[1],
    );

    let mut thread_lines: Vec<Line> = Vec::new();
    if let Some(room) = room {
        if room.timeline.is_empty() {
            thread_lines.push(Line::from(Span::styled("", Style::default().bg(t.bg))));
            thread_lines.push(Line::from(Span::styled(
                "  Start typing below. First message becomes the work.",
                muted_style().bg(t.bg),
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
                        Style::default()
                            .fg(t.text)
                            .bg(t.bg)
                            .add_modifier(Modifier::BOLD),
                    ),
                    "handoff" => ("handoff", Style::default().fg(t.warning).bg(t.bg)),
                    "wake" => ("wake", Style::default().fg(t.info).bg(t.bg)),
                    other => (other, Style::default().fg(t.text_muted).bg(t.bg)),
                };
                thread_lines.push(Line::from(vec![
                    Span::styled(
                        format!("  {prefix:<8}"),
                        Style::default().fg(t.text_muted).bg(t.bg),
                    ),
                    Span::styled(entry.summary.clone(), style),
                ]));
                thread_lines.push(Line::from(Span::styled("", Style::default().bg(t.bg))));
            }
        }
    }
    frame.render_widget(
        Paragraph::new(thread_lines)
            .wrap(Wrap { trim: false })
            .style(Style::default().bg(t.bg).fg(t.text))
            .block(
                Block::default()
                    .borders(Borders::NONE)
                    .style(Style::default().bg(t.bg).fg(t.text)),
            ),
        rows[2],
    );

    let focused = Style::default()
        .fg(t.border_focus)
        .bg(t.surface)
        .add_modifier(Modifier::BOLD);
    let draft_style = if app.room_composer.is_empty() {
        muted_style().bg(t.surface)
    } else {
        Style::default().fg(t.text).bg(t.surface)
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
                .border_style(Style::default().fg(t.border_focus).bg(t.surface))
                .style(Style::default().bg(t.surface).fg(t.text))
                .title(Span::styled(
                    " enter send · esc back · ctrl+a attach ",
                    muted_style().bg(t.surface),
                )),
        ),
        rows[3],
    );
}
