use anyhow::{bail, Result};
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::rc::Rc;

use super::{
    validate_facts, AttachOutcome, CreateSessionRequest, SessionScope, SubstrateCapabilities,
    SubstrateSessionFacts, SubstrateSessionRef, TerminalSubstrate,
};

#[derive(Clone, Default)]
pub struct FakeTerminalSubstrate {
    sessions: Rc<RefCell<BTreeMap<SubstrateSessionRef, SubstrateSessionFacts>>>,
    fail_on_probe: bool,
    fail_on_create: bool,
    fail_on_attach: bool,
    fail_on_list: bool,
    fail_on_terminate: bool,
}

impl FakeTerminalSubstrate {
    pub fn with_sessions(sessions: Vec<SubstrateSessionFacts>) -> Self {
        Self {
            sessions: Rc::new(RefCell::new(
                sessions
                    .into_iter()
                    .map(|session| (session.session_ref.clone(), session))
                    .collect(),
            )),
            ..Self::default()
        }
    }
}

impl TerminalSubstrate for FakeTerminalSubstrate {
    fn probe(&self) -> Result<SubstrateCapabilities> {
        if self.fail_on_probe {
            bail!("probe failed");
        }
        Ok(SubstrateCapabilities {
            backend_name: "fake".to_string(),
            supports_create: true,
            supports_attach: true,
            supports_inspect: true,
            supports_list: true,
            supports_terminate: true,
            unsupported_reason: None,
        })
    }

    fn create_session(&self, request: &CreateSessionRequest) -> Result<SubstrateSessionFacts> {
        if self.fail_on_create {
            bail!("create failed");
        }
        let facts = SubstrateSessionFacts {
            session_ref: request.session_ref.clone(),
            exists: true,
            attached_client_count: 0,
            child_process_alive: true,
            last_activity_at: Some("2026-07-20T00:00:00.000Z".to_string()),
            exit_state: None,
            backend_metadata: BTreeMap::from([
                (
                    "participant".to_string(),
                    request.display.participant.clone(),
                ),
                ("runtime".to_string(), request.display.runtime.clone()),
                ("taskroomStateDerived".to_string(), "false".to_string()),
            ]),
        };
        self.sessions
            .borrow_mut()
            .insert(request.session_ref.clone(), facts.clone());
        Ok(facts)
    }

    fn attach_interactive(&self, session: &SubstrateSessionRef) -> Result<AttachOutcome> {
        if self.fail_on_attach {
            bail!("attach failed");
        }
        if !self.sessions.borrow().contains_key(session) {
            bail!("session not found");
        }
        Ok(AttachOutcome::Detached)
    }

    fn inspect(&self, session: &SubstrateSessionRef) -> Result<SubstrateSessionFacts> {
        let facts = self
            .sessions
            .borrow()
            .get(session)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("session not found"))?;
        validate_facts(&facts)?;
        Ok(facts)
    }

    fn list_sessions(&self, scope: &SessionScope) -> Result<Vec<SubstrateSessionFacts>> {
        if self.fail_on_list {
            bail!("list failed");
        }
        let sessions = self.sessions.borrow();
        let mut listed = sessions
            .values()
            .filter(|facts| match scope {
                SessionScope::All => true,
                SessionScope::Prefix(prefix) => facts.session_ref.0.starts_with(prefix),
            })
            .cloned()
            .collect::<Vec<_>>();
        listed.sort_by(|left, right| left.session_ref.0.cmp(&right.session_ref.0));
        Ok(listed)
    }

    fn terminate(&self, session: &SubstrateSessionRef) -> Result<()> {
        if self.fail_on_terminate {
            bail!("terminate failed");
        }
        let mut sessions = self.sessions.borrow_mut();
        let Some(facts) = sessions.get_mut(session) else {
            bail!("session not found");
        };
        facts.child_process_alive = false;
        facts.exists = false;
        facts.exit_state = Some("terminated".to_string());
        Ok(())
    }
}
