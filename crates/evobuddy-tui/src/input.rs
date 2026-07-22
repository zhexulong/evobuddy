use crate::app::{FocusPane, SelectedActor, WorkbenchApp, WorkbenchEffect};
use crate::views::{DetailView, ViewMode};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyInput {
    Up,
    Down,
    Left,
    Right,
    Enter,
    Escape,
    Tab,
    ShiftTab,
    Search,
    Commands,
    Help,
    Actions,
    NewRoom,
    Handoff,
    NextField,
    RuntimeSetup,
    Trace,
    Updates,
    ToggleTaskRooms,
    ToggleUpdates,
    Quit,
    StructuredAnswer(u8),
    Char(char),
}

pub fn handle_key_event(app: &mut WorkbenchApp, input: KeyInput) -> WorkbenchEffect {
    match input {
        KeyInput::Tab => {
            app.focus = next_focus(app.focus);
            WorkbenchEffect::None
        }
        KeyInput::ShiftTab => {
            app.focus = previous_focus(app.focus);
            WorkbenchEffect::None
        }
        KeyInput::Up => {
            move_selection(app, -1);
            WorkbenchEffect::None
        }
        KeyInput::Down => {
            move_selection(app, 1);
            WorkbenchEffect::None
        }
        KeyInput::Enter | KeyInput::Right => {
            if app.view_mode == ViewMode::ConfirmAction {
                app.confirm_pending_action()
            } else if app.view_mode == ViewMode::TaskRoomForm {
                app.submit_task_room_form()
            } else if app.view_mode == ViewMode::HandoffForm {
                app.submit_handoff_form()
            } else if app.view_mode == ViewMode::StructuredQuestion {
                let index = app
                    .structured_question
                    .as_ref()
                    .map(|question| question.selected_choice)
                    .unwrap_or(0);
                app.submit_structured_answer(index)
            } else if app.view_mode == ViewMode::CommandPalette {
                app.execute_selected_command()
            } else if app.focus == FocusPane::TeamBuddies {
                match app.selected_actor {
                    Some(SelectedActor::FocusedBuddy(_)) => {
                        app.push_view(ViewMode::FocusedBuddyWorkspace)
                    }
                    _ => app.push_view(ViewMode::TeamMemberWorkspace),
                }
                WorkbenchEffect::None
            } else if app.focus == FocusPane::TaskRooms {
                app.push_view(ViewMode::TaskRoomWorkspace);
                WorkbenchEffect::None
            } else {
                app.push_view(ViewMode::Detail(app.current_detail_view()));
                WorkbenchEffect::None
            }
        }
        KeyInput::Left | KeyInput::Escape => {
            if app.view_mode == ViewMode::ConfirmAction {
                app.cancel_pending_confirmation();
            } else {
                app.pop_view();
            }
            WorkbenchEffect::None
        }
        KeyInput::Search => {
            app.search_query.clear();
            app.push_view(ViewMode::Search);
            WorkbenchEffect::None
        }
        KeyInput::Commands => {
            app.command_query.clear();
            app.selected_command = 0;
            app.push_view(ViewMode::CommandPalette);
            WorkbenchEffect::None
        }
        KeyInput::Help => {
            app.push_view(ViewMode::Help);
            WorkbenchEffect::None
        }
        KeyInput::Actions => {
            if matches!(
                app.view_mode,
                ViewMode::Dashboard | ViewMode::TaskRoomWorkspace
            ) {
                app.open_native_runtime_effect()
            } else {
                WorkbenchEffect::None
            }
        }
        KeyInput::NewRoom => {
            app.open_task_room_form();
            WorkbenchEffect::None
        }
        KeyInput::Handoff => {
            if app.view_mode == ViewMode::TaskRoomWorkspace {
                app.open_handoff_form();
            }
            WorkbenchEffect::None
        }
        KeyInput::NextField => {
            app.advance_active_form_field();
            WorkbenchEffect::None
        }
        KeyInput::RuntimeSetup => {
            app.focus = FocusPane::RuntimeSetup;
            app.push_view(ViewMode::Detail(DetailView::RuntimeSetup));
            WorkbenchEffect::None
        }
        KeyInput::Trace => {
            app.push_view(ViewMode::TraceDrawer);
            WorkbenchEffect::None
        }
        KeyInput::Updates => {
            app.focus = FocusPane::Updates;
            app.push_view(ViewMode::Detail(DetailView::Updates));
            WorkbenchEffect::None
        }
        KeyInput::ToggleTaskRooms => {
            app.task_rooms_collapsed = !app.task_rooms_collapsed;
            WorkbenchEffect::None
        }
        KeyInput::ToggleUpdates => {
            app.updates_collapsed = !app.updates_collapsed;
            WorkbenchEffect::None
        }
        KeyInput::StructuredAnswer(choice) => {
            app.submit_structured_answer(choice.saturating_sub(1) as usize)
        }
        KeyInput::Char(ch) => {
            if app.view_mode == ViewMode::CommandPalette {
                app.command_query.push(ch);
                app.selected_command = 0;
            } else if app.view_mode == ViewMode::Search {
                app.search_query.push(ch);
                if let Some(first) = app.filtered_actor_entries().first().copied() {
                    app.selected_actor = Some(first);
                }
            } else if matches!(
                app.view_mode,
                ViewMode::TaskRoomForm | ViewMode::HandoffForm | ViewMode::StructuredQuestion
            ) {
                app.append_to_active_input(ch);
            }
            WorkbenchEffect::None
        }
        KeyInput::Quit => WorkbenchEffect::None,
    }
}

fn move_selection(app: &mut WorkbenchApp, delta: isize) {
    match app.focus {
        FocusPane::TeamBuddies => app.select_next_actor(delta),
        FocusPane::TaskRooms => {
            let max = app.state.task_rooms.len().saturating_sub(1) as isize;
            app.selected_task_room =
                (app.selected_task_room as isize + delta).clamp(0, max) as usize;
        }
        FocusPane::RuntimeSetup => {
            let max = app.state.runtime_setup.len().saturating_sub(1) as isize;
            app.selected_runtime_setup =
                (app.selected_runtime_setup as isize + delta).clamp(0, max) as usize;
        }
        FocusPane::Updates => {
            let max = app.state.updates.len().saturating_sub(1) as isize;
            app.selected_update = (app.selected_update as isize + delta).clamp(0, max) as usize;
        }
    }
}

fn next_focus(current: FocusPane) -> FocusPane {
    match current {
        FocusPane::TeamBuddies => FocusPane::TaskRooms,
        FocusPane::TaskRooms => FocusPane::RuntimeSetup,
        FocusPane::RuntimeSetup => FocusPane::Updates,
        FocusPane::Updates => FocusPane::TeamBuddies,
    }
}

fn previous_focus(current: FocusPane) -> FocusPane {
    match current {
        FocusPane::TeamBuddies => FocusPane::Updates,
        FocusPane::TaskRooms => FocusPane::TeamBuddies,
        FocusPane::RuntimeSetup => FocusPane::TaskRooms,
        FocusPane::Updates => FocusPane::RuntimeSetup,
    }
}
