use ratatui::layout::Rect;
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::widgets::form_kit::{place_form_cursor, render_form, FormFieldView};

pub fn task_room_form_fields(app: &WorkbenchApp) -> Vec<FormFieldView> {
    let labels = [
        "Objective",
        "Acceptance criteria",
        "Workspace",
        "Actor",
        "Runtime",
        "Safety mode",
    ];
    let values = [
        app.task_room_form.objective.clone(),
        app.task_room_form.acceptance_criteria.clone(),
        app.task_room_form.workspace.clone(),
        app.task_room_form.actor.clone(),
        app.task_room_form.runtime.clone(),
        app.task_room_form.safety_mode.clone(),
    ];
    labels
        .into_iter()
        .zip(values)
        .enumerate()
        .map(|(index, (label, value))| FormFieldView {
            label,
            value,
            active: app.task_room_form_field == index,
            error: app
                .task_room_form_field_errors
                .get(index)
                .and_then(|err| err.clone()),
        })
        .collect()
}

pub fn render_task_room_form(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let fields = task_room_form_fields(app);
    render_form(
        frame,
        area,
        "TaskRoom Form",
        &fields,
        "Enter submit · Esc cancel · Tab/Ctrl+Tab next field · Shift+Tab previous",
    );
    place_form_cursor(frame, area, &fields);
}
