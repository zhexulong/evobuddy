use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct WorkbenchState {
    pub schema: String,
    #[serde(rename = "projectRoot")]
    pub project_root: String,
    #[serde(rename = "generatedAt")]
    pub generated_at: Option<String>,
    pub actors: Actors,
    #[serde(rename = "taskRooms")]
    pub task_rooms: Vec<TaskRoom>,
    #[serde(rename = "runtimeSetup")]
    pub runtime_setup: Vec<RuntimeSetupEntry>,
    #[serde(default, rename = "nativeSessions")]
    pub native_sessions: Vec<NativeSessionSummary>,
    #[serde(default, rename = "runtimeCapabilities")]
    pub runtime_capabilities: Vec<RuntimeCapabilitySummary>,
    pub updates: Vec<UpdateItem>,
    pub diagnostics: Diagnostics,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Actors {
    #[serde(rename = "teamAgents")]
    pub team_agents: Vec<TeamAgent>,
    #[serde(rename = "focusedBuddies")]
    pub focused_buddies: Vec<FocusedBuddy>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TeamAgent {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub status: ActorStatus,
    pub role: String,
    #[serde(rename = "taskRoomIds")]
    pub task_room_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FocusedBuddy {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub status: ActorStatus,
    #[serde(rename = "routingSummary")]
    pub routing_summary: String,
    #[serde(rename = "runtimeSurfaces")]
    pub runtime_surfaces: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TaskRoom {
    pub id: String,
    pub title: String,
    pub runtime: String,
    pub status: TaskRoomStatus,
    #[serde(default)]
    pub objective: String,
    #[serde(default, rename = "acceptanceCriteria")]
    pub acceptance_criteria: String,
    pub participants: Vec<Participant>,
    pub rounds: Vec<Round>,
    pub handoffs: Vec<Handoff>,
    #[serde(rename = "reviewerContinuity")]
    pub reviewer_continuity: StatusSummary,
    #[serde(rename = "evolutionHandoff")]
    pub evolution_handoff: StatusSummary,
    #[serde(default)]
    pub attention: Option<AttentionSource>,
    #[serde(default, rename = "availableActions")]
    pub available_actions: Vec<ActionAvailability>,
    #[serde(rename = "returnedTo")]
    pub returned_to: Option<String>,
    #[serde(rename = "artifactsSummary")]
    pub artifacts_summary: Vec<String>,
    pub summary: String,
    #[serde(default)]
    pub timeline: Vec<TimelineEntry>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct TimelineEntry {
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub at: String,
    #[serde(default)]
    pub summary: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Participant {
    pub id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub kind: String,
    pub status: ActorStatus,
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub runtime: String,
    #[serde(default, rename = "nativeSessionDescriptorId")]
    pub native_session_descriptor_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AttentionSource {
    pub state: String,
    #[serde(rename = "sourceKind")]
    pub source_kind: String,
    #[serde(rename = "sourceRef")]
    pub source_ref: String,
    #[serde(rename = "observedAt")]
    pub observed_at: String,
    pub confidence: String,
    #[serde(rename = "staleAfter")]
    pub stale_after: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct ActionAvailability {
    pub id: String,
    pub label: String,
    pub enabled: bool,
    #[serde(default, rename = "disabledReason")]
    pub disabled_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Round {
    pub id: String,
    #[serde(rename = "builderSummary")]
    pub builder_summary: String,
    #[serde(rename = "reviewerSummary")]
    pub reviewer_summary: String,
    #[serde(rename = "priorReviewLinked")]
    pub prior_review_linked: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Handoff {
    pub from: String,
    pub to: String,
    pub summary: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StatusSummary {
    pub status: String,
    pub summary: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub enum RuntimeSetupStatus {
    Ready,
    Partial,
    Blocked,
    Working,
    Returned,
    Available,
    Archived,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RuntimeSetupEntry {
    pub runtime: String,
    #[serde(rename = "teamAgent")]
    pub team_agent: String,
    #[serde(rename = "focusedBuddy")]
    pub focused_buddy: String,
    pub status: RuntimeSetupStatus,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NativeSessionSummary {
    #[serde(rename = "descriptorId")]
    pub descriptor_id: String,
    #[serde(rename = "roomId")]
    pub room_id: String,
    #[serde(rename = "agentInstanceId")]
    pub agent_instance_id: String,
    pub runtime: String,
    pub lifecycle: NativeSessionLifecycle,
    #[serde(rename = "terminalSubstrate")]
    pub terminal_substrate: String,
    #[serde(rename = "terminalSessionRef")]
    pub terminal_session_ref: String,
    pub workspace: String,
    #[serde(rename = "safetyMode")]
    pub safety_mode: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum NativeSessionLifecycle {
    Creating,
    Attachable,
    Attached,
    Detached,
    Stale,
    Failed,
    Terminated,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RuntimeCapabilitySummary {
    #[serde(rename = "capabilityId")]
    pub capability_id: String,
    pub runtime: String,
    #[serde(rename = "supportsFreshSession")]
    pub supports_fresh_session: bool,
    #[serde(rename = "supportsContextContinuation")]
    pub supports_context_continuation: bool,
    #[serde(rename = "exactResumeSupported")]
    pub exact_resume_supported: bool,
    #[serde(rename = "heuristicResumeSupported")]
    pub heuristic_resume_supported: bool,
    #[serde(default, rename = "unsupportedReason")]
    pub unsupported_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateItem {
    pub id: String,
    pub text: String,
    pub kind: String,
    pub risk: String,
    #[serde(rename = "targetRefs")]
    pub target_refs: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Diagnostics {
    #[serde(rename = "claimCeiling")]
    pub claim_ceiling: String,
    #[serde(rename = "hiddenProofFieldsPresent")]
    pub hidden_proof_fields_present: bool,
    #[serde(rename = "blockedReasons")]
    pub blocked_reasons: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub enum ActorStatus {
    #[serde(rename = "Needs input")]
    NeedsInput,
    Blocked,
    Working,
    Returned,
    Available,
    Archived,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub enum TaskRoomStatus {
    Queued,
    Working,
    #[serde(rename = "NeedsInput")]
    NeedsInput,
    #[serde(rename = "NeedsReview")]
    NeedsReview,
    Blocked,
    Returned,
    Completed,
    Failed,
    Archived,
    #[serde(other)]
    Unknown,
}

pub fn parse_workbench_state(text: &str) -> Result<WorkbenchState> {
    let state: WorkbenchState = serde_json::from_str(text)
        .map_err(|error| anyhow::anyhow!("failed to parse workbench state JSON: {error}"))?;
    anyhow::ensure!(
        state.schema == "evobuddy.workbench.state.v1",
        "unsupported schema: {}",
        state.schema
    );
    anyhow::ensure!(
        !state.project_root.trim().is_empty(),
        "projectRoot must be non-empty"
    );
    anyhow::ensure!(
        !state.runtime_setup.is_empty(),
        "runtimeSetup must be present"
    );
    Ok(state)
}
