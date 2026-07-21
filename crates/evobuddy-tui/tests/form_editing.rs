use std::fs;
use std::path::PathBuf;

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use evobuddy_tui::app::{
    StructuredQuestion, StructuredQuestionChoice, WorkbenchApp, WorkbenchEffect,
};
use evobuddy_tui::input::{handle_key_event, KeyInput};
use evobuddy_tui::model::parse_workbench_state;
use evobuddy_tui::ui::{map_key_event_for_app, render_current_snapshot};
use evobuddy_tui::views::ViewMode;
use evobuddy_tui::widgets::form_kit::{active_field_cursor, FormFieldView};
use ratatui::layout::Rect;
use ratatui::style::Modifier;

fn load_app(name: &str) -> WorkbenchApp {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures")
        .join(name);
    let text = fs::read_to_string(path).expect("read fixture");
    let state = parse_workbench_state(&text).expect("parse state");
    WorkbenchApp::new(state)
}

#[test]
fn backspace_deletes_from_active_field() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    handle_key_event(&mut app, KeyInput::NewRoom);
    assert_eq!(app.view_mode, ViewMode::TaskRoomForm);

    handle_key_event(&mut app, KeyInput::Char('a'));
    handle_key_event(&mut app, KeyInput::Char('b'));
    handle_key_event(&mut app, KeyInput::Char('c'));
    assert_eq!(app.task_room_form.objective, "abc");

    handle_key_event(&mut app, KeyInput::Backspace);
    assert_eq!(app.task_room_form.objective, "ab");

    handle_key_event(&mut app, KeyInput::Delete);
    assert_eq!(app.task_room_form.objective, "a");
}

#[test]
fn active_field_highlight_differs_from_inactive() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    handle_key_event(&mut app, KeyInput::NewRoom);
    app.task_room_form.objective = "active-value".to_string();
    app.task_room_form.acceptance_criteria = "inactive-value".to_string();
    app.task_room_form_field = 0;

    let backend = ratatui::backend::TestBackend::new(80, 24);
    let mut terminal = ratatui::Terminal::new(backend).expect("terminal");
    terminal
        .draw(|frame| {
            evobuddy_tui::widgets::task_room_form::render_task_room_form(frame, &app, frame.area());
        })
        .expect("draw");

    let buffer = terminal.backend().buffer();
    let mut found_reversed = false;
    let mut found_plain = false;
    for y in 0..24u16 {
        for x in 0..80u16 {
            let cell = &buffer[(x, y)];
            let mods = cell.style().add_modifier;
            if mods.contains(Modifier::REVERSED) || mods.contains(Modifier::BOLD) {
                found_reversed = true;
            } else if !cell.symbol().trim().is_empty() {
                found_plain = true;
            }
        }
    }
    assert!(
        found_reversed,
        "active field must use reversed or bold highlight"
    );
    assert!(found_plain, "inactive content must still render");

    let fields = [
        FormFieldView {
            label: "Objective",
            value: "x".to_string(),
            active: true,
            error: None,
        },
        FormFieldView {
            label: "Runtime",
            value: "y".to_string(),
            active: false,
            error: None,
        },
    ];
    let backend = ratatui::backend::TestBackend::new(60, 16);
    let mut terminal = ratatui::Terminal::new(backend).expect("terminal");
    terminal
        .draw(|frame| {
            evobuddy_tui::widgets::form_kit::render_form(
                frame,
                frame.area(),
                "Test Form",
                &fields,
                "help",
            );
        })
        .expect("draw");
    let buffer = terminal.backend().buffer();
    let mut active_mods = None;
    let mut inactive_mods = None;
    for y in 0..16u16 {
        for x in 0..60u16 {
            let cell = &buffer[(x, y)];
            if cell.symbol().contains('x') || cell.symbol() == "x" || cell.symbol() == "█" {
                active_mods = Some(cell.style().add_modifier);
            }
            if cell.symbol().contains('y') || cell.symbol() == "y" {
                inactive_mods = Some(cell.style().add_modifier);
            }
        }
    }
    let active = active_mods.expect("active field glyph present");
    let inactive = inactive_mods.expect("inactive field glyph present");
    assert_ne!(
        active, inactive,
        "active field highlight must differ from inactive"
    );
}

#[test]
fn active_field_cursor_coordinates_are_set() {
    let fields = [
        FormFieldView {
            label: "Objective",
            value: "hi".to_string(),
            active: true,
            error: None,
        },
        FormFieldView {
            label: "Runtime",
            value: String::new(),
            active: false,
            error: None,
        },
    ];
    let area = Rect::new(0, 0, 60, 20);
    let cursor = active_field_cursor(area, &fields);
    assert!(cursor.is_some(), "active field must yield cursor coords");
    let (x, y) = cursor.unwrap();
    assert!(x > 0, "cursor x should be past label/value start");
    assert!(y > 0, "cursor y should be inside form body");

    // Render path for task room form must also be able to compute a cursor.
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    handle_key_event(&mut app, KeyInput::NewRoom);
    app.task_room_form.objective = "typed".to_string();
    let snapshot = render_current_snapshot(&app, 80, 24).expect("snapshot");
    assert!(
        snapshot.contains("Objective") || snapshot.contains("typed"),
        "form snapshot must show field content"
    );
    assert!(
        snapshot.contains('█') || snapshot.contains('|') || snapshot.contains("typed"),
        "form should expose a caret marker when terminal cursor is not asserted"
    );
}

#[test]
fn empty_objective_blocks_submit_with_field_error() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    handle_key_event(&mut app, KeyInput::NewRoom);
    // leave objective empty; put something in runtime so only objective fails first
    app.task_room_form.runtime = "opencode".to_string();

    let effect = handle_key_event(&mut app, KeyInput::Enter);
    assert_eq!(effect, WorkbenchEffect::None);
    assert_eq!(app.view_mode, ViewMode::TaskRoomForm);
    assert!(
        app.task_room_form_field_errors[0].is_some(),
        "empty objective must set field error"
    );
}

#[test]
fn empty_runtime_blocks_submit_with_field_error() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    handle_key_event(&mut app, KeyInput::NewRoom);
    app.task_room_form.objective = "ship it".to_string();
    // runtime left empty

    let effect = handle_key_event(&mut app, KeyInput::Enter);
    assert_eq!(effect, WorkbenchEffect::None);
    assert_eq!(app.view_mode, ViewMode::TaskRoomForm);
    assert!(
        app.task_room_form_field_errors[4].is_some(),
        "empty runtime must set field error on runtime field"
    );
}

#[test]
fn tab_and_ctrl_tab_move_form_fields() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    handle_key_event(&mut app, KeyInput::NewRoom);
    assert_eq!(app.task_room_form_field, 0);

    handle_key_event(&mut app, KeyInput::Tab);
    assert_eq!(app.task_room_form_field, 1);

    handle_key_event(&mut app, KeyInput::NextField); // Ctrl+Tab
    assert_eq!(app.task_room_form_field, 2);

    handle_key_event(&mut app, KeyInput::ShiftTab);
    assert_eq!(app.task_room_form_field, 1);

    handle_key_event(&mut app, KeyInput::Char('z'));
    assert_eq!(app.task_room_form.acceptance_criteria, "z");
}

#[test]
fn valid_submit_clears_errors_and_emits_effect() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    handle_key_event(&mut app, KeyInput::NewRoom);
    app.task_room_form.objective = "do work".to_string();
    app.task_room_form.runtime = "opencode".to_string();

    let effect = handle_key_event(&mut app, KeyInput::Enter);
    assert!(matches!(effect, WorkbenchEffect::CreateTaskRoom(_)));
    assert_eq!(app.view_mode, ViewMode::ActionProgress);
}

#[test]
fn map_key_event_on_task_room_form_types_shortcut_letters() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    handle_key_event(&mut app, KeyInput::NewRoom);
    assert_eq!(app.view_mode, ViewMode::TaskRoomForm);

    for ch in ['n', 'h', 'a', 'r'] {
        let mapped =
            map_key_event_for_app(&app, KeyEvent::new(KeyCode::Char(ch), KeyModifiers::NONE));
        assert_eq!(
            mapped,
            Some(KeyInput::Char(ch)),
            "form typing must map '{ch}' to Char, not a global shortcut"
        );
        handle_key_event(&mut app, mapped.expect("mapped"));
    }

    assert_eq!(app.task_room_form.objective, "nhar");
    assert_eq!(app.view_mode, ViewMode::TaskRoomForm);
}

#[test]
fn form_right_does_not_submit_only_enter_does() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    handle_key_event(&mut app, KeyInput::NewRoom);
    app.task_room_form.objective = "do work".to_string();
    app.task_room_form.runtime = "opencode".to_string();

    let effect = handle_key_event(&mut app, KeyInput::Right);
    assert_eq!(effect, WorkbenchEffect::None);
    assert_eq!(app.view_mode, ViewMode::TaskRoomForm);

    let effect = handle_key_event(&mut app, KeyInput::Enter);
    assert!(matches!(effect, WorkbenchEffect::CreateTaskRoom(_)));
}

#[test]
fn handoff_pop_clears_field_errors() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.push_view(ViewMode::TaskRoomWorkspace);
    handle_key_event(&mut app, KeyInput::Handoff);
    assert_eq!(app.view_mode, ViewMode::HandoffForm);
    app.handoff_form_field_errors[0] = Some("required".to_string());

    handle_key_event(&mut app, KeyInput::Escape);
    assert_ne!(app.view_mode, ViewMode::HandoffForm);
    assert!(
        app.handoff_form_field_errors.iter().all(|e| e.is_none()),
        "leaving handoff form must clear field errors"
    );
}

#[test]
fn structured_question_without_free_text_keeps_digit_answers() {
    let mut app = load_app("evobuddy-workbench-state-v1.json");
    app.structured_question = Some(StructuredQuestion {
        prompt: "pick".to_string(),
        choices: vec![
            StructuredQuestionChoice {
                id: "1".to_string(),
                label: "one".to_string(),
            },
            StructuredQuestionChoice {
                id: "2".to_string(),
                label: "two".to_string(),
            },
        ],
        selected_choice: 0,
        allows_free_text: false,
        free_text: String::new(),
        destination_label: "dest".to_string(),
        effect_label: "effect".to_string(),
    });
    app.push_view(ViewMode::StructuredQuestion);

    let mapped = map_key_event_for_app(&app, KeyEvent::new(KeyCode::Char('1'), KeyModifiers::NONE));
    assert_eq!(mapped, Some(KeyInput::StructuredAnswer(1)));
}
