use anyhow::{bail, Result};
use std::collections::BTreeMap;
use std::ffi::OsString;
use std::path::PathBuf;

pub mod attach;
pub mod capability_matrix;
pub mod fake;
pub mod tmux;
pub mod tmux_inspect;

pub use capability_matrix::{
    action_gates_from_matrix, ActionGate, CapabilityStatus, SubstrateAction,
    SubstrateCapabilityKind, SubstrateCapabilityMatrix, SubstratePlatform,
};
pub use fake::FakeTerminalSubstrate;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubstrateCapabilities {
    pub backend_name: String,
    pub supports_create: bool,
    pub supports_attach: bool,
    pub supports_inspect: bool,
    pub supports_list: bool,
    pub supports_terminate: bool,
    pub unsupported_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct SubstrateSessionRef(pub String);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AttachOutcome {
    Detached,
    SessionEnded,
    AttachFailed,
    Interrupted,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionScope {
    All,
    Prefix(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionDisplayMetadata {
    pub participant: String,
    pub runtime: String,
    pub workspace: String,
    pub safety_mode: String,
    pub detach_shortcut: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateSessionRequest {
    pub descriptor_id: String,
    pub session_ref: SubstrateSessionRef,
    pub launcher_plan_ref: String,
    pub program: PathBuf,
    pub args: Vec<OsString>,
    pub cwd: PathBuf,
    pub environment_policy_ref: String,
    pub display: SessionDisplayMetadata,
    pub project_root: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubstrateSessionFacts {
    pub session_ref: SubstrateSessionRef,
    pub exists: bool,
    pub attached_client_count: u32,
    pub child_process_alive: bool,
    pub last_activity_at: Option<String>,
    pub exit_state: Option<String>,
    pub backend_metadata: BTreeMap<String, String>,
}

pub trait TerminalSubstrate {
    fn probe(&self) -> Result<SubstrateCapabilities>;
    fn create_session(&self, request: &CreateSessionRequest) -> Result<SubstrateSessionFacts>;
    fn attach_interactive(&self, session: &SubstrateSessionRef) -> Result<AttachOutcome>;
    fn inspect(&self, session: &SubstrateSessionRef) -> Result<SubstrateSessionFacts>;
    fn list_sessions(&self, scope: &SessionScope) -> Result<Vec<SubstrateSessionFacts>>;
    fn terminate(&self, session: &SubstrateSessionRef) -> Result<()>;
}

pub(crate) fn validate_facts(facts: &SubstrateSessionFacts) -> Result<()> {
    if facts
        .backend_metadata
        .get("malformed")
        .is_some_and(|value| value == "true")
    {
        bail!("malformed substrate facts");
    }
    Ok(())
}
