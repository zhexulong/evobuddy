use ratatui::style::{Color, Modifier, Style};
use ratatui::widgets::{Block, Borders};

use crate::model::{ActorStatus, RuntimeSetupStatus};

pub fn pane_border_style(focused: bool) -> Style {
    if focused {
        Style::default()
            .fg(Color::Cyan)
            .add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(Color::DarkGray)
    }
}

pub fn selected_style() -> Style {
    Style::default()
        .fg(Color::Yellow)
        .add_modifier(Modifier::BOLD)
}

pub fn section_style() -> Style {
    Style::default()
        .fg(Color::White)
        .add_modifier(Modifier::BOLD)
}

pub fn muted_style() -> Style {
    Style::default().fg(Color::DarkGray)
}

pub fn attention_style() -> Style {
    Style::default()
        .fg(Color::LightYellow)
        .add_modifier(Modifier::BOLD)
}

pub fn action_style() -> Style {
    Style::default()
        .fg(Color::LightGreen)
        .add_modifier(Modifier::BOLD)
}

pub fn status_style(status: &ActorStatus) -> Style {
    match status {
        ActorStatus::NeedsInput => Style::default()
            .fg(Color::LightMagenta)
            .add_modifier(Modifier::BOLD),
        ActorStatus::Blocked => Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
        ActorStatus::Working => Style::default().fg(Color::Yellow),
        ActorStatus::Returned => Style::default()
            .fg(Color::Cyan)
            .add_modifier(Modifier::BOLD),
        ActorStatus::Available => Style::default().fg(Color::Green),
        ActorStatus::Archived => muted_style(),
        ActorStatus::Unknown => Style::default().fg(Color::Gray),
    }
}

pub fn runtime_status_style(status: &RuntimeSetupStatus) -> Style {
    match status {
        RuntimeSetupStatus::Ready => Style::default().fg(Color::Green),
        RuntimeSetupStatus::Partial => Style::default().fg(Color::Yellow),
        RuntimeSetupStatus::Blocked => Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
        RuntimeSetupStatus::Working => Style::default().fg(Color::Yellow),
        RuntimeSetupStatus::Returned => Style::default().fg(Color::Cyan),
        RuntimeSetupStatus::Available => Style::default().fg(Color::Green),
        RuntimeSetupStatus::Archived => muted_style(),
        RuntimeSetupStatus::Unknown => Style::default().fg(Color::Gray),
    }
}

pub fn surface_block(title: &str, focused: bool) -> Block<'static> {
    Block::default()
        .title(title.to_string())
        .borders(Borders::ALL)
        .border_style(pane_border_style(focused))
}
