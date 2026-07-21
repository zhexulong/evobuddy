use crate::model::{
    ActionAvailability, NativeSessionLifecycle, NativeSessionSummary, RuntimeCapabilitySummary,
    TaskRoom,
};

#[derive(Debug, Clone)]
pub struct RuntimeActionContext<'a> {
    pub room: &'a TaskRoom,
    pub capability: Option<&'a RuntimeCapabilitySummary>,
    pub session: Option<&'a NativeSessionSummary>,
    pub provider_conversation_ref_validated: bool,
    pub heuristic_candidate_count: usize,
    pub substrate_available: bool,
    pub recovery: &'a [RecoveryDiagnostic],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RecoveryDiagnostic {
    MissingTmux,
    StaleDescriptor,
    OrphanSession,
    ConflictedSession,
    DeadChild,
    AttachFailure,
    RestoreFailure,
    UnsupportedExactResume,
    EvidenceStale,
    EvidenceUnknown,
}

impl RecoveryDiagnostic {
    pub fn label(&self) -> &'static str {
        match self {
            Self::MissingTmux => "missing tmux",
            Self::StaleDescriptor => "stale descriptor",
            Self::OrphanSession => "orphan session",
            Self::ConflictedSession => "conflicted session",
            Self::DeadChild => "dead child process",
            Self::AttachFailure => "attach failure",
            Self::RestoreFailure => "restore failure",
            Self::UnsupportedExactResume => "unsupported exact resume",
            Self::EvidenceStale => "evidence stale",
            Self::EvidenceUnknown => "evidence unknown",
        }
    }
}

pub fn derive_runtime_session_actions(ctx: &RuntimeActionContext<'_>) -> Vec<ActionAvailability> {
    let mut actions = Vec::new();
    let capability = ctx.capability;
    let session = ctx.session;

    let open_enabled = ctx.substrate_available
        && capability
            .map(|cap| cap.unsupported_reason.is_none())
            .unwrap_or(false)
        && session
            .map(|item| {
                matches!(
                    item.lifecycle,
                    NativeSessionLifecycle::Attachable
                        | NativeSessionLifecycle::Attached
                        | NativeSessionLifecycle::Detached
                        | NativeSessionLifecycle::Creating
                )
            })
            .unwrap_or(true);
    actions.push(ActionAvailability {
        id: "open-session".to_string(),
        label: "Open session".to_string(),
        enabled: open_enabled,
        disabled_reason: if open_enabled {
            None
        } else if !ctx.substrate_available {
            Some("missing tmux".to_string())
        } else {
            Some(
                capability
                    .and_then(|cap| cap.unsupported_reason.clone())
                    .unwrap_or_else(|| "runtime session unavailable".to_string()),
            )
        },
    });

    let exact_supported = capability
        .map(|cap| cap.exact_resume_supported)
        .unwrap_or(false);
    let exact_enabled = exact_supported && ctx.provider_conversation_ref_validated;
    actions.push(ActionAvailability {
        id: "resume-conversation".to_string(),
        label: "Resume conversation".to_string(),
        enabled: exact_enabled,
        disabled_reason: if exact_enabled {
            None
        } else if exact_supported {
            Some("Exact resume requires validated provider conversation identity.".to_string())
        } else {
            Some("Exact resume unsupported for this runtime.".to_string())
        },
    });

    let heuristic_supported = capability
        .map(|cap| cap.heuristic_resume_supported)
        .unwrap_or(false);
    let heuristic_enabled = heuristic_supported && ctx.heuristic_candidate_count > 0;
    let heuristic_label = if ctx.heuristic_candidate_count > 1 {
        "Heuristic resume".to_string()
    } else {
        "Resume latest candidate".to_string()
    };
    actions.push(ActionAvailability {
        id: "heuristic-resume".to_string(),
        label: heuristic_label,
        enabled: heuristic_enabled,
        disabled_reason: if heuristic_enabled {
            None
        } else {
            Some("Heuristic resume candidates unavailable.".to_string())
        },
    });

    let context_enabled = capability
        .map(|cap| cap.supports_context_continuation)
        .unwrap_or(false)
        && !ctx.room.objective.is_empty();
    actions.push(ActionAvailability {
        id: "continue-with-context".to_string(),
        label: "Continue with TaskRoom context".to_string(),
        enabled: context_enabled,
        disabled_reason: if context_enabled {
            None
        } else {
            Some("Context continuation requires TaskRoom context.".to_string())
        },
    });

    let fresh_enabled = capability
        .map(|cap| cap.supports_fresh_session)
        .unwrap_or(false);
    actions.push(ActionAvailability {
        id: "start-new-session".to_string(),
        label: "Start new session".to_string(),
        enabled: fresh_enabled,
        disabled_reason: if fresh_enabled {
            None
        } else {
            Some("Fresh session unsupported.".to_string())
        },
    });

    actions.push(ActionAvailability {
        id: "view-evidence".to_string(),
        label: "View evidence".to_string(),
        enabled: true,
        disabled_reason: None,
    });

    let retry_enabled = ctx.recovery.iter().any(|item| {
        matches!(
            item,
            RecoveryDiagnostic::AttachFailure
                | RecoveryDiagnostic::RestoreFailure
                | RecoveryDiagnostic::DeadChild
                | RecoveryDiagnostic::StaleDescriptor
        )
    });
    actions.push(ActionAvailability {
        id: "retry".to_string(),
        label: "Retry".to_string(),
        enabled: retry_enabled,
        disabled_reason: if retry_enabled {
            None
        } else {
            Some("No recoverable failure present.".to_string())
        },
    });

    actions
}

pub fn classify_recovery(
    substrate_available: bool,
    session: Option<&NativeSessionSummary>,
    attention_state: Option<&str>,
    exact_resume_supported: bool,
    provider_conversation_ref_validated: bool,
) -> Vec<RecoveryDiagnostic> {
    let mut out = Vec::new();
    if !substrate_available {
        out.push(RecoveryDiagnostic::MissingTmux);
    }
    if let Some(session) = session {
        if matches!(session.lifecycle, NativeSessionLifecycle::Stale) {
            out.push(RecoveryDiagnostic::StaleDescriptor);
        }
        if matches!(session.lifecycle, NativeSessionLifecycle::Failed) {
            out.push(RecoveryDiagnostic::AttachFailure);
        }
        if matches!(session.lifecycle, NativeSessionLifecycle::Terminated) {
            out.push(RecoveryDiagnostic::DeadChild);
        }
    }
    if exact_resume_supported && !provider_conversation_ref_validated {
        out.push(RecoveryDiagnostic::UnsupportedExactResume);
    }
    match attention_state {
        Some(state) if state.eq_ignore_ascii_case("stale") => {
            out.push(RecoveryDiagnostic::EvidenceStale)
        }
        Some(state) if state.eq_ignore_ascii_case("unknown") => {
            out.push(RecoveryDiagnostic::EvidenceUnknown)
        }
        _ => {}
    }
    out
}
