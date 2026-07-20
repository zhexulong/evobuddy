use ratatui::layout::Rect;
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::widgets::form_kit::{place_form_cursor, render_form, FormFieldView};

pub fn handoff_form_fields(app: &WorkbenchApp) -> Vec<FormFieldView> {
    let labels = [
        "Sender",
        "Receiver",
        "Body",
        "Artifact refs",
        "Expected next action",
        "Return destination",
    ];
    let values = [
        app.handoff_form.sender.clone(),
        app.handoff_form.receiver.clone(),
        app.handoff_form.body.clone(),
        app.handoff_form.artifact_refs.clone(),
        app.handoff_form.expected_next_action.clone(),
        app.handoff_form.return_destination.clone(),
    ];
    labels
        .into_iter()
        .zip(values)
        .enumerate()
        .map(|(index, (label, value))| FormFieldView {
            label,
            value,
            active: app.handoff_form_field == index,
            error: app
                .handoff_form_field_errors
                .get(index)
                .and_then(|err| err.clone()),
        })
        .collect()
}

pub fn render_handoff_form(frame: &mut Frame<'_>, app: &WorkbenchApp, area: Rect) {
    let fields = handoff_form_fields(app);
    render_form(
        frame,
        area,
        "Handoff Form",
        &fields,
        "Enter submit · Esc cancel · Tab/Ctrl+Tab next field · Shift+Tab previous",
    );
    place_form_cursor(frame, area, &fields);
}
