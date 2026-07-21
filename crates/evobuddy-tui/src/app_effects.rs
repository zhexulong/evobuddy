use crate::app::WorkbenchApp;
use crate::app_types::*;
use crate::views::{DetailView, ViewMode};

impl WorkbenchApp {
    pub fn request_confirmation(&mut self, pending: PendingConfirmation) -> WorkbenchEffect {
        self.pending_confirmation = Some(pending.clone());
        self.action_status = Some(format!(
            "confirm {} · target {}",
            pending.effect_label, pending.target
        ));
        self.push_view(ViewMode::ConfirmAction);
        WorkbenchEffect::RequestConfirmation(pending)
    }
    pub fn confirm_pending_action(&mut self) -> WorkbenchEffect {
        let Some(pending) = self.pending_confirmation.take() else {
            return WorkbenchEffect::None;
        };
        self.action_status = Some(format!("{} confirmed", pending.effect_label.to_lowercase()));
        self.push_view(ViewMode::ActionProgress);
        match pending.action {
            ConfirmedAction::CreateTaskRoom(draft) => WorkbenchEffect::CreateTaskRoom(draft),
            ConfirmedAction::CreateHandoff(draft) => WorkbenchEffect::CreateHandoff(draft),
            ConfirmedAction::AddParticipant {
                room_id,
                participant_id,
                actor_name,
                actor_kind,
                role,
                runtime,
            } => WorkbenchEffect::AddParticipant {
                room_id,
                participant_id,
                actor_name,
                actor_kind,
                role,
                runtime,
            },
            ConfirmedAction::StopSession {
                room_id,
                instance_id,
            } => WorkbenchEffect::StopSession {
                room_id,
                instance_id,
            },
            ConfirmedAction::ArchiveTaskRoom { room_id } => {
                WorkbenchEffect::ArchiveTaskRoom { room_id }
            }
        }
    }
    pub fn cancel_pending_confirmation(&mut self) {
        self.pending_confirmation = None;
        if self.view_mode == ViewMode::ConfirmAction {
            self.pop_view();
        }
    }
    pub fn request_stop_session(&mut self, room_id: &str, instance_id: &str) -> WorkbenchEffect {
        self.request_confirmation(PendingConfirmation {
            target: format!("session {instance_id} in room {room_id}"),
            effect_label: "Stop Session".to_string(),
            action: ConfirmedAction::StopSession {
                room_id: room_id.to_string(),
                instance_id: instance_id.to_string(),
            },
        })
    }
    pub fn request_archive_task_room(&mut self, room_id: &str) -> WorkbenchEffect {
        self.request_confirmation(PendingConfirmation {
            target: format!("taskroom {room_id}"),
            effect_label: "Archive TaskRoom".to_string(),
            action: ConfirmedAction::ArchiveTaskRoom {
                room_id: room_id.to_string(),
            },
        })
    }
    pub fn execute_selected_command(&mut self) -> WorkbenchEffect {
        let Some(command) = self.visible_commands().get(self.selected_command).cloned() else {
            return WorkbenchEffect::None;
        };
        self.execute_command(command.command)
    }
    pub fn execute_command(&mut self, command: DeterministicCommand) -> WorkbenchEffect {
        match command {
            DeterministicCommand::OpenSelectedTaskRoom => self.open_native_runtime_effect(),
            DeterministicCommand::ShowHandoffs => {
                self.push_view(ViewMode::Detail(DetailView::TaskRoom));
                WorkbenchEffect::ExecuteCommand(DeterministicCommand::ShowHandoffs)
            }
            DeterministicCommand::FilterBlocked => {
                self.search_query = "blocked".to_string();
                self.push_view(ViewMode::Search);
                WorkbenchEffect::ExecuteCommand(DeterministicCommand::FilterBlocked)
            }
            DeterministicCommand::ShowRuntimeSetup => {
                self.focus = FocusPane::RuntimeSetup;
                self.push_view(ViewMode::Detail(DetailView::RuntimeSetup));
                WorkbenchEffect::ExecuteCommand(DeterministicCommand::ShowRuntimeSetup)
            }
            DeterministicCommand::CreateTaskRoom => {
                self.open_task_room_form();
                WorkbenchEffect::ExecuteCommand(DeterministicCommand::CreateTaskRoom)
            }
            DeterministicCommand::CreateHandoff => {
                self.open_handoff_form();
                WorkbenchEffect::ExecuteCommand(DeterministicCommand::CreateHandoff)
            }
            DeterministicCommand::OpenTrace => {
                self.push_view(ViewMode::TraceDrawer);
                WorkbenchEffect::ExecuteCommand(DeterministicCommand::OpenTrace)
            }
        }
    }
    pub fn open_native_runtime_effect(&mut self) -> WorkbenchEffect {
        let Some(room) = self.selected_task_room() else {
            return WorkbenchEffect::None;
        };
        let Some(action) = room.available_actions.iter().find(|action| action.enabled) else {
            return WorkbenchEffect::None;
        };
        let room_id = room.id.clone();
        let label = action.label.clone();
        let instance_id = room
            .participants
            .first()
            .map(|participant| participant.id.clone())
            .unwrap_or_default();
        self.action_status = Some(format!("attaching… ({})", label.to_lowercase()));
        self.push_view(ViewMode::ActionProgress);
        WorkbenchEffect::OpenNativeRuntime {
            room_id,
            instance_id,
        }
    }
    pub fn visible_commands(&self) -> Vec<CommandEntry> {
        let query = self.command_query.trim().to_lowercase();
        command_registry()
            .into_iter()
            .filter(|command| query.is_empty() || command.label.contains(&query))
            .collect()
    }
}

fn command_registry() -> Vec<CommandEntry> {
    vec![
        CommandEntry {
            label: "open selected agent",
            command: DeterministicCommand::OpenSelectedTaskRoom,
        },
        CommandEntry {
            label: "attach selected task room",
            command: DeterministicCommand::OpenSelectedTaskRoom,
        },
        CommandEntry {
            label: "show handoffs",
            command: DeterministicCommand::ShowHandoffs,
        },
        CommandEntry {
            label: "filter blocked",
            command: DeterministicCommand::FilterBlocked,
        },
        CommandEntry {
            label: "show runtime setup",
            command: DeterministicCommand::ShowRuntimeSetup,
        },
        CommandEntry {
            label: "create taskroom",
            command: DeterministicCommand::CreateTaskRoom,
        },
        CommandEntry {
            label: "create handoff",
            command: DeterministicCommand::CreateHandoff,
        },
        CommandEntry {
            label: "open trace",
            command: DeterministicCommand::OpenTrace,
        },
    ]
}

