use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::backend::{session_plan_open_command, BackendCommand};
use crate::substrate::{CreateSessionRequest, SessionDisplayMetadata, SubstrateSessionRef};

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct ContinuationCandidate {
    #[serde(rename = "candidateId")]
    pub candidate_id: String,
    pub label: String,
    #[serde(rename = "providerConversationRef")]
    pub provider_conversation_ref: Option<String>,
    #[serde(rename = "sourceRef")]
    pub source_ref: String,
    #[serde(rename = "observedAt")]
    pub observed_at: String,
    pub confidence: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct ContinuationDecision {
    pub kind: String,
    #[serde(rename = "heuristicCandidateSource")]
    pub heuristic_candidate_source: Option<String>,
    #[serde(rename = "candidateCount")]
    pub candidate_count: usize,
    pub candidates: Vec<ContinuationCandidate>,
    #[serde(rename = "requiresStructuredChoice")]
    pub requires_structured_choice: bool,
    #[serde(rename = "disabledReason")]
    pub disabled_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct RuntimeSessionIntent {
    #[serde(rename = "roomId")]
    pub room_id: String,
    #[serde(rename = "agentInstanceId")]
    pub agent_instance_id: String,
    pub runtime: String,
    pub workspace: String,
    #[serde(rename = "launchMode")]
    pub launch_mode: String,
    #[serde(rename = "providerConversationRef")]
    pub provider_conversation_ref: Option<String>,
    #[serde(rename = "terminalSessionRef")]
    pub terminal_session_ref: String,
    #[serde(rename = "contextPacketRef")]
    pub context_packet_ref: Option<String>,
    #[serde(rename = "safetyMode")]
    pub safety_mode: String,
    #[serde(rename = "expectedEvidencePath")]
    pub expected_evidence_path: String,
    #[serde(rename = "recoveryHint")]
    pub recovery_hint: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
struct CreateSessionRequestJson {
    #[serde(rename = "descriptorId")]
    descriptor_id: String,
    #[serde(rename = "sessionRef")]
    session_ref: String,
    #[serde(rename = "launcherPlanRef")]
    launcher_plan_ref: String,
    program: String,
    args: Vec<String>,
    cwd: String,
    #[serde(rename = "environmentPolicyRef")]
    environment_policy_ref: String,
    display: SessionDisplayMetadataJson,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
struct SessionDisplayMetadataJson {
    participant: String,
    runtime: String,
    workspace: String,
    #[serde(rename = "safetyMode")]
    safety_mode: String,
    #[serde(rename = "detachShortcut")]
    detach_shortcut: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
struct RuntimeSessionOpenPlanJson {
    schema: String,
    #[serde(rename = "descriptorId")]
    descriptor_id: String,
    continuation: ContinuationDecision,
    intent: RuntimeSessionIntent,
    #[serde(rename = "createSessionRequest")]
    create_session_request: CreateSessionRequestJson,
    #[serde(rename = "runtimeCapabilityRef")]
    runtime_capability_ref: String,
    #[serde(rename = "launchCommandRef")]
    launch_command_ref: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeSessionOpenPlan {
    pub schema: String,
    pub descriptor_id: String,
    pub continuation: ContinuationDecision,
    pub intent: RuntimeSessionIntent,
    pub create_session_request: CreateSessionRequest,
    pub runtime_capability_ref: String,
    pub launch_command_ref: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct NativeSessionDescriptor {
    #[serde(rename = "descriptorId")]
    pub descriptor_id: String,
    #[serde(rename = "roomId")]
    pub room_id: String,
    #[serde(rename = "agentInstanceId")]
    pub agent_instance_id: String,
    pub runtime: String,
    pub workspace: String,
    #[serde(rename = "terminalSessionRef")]
    pub terminal_session_ref: String,
    pub lifecycle: String,
    #[serde(rename = "launchCommandRef")]
    pub launch_command_ref: String,
    #[serde(rename = "runtimeCapabilityRef")]
    pub runtime_capability_ref: String,
    #[serde(rename = "safetyMode")]
    pub safety_mode: String,
    #[serde(rename = "contextPacketRef")]
    pub context_packet_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReconciliationClass {
    Matched {
        descriptor_id: String,
        terminal_session_ref: String,
    },
    Orphaned {
        terminal_session_ref: String,
    },
    Conflicted {
        descriptor_id: String,
        terminal_session_ref: String,
    },
    Stale {
        descriptor_id: String,
        terminal_session_ref: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionBackendError {
    LockConflict { agent_instance_id: String },
    PlanOpenFailed { message: String },
    ReserveFailed { message: String },
    CommitFailed { message: String },
    InspectFailed { message: String },
    SchemaMismatch { message: String },
    CommandFailed { message: String },
    CreateFailed { message: String },
}

impl std::fmt::Display for SessionBackendError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::LockConflict { agent_instance_id } => {
                write!(f, "lock conflict for agent instance {agent_instance_id}")
            }
            Self::PlanOpenFailed { message }
            | Self::ReserveFailed { message }
            | Self::CommitFailed { message }
            | Self::InspectFailed { message }
            | Self::SchemaMismatch { message }
            | Self::CommandFailed { message }
            | Self::CreateFailed { message } => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for SessionBackendError {}

pub trait NativeSessionBackend {
    fn with_instance_lock<T>(
        &self,
        agent_instance_id: &str,
        work: &mut dyn FnMut() -> Result<T, SessionBackendError>,
    ) -> Result<T, SessionBackendError>;

    fn plan_open(
        &self,
        request: &crate::router::RuntimeSessionOpenRequest,
    ) -> Result<RuntimeSessionOpenPlan, SessionBackendError>;

    fn reserve(
        &self,
        plan: &RuntimeSessionOpenPlan,
    ) -> Result<NativeSessionDescriptor, SessionBackendError>;

    fn commit(
        &self,
        descriptor_id: &str,
        substrate_ref: &str,
    ) -> Result<NativeSessionDescriptor, SessionBackendError>;

    fn inspect(&self, descriptor_id: &str) -> Result<NativeSessionDescriptor, SessionBackendError>;

    fn list(&self) -> Result<Vec<NativeSessionDescriptor>, SessionBackendError>;

    fn reconcile(
        &self,
        substrate_facts: &[crate::substrate::SubstrateSessionFacts],
    ) -> Result<Vec<ReconciliationClass>, SessionBackendError>;
}

fn validate_open_plan(
    plan: RuntimeSessionOpenPlanJson,
) -> Result<RuntimeSessionOpenPlan, SessionBackendError> {
    if plan.schema != "evobuddy.runtime-session-open-plan.v1" {
        return Err(SessionBackendError::SchemaMismatch {
            message: format!("invalid plan schema: {}", plan.schema),
        });
    }
    if plan.create_session_request.program.is_empty() {
        return Err(SessionBackendError::SchemaMismatch {
            message: "createSessionRequest.program is required".to_string(),
        });
    }
    if plan.create_session_request.launcher_plan_ref.is_empty() {
        return Err(SessionBackendError::SchemaMismatch {
            message: "createSessionRequest.launcherPlanRef is required".to_string(),
        });
    }
    if plan.create_session_request.cwd.is_empty() {
        return Err(SessionBackendError::SchemaMismatch {
            message: "createSessionRequest.cwd is required".to_string(),
        });
    }
    if plan
        .create_session_request
        .environment_policy_ref
        .is_empty()
    {
        return Err(SessionBackendError::SchemaMismatch {
            message: "createSessionRequest.environmentPolicyRef is required".to_string(),
        });
    }
    Ok(RuntimeSessionOpenPlan {
        schema: plan.schema,
        descriptor_id: plan.descriptor_id,
        continuation: plan.continuation,
        intent: plan.intent,
        create_session_request: CreateSessionRequest {
            descriptor_id: plan.create_session_request.descriptor_id,
            session_ref: SubstrateSessionRef(plan.create_session_request.session_ref),
            launcher_plan_ref: plan.create_session_request.launcher_plan_ref,
            program: PathBuf::from(plan.create_session_request.program),
            args: plan
                .create_session_request
                .args
                .into_iter()
                .map(std::ffi::OsString::from)
                .collect(),
            cwd: PathBuf::from(plan.create_session_request.cwd),
            environment_policy_ref: plan.create_session_request.environment_policy_ref,
            display: SessionDisplayMetadata {
                participant: plan.create_session_request.display.participant,
                runtime: plan.create_session_request.display.runtime,
                workspace: plan.create_session_request.display.workspace,
                safety_mode: plan.create_session_request.display.safety_mode,
                detach_shortcut: plan.create_session_request.display.detach_shortcut,
            },
            project_root: PathBuf::new(),
        },
        runtime_capability_ref: plan.runtime_capability_ref,
        launch_command_ref: plan.launch_command_ref,
    })
}

pub fn parse_runtime_session_open_plan(
    stdout: &str,
) -> Result<RuntimeSessionOpenPlan, SessionBackendError> {
    let parsed: RuntimeSessionOpenPlanJson =
        serde_json::from_str(stdout).map_err(|error| SessionBackendError::SchemaMismatch {
            message: format!("failed to parse plan-open JSON: {error}"),
        })?;
    validate_open_plan(parsed)
}

fn run_node_command(
    command: &BackendCommand,
    project: &Path,
) -> Result<String, SessionBackendError> {
    let output = Command::new(&command.program)
        .args(&command.args)
        .current_dir(project)
        .output()
        .map_err(|error| SessionBackendError::CommandFailed {
            message: format!("failed to run node command: {error}"),
        })?;
    if !output.status.success() {
        return Err(SessionBackendError::CommandFailed {
            message: format!(
                "node command failed with status {}: {}",
                output.status,
                String::from_utf8_lossy(&output.stderr)
            ),
        });
    }
    String::from_utf8(output.stdout).map_err(|error| SessionBackendError::CommandFailed {
        message: format!("node command stdout was not valid UTF-8: {error}"),
    })
}

#[derive(Debug, Clone)]
pub struct NodeNativeSessionBackend {
    pub project_root: PathBuf,
}

impl NodeNativeSessionBackend {
    pub fn new(project_root: PathBuf) -> Self {
        Self { project_root }
    }
}

impl NativeSessionBackend for NodeNativeSessionBackend {
    fn with_instance_lock<T>(
        &self,
        _agent_instance_id: &str,
        work: &mut dyn FnMut() -> Result<T, SessionBackendError>,
    ) -> Result<T, SessionBackendError> {
        work()
    }

    fn plan_open(
        &self,
        request: &crate::router::RuntimeSessionOpenRequest,
    ) -> Result<RuntimeSessionOpenPlan, SessionBackendError> {
        let command = session_plan_open_command(
            &request.project_root,
            &request.room_id,
            &request.agent_instance_id,
            &request.runtime,
            &request.workspace,
            request.mode.as_deref(),
            request.participant.as_deref(),
        );
        let stdout = run_node_command(&command, &self.project_root)?;
        parse_runtime_session_open_plan(&stdout)
    }

    fn reserve(
        &self,
        plan: &RuntimeSessionOpenPlan,
    ) -> Result<NativeSessionDescriptor, SessionBackendError> {
        let command = crate::backend::session_reserve_command(
            &self.project_root,
            &plan.intent.room_id,
            &plan.intent.agent_instance_id,
            &plan.intent.runtime,
            Path::new(&plan.intent.workspace),
            Some(&plan.descriptor_id),
            Some(&plan.intent.terminal_session_ref),
            plan.intent.context_packet_ref.as_deref(),
            Some(&plan.intent.safety_mode),
            Some(&plan.create_session_request.display.participant),
        );
        let stdout = run_node_command(&command, &self.project_root)?;
        serde_json::from_str(&stdout).map_err(|error| SessionBackendError::ReserveFailed {
            message: format!("failed to parse reserve JSON: {error}"),
        })
    }

    fn commit(
        &self,
        descriptor_id: &str,
        substrate_ref: &str,
    ) -> Result<NativeSessionDescriptor, SessionBackendError> {
        let command = crate::backend::session_commit_command(
            &self.project_root,
            descriptor_id,
            substrate_ref,
        );
        let stdout = run_node_command(&command, &self.project_root)?;
        serde_json::from_str(&stdout).map_err(|error| SessionBackendError::CommitFailed {
            message: format!("failed to parse commit JSON: {error}"),
        })
    }

    fn inspect(&self, descriptor_id: &str) -> Result<NativeSessionDescriptor, SessionBackendError> {
        let command = crate::backend::session_inspect_command(&self.project_root, descriptor_id);
        let stdout = run_node_command(&command, &self.project_root)?;
        serde_json::from_str(&stdout).map_err(|error| SessionBackendError::InspectFailed {
            message: format!("failed to parse inspect JSON: {error}"),
        })
    }

    fn list(&self) -> Result<Vec<NativeSessionDescriptor>, SessionBackendError> {
        Ok(vec![])
    }

    fn reconcile(
        &self,
        substrate_facts: &[crate::substrate::SubstrateSessionFacts],
    ) -> Result<Vec<ReconciliationClass>, SessionBackendError> {
        let command = crate::backend::session_reconcile_command(&self.project_root);
        let stdout = run_node_command(&command, &self.project_root)?;
        #[derive(Deserialize)]
        struct ReconcileReport {
            classifications: Vec<ReconcileEntry>,
        }
        #[derive(Deserialize)]
        struct ReconcileEntry {
            classification: String,
            #[serde(rename = "descriptorId")]
            descriptor_id: Option<String>,
            #[serde(rename = "terminalSessionRef")]
            terminal_session_ref: Option<String>,
        }
        let report: ReconcileReport =
            serde_json::from_str(&stdout).map_err(|error| SessionBackendError::CommandFailed {
                message: format!("failed to parse reconcile JSON: {error}"),
            })?;
        let mut classes = report
            .classifications
            .into_iter()
            .filter_map(|entry| match entry.classification.as_str() {
                "matched" => Some(ReconciliationClass::Matched {
                    descriptor_id: entry.descriptor_id.unwrap_or_default(),
                    terminal_session_ref: entry.terminal_session_ref.unwrap_or_default(),
                }),
                "stale" => Some(ReconciliationClass::Stale {
                    descriptor_id: entry.descriptor_id.unwrap_or_default(),
                    terminal_session_ref: entry.terminal_session_ref.unwrap_or_default(),
                }),
                "conflicted" => Some(ReconciliationClass::Conflicted {
                    descriptor_id: entry.descriptor_id.unwrap_or_default(),
                    terminal_session_ref: entry.terminal_session_ref.unwrap_or_default(),
                }),
                "orphaned" => Some(ReconciliationClass::Orphaned {
                    terminal_session_ref: entry.terminal_session_ref.unwrap_or_default(),
                }),
                _ => None,
            })
            .collect::<Vec<_>>();

        if classes.is_empty() {
            for facts in substrate_facts.iter().filter(|facts| facts.exists) {
                classes.push(ReconciliationClass::Orphaned {
                    terminal_session_ref: facts.session_ref.0.clone(),
                });
            }
        }
        Ok(classes)
    }
}

pub fn validate_create_request_binding(plan: &RuntimeSessionOpenPlan) -> Result<()> {
    let request = &plan.create_session_request;
    if request.descriptor_id != plan.descriptor_id {
        bail!("createSessionRequest.descriptorId does not match plan.descriptorId");
    }
    if request.session_ref.0 != plan.intent.terminal_session_ref {
        bail!("createSessionRequest.sessionRef does not match intent.terminalSessionRef");
    }
    if request.launcher_plan_ref.is_empty() {
        bail!("createSessionRequest.launcherPlanRef is required");
    }
    if request.program.as_os_str().is_empty() {
        bail!("createSessionRequest.program is required");
    }
    if request.cwd.as_os_str().is_empty() {
        bail!("createSessionRequest.cwd is required");
    }
    if request.environment_policy_ref.is_empty() {
        bail!("createSessionRequest.environmentPolicyRef is required");
    }
    Ok(())
}

pub fn default_reconciliation(
    descriptors: &[NativeSessionDescriptor],
    substrate_facts: &[crate::substrate::SubstrateSessionFacts],
) -> Vec<ReconciliationClass> {
    let live: std::collections::BTreeMap<_, _> = substrate_facts
        .iter()
        .filter(|facts| facts.exists)
        .map(|facts| (facts.session_ref.0.clone(), facts))
        .collect();
    let mut by_agent: std::collections::BTreeMap<String, usize> = std::collections::BTreeMap::new();
    let mut by_ref: std::collections::BTreeMap<String, usize> = std::collections::BTreeMap::new();
    for descriptor in descriptors {
        if live.contains_key(&descriptor.terminal_session_ref) {
            *by_agent
                .entry(descriptor.agent_instance_id.clone())
                .or_default() += 1;
            *by_ref
                .entry(descriptor.terminal_session_ref.clone())
                .or_default() += 1;
        }
    }
    let mut classes = descriptors
        .iter()
        .map(|descriptor| {
            if !live.contains_key(&descriptor.terminal_session_ref) {
                ReconciliationClass::Stale {
                    descriptor_id: descriptor.descriptor_id.clone(),
                    terminal_session_ref: descriptor.terminal_session_ref.clone(),
                }
            } else if by_agent
                .get(&descriptor.agent_instance_id)
                .copied()
                .unwrap_or(0)
                > 1
                || by_ref
                    .get(&descriptor.terminal_session_ref)
                    .copied()
                    .unwrap_or(0)
                    > 1
            {
                ReconciliationClass::Conflicted {
                    descriptor_id: descriptor.descriptor_id.clone(),
                    terminal_session_ref: descriptor.terminal_session_ref.clone(),
                }
            } else {
                ReconciliationClass::Matched {
                    descriptor_id: descriptor.descriptor_id.clone(),
                    terminal_session_ref: descriptor.terminal_session_ref.clone(),
                }
            }
        })
        .collect::<Vec<_>>();
    let known: std::collections::BTreeSet<_> = descriptors
        .iter()
        .map(|descriptor| descriptor.terminal_session_ref.clone())
        .collect();
    for (session_ref, _) in live {
        if !known.contains(&session_ref) {
            classes.push(ReconciliationClass::Orphaned {
                terminal_session_ref: session_ref,
            });
        }
    }
    classes
}

pub fn load_launch_plan_binding(
    project_root: &Path,
    launcher_plan_ref: &str,
) -> Result<crate::launcher::LaunchPlan> {
    let plan_id = launcher_plan_ref
        .strip_prefix("launch-plan:")
        .unwrap_or(launcher_plan_ref);
    crate::launcher::load_launch_plan(project_root, plan_id).context("load launch plan binding")
}
