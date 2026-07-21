use ratatui::layout::Rect;
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::widgets::form_kit::{place_form_cursor, render_form, FormFieldView};

pub fn task_room_form_fields(app: &WorkbenchApp) -> Vec<FormFieldView> {
    vec![FormFieldView {
        label: "What should we do?",
        value: app.task_room_form.objective.clone(),
        active: true,
        error: app
            .task_room_form_field_errors
            .first()
            .and_then(|err| err.clone()),
    }]
}

pub fn render_task_room_form(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let fields = task_room_form_fields(app);
    let runtime = if app.task_room_form.runtime.is_empty() {
        "default"
    } else {
        app.task_room_form.runtime.as_str()
    };
    let help = format!(
        "Enter create · Esc cancel · Ctrl+C quit · title from text · runtime {runtime}"
    );
    render_form(frame, area, "New work", &fields, &help);
    place_form_cursor(frame, area, &fields);
}
