use ratatui::style::{Color, Modifier, Style};
use ratatui::widgets::{Block, Borders, Padding};

use crate::model::{ActorStatus, RuntimeSetupStatus, TaskRoomStatus};

/// Semantic color tokens for the EvoBuddy TUI visual system.
///
/// Prefer named ANSI colors so the palette remains readable without truecolor.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ThemeTokens {
    pub bg: Color,
    pub surface: Color,
    pub surface_alt: Color,
    pub border: Color,
    pub border_focus: Color,
    pub text: Color,
    pub text_muted: Color,
    pub text_inverse: Color,
    pub accent: Color,
    pub danger: Color,
    pub warning: Color,
    pub success: Color,
    pub info: Color,
    pub action_bar_bg: Color,
    pub action_bar_fg: Color,
}

/// Dark-theme defaults with ANSI fallbacks (no truecolor dependency).
pub fn theme() -> ThemeTokens {
    ThemeTokens {
        bg: Color::Black,
        surface: Color::Black,
        surface_alt: Color::DarkGray,
        border: Color::DarkGray,
        border_focus: Color::Cyan,
        text: Color::White,
        text_muted: Color::DarkGray,
        text_inverse: Color::Black,
        accent: Color::Magenta,
        danger: Color::Red,
        warning: Color::Yellow,
        success: Color::Green,
        info: Color::Cyan,
        action_bar_bg: Color::White,
        action_bar_fg: Color::Black,
    }
}

pub fn pane_border_style(focused: bool) -> Style {
    let t = theme();
    if focused {
        Style::default()
            .fg(t.border_focus)
            .add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(t.border)
    }
}

/// Outer/inner pane chrome: stronger border when focused, padding on content.
pub fn pane_block(title: impl Into<String>, focused: bool) -> Block<'static> {
    Block::default()
        .title(title.into())
        .borders(Borders::ALL)
        .border_style(pane_border_style(focused))
        .padding(Padding::horizontal(1))
}

/// Full-width reversed/high-contrast action bar chrome.
pub fn action_bar_block() -> Block<'static> {
    let t = theme();
    Block::default().borders(Borders::NONE).style(
        Style::default()
            .bg(t.action_bar_bg)
            .fg(t.action_bar_fg)
            .add_modifier(Modifier::BOLD),
    )
}

/// Form field chrome: idle, active (inverted/accent), and danger for errors.
pub fn field_style(active: bool, error: bool) -> Style {
    let t = theme();
    if error {
        let mut style = Style::default().fg(t.danger);
        if active {
            style = style.add_modifier(Modifier::BOLD | Modifier::REVERSED);
        } else {
            style = style.add_modifier(Modifier::BOLD);
        }
        return style;
    }
    if active {
        return Style::default()
            .fg(t.text_inverse)
            .bg(t.accent)
            .add_modifier(Modifier::BOLD | Modifier::REVERSED);
    }
    Style::default().fg(t.text)
}

pub fn selected_style() -> Style {
    let t = theme();
    Style::default()
        .fg(t.text_inverse)
        .bg(t.accent)
        .add_modifier(Modifier::BOLD)
}

pub fn status_glyph(status: &TaskRoomStatus) -> &'static str {
    match status {
        TaskRoomStatus::NeedsInput | TaskRoomStatus::NeedsReview | TaskRoomStatus::Blocked => "●",
        TaskRoomStatus::Working | TaskRoomStatus::Queued => "◉",
        TaskRoomStatus::Returned | TaskRoomStatus::Completed => "○",
        _ => "·",
    }
}

pub fn section_style() -> Style {
    let t = theme();
    Style::default().fg(t.text).add_modifier(Modifier::BOLD)
}

pub fn muted_style() -> Style {
    let t = theme();
    Style::default().fg(t.text_muted)
}

pub fn attention_style() -> Style {
    let t = theme();
    Style::default().fg(t.warning).add_modifier(Modifier::BOLD)
}

pub fn action_style() -> Style {
    let t = theme();
    Style::default().fg(t.success).add_modifier(Modifier::BOLD)
}

pub fn status_style(status: &ActorStatus) -> Style {
    let t = theme();
    match status {
        ActorStatus::NeedsInput => Style::default().fg(t.accent).add_modifier(Modifier::BOLD),
        ActorStatus::Blocked => Style::default().fg(t.danger).add_modifier(Modifier::BOLD),
        ActorStatus::Working => Style::default().fg(t.warning),
        ActorStatus::Returned => Style::default().fg(t.info).add_modifier(Modifier::BOLD),
        ActorStatus::Available => Style::default().fg(t.success),
        ActorStatus::Archived => muted_style(),
        ActorStatus::Unknown => Style::default().fg(t.text_muted),
    }
}

pub fn runtime_status_style(status: &RuntimeSetupStatus) -> Style {
    let t = theme();
    match status {
        RuntimeSetupStatus::Ready => Style::default().fg(t.success),
        RuntimeSetupStatus::Partial => Style::default().fg(t.warning),
        RuntimeSetupStatus::Blocked => Style::default().fg(t.danger).add_modifier(Modifier::BOLD),
        RuntimeSetupStatus::Working => Style::default().fg(t.warning),
        RuntimeSetupStatus::Returned => Style::default().fg(t.info),
        RuntimeSetupStatus::Available => Style::default().fg(t.success),
        RuntimeSetupStatus::Archived => muted_style(),
        RuntimeSetupStatus::Unknown => Style::default().fg(t.text_muted),
    }
}

/// Stable status colors shared with Actor/Runtime semantics.
pub fn task_room_status_style(status: &TaskRoomStatus) -> Style {
    let t = theme();
    match status {
        TaskRoomStatus::NeedsInput => Style::default().fg(t.accent).add_modifier(Modifier::BOLD),
        TaskRoomStatus::NeedsReview => Style::default().fg(t.warning).add_modifier(Modifier::BOLD),
        TaskRoomStatus::Blocked | TaskRoomStatus::Failed => {
            Style::default().fg(t.danger).add_modifier(Modifier::BOLD)
        }
        TaskRoomStatus::Working | TaskRoomStatus::Queued => Style::default().fg(t.warning),
        TaskRoomStatus::Returned => Style::default().fg(t.info).add_modifier(Modifier::BOLD),
        TaskRoomStatus::Completed => Style::default().fg(t.success),
        TaskRoomStatus::Archived => muted_style(),
        TaskRoomStatus::Unknown => Style::default().fg(t.text_muted),
    }
}

pub fn surface_block(title: &str, focused: bool) -> Block<'static> {
    pane_block(title, focused)
}
