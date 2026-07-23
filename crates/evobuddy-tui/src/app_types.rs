//! Shared WorkbenchApp public types.
use crate::views::ViewMode;

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
    pub attach_room_id: Option<String>,
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
pub enum ConfirmedAction {
    CreateTaskRoom(CreateTaskRoomDraft),
    CreateHandoff(CreateHandoffDraft),
    AddParticipant {
        room_id: String,
        participant_id: String,
        actor_name: String,
        actor_kind: String,
        role: String,
        runtime: Option<String>,
    },
    StopSession {
        room_id: String,
        instance_id: String,
    },
    ArchiveTaskRoom {
        room_id: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PendingConfirmation {
    pub target: String,
    pub effect_label: String,
    pub action: ConfirmedAction,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WorkbenchEffect {
    None,
    RequestConfirmation(PendingConfirmation),
    CreateTaskRoom(CreateTaskRoomDraft),
    CreateHandoff(CreateHandoffDraft),
    AddParticipant {
        room_id: String,
        participant_id: String,
        actor_name: String,
        actor_kind: String,
        role: String,
        runtime: Option<String>,
    },
    StopSession {
        room_id: String,
        instance_id: String,
    },
    ArchiveTaskRoom {
        room_id: String,
    },
    ExecuteCommand(DeterministicCommand),
    AnswerQuestion(String),
    OpenNativeRuntime {
        room_id: String,
        instance_id: String,
    },
    SendRoomMessage {
        room_id: String,
        body: String,
    },
    RefreshTaskRoom,
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
