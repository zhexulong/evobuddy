//! Substrate capability negotiation and action gating.
//!
//! Evaluation matrices for future backends (Zellij, cmux) must never be treated
//! as production implementations merely because the matrix type exists.

use anyhow::{bail, Result};
use std::collections::BTreeMap;

use super::SubstrateCapabilities;

/// Named substrate capabilities required by the contract and Task 20 matrix.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum SubstrateCapabilityKind {
    InteractiveAttach,
    DetachedPersistence,
    ExactInspect,
    ClientSwitching,
    RemoteAvailability,
    PlatformSupport,
    Recovery,
    CreateSession,
    ListSessions,
    Terminate,
}

/// Host / backend platform scope for capability gates.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubstratePlatform {
    /// Linux and macOS (tmux/zellij class).
    LinuxMacOs,
    /// macOS only (cmux-class workspace tools).
    MacOsOnly,
    /// Explicitly unsupported on the current host.
    Unsupported,
}

/// User/workbench actions that depend on substrate capabilities.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum SubstrateAction {
    OpenInteractive,
    CreateDetached,
    InspectExact,
    RecoverSession,
    ListManagedSessions,
    TerminateSession,
    UseRemote,
    SwitchWorkspaceFocus,
    SwitchClient,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CapabilityStatus {
    pub supported: bool,
    pub unsupported_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActionGate {
    pub action: SubstrateAction,
    pub enabled: bool,
    pub disabled_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubstrateCapabilityMatrix {
    pub backend_name: String,
    pub platform: SubstratePlatform,
    /// `production` for shipped backends; `evaluation-only` for ADR projections.
    production: bool,
    statuses: BTreeMap<SubstrateCapabilityKind, CapabilityStatus>,
}

impl SubstrateCapabilityMatrix {
    pub fn full(backend_name: &str, platform: SubstratePlatform) -> Self {
        let kinds = [
            SubstrateCapabilityKind::InteractiveAttach,
            SubstrateCapabilityKind::DetachedPersistence,
            SubstrateCapabilityKind::ExactInspect,
            SubstrateCapabilityKind::ClientSwitching,
            SubstrateCapabilityKind::RemoteAvailability,
            SubstrateCapabilityKind::PlatformSupport,
            SubstrateCapabilityKind::Recovery,
            SubstrateCapabilityKind::CreateSession,
            SubstrateCapabilityKind::ListSessions,
            SubstrateCapabilityKind::Terminate,
        ];
        let mut statuses = BTreeMap::new();
        for kind in kinds {
            statuses.insert(
                kind,
                CapabilityStatus {
                    supported: true,
                    unsupported_reason: None,
                },
            );
        }
        Self {
            backend_name: backend_name.to_string(),
            platform,
            production: true,
            statuses,
        }
    }

    pub fn evaluated(
        backend_name: &str,
        platform: SubstratePlatform,
        entries: &[(SubstrateCapabilityKind, bool, Option<&str>)],
    ) -> Self {
        Self::try_evaluated(backend_name, platform, entries)
            .expect("evaluated matrix entries must be valid")
    }

    pub fn try_evaluated(
        backend_name: &str,
        platform: SubstratePlatform,
        entries: &[(SubstrateCapabilityKind, bool, Option<&str>)],
    ) -> Result<Self> {
        let mut statuses = BTreeMap::new();
        for (kind, supported, reason) in entries {
            match (*supported, *reason) {
                (false, None) => {
                    bail!("unsupported capability requires reason");
                }
                (true, Some(_)) => {
                    bail!("supported capability must not carry unsupported_reason");
                }
                (supported, reason) => {
                    statuses.insert(
                        *kind,
                        CapabilityStatus {
                            supported,
                            unsupported_reason: reason.map(str::to_string),
                        },
                    );
                }
            }
        }
        Ok(Self {
            backend_name: backend_name.to_string(),
            platform,
            production: false,
            statuses,
        })
    }

    pub fn from_probe(capabilities: &SubstrateCapabilities, platform: SubstratePlatform) -> Self {
        let reason = capabilities.unsupported_reason.as_deref();
        let entry = |supported: bool, fallback: &str| -> CapabilityStatus {
            if supported {
                CapabilityStatus {
                    supported: true,
                    unsupported_reason: None,
                }
            } else {
                CapabilityStatus {
                    supported: false,
                    unsupported_reason: Some(reason.unwrap_or(fallback).to_string()),
                }
            }
        };
        let mut statuses = BTreeMap::new();
        statuses.insert(
            SubstrateCapabilityKind::CreateSession,
            entry(capabilities.supports_create, "create unsupported"),
        );
        statuses.insert(
            SubstrateCapabilityKind::InteractiveAttach,
            entry(capabilities.supports_attach, "attach unsupported"),
        );
        statuses.insert(
            SubstrateCapabilityKind::ExactInspect,
            entry(capabilities.supports_inspect, "inspect unsupported"),
        );
        statuses.insert(
            SubstrateCapabilityKind::ListSessions,
            entry(capabilities.supports_list, "list unsupported"),
        );
        statuses.insert(
            SubstrateCapabilityKind::Terminate,
            entry(capabilities.supports_terminate, "terminate unsupported"),
        );
        // Probe does not yet negotiate these extended matrix rows; leave them
        // supported only when all core ops are present (tmux-class backends).
        let core_ok = capabilities.supports_create
            && capabilities.supports_attach
            && capabilities.supports_inspect
            && capabilities.supports_list
            && capabilities.supports_terminate;
        for kind in [
            SubstrateCapabilityKind::DetachedPersistence,
            SubstrateCapabilityKind::ClientSwitching,
            SubstrateCapabilityKind::RemoteAvailability,
            SubstrateCapabilityKind::PlatformSupport,
            SubstrateCapabilityKind::Recovery,
        ] {
            statuses.insert(
                kind,
                entry(core_ok, "extended capability not negotiated by probe"),
            );
        }
        Self {
            backend_name: capabilities.backend_name.clone(),
            platform,
            production: true,
            statuses,
        }
    }

    pub fn status(&self, kind: SubstrateCapabilityKind) -> Option<&CapabilityStatus> {
        self.statuses.get(&kind)
    }

    pub fn is_production_backend(&self) -> bool {
        self.production
    }

    pub fn is_cross_platform_substrate(&self) -> bool {
        matches!(self.platform, SubstratePlatform::LinuxMacOs) && self.production
    }

    pub fn implementation_status(&self) -> &'static str {
        if self.production {
            "production"
        } else {
            "evaluation-only"
        }
    }

    pub fn actions_for_host(&self, host: SubstratePlatform) -> Vec<ActionGate> {
        let mut gates = action_gates_from_matrix(self);
        if !platform_compatible(self.platform, host) {
            for gate in &mut gates {
                if gate.enabled {
                    gate.enabled = false;
                    gate.disabled_reason = Some(platform_mismatch_reason(self.platform));
                }
            }
        }
        gates
    }
}

fn platform_compatible(backend: SubstratePlatform, host: SubstratePlatform) -> bool {
    match (backend, host) {
        (SubstratePlatform::Unsupported, _) => false,
        (_, SubstratePlatform::Unsupported) => false,
        (SubstratePlatform::MacOsOnly, SubstratePlatform::MacOsOnly) => true,
        (SubstratePlatform::MacOsOnly, _) => false,
        (SubstratePlatform::LinuxMacOs, SubstratePlatform::LinuxMacOs) => true,
        (SubstratePlatform::LinuxMacOs, SubstratePlatform::MacOsOnly) => true,
    }
}

fn platform_mismatch_reason(backend: SubstratePlatform) -> String {
    match backend {
        SubstratePlatform::MacOsOnly => "requires macOS host".to_string(),
        SubstratePlatform::LinuxMacOs => "requires Linux or macOS host".to_string(),
        SubstratePlatform::Unsupported => "platform unsupported".to_string(),
    }
}

fn require_capability(
    matrix: &SubstrateCapabilityMatrix,
    kind: SubstrateCapabilityKind,
) -> ActionGateParts {
    match matrix.status(kind) {
        Some(status) if status.supported => ActionGateParts {
            enabled: true,
            disabled_reason: None,
        },
        Some(status) => ActionGateParts {
            enabled: false,
            disabled_reason: status.unsupported_reason.clone(),
        },
        None => ActionGateParts {
            enabled: false,
            disabled_reason: Some(format!("capability {kind:?} not declared")),
        },
    }
}

struct ActionGateParts {
    enabled: bool,
    disabled_reason: Option<String>,
}

/// Map a capability matrix to fail-closed action gates with disable reasons.
pub fn action_gates_from_matrix(matrix: &SubstrateCapabilityMatrix) -> Vec<ActionGate> {
    let map = |action: SubstrateAction, kind: SubstrateCapabilityKind| {
        let parts = require_capability(matrix, kind);
        ActionGate {
            action,
            enabled: parts.enabled,
            disabled_reason: parts.disabled_reason,
        }
    };

    // Workspace focus uses client switching as its capability row for cmux-class tools.
    let switch_focus = require_capability(matrix, SubstrateCapabilityKind::ClientSwitching);

    vec![
        map(
            SubstrateAction::OpenInteractive,
            SubstrateCapabilityKind::InteractiveAttach,
        ),
        map(
            SubstrateAction::CreateDetached,
            SubstrateCapabilityKind::CreateSession,
        )
        .and_require(matrix, SubstrateCapabilityKind::DetachedPersistence),
        map(
            SubstrateAction::InspectExact,
            SubstrateCapabilityKind::ExactInspect,
        ),
        map(
            SubstrateAction::RecoverSession,
            SubstrateCapabilityKind::Recovery,
        ),
        map(
            SubstrateAction::ListManagedSessions,
            SubstrateCapabilityKind::ListSessions,
        ),
        map(
            SubstrateAction::TerminateSession,
            SubstrateCapabilityKind::Terminate,
        ),
        map(
            SubstrateAction::UseRemote,
            SubstrateCapabilityKind::RemoteAvailability,
        ),
        ActionGate {
            action: SubstrateAction::SwitchWorkspaceFocus,
            enabled: switch_focus.enabled,
            disabled_reason: switch_focus.disabled_reason,
        },
        map(
            SubstrateAction::SwitchClient,
            SubstrateCapabilityKind::ClientSwitching,
        ),
    ]
}

trait ActionGateCombine {
    fn and_require(
        self,
        matrix: &SubstrateCapabilityMatrix,
        kind: SubstrateCapabilityKind,
    ) -> ActionGate;
}

impl ActionGateCombine for ActionGate {
    fn and_require(
        mut self,
        matrix: &SubstrateCapabilityMatrix,
        kind: SubstrateCapabilityKind,
    ) -> ActionGate {
        if !self.enabled {
            return self;
        }
        let parts = require_capability(matrix, kind);
        if !parts.enabled {
            self.enabled = false;
            self.disabled_reason = parts.disabled_reason;
        }
        self
    }
}
