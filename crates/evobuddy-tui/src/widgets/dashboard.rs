use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, List, ListItem, Paragraph};
use ratatui::Frame;

use crate::app::{FocusPane, SelectedActor, WorkbenchApp};
use crate::model::{ActorStatus, RuntimeSetupStatus, TaskRoomStatus};
use crate::theme::{
    action_style, attention_style, muted_style, pane_border_style, runtime_status_style,
    section_style, selected_style, status_style, surface_block,
};
use crate::widgets::status_bar::render_status_bar;

pub fn render_dashboard(frame: &mut Frame<'_>, app: &WorkbenchApp) {
    let area = frame.area();
    if area.width < 70 {
        render_narrow(frame, app, area);
    } else if area.width < 100 {
        render_compact(frame, app, area);
    } else {
        render_wide(frame, app, area);
    }
}

fn render_header(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let header = Paragraph::new(vec![Line::from(format!(
        "EvoBuddy · {} · {}",
        app.summary_line(),
        if app.search_query.is_empty() {
            "Read-only boundary"
        } else {
            "Search active"
        }
    ))])
    .block(
        Block::default()
            .title("EvoBuddy Workbench")
            .borders(Borders::ALL)
            .border_style(pane_border_style(true)),
    );
    frame.render_widget(header, area);
}

fn render_wide(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(1),
            Constraint::Length(14),
            Constraint::Length(10),
            Constraint::Min(6),
            Constraint::Length(3),
        ])
        .split(area);
    render_header(frame, app, rows[0]);
    render_attention(frame, app, rows[1]);
    let upper = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(38),
            Constraint::Percentage(38),
            Constraint::Percentage(24),
        ])
        .split(rows[2]);
    render_team_buddies(frame, app, upper[0], true, "Team · Members");
    render_active_workspace(frame, app, upper[1]);
    render_inspector(frame, app, upper[2]);
    let middle = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(58), Constraint::Percentage(42)])
        .split(rows[3]);
    render_task_rooms(frame, app, middle[0], "TaskRooms");
    render_runtime_setup(frame, app, middle[1]);
    let lower = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(68), Constraint::Percentage(32)])
        .split(rows[4]);
    render_updates(frame, app, lower[0]);
    render_trace(frame, app, lower[1]);
    render_status_bar(frame, app, rows[5]);
}

fn render_compact(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4),
            Constraint::Length(11),
            Constraint::Length(7),
            Constraint::Min(5),
            Constraint::Length(3),
        ])
        .split(area);
    render_header(frame, app, rows[0]);
    let upper = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(55), Constraint::Percentage(45)])
        .split(rows[1]);
    render_team_buddies(frame, app, upper[0], false, "Team · Delegates");
    render_active_workspace(frame, app, upper[1]);
    let middle = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(55), Constraint::Percentage(45)])
        .split(rows[2]);
    render_task_rooms(frame, app, middle[0], "TaskRooms");
    render_runtime_setup(frame, app, middle[1]);
    render_updates(frame, app, rows[3]);
    render_status_bar(frame, app, rows[4]);
}

fn render_narrow(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(1),
            Constraint::Length(6),
            Constraint::Length(3),
            Constraint::Length(4),
            Constraint::Length(2),
            Constraint::Length(1),
        ])
        .split(area);
    render_header(frame, app, rows[0]);
    render_attention(frame, app, rows[1]);
    render_team_buddies(frame, app, rows[2], false, "Team · Delegates");
    render_active_workspace(frame, app, rows[3]);
    let middle = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(rows[4]);
    render_task_rooms_narrow(frame, app, middle[0]);
    render_runtime_setup_narrow(frame, app, middle[1]);
    render_updates(frame, app, rows[5]);
    render_status_bar(frame, app, rows[6]);
}

fn render_attention(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let blocked = app
        .state
        .actors
        .team_agents
        .iter()
        .filter(|agent| matches!(agent.status, ActorStatus::Blocked | ActorStatus::NeedsInput))
        .count();
    let working = app
        .state
        .actors
        .team_agents
        .iter()
        .filter(|actor| matches!(actor.status, ActorStatus::Working))
        .count()
        + app
            .state
            .actors
            .focused_buddies
            .iter()
            .filter(|actor| matches!(actor.status, ActorStatus::Working))
            .count();
    let returned = app
        .state
        .actors
        .team_agents
        .iter()
        .filter(|actor| matches!(actor.status, ActorStatus::Returned))
        .count()
        + app
            .state
            .actors
            .focused_buddies
            .iter()
            .filter(|actor| matches!(actor.status, ActorStatus::Returned))
            .count();
    let available = app
        .state
        .actors
        .team_agents
        .iter()
        .filter(|actor| matches!(actor.status, ActorStatus::Available | ActorStatus::Unknown))
        .count()
        + app
            .state
            .actors
            .focused_buddies
            .iter()
            .filter(|actor| matches!(actor.status, ActorStatus::Available | ActorStatus::Unknown))
            .count();
    let line = if app.search_query.trim().is_empty() {
        format!(
            "Attention · need action · {blocked} · working · {working} · returned · {returned} · available · {available} · {} TaskRooms",
            app.state.task_rooms.len()
        )
    } else {
        format!(
            "Search: {} · {} results · product context retained",
            app.search_query,
            app.unified_search_results().len()
        )
    };
    frame.render_widget(Paragraph::new(line).style(attention_style()), area);
}

fn render_team_buddies(
    frame: &mut Frame<'_>,
    app: &WorkbenchApp,
    area: Rect,
    expanded: bool,
    title: &str,
) {
    let mut items = Vec::new();
    let team_limit = if expanded { usize::MAX } else { 2 };
    let buddy_limit = if expanded { usize::MAX } else { 2 };
    items.push(ListItem::new(Line::from(Span::styled(
        format!(
            "{} Team · Members · {} active",
            if app.team_agents_collapsed {
                "▸"
            } else {
                "▾"
            },
            app.state.actors.team_agents.len()
        ),
        muted_style(),
    ))));

    for (group_label, group_statuses) in [
        (
            "Needs you",
            [ActorStatus::NeedsInput, ActorStatus::Blocked].as_slice(),
        ),
        ("Working", [ActorStatus::Working].as_slice()),
        ("Returned", [ActorStatus::Returned].as_slice()),
        (
            "Available",
            [ActorStatus::Available, ActorStatus::Unknown].as_slice(),
        ),
    ] {
        items.push(ListItem::new(Line::from(Span::styled(
            group_label,
            section_style(),
        ))));
        if !app.team_agents_collapsed {
            for (index, agent) in app
                .visible_team_agents()
                .into_iter()
                .take(team_limit)
                .enumerate()
            {
                if !group_statuses.contains(&agent.status) {
                    continue;
                }
                let selected = app.selected_actor == Some(SelectedActor::TeamAgent(index));
                let prefix = if selected { "❯" } else { " " };
                let line = format!(
                    "{} {} TeamMember {:<9} {}",
                    prefix,
                    status_glyph(&agent.status),
                    truncate(&agent.display_name, if expanded { 16 } else { 10 }),
                    agent.status.as_label()
                );
                items.push(ListItem::new(line).style(if selected {
                    selected_style()
                } else {
                    status_style(&agent.status)
                }));
            }
        }
    }

    items.push(ListItem::new(Line::from(Span::styled(
        format!(
            "{} Delegates · OMO specialists · {} buddies",
            if app.focused_buddies_collapsed {
                "▸"
            } else {
                "▾"
            },
            app.state.actors.focused_buddies.len()
        ),
        muted_style(),
    ))));
    if !app.focused_buddies_collapsed {
        for (index, buddy) in app
            .visible_focused_buddies()
            .into_iter()
            .take(buddy_limit)
            .enumerate()
        {
            let selected = app.selected_actor == Some(SelectedActor::FocusedBuddy(index));
            let prefix = if selected { "❯" } else { " " };
            let line = format!(
                "{} {} FocusedBuddy {:<8} {}",
                prefix,
                status_glyph(&buddy.status),
                truncate(&buddy.display_name, if expanded { 12 } else { 8 }),
                buddy.status.as_label()
            );
            items.push(ListItem::new(line).style(if selected {
                selected_style()
            } else {
                status_style(&buddy.status)
            }));
        }
    }

    let block = surface_block(title, app.focus == FocusPane::TeamBuddies);
    frame.render_widget(List::new(items).block(block), area);
}

fn render_active_workspace(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let mut lines = vec!["Selected TaskRoom".to_string()];
    lines.extend(app.selected_task_room_lines());
    lines.push(String::new());
    lines.push("Actions".to_string());
    lines.push("• Open TaskRoom".to_string());
    lines.extend(app.selected_task_room_action_lines());
    lines.push(app.evidence_action_summary_line());
    frame.render_widget(
        Paragraph::new(lines.join("\n"))
            .block(surface_block("Active Workspace · Selected TaskRoom", false)),
        area,
    );
}

fn render_inspector(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let mut lines = vec![Line::from(Span::styled("Inspector", section_style()))];
    if let Some(room) = app.selected_task_room() {
        lines.push(Line::from(Span::styled(
            room.title.clone(),
            selected_style(),
        )));
        lines.push(Line::from(Span::styled(
            format!("{} participants", room.participants.len()),
            muted_style(),
        )));
        lines.push(Line::from(Span::styled(
            format!("{} rounds", room.rounds.len()),
            muted_style(),
        )));
        lines.push(Line::from(Span::styled(
            room.attention
                .as_ref()
                .map(|attention| format!("{} via {}", attention.state, attention.source_kind))
                .unwrap_or_else(|| "No attention source".to_string()),
            action_style(),
        )));
        lines.push(Line::from(Span::styled("Runtime actions", section_style())));
        for action in app.selected_runtime_actions() {
            lines.push(Line::from(if action.enabled {
                format!("• {}", action.label)
            } else {
                format!(
                    "• {} ({})",
                    action.label,
                    action.disabled_reason.as_deref().unwrap_or("unavailable")
                )
            }));
        }
    }
    frame.render_widget(
        Paragraph::new(lines).block(surface_block("Inspector", false)),
        area,
    );
}

fn render_task_rooms(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect, title: &str) {
    let items = if app.task_rooms_collapsed {
        vec![ListItem::new("◌ TaskRooms hidden")]
    } else if app.sorted_task_rooms().is_empty() {
        vec![ListItem::new("◌ No TaskRooms observed")]
    } else {
        app.sorted_task_rooms()
            .into_iter()
            .take(area.height.saturating_sub(2) as usize)
            .enumerate()
            .map(|(index, room)| {
                let prefix = if index == app.selected_task_room {
                    "❯"
                } else {
                    " "
                };
                ListItem::new(format!(
                    "{} {} {} {}",
                    prefix,
                    task_room_status_glyph(&room.status),
                    truncate(&room.title, 20),
                    room.status.as_label()
                ))
            })
            .collect()
    };
    frame.render_widget(
        List::new(items).block(surface_block(title, app.focus == FocusPane::TaskRooms)),
        area,
    );
}

fn render_runtime_setup(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let items = app
        .runtime_setup()
        .iter()
        .take(area.height.saturating_sub(2) as usize)
        .map(|entry| {
            ListItem::new(format!(
                "{} {}",
                entry.runtime,
                runtime_status_text(&entry.status)
            ))
        });
    frame.render_widget(
        List::new(
            items
                .zip(app.runtime_setup().iter())
                .map(|(item, entry)| item.style(runtime_status_style(&entry.status)))
                .collect::<Vec<_>>(),
        )
        .block(surface_block(
            "Runtime Setup",
            app.focus == FocusPane::RuntimeSetup,
        )),
        area,
    );
}

fn render_task_rooms_narrow(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let text = app
        .selected_task_room()
        .map(|room| {
            format!(
                "{} {}",
                task_room_status_glyph(&room.status),
                truncate(&room.title, area.width.saturating_sub(6) as usize)
            )
        })
        .unwrap_or_else(|| "◌ No TaskRooms observed".to_string());
    frame.render_widget(
        Paragraph::new(text).block(
            Block::default()
                .title("TaskRooms")
                .borders(Borders::ALL)
                .border_style(pane_border_style(app.focus == FocusPane::TaskRooms)),
        ),
        area,
    );
}

fn render_trace(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let lines = vec![
        Line::from(Span::styled("Trace", section_style())),
        Line::from(format!(
            "Claim ceiling: {}",
            app.state.diagnostics.claim_ceiling
        )),
        Line::from(format!(
            "Proof fields hidden: {}",
            app.state.diagnostics.hidden_proof_fields_present
        )),
        Line::from(format!(
            "Generated: {}",
            app.state.generated_at.as_deref().unwrap_or("unknown")
        )),
    ];
    frame.render_widget(
        Paragraph::new(lines).block(surface_block("Trace", false)),
        area,
    );
}

fn render_runtime_setup_narrow(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let top = app
        .runtime_setup()
        .iter()
        .take(2)
        .map(|entry| format!("{} {}", entry.runtime, runtime_status_text(&entry.status)))
        .collect::<Vec<_>>()
        .join(" · ");
    let bottom = app
        .runtime_setup()
        .get(2)
        .map(|entry| format!("{} {}", entry.runtime, runtime_status_text(&entry.status)))
        .unwrap_or_default();
    frame.render_widget(
        Paragraph::new(vec![Line::from(top), Line::from(bottom)]).block(
            Block::default()
                .title("Runtime Setup")
                .borders(Borders::ALL)
                .border_style(pane_border_style(app.focus == FocusPane::RuntimeSetup)),
        ),
        area,
    );
}

fn render_updates(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let items = if app.updates_collapsed {
        vec![ListItem::new("◌ Updates hidden")]
    } else {
        app.updates()
            .iter()
            .take((area.height.saturating_sub(2)).max(1) as usize)
            .map(|update| {
                ListItem::new(format!(
                    "• {}",
                    truncate(&update.text, area.width.saturating_sub(6) as usize)
                ))
            })
            .collect::<Vec<_>>()
    };
    frame.render_widget(
        List::new(items).block(
            Block::default()
                .title("Updates")
                .borders(Borders::ALL)
                .border_style(pane_border_style(app.focus == FocusPane::Updates)),
        ),
        area,
    );
}

fn status_glyph(status: &ActorStatus) -> &'static str {
    match status {
        ActorStatus::Returned => "●",
        ActorStatus::Available => "○",
        ActorStatus::Working => "◐",
        ActorStatus::Blocked => "■",
        ActorStatus::NeedsInput => "▲",
        ActorStatus::Archived => "·",
        ActorStatus::Unknown => "?",
    }
}

fn task_room_status_glyph(status: &TaskRoomStatus) -> &'static str {
    match status {
        TaskRoomStatus::Queued => "◌",
        TaskRoomStatus::Working => "◐",
        TaskRoomStatus::NeedsInput => "▲",
        TaskRoomStatus::NeedsReview => "◆",
        TaskRoomStatus::Blocked => "■",
        TaskRoomStatus::Returned => "●",
        TaskRoomStatus::Completed => "✓",
        TaskRoomStatus::Failed => "✕",
        TaskRoomStatus::Archived => "·",
        TaskRoomStatus::Unknown => "?",
    }
}

fn runtime_status_text(status: &RuntimeSetupStatus) -> &'static str {
    match status {
        RuntimeSetupStatus::Ready => "Ready",
        RuntimeSetupStatus::Partial => "Partial",
        RuntimeSetupStatus::Blocked => "Blocked",
        RuntimeSetupStatus::Working => "Working",
        RuntimeSetupStatus::Returned => "Returned",
        RuntimeSetupStatus::Available => "Available",
        RuntimeSetupStatus::Archived => "Archived",
        RuntimeSetupStatus::Unknown => "Unknown",
    }
}

fn truncate(value: &str, max: usize) -> String {
    let chars: Vec<char> = value.chars().collect();
    if chars.len() <= max {
        value.to_string()
    } else if max > 1 {
        format!("{}…", chars[..max - 1].iter().collect::<String>())
    } else {
        "…".to_string()
    }
}
