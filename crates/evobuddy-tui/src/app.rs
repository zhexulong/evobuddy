use crate::app_status::sort_by_status;
use crate::backend::AdapterActorKind;
use crate::model::{
    FocusedBuddy, RuntimeSetupEntry, TaskRoom, TeamAgent, UpdateItem, WorkbenchState,
};
use crate::views::ViewMode;

pub use crate::app_types::*;
pub use crate::app_status::HasStatus;

#[derive(Debug, Clone)]
pub struct WorkbenchApp {
    pub state: WorkbenchState,
    pub focus: FocusPane,
    pub selected_actor: Option<SelectedActor>,
    pub selected_task_room: usize,
    pub selected_runtime_setup: usize,
    pub selected_update: usize,
    pub team_agents_collapsed: bool,
    pub focused_buddies_collapsed: bool,
    pub task_rooms_collapsed: bool,
    pub updates_collapsed: bool,
    pub view_mode: ViewMode,
    pub back_stack: Vec<ViewMode>,
    pub search_query: String,
    pub command_query: String,
    pub selected_command: usize,
    pub task_room_form: CreateTaskRoomDraft,
    pub task_room_form_field: usize,
    pub handoff_form: CreateHandoffDraft,
    pub handoff_form_field: usize,
    pub structured_question: Option<StructuredQuestion>,
    pub pending_confirmation: Option<PendingConfirmation>,
    pub action_status: Option<String>,
    pub durable_writes: Vec<String>,
}

impl WorkbenchApp {

    pub fn new(state: WorkbenchState) -> Self {
        let selected_actor = if !state.actors.team_agents.is_empty() {
            Some(SelectedActor::TeamAgent(0))
        } else if !state.actors.focused_buddies.is_empty() {
            Some(SelectedActor::FocusedBuddy(0))
        } else {
            None
        };
        Self {
            state,
            focus: FocusPane::TaskRooms,
            selected_actor,
            selected_task_room: 0,
            selected_runtime_setup: 0,
            selected_update: 0,
            team_agents_collapsed: false,
            focused_buddies_collapsed: false,
            task_rooms_collapsed: false,
            updates_collapsed: false,
            view_mode: ViewMode::Dashboard,
            back_stack: Vec::new(),
            search_query: String::new(),
            command_query: String::new(),
            selected_command: 0,
            task_room_form: CreateTaskRoomDraft {
                objective: String::new(),
                acceptance_criteria: String::new(),
                workspace: String::new(),
                actor: String::new(),
                runtime: String::new(),
                safety_mode: String::new(),
            },
            task_room_form_field: 0,
            handoff_form: CreateHandoffDraft {
                sender: String::new(),
                receiver: String::new(),
                body: String::new(),
                artifact_refs: String::new(),
                expected_next_action: String::new(),
                return_destination: String::new(),
            },
            handoff_form_field: 0,
            structured_question: None,
            pending_confirmation: None,
            action_status: None,
            durable_writes: Vec::new(),
        }
    }

    pub fn summary_line(&self) -> String {
        format!(
            "TaskRoom workspace · {} agents · {} focused buddies · {} task rooms · {}",
            self.state.actors.team_agents.len(),
            self.state.actors.focused_buddies.len(),
            self.state.task_rooms.len(),
            self.codex_status_summary()
        )
    }

    pub fn sorted_team_agents(&self) -> Vec<&TeamAgent> {
        sort_by_status(self.state.actors.team_agents.iter().collect())
    }

    pub fn sorted_focused_buddies(&self) -> Vec<&FocusedBuddy> {
        sort_by_status(self.state.actors.focused_buddies.iter().collect())
    }

    pub fn sorted_task_rooms(&self) -> Vec<&TaskRoom> {
        sort_by_status(self.state.task_rooms.iter().collect())
    }

    pub fn runtime_setup(&self) -> &[RuntimeSetupEntry] {
        &self.state.runtime_setup
    }

    pub fn updates(&self) -> &[UpdateItem] {
        &self.state.updates
    }

    pub fn selected_actor_lines(&self) -> Vec<String> {
        match self.selected_actor {
            Some(SelectedActor::TeamAgent(index)) => self
                .state
                .actors
                .team_agents
                .get(index)
                .map(|actor| {
                    vec![
                        actor.display_name.clone(),
                        format!("Role: {}", actor.role),
                        format!("Status: {}", actor.status.as_label()),
                        format!("Rooms: {}", actor.task_room_ids.len()),
                    ]
                })
                .unwrap_or_else(|| vec!["No selection".to_string()]),
            Some(SelectedActor::FocusedBuddy(index)) => self
                .state
                .actors
                .focused_buddies
                .get(index)
                .map(|buddy| {
                    vec![
                        buddy.display_name.clone(),
                        format!("Routing: {}", buddy.routing_summary),
                        format!("Status: {}", buddy.status.as_label()),
                        format!("Runtimes: {}", buddy.runtime_surfaces.join(", ")),
                    ]
                })
                .unwrap_or_else(|| vec!["No selection".to_string()]),
            None => vec!["No selection".to_string()],
        }
    }

    pub fn selected_task_room(&self) -> Option<&TaskRoom> {
        self.sorted_task_rooms()
            .get(self.selected_task_room)
            .copied()
    }

    pub fn selected_task_room_lines(&self) -> Vec<String> {
        let Some(room) = self.selected_task_room() else {
            return vec!["No TaskRoom selected".to_string()];
        };
        let mut lines = vec![
            room.title.clone(),
            format!("{} · {}", room.status.as_label(), room.runtime),
        ];
        if let Some(attention) = &room.attention {
            lines.push(format!(
                "Attention: {} via {}",
                attention.state, attention.source_kind
            ));
        }
        if !room.objective.is_empty() {
            lines.push("Objective".to_string());
            lines.push(room.objective.clone());
        }
        if !room.acceptance_criteria.is_empty() {
            lines.push("Acceptance".to_string());
            lines.push(room.acceptance_criteria.clone());
        }
        lines
    }

    pub fn selected_task_room_action_lines(&self) -> Vec<String> {
        let actions = self.selected_runtime_actions();
        if actions.is_empty() {
            return vec!["No actions available".to_string()];
        }
        actions
            .iter()
            .map(|action| {
                if action.enabled {
                    format!("• {}", action.label)
                } else {
                    format!(
                        "• {} ({})",
                        action.label,
                        action
                            .disabled_reason
                            .as_deref()
                            .unwrap_or("currently unavailable")
                    )
                }
            })
            .collect()
    }

    pub fn selected_runtime_actions(&self) -> Vec<crate::model::ActionAvailability> {
        let Some(room) = self.selected_task_room() else {
            return Vec::new();
        };
        if !room.available_actions.is_empty()
            && room
                .available_actions
                .iter()
                .any(|action| action.id != "open-native-runtime")
        {
            return room.available_actions.clone();
        }
        let capability = self
            .state
            .runtime_capabilities
            .iter()
            .find(|entry| entry.runtime == room.runtime);
        let session = self
            .state
            .native_sessions
            .iter()
            .find(|entry| entry.room_id == room.id);
        let recovery = crate::runtime_actions::classify_recovery(
            true,
            session,
            room.attention.as_ref().map(|item| item.state.as_str()),
            capability
                .map(|item| item.exact_resume_supported)
                .unwrap_or(false),
            false,
        );
        crate::runtime_actions::derive_runtime_session_actions(
            &crate::runtime_actions::RuntimeActionContext {
                room,
                capability,
                session,
                provider_conversation_ref_validated: false,
                heuristic_candidate_count: if capability
                    .map(|item| item.heuristic_resume_supported)
                    .unwrap_or(false)
                {
                    1
                } else {
                    0
                },
                substrate_available: true,
                recovery: &recovery,
            },
        )
    }

    pub fn evidence_action_summary_line(&self) -> String {
        let labels: Vec<String> = self
            .selected_runtime_actions()
            .into_iter()
            .map(|action| action.label)
            .collect();
        if labels.is_empty() {
            "Actions: none".to_string()
        } else {
            format!("Actions: {}", labels.join(" · "))
        }
    }

    pub fn recovery_diagnostic_lines(&self) -> Vec<String> {
        let Some(room) = self.selected_task_room() else {
            return Vec::new();
        };
        let capability = self
            .state
            .runtime_capabilities
            .iter()
            .find(|entry| entry.runtime == room.runtime);
        let session = self
            .state
            .native_sessions
            .iter()
            .find(|entry| entry.room_id == room.id);
        crate::runtime_actions::classify_recovery(
            true,
            session,
            room.attention.as_ref().map(|item| item.state.as_str()),
            capability
                .map(|item| item.exact_resume_supported)
                .unwrap_or(false),
            false,
        )
        .into_iter()
        .map(|item| item.label().to_string())
        .collect()
    }

    pub fn status_bar_text(&self) -> String {
        let contextual = if self.focus == FocusPane::TaskRooms {
            self.selected_runtime_actions()
                .into_iter()
                .find(|action| action.enabled)
                .map(|action| action.label)
                .unwrap_or_else(|| "No room actions".to_string())
        } else if self.selected_actor_can_start_adapter_task() {
            "Start adapter task".to_string()
        } else {
            "Inspect selection".to_string()
        };

        format!(
            "[/ search] [: commands] [Enter open] [Esc back] [n new room] [a {}] [? help]",
            contextual
        )
    }

    pub fn selected_actor_label(&self) -> String {
        match self
            .selected_actor
            .and_then(|selected| self.actor_label(selected))
        {
            Some(label) => label,
            None => "No selection".to_string(),
        }
    }

    pub fn selected_actor_task_rooms(&self) -> Vec<&TaskRoom> {
        match self.selected_actor {
            Some(SelectedActor::TeamAgent(index)) => self
                .state
                .actors
                .team_agents
                .get(index)
                .map(|actor| {
                    self.state
                        .task_rooms
                        .iter()
                        .filter(|room| actor.task_room_ids.iter().any(|id| id == &room.id))
                        .collect()
                })
                .unwrap_or_default(),
            Some(SelectedActor::FocusedBuddy(index)) => self
                .state
                .actors
                .focused_buddies
                .get(index)
                .map(|buddy| {
                    self.state
                        .task_rooms
                        .iter()
                        .filter(|room| {
                            room.participants
                                .iter()
                                .any(|participant| participant.id == buddy.id)
                        })
                        .collect()
                })
                .unwrap_or_default(),
            None => Vec::new(),
        }
    }

    pub fn selected_actor_can_start_adapter_task(&self) -> bool {
        self.selected_actor_adapter_kind().is_some()
    }

    pub fn selected_actor_adapter_kind(&self) -> Option<AdapterActorKind> {
        match self.selected_actor {
            Some(SelectedActor::TeamAgent(_)) => Some(AdapterActorKind::TeamAgent),
            Some(SelectedActor::FocusedBuddy(_)) => Some(AdapterActorKind::FocusedBuddy),
            None => None,
        }
    }










    pub fn codex_status_summary(&self) -> String {
        self.state
            .runtime_setup
            .iter()
            .find(|entry| entry.runtime == "Codex")
            .map(|entry| format!("Codex {}", entry.status.as_label()))
            .unwrap_or_else(|| "Codex unknown".to_string())
    }
}
