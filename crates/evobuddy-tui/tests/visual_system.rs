use std::fs;
use std::path::PathBuf;

use anyhow::Result;
use evobuddy_tui::action_hints::action_hints;
use evobuddy_tui::app::WorkbenchApp;
use evobuddy_tui::model::{parse_workbench_state, ActorStatus, RuntimeSetupStatus, TaskRoomStatus};
use evobuddy_tui::theme::{
    action_bar_block, field_style, pane_block, pane_border_style, runtime_status_style,
    selected_style, status_style, task_room_status_style, theme, ThemeTokens,
};
use evobuddy_tui::ui::render_dashboard_snapshot;
use ratatui::style::{Color, Modifier, Styled};
use ratatui::widgets::{Block, Borders, Padding};

fn app_with_rooms() -> WorkbenchApp {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures")
        .join("evobuddy-workbench-state-v1.json");
    let text = fs::read_to_string(path).expect("read fixture");
    let state = parse_workbench_state(&text).expect("parse state");
    WorkbenchApp::new(state)
}

fn render_snapshot(app: &WorkbenchApp, width: u16, height: u16) -> Result<String> {
    render_dashboard_snapshot(app, width, height)
}

// --- Task 1 beauty landmarks (may remain RED until Task 9 inbox redesign) ---

#[test]
fn home_is_taskroom_inbox_not_debug_dashboard() {
    let frame = render_snapshot(&app_with_rooms(), 120, 40).unwrap();
    assert!(frame.contains("Needs input") || frame.contains("Needs Input"));
    assert!(frame.contains("Work inbox") || frame.contains("TaskRoom inbox"));
    assert!(!frame.contains("Read-only boundary"));
    assert!(
        frame.contains("Detach:") || frame.contains("Enter Open") || frame.contains("Enter  Open")
    );
}

#[test]
fn home_forbids_equal_weight_debug_chrome_as_primary_surface() {
    let frame = render_snapshot(&app_with_rooms(), 120, 40).unwrap();
    assert!(
        frame.contains("Work inbox")
            || frame.contains("TaskRoom inbox")
            || frame.contains("Selected TaskRoom"),
        "missing TaskRoom-first primary surface landmarks:\n{frame}"
    );
    assert!(
        !frame.contains("Read-only boundary"),
        "home must not advertise read-only once mutation path is the product goal:\n{frame}"
    );
}

// --- Task 8 token layer (must PASS) ---

fn assert_token_palette(t: &ThemeTokens) {
    for (name, color) in [
        ("bg", t.bg),
        ("surface", t.surface),
        ("surface_alt", t.surface_alt),
        ("border", t.border),
        ("border_focus", t.border_focus),
        ("text", t.text),
        ("text_muted", t.text_muted),
        ("text_inverse", t.text_inverse),
        ("accent", t.accent),
        ("danger", t.danger),
        ("warning", t.warning),
        ("success", t.success),
        ("info", t.info),
        ("action_bar_bg", t.action_bar_bg),
        ("action_bar_fg", t.action_bar_fg),
    ] {
        assert_ne!(color, Color::Reset, "token {name} must not be Color::Reset");
    }
    assert_ne!(
        t.border, t.border_focus,
        "outer/focus border must differ from default border for hierarchy"
    );
    assert_ne!(
        t.action_bar_bg, t.action_bar_fg,
        "action bar must reverse for high contrast"
    );
    assert_ne!(
        t.text, t.text_muted,
        "muted text must differ from body text"
    );
    assert_ne!(t.accent, t.danger, "accent and danger must be distinct");
    assert_ne!(t.danger, t.success, "danger and success must be distinct");
    assert_ne!(t.warning, t.success, "warning and success must be distinct");
}

#[test]
fn theme_tokens_expose_complete_palette() {
    let t = theme();
    assert_token_palette(&t);
}

#[test]
fn selected_style_uses_accent_and_bold_not_only_yellow() {
    let t = theme();
    let style = selected_style();
    assert!(
        style.add_modifier.contains(Modifier::BOLD),
        "selected row must be bold"
    );
    // Full-row emphasis: accent as background (or reversed), not bare yellow text alone.
    assert_eq!(
        style.bg,
        Some(t.accent),
        "selected row must use accent as background fill"
    );
    assert_ne!(
        style.fg,
        Some(Color::Yellow),
        "selected row must not be ad-hoc yellow-only"
    );
}

#[test]
fn pane_block_distinguishes_focused_and_unfocused_borders() {
    let t = theme();
    let focused_border = pane_border_style(true);
    let unfocused_border = pane_border_style(false);
    assert_eq!(
        focused_border.fg,
        Some(t.border_focus),
        "focused pane uses border_focus"
    );
    assert_eq!(
        unfocused_border.fg,
        Some(t.border),
        "unfocused pane uses lighter border token"
    );
    assert!(
        focused_border.add_modifier.contains(Modifier::BOLD)
            || focused_border.fg != unfocused_border.fg,
        "outer/focused chrome must read stronger than inner"
    );

    let focused: Block<'_> = pane_block("Work inbox", true);
    let unfocused: Block<'_> = pane_block("Work inbox", false);
    let expected_focused = Block::default()
        .title("Work inbox".to_string())
        .borders(Borders::ALL)
        .border_style(focused_border)
        .padding(Padding::horizontal(1));
    let expected_unfocused = Block::default()
        .title("Work inbox".to_string())
        .borders(Borders::ALL)
        .border_style(unfocused_border)
        .padding(Padding::horizontal(1));
    assert_eq!(
        focused, expected_focused,
        "focused pane_block matches tokens"
    );
    assert_eq!(
        unfocused, expected_unfocused,
        "unfocused pane_block matches tokens"
    );
}

#[test]
fn action_bar_block_is_reversed_high_contrast() {
    let t = theme();
    let block = action_bar_block();
    let style = Styled::style(&block);
    assert_eq!(
        style.bg,
        Some(t.action_bar_bg),
        "action bar block uses action_bar_bg"
    );
    assert_eq!(
        style.fg,
        Some(t.action_bar_fg),
        "action bar block uses action_bar_fg"
    );
    assert_ne!(style.bg, style.fg, "reversed action bar requires contrast");
}

#[test]
fn field_style_marks_active_and_error_states() {
    let t = theme();
    let idle = field_style(false, false);
    let active = field_style(true, false);
    let error = field_style(false, true);
    let active_error = field_style(true, true);

    assert_ne!(idle, active, "active field must differ from idle");
    assert_ne!(idle, error, "error field must differ from idle");
    assert!(
        active.add_modifier.contains(Modifier::REVERSED)
            || active.bg == Some(t.accent)
            || active.fg == Some(t.text_inverse),
        "active field should be inverted or accent-highlighted"
    );
    assert_eq!(error.fg, Some(t.danger), "error field uses danger token");
    assert_eq!(
        active_error.fg,
        Some(t.danger),
        "active+error still surfaces danger"
    );
}

#[test]
fn status_colors_are_stable_across_actor_taskroom_and_runtime() {
    let t = theme();

    assert_eq!(status_style(&ActorStatus::Blocked).fg, Some(t.danger));
    assert_eq!(
        runtime_status_style(&RuntimeSetupStatus::Blocked).fg,
        Some(t.danger)
    );
    assert_eq!(
        task_room_status_style(&TaskRoomStatus::Blocked).fg,
        Some(t.danger)
    );

    assert_eq!(status_style(&ActorStatus::Working).fg, Some(t.warning));
    assert_eq!(
        runtime_status_style(&RuntimeSetupStatus::Working).fg,
        Some(t.warning)
    );
    assert_eq!(
        task_room_status_style(&TaskRoomStatus::Working).fg,
        Some(t.warning)
    );

    assert_eq!(status_style(&ActorStatus::Available).fg, Some(t.success));
    assert_eq!(
        runtime_status_style(&RuntimeSetupStatus::Ready).fg,
        Some(t.success)
    );
    assert_eq!(
        task_room_status_style(&TaskRoomStatus::Completed).fg,
        Some(t.success)
    );

    assert_eq!(status_style(&ActorStatus::Returned).fg, Some(t.info));
    assert_eq!(
        runtime_status_style(&RuntimeSetupStatus::Returned).fg,
        Some(t.info)
    );
    assert_eq!(
        task_room_status_style(&TaskRoomStatus::Returned).fg,
        Some(t.info)
    );

    assert_eq!(status_style(&ActorStatus::NeedsInput).fg, Some(t.accent));
    assert_eq!(
        task_room_status_style(&TaskRoomStatus::NeedsInput).fg,
        Some(t.accent)
    );
}

#[test]
fn theme_module_source_defines_token_api_surface() {
    let theme_src =
        fs::read_to_string(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/theme.rs"))
            .expect("read theme.rs");
    for needle in [
        "pub struct ThemeTokens",
        "pub fn theme()",
        "pub fn pane_block",
        "pub fn action_bar_block",
        "pub fn field_style",
        "action_bar_bg",
        "border_focus",
        "text_muted",
    ] {
        assert!(
            theme_src.contains(needle),
            "theme.rs must define token surface: {needle}"
        );
    }
}

#[test]
fn selected_style_uses_background_or_reversed_emphasis() {
    let style = selected_style();
    let has_bg = style.bg.is_some();
    let reversed = style.add_modifier.contains(Modifier::REVERSED);
    assert!(
        has_bg || reversed,
        "selected_style must use bg fill or REVERSED for full-row emphasis, got {style:?}"
    );
}

#[test]
fn home_bans_debug_chrome_copy() {
    let frame = render_snapshot(&app_with_rooms(), 120, 40).unwrap();
    for banned in [
        "Read-only boundary",
        "Attention strip:",
        "Secondary",
        "Runtime readiness / recent returns",
    ] {
        assert!(!frame.contains(banned), "banned `{banned}` in:\n{frame}");
    }
}

#[test]
fn home_action_bar_has_at_most_four_promoted_actions() {
    let app = app_with_rooms();
    let hints = action_hints(&app);
    assert!(
        hints.len() <= 4,
        "Home bar too crowded: {} hints {:?}",
        hints.len(),
        hints.iter().map(|h| h.key).collect::<Vec<_>>()
    );
}
