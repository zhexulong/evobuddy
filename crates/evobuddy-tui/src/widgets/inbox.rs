use ratatui::layout::Rect;
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{List, ListItem, Paragraph};
use ratatui::Frame;

use crate::action_hints::short_primary_action_label;
use crate::app::WorkbenchApp;
use crate::model::{TaskRoom, TaskRoomStatus};
use crate::theme::{muted_style, pane_block, selected_style, status_glyph, task_room_status_style};

pub fn render_work_inbox(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect, focused: bool) {
    let rooms = visible_rooms(app);
    if rooms.is_empty() {
        let empty = Paragraph::new(vec![
            Line::from(Span::styled("No TaskRooms yet", selected_style())),
            Line::from(""),
            Line::from("Press n to create the first room"),
            Line::from("Native agent sessions attach with Enter after a room exists"),
        ])
        .block(pane_block("Work inbox", focused));
        frame.render_widget(empty, area);
        return;
    }

    let selected = app.selected_task_room;
    let items: Vec<ListItem> = rooms
        .iter()
        .enumerate()
        .map(|(index, room)| {
            let marker = if index == selected { "❯ " } else { "  " };
            let glyph = status_glyph(&room.status);
            let status = format_status(&room.status);
            let runtime = primary_runtime(room);
            let title = truncate(&room.title, area_title_width(area));
            let line = format!("{marker}{glyph} {status:<8} {title}  {runtime}");
            let style = if index == selected {
                selected_style()
            } else {
                task_room_status_style(&room.status)
            };
            ListItem::new(Line::from(Span::styled(line, style)))
        })
        .collect();

    let more = if rooms.len() > area.height.saturating_sub(2) as usize {
        format!(" · {}/{}", selected.saturating_add(1), rooms.len())
    } else {
        String::new()
    };
    let title = format!("Work inbox{more}");
    frame.render_widget(List::new(items).block(pane_block(title, focused)), area);
}

pub fn render_selected_task_room_detail(
    frame: &mut Frame<'_>,
    app: &WorkbenchApp,
    area: Rect,
    focused: bool,
) {
    let Some(room) = app.selected_task_room() else {
        frame.render_widget(
            Paragraph::new(vec![
                Line::from(Span::styled("Selected TaskRoom", selected_style())),
                Line::from("No room selected"),
                Line::from(Span::styled("Press n to create a room", muted_style())),
            ])
            .block(pane_block("Selected TaskRoom", focused)),
            area,
        );
        return;
    };

    let attention = room
        .attention
        .as_ref()
        .map(|a| a.state.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| attention_phrase(&room.status));
    let who = if room.participants.is_empty() {
        "—".to_string()
    } else {
        room.participants
            .iter()
            .map(|p| {
                if p.role.is_empty() {
                    p.display_name.clone()
                } else {
                    format!("{} ({})", p.display_name, p.role)
                }
            })
            .collect::<Vec<_>>()
            .join(" · ")
    };
    let session_line = room_session_line(app, room);
    let enter_line = primary_enter_line(room);

    let lines = vec![
        Line::from(Span::styled(
            format!(
                "{} {}  {}",
                status_glyph(&room.status),
                format_status(&room.status),
                room.title
            ),
            selected_style(),
        )),
        Line::from(Span::styled(
            format!("Now · {attention}"),
            Style::default().add_modifier(Modifier::BOLD),
        )),
        Line::from(format!("Session: {session_line}")),
        Line::from(format!("Who: {}", truncate(&who, 72))),
        Line::from(format!("Work: {}", truncate(&room.objective, 72))),
        Line::from(format!(
            "Done when: {}",
            truncate(&room.acceptance_criteria, 56)
        )),
        Line::from(Span::styled(
            "Enter",
            Style::default().add_modifier(Modifier::BOLD),
        )),
        Line::from(enter_line),
    ];

    frame.render_widget(
        Paragraph::new(lines).block(pane_block("Selected TaskRoom", focused)),
        area,
    );
}

fn attention_phrase(status: &TaskRoomStatus) -> &'static str {
    match status {
        TaskRoomStatus::NeedsInput => "needs you",
        TaskRoomStatus::NeedsReview => "needs review",
        TaskRoomStatus::Working => "working",
        TaskRoomStatus::Returned => "returned",
        TaskRoomStatus::Completed => "done",
        TaskRoomStatus::Blocked => "blocked",
        TaskRoomStatus::Queued => "ready · not started",
        TaskRoomStatus::Failed => "failed",
        TaskRoomStatus::Archived => "archived",
        TaskRoomStatus::Unknown => "—",
    }
}

fn room_session_line(app: &WorkbenchApp, room: &TaskRoom) -> String {
    let session = app
        .state
        .native_sessions
        .iter()
        .find(|s| s.room_id == room.id);
    match session {
        Some(s) => {
            let life = match s.lifecycle {
                crate::model::NativeSessionLifecycle::Attachable => "attachable",
                crate::model::NativeSessionLifecycle::Attached => "attached",
                crate::model::NativeSessionLifecycle::Detached => "detached",
                crate::model::NativeSessionLifecycle::Creating => "creating",
                crate::model::NativeSessionLifecycle::Stale => "stale",
                crate::model::NativeSessionLifecycle::Failed => "failed",
                crate::model::NativeSessionLifecycle::Terminated => "ended",
                crate::model::NativeSessionLifecycle::Unknown => "unknown",
            };
            let runtime = if s.runtime.is_empty() {
                room.runtime.as_str()
            } else {
                s.runtime.as_str()
            };
            format!("{life} · {runtime} · {}", s.terminal_session_ref)
        }
        None => {
            if room.runtime.is_empty() {
                "no native session yet".to_string()
            } else {
                format!("{} · no session yet", room.runtime)
            }
        }
    }
}

fn primary_enter_line(room: &TaskRoom) -> String {
    if let Some(action) = room.available_actions.iter().find(|a| a.enabled) {
        format!("  →  {}", short_primary_action_label(action))
    } else if let Some(action) = room.available_actions.first() {
        let reason = action.disabled_reason.as_deref().unwrap_or("unavailable");
        format!(
            "  {} (disabled: {})",
            short_primary_action_label(action),
            reason
        )
    } else {
        "  No actions yet — attach when runtime ready".to_string()
    }
}

pub fn attention_counts(app: &WorkbenchApp) -> (usize, usize, usize) {
    let mut needs = 0usize;
    let mut working = 0usize;
    let mut returned = 0usize;
    for room in &app.state.task_rooms {
        match room.status {
            TaskRoomStatus::NeedsInput | TaskRoomStatus::NeedsReview | TaskRoomStatus::Blocked => {
                needs += 1;
            }
            TaskRoomStatus::Working => working += 1,
            TaskRoomStatus::Returned | TaskRoomStatus::Completed => returned += 1,
            // Queued = room exists, not started — do not count as working.
            _ => {}
        }
    }
    (needs, working, returned)
}

fn visible_rooms(app: &WorkbenchApp) -> Vec<&TaskRoom> {
    let rooms = app.sorted_task_rooms();
    if app.search_query.trim().is_empty() {
        rooms
    } else {
        let q = app.search_query.to_lowercase();
        rooms
            .into_iter()
            .filter(|room| {
                room.title.to_lowercase().contains(&q)
                    || room.objective.to_lowercase().contains(&q)
                    || room.id.to_lowercase().contains(&q)
            })
            .collect()
    }
}

fn format_status(status: &TaskRoomStatus) -> &'static str {
    match status {
        TaskRoomStatus::NeedsInput => "Needs",
        TaskRoomStatus::NeedsReview => "Review",
        TaskRoomStatus::Working => "Working",
        TaskRoomStatus::Returned => "Returned",
        TaskRoomStatus::Completed => "Done",
        TaskRoomStatus::Blocked => "Blocked",
        TaskRoomStatus::Queued => "Ready",
        TaskRoomStatus::Failed => "Failed",
        TaskRoomStatus::Archived => "Archived",
        TaskRoomStatus::Unknown => "—",
    }
}

fn primary_runtime(room: &TaskRoom) -> String {
    if !room.runtime.is_empty() {
        return room.runtime.clone();
    }
    room.participants
        .first()
        .map(|p| p.kind.clone())
        .filter(|k| !k.is_empty())
        .unwrap_or_else(|| "—".to_string())
}

fn truncate(text: &str, max: usize) -> String {
    if max == 0 {
        return String::new();
    }
    let mut out = String::new();
    for (i, ch) in text.chars().enumerate() {
        if i + 1 >= max {
            out.push('…');
            break;
        }
        out.push(ch);
    }
    if out.is_empty() {
        text.chars().take(max).collect()
    } else {
        out
    }
}

fn area_title_width(area: Rect) -> usize {
    (area.width as usize).saturating_sub(28).max(8)
}
