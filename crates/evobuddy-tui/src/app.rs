use crate::backend::AdapterActorKind;
use crate::model::{
    ActorStatus, FocusedBuddy, RuntimeSetupEntry, RuntimeSetupStatus, TaskRoom, TaskRoomStatus,
    TeamAgent, UpdateItem, WorkbenchState,
};
use crate::views::{DetailView, ViewMode};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FocusPane {
    TeamBuddies,
    TaskRooms,
    RuntimeSetup,
    Updates,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SelectedActor {
    TeamAgent(usize),
    FocusedBuddy(usize),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandEntry {
    pub label: &'static str,
    pub command: DeterministicCommand,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchResult {
    pub kind: &'static str,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateTaskRoomDraft {
    pub objective: String,
    pub acceptance_criteria: String,
    pub workspace: String,
    pub actor: String,
    pub runtime: String,
    pub safety_mode: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateHandoffDraft {
    pub sender: String,
    pub receiver: String,
    pub body: String,
    pub artifact_refs: String,
    pub expected_next_action: String,
    pub return_destination: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StructuredQuestionChoice {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StructuredQuestion {
    pub prompt: String,
    pub choices: Vec<StructuredQuestionChoice>,
    pub selected_choice: usize,
    pub allows_free_text: bool,
    pub free_text: String,
    pub destination_label: String,
    pub effect_label: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeterministicCommand {
    OpenSelectedTaskRoom,
    ShowHandoffs,
    FilterBlocked,
    ShowRuntimeSetup,
    CreateTaskRoom,
    CreateHandoff,
    OpenTrace,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WorkbenchEffect {
    None,
    CreateTaskRoom(CreateTaskRoomDraft),
    CreateHandoff(CreateHandoffDraft),
    ExecuteCommand(DeterministicCommand),
    AnswerQuestion(String),
    OpenNativeRuntime {
        room_id: String,
        instance_id: String,
    },
    RefreshEvidence {
        room_id: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SelectionSnapshot {
    pub focus: FocusPane,
    pub selected_actor: Option<SelectedActor>,
    pub selected_task_room: usize,
    pub selected_runtime_setup: usize,
    pub selected_update: usize,
    pub view_mode: ViewMode,
    pub back_stack: Vec<ViewMode>,
    pub selected_task_room_id: Option<String>,
    pub selected_participant_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NativeOpenContext {
    pub project_root: String,
    pub room_id: String,
    pub agent_instance_id: String,
    pub participant_name: String,
    pub runtime: String,
    pub workspace: String,
    pub safety_mode: String,
    pub terminal_session_ref: Option<String>,
}

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
    pub task_room_form_field_errors: [Option<String>; 6],
    pub handoff_form: CreateHandoffDraft,
    pub handoff_form_field: usize,
    pub handoff_form_field_errors: [Option<String>; 6],
    pub structured_question: Option<StructuredQuestion>,
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
            task_room_form_field_errors: [None, None, None, None, None, None],
            handoff_form: CreateHandoffDraft {
                sender: String::new(),
                receiver: String::new(),
                body: String::new(),
                artifact_refs: String::new(),
                expected_next_action: String::new(),
                return_destination: String::new(),
            },
            handoff_form_field: 0,
            handoff_form_field_errors: [None, None, None, None, None, None],
            structured_question: None,
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
            lines.push("Work".to_string());
            lines.push(room.objective.clone());
        }
        if !room.acceptance_criteria.is_empty() {
            lines.push("Done when".to_string());
            lines.push(room.acceptance_criteria.clone());
        }
        lines
    }

    pub fn selected_task_room_action_lines(&self) -> Vec<String> {
        let Some(room) = self.selected_task_room() else {
            return vec!["No actions available".to_string()];
        };
        if room.available_actions.is_empty() {
            return vec!["No actions available".to_string()];
        }
        room.available_actions
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

    pub fn status_bar_text(&self) -> String {
        let contextual = if self.focus == FocusPane::TaskRooms {
            self.selected_task_room()
                .map(|room| {
                    room.available_actions
                        .iter()
                        .find(|action| action.enabled)
                        .map(|action| action.label.clone())
                        .unwrap_or_else(|| "No room actions".to_string())
                })
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

    pub fn visible_commands(&self) -> Vec<CommandEntry> {
        let query = self.command_query.trim().to_lowercase();
        command_registry()
            .into_iter()
            .filter(|command| query.is_empty() || command.label.contains(&query))
            .collect()
    }

    pub fn open_task_room_form(&mut self) {
        self.task_room_form = CreateTaskRoomDraft {
            objective: String::new(),
            acceptance_criteria: String::new(),
            workspace: self.state.project_root.clone(),
            actor: String::new(),
            runtime: default_runtime_for_create(&self.state),
            safety_mode: "workspace-write".to_string(),
        };
        self.task_room_form_field = 0;
        self.task_room_form_field_errors = [None, None, None, None, None, None];
        self.push_view(ViewMode::TaskRoomForm);
    }

    pub fn open_handoff_form(&mut self) {
        self.handoff_form = CreateHandoffDraft {
            sender: String::new(),
            receiver: String::new(),
            body: String::new(),
            artifact_refs: String::new(),
            expected_next_action: String::new(),
            return_destination: String::new(),
        };
        self.handoff_form_field = 0;
        self.handoff_form_field_errors = [None, None, None, None, None, None];
        self.push_view(ViewMode::HandoffForm);
    }

    pub fn advance_active_form_field(&mut self) {
        match self.view_mode {
            ViewMode::TaskRoomForm => {
                self.task_room_form_field = 0;
            }
            ViewMode::HandoffForm => {
                self.handoff_form_field = (self.handoff_form_field + 1).min(5);
            }
            _ => {}
        }
    }

    pub fn reverse_active_form_field(&mut self) {
        match self.view_mode {
            ViewMode::TaskRoomForm => {
                self.task_room_form_field = 0;
            }
            ViewMode::HandoffForm => {
                self.handoff_form_field = self.handoff_form_field.saturating_sub(1);
            }
            _ => {}
        }
    }

    pub fn append_to_active_input(&mut self, ch: char) {
        match self.view_mode {
            ViewMode::TaskRoomForm => {
                if let Some(err) = self
                    .task_room_form_field_errors
                    .get_mut(self.task_room_form_field)
                {
                    *err = None;
                }
                self.task_room_form_field = 0;
                self.task_room_form.objective.push(ch);
            }
            ViewMode::HandoffForm => {
                if let Some(err) = self
                    .handoff_form_field_errors
                    .get_mut(self.handoff_form_field)
                {
                    *err = None;
                }
                match self.handoff_form_field {
                    0 => self.handoff_form.sender.push(ch),
                    1 => self.handoff_form.receiver.push(ch),
                    2 => self.handoff_form.body.push(ch),
                    3 => self.handoff_form.artifact_refs.push(ch),
                    4 => self.handoff_form.expected_next_action.push(ch),
                    5 => self.handoff_form.return_destination.push(ch),
                    _ => {}
                }
            }
            ViewMode::StructuredQuestion => {
                if let Some(question) = &mut self.structured_question {
                    if question.allows_free_text {
                        question.free_text.push(ch);
                    }
                }
            }
            _ => {}
        }
    }

    pub fn pop_active_input(&mut self) {
        match self.view_mode {
            ViewMode::TaskRoomForm => {
                if let Some(err) = self
                    .task_room_form_field_errors
                    .get_mut(self.task_room_form_field)
                {
                    *err = None;
                }
                self.task_room_form_field = 0;
                self.task_room_form.objective.pop();
            }
            ViewMode::HandoffForm => match self.handoff_form_field {
                0 => {
                    self.handoff_form.sender.pop();
                }
                1 => {
                    self.handoff_form.receiver.pop();
                }
                2 => {
                    self.handoff_form.body.pop();
                }
                3 => {
                    self.handoff_form.artifact_refs.pop();
                }
                4 => {
                    self.handoff_form.expected_next_action.pop();
                }
                5 => {
                    self.handoff_form.return_destination.pop();
                }
                _ => {}
            },
            ViewMode::StructuredQuestion => {
                if let Some(question) = &mut self.structured_question {
                    if question.allows_free_text {
                        question.free_text.pop();
                    }
                }
            }
            ViewMode::CommandPalette => {
                self.command_query.pop();
            }
            ViewMode::Search => {
                self.search_query.pop();
            }
            _ => {}
        }
    }

    pub fn submit_task_room_form(&mut self) -> WorkbenchEffect {
        self.task_room_form_field_errors = [None, None, None, None, None, None];
        if self.task_room_form.objective.trim().is_empty() {
            self.task_room_form_field_errors[0] =
                Some("Describe the work (required)".to_string());
            return WorkbenchEffect::None;
        }
        if self.task_room_form.runtime.trim().is_empty() {
            self.task_room_form.runtime = default_runtime_for_create(&self.state);
        }
        if self.task_room_form.workspace.trim().is_empty() {
            self.task_room_form.workspace = self.state.project_root.clone();
        }
        if self.task_room_form.safety_mode.trim().is_empty() {
            self.task_room_form.safety_mode = "workspace-write".to_string();
        }
        if self.task_room_form.runtime.trim().is_empty() {
            self.task_room_form_field_errors[0] =
                Some("No runtime available — fix project runtime setup".to_string());
            return WorkbenchEffect::None;
        }
        let draft = self.task_room_form.clone();
        self.action_status = Some("creating TaskRoom…".to_string());
        self.push_view(ViewMode::ActionProgress);
        WorkbenchEffect::CreateTaskRoom(draft)
    }

    pub fn submit_handoff_form(&mut self) -> WorkbenchEffect {
        self.handoff_form_field_errors = [None, None, None, None, None, None];
        let mut invalid = false;
        if self.handoff_form.sender.trim().is_empty() {
            self.handoff_form_field_errors[0] = Some("Sender is required".to_string());
            invalid = true;
        }
        if self.handoff_form.receiver.trim().is_empty() {
            self.handoff_form_field_errors[1] = Some("Receiver is required".to_string());
            invalid = true;
        }
        if self.handoff_form.body.trim().is_empty() {
            self.handoff_form_field_errors[2] = Some("Body is required".to_string());
            invalid = true;
        }
        if invalid {
            return WorkbenchEffect::None;
        }
        let draft = self.handoff_form.clone();
        self.action_status = Some("creating handoff…".to_string());
        self.push_view(ViewMode::ActionProgress);
        WorkbenchEffect::CreateHandoff(draft)
    }

    pub fn submit_structured_answer(&mut self, index: usize) -> WorkbenchEffect {
        let Some(question) = &self.structured_question else {
            return WorkbenchEffect::None;
        };
        let answer = question
            .choices
            .get(index)
            .map(|choice| choice.id.clone())
            .or_else(|| {
                if question.allows_free_text && !question.free_text.is_empty() {
                    Some(question.free_text.clone())
                } else {
                    None
                }
            });
        let Some(answer) = answer else {
            return WorkbenchEffect::None;
        };
        self.action_status = Some("structured answer recorded".to_string());
        self.push_view(ViewMode::ActionProgress);
        WorkbenchEffect::AnswerQuestion(answer)
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
        self.action_status = Some(format!("opening {label}…"));
        WorkbenchEffect::OpenNativeRuntime {
            room_id,
            instance_id,
        }
    }

    pub fn present_continuation_choice(&mut self, plan: &crate::session::RuntimeSessionOpenPlan) {
        let choices = plan
            .continuation
            .candidates
            .iter()
            .map(|candidate| StructuredQuestionChoice {
                id: candidate.candidate_id.clone(),
                label: candidate.label.clone(),
            })
            .collect::<Vec<_>>();
        let count = choices.len();
        self.structured_question = Some(StructuredQuestion {
            prompt: format!(
                "Choose continuation ({} candidate{})",
                count,
                if count == 1 { "" } else { "s" }
            ),
            choices,
            selected_choice: 0,
            allows_free_text: false,
            free_text: String::new(),
            destination_label: format!(
                "{} · {}",
                plan.intent.runtime, plan.intent.agent_instance_id
            ),
            effect_label: "Resume with selected candidate".to_string(),
        });
        if self.view_mode == ViewMode::ActionProgress {
            self.pop_view();
        }
        self.push_view(ViewMode::StructuredQuestion);
        self.action_status = Some(format!(
            "choose continuation ({} candidates)",
            plan.continuation.candidate_count
        ));
    }

    pub fn refresh_evidence_effect(&mut self) -> WorkbenchEffect {
        let Some(room) = self.selected_task_room() else {
            return WorkbenchEffect::None;
        };
        let room_id = room.id.clone();
        self.action_status = Some(format!("refreshing evidence for {room_id}…"));
        WorkbenchEffect::RefreshEvidence { room_id }
    }

    pub fn selection_snapshot(&self) -> SelectionSnapshot {
        SelectionSnapshot {
            focus: self.focus,
            selected_actor: self.selected_actor,
            selected_task_room: self.selected_task_room,
            selected_runtime_setup: self.selected_runtime_setup,
            selected_update: self.selected_update,
            view_mode: self.view_mode.clone(),
            back_stack: self.back_stack.clone(),
            selected_task_room_id: self.selected_task_room().map(|room| room.id.clone()),
            selected_participant_id: self
                .selected_task_room()
                .and_then(|room| room.participants.first().map(|p| p.id.clone())),
        }
    }

    pub fn restore_selection(&mut self, snapshot: &SelectionSnapshot) {
        self.focus = snapshot.focus;
        self.selected_actor = snapshot.selected_actor;
        self.selected_runtime_setup = snapshot.selected_runtime_setup;
        self.selected_update = snapshot.selected_update;
        self.view_mode = snapshot.view_mode.clone();
        self.back_stack = snapshot.back_stack.clone();
        if let Some(room_id) = snapshot.selected_task_room_id.as_ref() {
            if let Some(index) = self
                .state
                .task_rooms
                .iter()
                .position(|room| &room.id == room_id)
            {
                self.selected_task_room = index;
            } else {
                self.selected_task_room = snapshot
                    .selected_task_room
                    .min(self.state.task_rooms.len().saturating_sub(1));
            }
        } else {
            self.selected_task_room = snapshot
                .selected_task_room
                .min(self.state.task_rooms.len().saturating_sub(1));
        }
    }

    pub fn replace_state_preserving_selection(
        &mut self,
        state: WorkbenchState,
        snapshot: &SelectionSnapshot,
    ) {
        self.state = state;
        self.restore_selection(snapshot);
    }

    pub fn select_task_room_by_id(&mut self, room_id: &str) -> bool {
        if let Some(index) = self
            .state
            .task_rooms
            .iter()
            .position(|room| room.id == room_id)
        {
            self.selected_task_room = index;
            self.focus = FocusPane::TaskRooms;
            true
        } else {
            false
        }
    }

    pub fn native_open_context(
        &self,
        room_id: &str,
        instance_id: &str,
    ) -> Option<NativeOpenContext> {
        let room = self
            .state
            .task_rooms
            .iter()
            .find(|room| room.id == room_id)?;
        let participant = room
            .participants
            .iter()
            .find(|participant| participant.id == instance_id)
            .or_else(|| room.participants.first())?;
        let native = self.state.native_sessions.iter().find(|session| {
            session.agent_instance_id == participant.id || session.room_id == room.id
        });
        Some(NativeOpenContext {
            project_root: self.state.project_root.clone(),
            room_id: room.id.clone(),
            agent_instance_id: participant.id.clone(),
            participant_name: participant.display_name.clone(),
            runtime: native
                .map(|session| session.runtime.clone())
                .unwrap_or_else(|| room.runtime.clone()),
            workspace: native
                .map(|session| session.workspace.clone())
                .unwrap_or_else(|| self.state.project_root.clone()),
            safety_mode: native
                .map(|session| session.safety_mode.clone())
                .unwrap_or_else(|| "workspace-write".to_string()),
            terminal_session_ref: native.map(|session| session.terminal_session_ref.clone()),
        })
    }

    pub fn filtered_actor_count(&self) -> usize {
        self.filtered_actor_entries().len()
    }

    pub fn unified_search_results(&self) -> Vec<SearchResult> {
        let query = self.search_query.trim().to_lowercase();
        if query.is_empty() {
            return Vec::new();
        }
        let mut results = Vec::new();
        for actor in &self.state.actors.team_agents {
            if actor.display_name.to_lowercase().contains(&query)
                || actor.role.to_lowercase().contains(&query)
            {
                results.push(SearchResult {
                    kind: "Agent",
                    label: actor.display_name.clone(),
                });
            }
        }
        for buddy in &self.state.actors.focused_buddies {
            if buddy.display_name.to_lowercase().contains(&query)
                || buddy.routing_summary.to_lowercase().contains(&query)
                || buddy
                    .runtime_surfaces
                    .iter()
                    .any(|runtime| runtime.to_lowercase().contains(&query))
            {
                results.push(SearchResult {
                    kind: "Buddy",
                    label: buddy.display_name.clone(),
                });
            }
        }
        for room in &self.state.task_rooms {
            if room.title.to_lowercase().contains(&query)
                || room.summary.to_lowercase().contains(&query)
                || room.runtime.to_lowercase().contains(&query)
            {
                results.push(SearchResult {
                    kind: "TaskRoom",
                    label: room.title.clone(),
                });
            }
        }
        for entry in &self.state.runtime_setup {
            let label = format!(
                "{} {} {}",
                entry.runtime, entry.team_agent, entry.focused_buddy
            );
            if label.to_lowercase().contains(&query) {
                results.push(SearchResult {
                    kind: "Runtime",
                    label,
                });
            }
        }
        for update in &self.state.updates {
            if update.text.to_lowercase().contains(&query)
                || update.kind.to_lowercase().contains(&query)
                || update.risk.to_lowercase().contains(&query)
            {
                results.push(SearchResult {
                    kind: "Update",
                    label: update.text.clone(),
                });
            }
        }
        results
    }

    pub fn visible_team_agents(&self) -> Vec<&TeamAgent> {
        let query = self.search_query.trim().to_lowercase();
        let mut items = self.sorted_team_agents();
        if query.is_empty() {
            return items;
        }
        items.retain(|actor| actor.display_name.to_lowercase().contains(&query));
        items
    }

    pub fn visible_focused_buddies(&self) -> Vec<&FocusedBuddy> {
        let query = self.search_query.trim().to_lowercase();
        let mut items = self.sorted_focused_buddies();
        if query.is_empty() {
            return items;
        }
        items.retain(|buddy| buddy.display_name.to_lowercase().contains(&query));
        items
    }

    pub fn filtered_actor_entries(&self) -> Vec<SelectedActor> {
        let query = self.search_query.trim().to_lowercase();
        let entries = self.all_actor_entries();
        if query.is_empty() {
            return entries;
        }
        entries
            .into_iter()
            .filter(|entry| {
                self.actor_label(*entry)
                    .map(|label| label.to_lowercase().contains(&query))
                    .unwrap_or(false)
            })
            .collect()
    }

    pub fn push_view(&mut self, next: ViewMode) {
        self.back_stack.push(self.view_mode.clone());
        self.view_mode = next;
    }

    pub fn pop_view(&mut self) {
        let leaving = self.view_mode.clone();
        self.view_mode = self.back_stack.pop().unwrap_or(ViewMode::Dashboard);
        if matches!(leaving, ViewMode::TaskRoomForm) {
            self.task_room_form_field_errors = [None, None, None, None, None, None];
        }
        if matches!(leaving, ViewMode::HandoffForm) {
            self.handoff_form_field_errors = [None, None, None, None, None, None];
        }
        if self.view_mode != ViewMode::Search {
            self.search_query.clear();
        }
        if self.view_mode != ViewMode::CommandPalette {
            self.command_query.clear();
            self.selected_command = 0;
        }
        if self.view_mode != ViewMode::StructuredQuestion {
            self.structured_question = None;
        }
    }

    pub fn current_detail_view(&self) -> DetailView {
        match self.focus {
            FocusPane::TeamBuddies => match self.selected_actor {
                Some(SelectedActor::FocusedBuddy(_)) => DetailView::FocusedBuddy,
                _ => DetailView::TeamAgent,
            },
            FocusPane::TaskRooms => DetailView::TaskRoom,
            FocusPane::RuntimeSetup => DetailView::RuntimeSetup,
            FocusPane::Updates => DetailView::Updates,
        }
    }

    pub fn select_next_actor(&mut self, delta: isize) {
        let entries = if self.view_mode == ViewMode::Search {
            self.filtered_actor_entries()
        } else {
            self.all_actor_entries()
        };
        if entries.is_empty() {
            self.selected_actor = None;
            return;
        }
        let current_index = self
            .selected_actor
            .and_then(|selected| entries.iter().position(|entry| *entry == selected))
            .unwrap_or(0) as isize;
        let next_index = (current_index + delta).clamp(0, (entries.len() - 1) as isize) as usize;
        self.selected_actor = Some(entries[next_index]);
    }

    fn all_actor_entries(&self) -> Vec<SelectedActor> {
        let mut entries = Vec::new();
        entries.extend((0..self.state.actors.team_agents.len()).map(SelectedActor::TeamAgent));
        entries
            .extend((0..self.state.actors.focused_buddies.len()).map(SelectedActor::FocusedBuddy));
        entries
    }

    fn actor_label(&self, selected: SelectedActor) -> Option<String> {
        match selected {
            SelectedActor::TeamAgent(index) => self
                .state
                .actors
                .team_agents
                .get(index)
                .map(|actor| actor.display_name.clone()),
            SelectedActor::FocusedBuddy(index) => self
                .state
                .actors
                .focused_buddies
                .get(index)
                .map(|buddy| buddy.display_name.clone()),
        }
    }

    fn codex_status_summary(&self) -> String {
        self.state
            .runtime_setup
            .iter()
            .find(|entry| entry.runtime == "Codex")
            .map(|entry| format!("Codex {}", entry.status.as_label()))
            .unwrap_or_else(|| "Codex unknown".to_string())
    }
}

fn default_runtime_for_create(state: &WorkbenchState) -> String {
    let preferred = ["opencode", "claude", "codex"];
    for name in preferred {
        if state
            .runtime_setup
            .iter()
            .any(|entry| entry.runtime.eq_ignore_ascii_case(name))
        {
            return name.to_string();
        }
    }
    state
        .runtime_setup
        .first()
        .map(|entry| entry.runtime.to_ascii_lowercase())
        .unwrap_or_else(|| "opencode".to_string())
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

fn sort_by_status<T: HasStatus>(mut items: Vec<T>) -> Vec<T> {
    items.sort_by_key(|item| item.status_order());
    items
}

pub trait HasStatus {
    fn status_order(&self) -> usize;
}

impl ActorStatus {
    pub fn as_label(&self) -> &'static str {
        match self {
            ActorStatus::NeedsInput => "Needs input",
            ActorStatus::Blocked => "Blocked",
            ActorStatus::Working => "Working",
            ActorStatus::Returned => "Returned",
            ActorStatus::Available => "Available",
            ActorStatus::Archived => "Archived",
            ActorStatus::Unknown => "Unknown",
        }
    }

    pub fn order(&self) -> usize {
        match self {
            ActorStatus::NeedsInput => 0,
            ActorStatus::Blocked => 1,
            ActorStatus::Working => 2,
            ActorStatus::Returned => 3,
            ActorStatus::Available => 4,
            ActorStatus::Archived => 5,
            ActorStatus::Unknown => 6,
        }
    }
}

impl RuntimeSetupStatus {
    pub fn as_label(&self) -> &'static str {
        match self {
            RuntimeSetupStatus::Ready => "Ready",
            RuntimeSetupStatus::Partial => "Partial",
            RuntimeSetupStatus::Blocked => "Blocked",
            RuntimeSetupStatus::Working => "Working",
            RuntimeSetupStatus::Returned => "Returned",
            RuntimeSetupStatus::Available => "Available",
            RuntimeSetupStatus::Archived => "Archived",
            RuntimeSetupStatus::Unknown => "Unknown",
        }
    }
}

impl TaskRoomStatus {
    pub fn as_label(&self) -> &'static str {
        match self {
            TaskRoomStatus::Queued => "Queued",
            TaskRoomStatus::Working => "Working",
            TaskRoomStatus::NeedsInput => "Needs input",
            TaskRoomStatus::NeedsReview => "Needs review",
            TaskRoomStatus::Blocked => "Blocked",
            TaskRoomStatus::Returned => "Returned",
            TaskRoomStatus::Completed => "Completed",
            TaskRoomStatus::Failed => "Failed",
            TaskRoomStatus::Archived => "Archived",
            TaskRoomStatus::Unknown => "Unknown",
        }
    }

    pub fn order(&self) -> usize {
        match self {
            TaskRoomStatus::NeedsInput => 0,
            TaskRoomStatus::NeedsReview => 1,
            TaskRoomStatus::Blocked => 2,
            TaskRoomStatus::Working => 3,
            TaskRoomStatus::Queued => 4,
            TaskRoomStatus::Returned => 5,
            TaskRoomStatus::Completed => 6,
            TaskRoomStatus::Failed => 7,
            TaskRoomStatus::Archived => 8,
            TaskRoomStatus::Unknown => 9,
        }
    }
}

impl HasStatus for &TeamAgent {
    fn status_order(&self) -> usize {
        self.status.order()
    }
}

impl HasStatus for &FocusedBuddy {
    fn status_order(&self) -> usize {
        self.status.order()
    }
}

impl HasStatus for &TaskRoom {
    fn status_order(&self) -> usize {
        self.status.order()
    }
}
