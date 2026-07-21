use anyhow::{bail, Context, Result};
use std::path::{Path, PathBuf};

use crate::session::{
    default_reconciliation, validate_create_request_binding, NativeSessionBackend,
    NativeSessionDescriptor, ReconciliationClass, RuntimeSessionOpenPlan, SessionBackendError,
};
use crate::substrate::tmux::{format_pre_attach_notice, write_pre_attach_notice};
use crate::substrate::{
    AttachOutcome, SessionDisplayMetadata, SessionScope, SubstrateSessionFacts,
    SubstrateSessionRef, TerminalSubstrate,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeSessionOpenRequest {
    pub project_root: PathBuf,
    pub room_id: String,
    pub agent_instance_id: String,
    pub runtime: String,
    pub workspace: PathBuf,
    pub mode: Option<String>,
    pub participant: Option<String>,
    pub provider_conversation_ref: Option<String>,
    pub context_packet_ref: Option<String>,
    pub safety_mode: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[allow(clippy::large_enum_variant)]
pub enum RuntimeSessionAction {
    Attach { session_ref: SubstrateSessionRef },
    RequireStructuredChoice { plan: RuntimeSessionOpenPlan },
    Disabled { reason: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[allow(clippy::large_enum_variant)]
pub enum RuntimeSessionResult {
    Ready {
        action: RuntimeSessionAction,
        plan: RuntimeSessionOpenPlan,
        descriptor: NativeSessionDescriptor,
        session_facts: SubstrateSessionFacts,
    },
    NeedsChoice {
        plan: RuntimeSessionOpenPlan,
    },
    Unsupported {
        plan: RuntimeSessionOpenPlan,
        reason: String,
    },
}

pub struct RuntimeSessionRouter<B, S> {
    backend: B,
    substrate: S,
}

impl<B, S> RuntimeSessionRouter<B, S>
where
    B: NativeSessionBackend,
    S: TerminalSubstrate,
{
    pub fn new(backend: B, substrate: S) -> Self {
        Self { backend, substrate }
    }

    pub fn open_native_session(
        &self,
        request: &RuntimeSessionOpenRequest,
    ) -> Result<RuntimeSessionResult> {
        let agent_instance_id = request.agent_instance_id.clone();
        match self
            .backend
            .with_instance_lock(&agent_instance_id, &mut || {
                self.open_native_session_locked(request).map_err(|error| {
                    if let Some(backend_error) = error.downcast_ref::<SessionBackendError>() {
                        backend_error.clone()
                    } else {
                        SessionBackendError::CommandFailed {
                            message: error.to_string(),
                        }
                    }
                })
            }) {
            Ok(result) => Ok(result),
            Err(SessionBackendError::LockConflict { agent_instance_id }) => {
                bail!("lock conflict for agent instance {agent_instance_id}")
            }
            Err(error) => bail!(error),
        }
    }

    fn open_native_session_locked(
        &self,
        request: &RuntimeSessionOpenRequest,
    ) -> Result<RuntimeSessionResult> {
        let plan = self
            .backend
            .plan_open(request)
            .map_err(|error| anyhow::anyhow!(error))?;
        validate_create_request_binding(&plan)?;

        if plan.continuation.kind == "unsupported" {
            return Ok(RuntimeSessionResult::Unsupported {
                reason: plan
                    .continuation
                    .disabled_reason
                    .clone()
                    .unwrap_or_else(|| "unsupported runtime continuation".to_string()),
                plan,
            });
        }

        if plan.continuation.requires_structured_choice {
            return Ok(RuntimeSessionResult::NeedsChoice { plan });
        }

        if let Ok(existing) = self.backend.inspect(&plan.descriptor_id) {
            if matches!(
                existing.lifecycle.as_str(),
                "attachable" | "detached" | "attached"
            ) {
                if let Ok(facts) = self
                    .substrate
                    .inspect(&SubstrateSessionRef(existing.terminal_session_ref.clone()))
                {
                    if facts.exists {
                        return Ok(RuntimeSessionResult::Ready {
                            action: RuntimeSessionAction::Attach {
                                session_ref: facts.session_ref.clone(),
                            },
                            plan,
                            descriptor: existing,
                            session_facts: facts,
                        });
                    }
                }
            }
        }

        let descriptor = self
            .backend
            .reserve(&plan)
            .map_err(|error| anyhow::anyhow!(error))?;

        let create_request = plan.create_session_request.clone();
        let facts = self
            .substrate
            .create_session(&create_request)
            .with_context(|| {
                format!(
                    "create tmux session failed (program={} args={:?} cwd={} session={})",
                    create_request.program.display(),
                    create_request.args,
                    create_request.cwd.display(),
                    create_request.session_ref.0
                )
            })?;
        if !facts.exists || !facts.child_process_alive {
            let _ = self.substrate.terminate(&facts.session_ref);
            bail!(
                "created substrate session is not live (exists={} child_alive={} session={} program={} args={:?}). \
OpenCode may have exited immediately — check PATH/binary and prefer a fresh session for new rooms.",
                facts.exists,
                facts.child_process_alive,
                facts.session_ref.0,
                create_request.program.display(),
                create_request.args
            );
        }

        let committed = self
            .backend
            .commit(&descriptor.descriptor_id, &facts.session_ref.0)
            .map_err(|error| anyhow::anyhow!(error))?;

        Ok(RuntimeSessionResult::Ready {
            action: RuntimeSessionAction::Attach {
                session_ref: facts.session_ref.clone(),
            },
            plan,
            descriptor: committed,
            session_facts: facts,
        })
    }

    pub fn reconcile(&self) -> Result<Vec<ReconciliationClass>> {
        let facts = self
            .substrate
            .list_sessions(&SessionScope::All)
            .context("list substrate sessions")?;
        match self.backend.reconcile(&facts) {
            Ok(classes) if !classes.is_empty() => Ok(classes),
            Ok(_) | Err(_) => {
                let descriptors = self.backend.list().unwrap_or_default();
                Ok(default_reconciliation(&descriptors, &facts))
            }
        }
    }

    pub fn attach_session(&self, session_ref: &SubstrateSessionRef) -> Result<AttachOutcome> {
        self.substrate.attach_interactive(session_ref)
    }

    pub fn attach_with_notice(
        &self,
        session_ref: &SubstrateSessionRef,
        display: &SessionDisplayMetadata,
    ) -> Result<AttachOutcome> {
        let notice = format_pre_attach_notice(display, session_ref);
        write_pre_attach_notice(&notice)?;
        self.attach_session(session_ref)
    }
}

pub fn default_tmux_socket_name() -> &'static str {
    "evobuddy"
}

pub fn build_open_request(
    project_root: &Path,
    room_id: &str,
    agent_instance_id: &str,
    runtime: &str,
    workspace: &Path,
    participant: Option<&str>,
    safety_mode: Option<&str>,
) -> RuntimeSessionOpenRequest {
    RuntimeSessionOpenRequest {
        project_root: project_root.to_path_buf(),
        room_id: room_id.to_string(),
        agent_instance_id: agent_instance_id.to_string(),
        runtime: runtime.to_string(),
        workspace: workspace.to_path_buf(),
        mode: Some("fresh-session".to_string()),
        participant: participant.map(str::to_string),
        provider_conversation_ref: None,
        context_packet_ref: None,
        safety_mode: safety_mode.map(str::to_string),
    }
}
