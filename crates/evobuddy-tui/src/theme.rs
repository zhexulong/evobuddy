use ratatui::style::{Color, Modifier, Style};
use ratatui::widgets::{Block, Borders, Padding};

use crate::model::{ActorStatus, RuntimeSetupStatus, TaskRoomStatus};

/// Semantic color tokens for the EvoBuddy TUI (GrokNight-aligned).
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
    pub orange: Color,
}

/// Canonical GrokNight RGB (truecolor). See visual craft + Grok alignment specs.
pub mod groknight {
    pub const BG: (u8, u8, u8) = (10, 10, 10);
    pub const BG_STORM: (u8, u8, u8) = (20, 20, 20);
    pub const BG_HIGHLIGHT: (u8, u8, u8) = (36, 36, 36);
    pub const FG: (u8, u8, u8) = (225, 225, 225);
    pub const FG_DARK: (u8, u8, u8) = (200, 200, 200);
    pub const COMMENT: (u8, u8, u8) = (108, 108, 108);
    pub const BLUE: (u8, u8, u8) = (122, 162, 247);
    pub const CYAN: (u8, u8, u8) = (125, 207, 255);
    pub const GREEN: (u8, u8, u8) = (158, 206, 106);
    pub const MAGENTA: (u8, u8, u8) = (187, 154, 247);
    pub const ORANGE: (u8, u8, u8) = (255, 158, 100);
    pub const YELLOW: (u8, u8, u8) = (224, 175, 104);
    pub const RED: (u8, u8, u8) = (247, 118, 142);
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ColorCapability {
    TrueColor,
    Ansi256,
    Ansi16,
    Mono,
}

fn env_truthy(name: &str) -> bool {
    match std::env::var(name) {
        Ok(v) => {
            let v = v.trim();
            !v.is_empty() && v != "0" && !v.eq_ignore_ascii_case("false")
        }
        Err(_) => false,
    }
}

/// Detect terminal color capability (Grok-style quantize ladder).
pub fn detect_color_capability() -> ColorCapability {
    if env_truthy("NO_COLOR") {
        return ColorCapability::Mono;
    }
    if env_truthy("EVOBUDDY_TUI_TRUECOLOR") {
        return ColorCapability::TrueColor;
    }
    if env_truthy("EVOBUDDY_TUI_ANSI16") {
        return ColorCapability::Ansi16;
    }
    let colorterm = std::env::var("COLORTERM").unwrap_or_default().to_lowercase();
    if colorterm.contains("truecolor") || colorterm.contains("24bit") {
        return ColorCapability::TrueColor;
    }
    let term = std::env::var("TERM").unwrap_or_default().to_lowercase();
    if term.contains("256color") || term.contains("xterm") {
        return ColorCapability::Ansi256;
    }
    if term == "dumb" || term.is_empty() {
        return ColorCapability::Ansi16;
    }
    ColorCapability::Ansi256
}

fn rgb(r: u8, g: u8, b: u8) -> Color {
    Color::Rgb(r, g, b)
}

fn quantize_rgb(cap: ColorCapability, (r, g, b): (u8, u8, u8), ansi16: Color) -> Color {
    match cap {
        ColorCapability::TrueColor => rgb(r, g, b),
        ColorCapability::Ansi256 => {
            // Nearest xterm 256 cube approximation for Night palette readability.
            let qr = ((r as u16 * 5) / 255) as u8;
            let qg = ((g as u16 * 5) / 255) as u8;
            let qb = ((b as u16 * 5) / 255) as u8;
            Color::Indexed(16 + 36 * qr + 6 * qg + qb)
        }
        ColorCapability::Ansi16 | ColorCapability::Mono => ansi16,
    }
}

/// Dark GrokNight-class theme with truecolor / 256 / 16 quantize.
pub fn theme() -> ThemeTokens {
    theme_for(detect_color_capability())
}

pub fn theme_for(cap: ColorCapability) -> ThemeTokens {
    use groknight::*;
    if matches!(cap, ColorCapability::Mono) {
        return ThemeTokens {
            bg: Color::Black,
            surface: Color::Black,
            surface_alt: Color::DarkGray,
            border: Color::DarkGray,
            border_focus: Color::White,
            text: Color::White,
            text_muted: Color::DarkGray,
            text_inverse: Color::Black,
            accent: Color::White,
            danger: Color::White,
            warning: Color::White,
            success: Color::White,
            info: Color::White,
            action_bar_bg: Color::DarkGray,
            action_bar_fg: Color::White,
            orange: Color::White,
        };
    }
    ThemeTokens {
        bg: quantize_rgb(cap, BG, Color::Black),
        surface: quantize_rgb(cap, BG_STORM, Color::Black),
        surface_alt: quantize_rgb(cap, BG_HIGHLIGHT, Color::DarkGray),
        border: quantize_rgb(cap, COMMENT, Color::DarkGray),
        border_focus: quantize_rgb(cap, BLUE, Color::Cyan),
        text: quantize_rgb(cap, FG, Color::White),
        text_muted: quantize_rgb(cap, COMMENT, Color::DarkGray),
        text_inverse: quantize_rgb(cap, BG, Color::Black),
        accent: quantize_rgb(cap, MAGENTA, Color::Magenta),
        danger: quantize_rgb(cap, RED, Color::Red),
        warning: quantize_rgb(cap, YELLOW, Color::Yellow),
        success: quantize_rgb(cap, GREEN, Color::Green),
        info: quantize_rgb(cap, CYAN, Color::Cyan),
        action_bar_bg: quantize_rgb(cap, BG_HIGHLIGHT, Color::DarkGray),
        action_bar_fg: quantize_rgb(cap, FG, Color::White),
        orange: quantize_rgb(cap, ORANGE, Color::Yellow),
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

pub fn pane_block(title: impl Into<String>, focused: bool) -> Block<'static> {
    let t = theme();
    Block::default()
        .title(title.into())
        .borders(Borders::ALL)
        .border_style(pane_border_style(focused))
        .style(Style::default().bg(t.surface).fg(t.text))
        .padding(Padding::horizontal(1))
}

pub fn action_bar_block() -> Block<'static> {
    let t = theme();
    Block::default().borders(Borders::NONE).style(
        Style::default()
            .bg(t.action_bar_bg)
            .fg(t.action_bar_fg)
            .add_modifier(Modifier::BOLD),
    )
}

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
            .fg(t.text)
            .bg(t.surface_alt)
            .add_modifier(Modifier::BOLD);
    }
    Style::default().fg(t.text)
}

pub fn selected_style() -> Style {
    let t = theme();
    Style::default()
        .fg(t.text)
        .bg(t.surface_alt)
        .add_modifier(Modifier::BOLD)
}

/// Selected list marker (left rail) without full-line reverse blocks.
pub fn selected_marker_style() -> Style {
    let t = theme();
    Style::default()
        .fg(t.border_focus)
        .add_modifier(Modifier::BOLD)
}

pub fn status_glyph(status: &TaskRoomStatus) -> &'static str {
    match status {
        TaskRoomStatus::NeedsInput | TaskRoomStatus::NeedsReview | TaskRoomStatus::Blocked => "●",
        TaskRoomStatus::Working => "◉",
        TaskRoomStatus::Queued => "·",
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
    Style::default().fg(t.danger).add_modifier(Modifier::BOLD)
}

pub fn action_style() -> Style {
    let t = theme();
    Style::default().fg(t.success).add_modifier(Modifier::BOLD)
}

pub fn status_style(status: &ActorStatus) -> Style {
    let t = theme();
    match status {
        ActorStatus::NeedsInput => Style::default().fg(t.danger).add_modifier(Modifier::BOLD),
        ActorStatus::Blocked => Style::default().fg(t.danger).add_modifier(Modifier::BOLD),
        ActorStatus::Working => Style::default().fg(t.info),
        ActorStatus::Returned => Style::default().fg(t.warning).add_modifier(Modifier::BOLD),
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
        RuntimeSetupStatus::Working => Style::default().fg(t.info),
        RuntimeSetupStatus::Returned => Style::default().fg(t.warning),
        RuntimeSetupStatus::Available => Style::default().fg(t.success),
        RuntimeSetupStatus::Archived => muted_style(),
        RuntimeSetupStatus::Unknown => Style::default().fg(t.text_muted),
    }
}

pub fn task_room_status_style(status: &TaskRoomStatus) -> Style {
    let t = theme();
    match status {
        TaskRoomStatus::NeedsInput => Style::default().fg(t.danger).add_modifier(Modifier::BOLD),
        TaskRoomStatus::NeedsReview => Style::default().fg(t.orange).add_modifier(Modifier::BOLD),
        TaskRoomStatus::Blocked | TaskRoomStatus::Failed => {
            Style::default().fg(t.danger).add_modifier(Modifier::BOLD)
        }
        TaskRoomStatus::Working => Style::default().fg(t.info),
        TaskRoomStatus::Queued => Style::default().fg(t.success),
        TaskRoomStatus::Returned => Style::default().fg(t.warning).add_modifier(Modifier::BOLD),
        TaskRoomStatus::Completed => Style::default().fg(t.success),
        TaskRoomStatus::Archived => muted_style(),
        TaskRoomStatus::Unknown => Style::default().fg(t.text_muted),
    }
}

pub fn surface_block(title: &str, focused: bool) -> Block<'static> {
    pane_block(title, focused)
}

pub fn compact_density() -> bool {
    env_truthy("EVOBUDDY_TUI_COMPACT")
}

pub fn home_body_min_height() -> u16 {
    if compact_density() {
        10
    } else {
        14
    }
}

#[cfg(test)]
mod theme_tests {
    use super::*;

    #[test]
    fn groknight_rgb_table_matches_spec() {
        assert_eq!(groknight::BG, (10, 10, 10));
        assert_eq!(groknight::BG_STORM, (20, 20, 20));
        assert_eq!(groknight::BG_HIGHLIGHT, (36, 36, 36));
        assert_eq!(groknight::FG, (225, 225, 225));
        assert_eq!(groknight::BLUE, (122, 162, 247));
        assert_eq!(groknight::MAGENTA, (187, 154, 247));
        assert_eq!(groknight::GREEN, (158, 206, 106));
        assert_eq!(groknight::RED, (247, 118, 142));
        assert_eq!(groknight::CYAN, (125, 207, 255));
    }

    #[test]
    fn truecolor_theme_uses_rgb_not_flat_named_only() {
        let t = theme_for(ColorCapability::TrueColor);
        assert!(matches!(t.bg, Color::Rgb(10, 10, 10)));
        assert!(matches!(t.surface, Color::Rgb(20, 20, 20)));
        assert!(matches!(t.surface_alt, Color::Rgb(36, 36, 36)));
        assert!(matches!(t.border_focus, Color::Rgb(122, 162, 247)));
        assert!(matches!(t.accent, Color::Rgb(187, 154, 247)));
        assert_ne!(t.bg, t.surface);
        assert_ne!(t.surface, t.surface_alt);
    }

    #[test]
    fn mono_theme_stays_readable() {
        let t = theme_for(ColorCapability::Mono);
        assert_eq!(t.bg, Color::Black);
        assert_eq!(t.text, Color::White);
    }
}
