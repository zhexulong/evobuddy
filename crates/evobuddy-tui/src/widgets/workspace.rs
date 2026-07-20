use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::text::{Line, Span};
use ratatui::widgets::{List, ListItem, Paragraph};
use ratatui::Frame;

use crate::app::{SelectedActor, WorkbenchApp};
use crate::model::TaskRoom;
use crate::theme::{action_style, muted_style, section_style, selected_style, surface_block};

pub fn render_team_member_workspace(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(6),
            Constraint::Length(8),
            Constraint::Min(8),
            Constraint::Length(8),
        ])
        .split(area);

    render_team_member_header(frame, app, rows[0]);
    render_task_room_summary(frame, app, rows[1], "TaskRooms");
    render_handoffs(frame, app, rows[2]);
    render_actions(frame, rows[3], "Start member adapter task");
}

pub fn render_focused_buddy_workspace(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(7),
            Constraint::Length(8),
            Constraint::Min(8),
            Constraint::Length(8),
        ])
        .split(area);

    render_focused_buddy_header(frame, app, rows[0]);
    render_buddy_runtime_surfaces(frame, app, rows[1]);
    render_task_room_summary(frame, app, rows[2], "TaskRoom links");
    render_actions(frame, rows[3], "Start buddy adapter task");
}

fn render_team_member_header(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let mut lines = vec![
        Line::from(Span::styled("Team Member Workspace", selected_style())),
        Line::from(Span::styled("Visible team member", section_style())),
    ];
    for line in app.selected_actor_lines() {
        lines.push(Line::from(line));
    }
    frame.render_widget(
        Paragraph::new(lines).block(surface_block("Team Member Workspace", true)),
        area,
    );
}

fn render_focused_buddy_header(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let mut lines = vec![
        Line::from(Span::styled("Focused Delegate Workspace", selected_style())),
        Line::from(Span::styled("OMO specialist delegate", section_style())),
    ];
    for line in app.selected_actor_lines() {
        lines.push(Line::from(line));
    }
    frame.render_widget(
        Paragraph::new(lines).block(surface_block("Focused Delegate Workspace", true)),
        area,
    );
}

fn render_buddy_runtime_surfaces(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let items = match app.selected_actor {
        Some(SelectedActor::FocusedBuddy(index)) => app
            .state
            .actors
            .focused_buddies
            .get(index)
            .map(|buddy| {
                buddy
                    .runtime_surfaces
                    .iter()
                    .map(|surface| ListItem::new(surface.clone()))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default(),
        _ => Vec::new(),
    };
    let items = if items.is_empty() {
        vec![ListItem::new("No runtime surfaces recorded").style(muted_style())]
    } else {
        items
    };
    frame.render_widget(
        List::new(items).block(surface_block("Runtime surfaces", false)),
        area,
    );
}

fn render_task_room_summary(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect, title: &str) {
    let rooms = app.selected_actor_task_rooms();
    let items = if rooms.is_empty() {
        vec![ListItem::new("No active TaskRooms for this agent")]
    } else {
        rooms
            .iter()
            .map(|room| {
                ListItem::new(format!(
                    "{} · {} · Returned to {}",
                    room.title,
                    room.status.as_label(),
                    room.returned_to.as_deref().unwrap_or("none")
                ))
            })
            .collect()
    };
    frame.render_widget(List::new(items).block(surface_block(title, false)), area);
}

fn render_handoffs(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let mut items = vec![ListItem::new(Line::from(Span::styled(
        "Handoffs",
        section_style(),
    )))];
    for room in app.selected_actor_task_rooms() {
        if room.handoffs.is_empty() {
            items.push(ListItem::new(format!("{} · no handoffs", room.title)).style(muted_style()));
            continue;
        }
        for handoff in &room.handoffs {
            items.push(ListItem::new(format!(
                "{} -> {}: {}",
                handoff.from, handoff.to, handoff.summary
            )));
        }
    }
    if items.len() == 1 {
        items.push(ListItem::new("No handoffs for selected agent").style(muted_style()));
    }
    frame.render_widget(
        List::new(items).block(surface_block("Handoffs", false)),
        area,
    );
}

fn render_actions(frame: &mut Frame<'_>, area: Rect, adapter_label: &str) {
    let items = [
        "Actions",
        "Open TaskRoom",
        "View Handoffs",
        adapter_label,
        "Open Trace",
    ]
    .into_iter()
    .map(|label| ListItem::new(label).style(action_style()))
    .collect::<Vec<_>>();
    frame.render_widget(
        List::new(items).block(surface_block("Actions", false)),
        area,
    );
}

pub fn render_task_room_workspace(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let Some(room) = app.selected_task_room() else {
        frame.render_widget(
            Paragraph::new("No TaskRoom selected").block(surface_block("TaskRoom Workspace", true)),
            area,
        );
        return;
    };

    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(7),
            Constraint::Length(8),
            Constraint::Length(8),
            Constraint::Min(8),
        ])
        .split(area);

    render_task_room_header(frame, room, rows[0]);
    render_participants_and_rounds(frame, room, rows[1]);
    render_room_handoffs(frame, room, rows[2]);
    render_room_continuity(frame, room, rows[3]);
}

fn render_task_room_header(frame: &mut Frame<'_>, room: &TaskRoom, area: Rect) {
    let lines = vec![
        Line::from(Span::styled("TaskRoom Workspace", selected_style())),
        Line::from(room.title.clone()),
        Line::from(format!("Runtime: {}", room.runtime)),
        Line::from(format!("Status: {}", room.status.as_label())),
        Line::from(format!(
            "Returned to: {}",
            room.returned_to.as_deref().unwrap_or("none")
        )),
    ];
    frame.render_widget(
        Paragraph::new(lines).block(surface_block("TaskRoom Workspace", true)),
        area,
    );
}

fn render_participants_and_rounds(frame: &mut Frame<'_>, room: &TaskRoom, area: Rect) {
    let columns = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area);

    let participant_items = room
        .participants
        .iter()
        .map(|participant| {
            ListItem::new(format!(
                "{} · {} · {}",
                participant.display_name,
                participant.kind,
                participant.status.as_label()
            ))
        })
        .collect::<Vec<_>>();
    frame.render_widget(
        List::new(participant_items).block(surface_block("Participants", false)),
        columns[0],
    );

    let round_items = room
        .rounds
        .iter()
        .map(|round| {
            ListItem::new(format!(
                "Round {} · Builder: {} · Reviewer: {} · prior review linked: {}",
                round.id, round.builder_summary, round.reviewer_summary, round.prior_review_linked
            ))
        })
        .collect::<Vec<_>>();
    frame.render_widget(
        List::new(round_items).block(surface_block("Rounds", false)),
        columns[1],
    );
}

fn render_room_handoffs(frame: &mut Frame<'_>, room: &TaskRoom, area: Rect) {
    let items = if room.handoffs.is_empty() {
        vec![ListItem::new("No handoffs recorded").style(muted_style())]
    } else {
        room.handoffs
            .iter()
            .map(|handoff| {
                ListItem::new(format!(
                    "{} -> {}: {}",
                    handoff.from, handoff.to, handoff.summary
                ))
            })
            .collect()
    };
    frame.render_widget(
        List::new(items).block(surface_block("Handoffs", false)),
        area,
    );
}

fn render_room_continuity(frame: &mut Frame<'_>, room: &TaskRoom, area: Rect) {
    let columns = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area);
    let continuity = vec![
        Line::from(Span::styled("Reviewer continuity", section_style())),
        Line::from(room.reviewer_continuity.status.clone()),
        Line::from(room.reviewer_continuity.summary.clone()),
        Line::from(Span::styled("Evolution handoff", section_style())),
        Line::from(room.evolution_handoff.status.clone()),
        Line::from(room.evolution_handoff.summary.clone()),
    ];
    frame.render_widget(
        Paragraph::new(continuity).block(surface_block("Reviewer continuity", false)),
        columns[0],
    );

    let artifacts = if room.artifacts_summary.is_empty() {
        vec![ListItem::new("No artifacts recorded").style(muted_style())]
    } else {
        room.artifacts_summary
            .iter()
            .map(|artifact| ListItem::new(artifact.clone()))
            .collect()
    };
    frame.render_widget(
        List::new(artifacts).block(surface_block("Artifacts", false)),
        columns[1],
    );
}
