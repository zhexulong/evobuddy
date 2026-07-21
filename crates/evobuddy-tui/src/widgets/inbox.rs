use ratatui::layout::Rect;
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{List, ListItem, Paragraph};
use ratatui::Frame;

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
            let line = format!("{marker}{glyph} {status:<10} {title}  {runtime}");
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

    let mut lines = vec![
        Line::from(Span::styled(
            format!("{} · {}", format_status(&room.status), room.title),
            selected_style(),
        )),
        Line::from(format!("Objective: {}", truncate(&room.objective, 72))),
        Line::from(format!(
            "Acceptance: {}",
            truncate(&room.acceptance_criteria, 72)
        )),
        Line::from(Span::styled(
            "Participants",
            Style::default().add_modifier(Modifier::BOLD),
        )),
    ];
    if room.participants.is_empty() {
        lines.push(Line::from(Span::styled("  (none)", muted_style())));
    } else {
        for participant in &room.participants {
            lines.push(Line::from(format!(
                "  {} · {}",
                participant.display_name, participant.kind
            )));
        }
    }
    lines.push(Line::from(Span::styled(
        "Primary action",
        Style::default().add_modifier(Modifier::BOLD),
    )));
    if let Some(action) = room.available_actions.iter().find(|a| a.enabled) {
        lines.push(Line::from(format!("  Enter  {}", action.label)));
    } else if let Some(action) = room.available_actions.first() {
        let reason = action.disabled_reason.as_deref().unwrap_or("unavailable");
        lines.push(Line::from(format!(
            "  {} (disabled: {})",
            action.label, reason
        )));
    } else {
        lines.push(Line::from(Span::styled(
            "  No actions yet — create/open when runtime ready",
            muted_style(),
        )));
    }

    frame.render_widget(
        Paragraph::new(lines).block(pane_block("Selected TaskRoom", focused)),
        area,
    );
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
            TaskRoomStatus::Working | TaskRoomStatus::Queued => working += 1,
            TaskRoomStatus::Returned | TaskRoomStatus::Completed => returned += 1,
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
        TaskRoomStatus::NeedsInput => "Needs input",
        TaskRoomStatus::NeedsReview => "Needs review",
        TaskRoomStatus::Working => "Working",
        TaskRoomStatus::Returned => "Returned",
        TaskRoomStatus::Completed => "Completed",
        TaskRoomStatus::Blocked => "Blocked",
        TaskRoomStatus::Queued => "Queued",
        TaskRoomStatus::Failed => "Failed",
        TaskRoomStatus::Archived => "Archived",
        TaskRoomStatus::Unknown => "Unknown",
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
