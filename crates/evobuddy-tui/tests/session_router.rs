use std::cell::RefCell;
use std::collections::BTreeMap;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::rc::Rc;

use evobuddy_tui::router::{
    RuntimeSessionAction, RuntimeSessionOpenRequest, RuntimeSessionRouter, RuntimeSessionResult,
};
use evobuddy_tui::session::{
    ContinuationCandidate, ContinuationDecision, NativeSessionBackend, NativeSessionDescriptor,
    ReconciliationClass, RuntimeSessionOpenPlan, SessionBackendError,
};
use evobuddy_tui::substrate::fake::FakeTerminalSubstrate;
use evobuddy_tui::substrate::{
    CreateSessionRequest, SessionDisplayMetadata, SessionScope, SubstrateSessionFacts,
    SubstrateSessionRef, TerminalSubstrate,
};

#[derive(Clone, Default)]
struct FakeNativeSessionBackend {
    plans: Rc<RefCell<BTreeMap<String, RuntimeSessionOpenPlan>>>,
    descriptors: Rc<RefCell<BTreeMap<String, NativeSessionDescriptor>>>,
    locked: Rc<RefCell<BTreeMap<String, bool>>>,
    pub fail_reserve: bool,
    pub fail_lock: bool,
    plan_open_calls: Rc<RefCell<usize>>,
    reserve_calls: Rc<RefCell<usize>>,
    commit_calls: Rc<RefCell<usize>>,
}

impl FakeNativeSessionBackend {
    fn with_plan(plan: RuntimeSessionOpenPlan) -> Self {
        let mut plans = BTreeMap::new();
        plans.insert(plan.intent.agent_instance_id.clone(), plan);
        Self {
            plans: Rc::new(RefCell::new(plans)),
            ..Self::default()
        }
    }
}

impl NativeSessionBackend for FakeNativeSessionBackend {
    fn with_instance_lock<T>(
        &self,
        agent_instance_id: &str,
        work: &mut dyn FnMut() -> Result<T, SessionBackendError>,
    ) -> Result<T, SessionBackendError> {
        if self.fail_lock {
            return Err(SessionBackendError::LockConflict {
                agent_instance_id: agent_instance_id.to_string(),
            });
        }
        if *self
            .locked
            .borrow()
            .get(agent_instance_id)
            .unwrap_or(&false)
        {
            return Err(SessionBackendError::LockConflict {
                agent_instance_id: agent_instance_id.to_string(),
            });
        }
        self.locked
            .borrow_mut()
            .insert(agent_instance_id.to_string(), true);
        let result = work();
        self.locked
            .borrow_mut()
            .insert(agent_instance_id.to_string(), false);
        result
    }

    fn plan_open(
        &self,
        request: &RuntimeSessionOpenRequest,
    ) -> Result<RuntimeSessionOpenPlan, SessionBackendError> {
        *self.plan_open_calls.borrow_mut() += 1;
        self.plans
            .borrow()
            .get(&request.agent_instance_id)
            .cloned()
            .ok_or_else(|| SessionBackendError::PlanOpenFailed {
                message: "missing plan".to_string(),
            })
    }

    fn reserve(
        &self,
        plan: &RuntimeSessionOpenPlan,
    ) -> Result<NativeSessionDescriptor, SessionBackendError> {
        *self.reserve_calls.borrow_mut() += 1;
        if self.fail_reserve {
            return Err(SessionBackendError::ReserveFailed {
                message: "reserve failed".to_string(),
            });
        }
        let descriptor = NativeSessionDescriptor {
            descriptor_id: plan.descriptor_id.clone(),
            room_id: plan.intent.room_id.clone(),
            agent_instance_id: plan.intent.agent_instance_id.clone(),
            runtime: plan.intent.runtime.clone(),
            workspace: plan.intent.workspace.clone(),
            terminal_session_ref: plan.intent.terminal_session_ref.clone(),
            lifecycle: "creating".to_string(),
            launch_command_ref: plan.launch_command_ref.clone(),
            runtime_capability_ref: plan.runtime_capability_ref.clone(),
            safety_mode: plan.intent.safety_mode.clone(),
            context_packet_ref: plan.intent.context_packet_ref.clone(),
        };
        self.descriptors
            .borrow_mut()
            .insert(descriptor.descriptor_id.clone(), descriptor.clone());
        Ok(descriptor)
    }

    fn commit(
        &self,
        descriptor_id: &str,
        substrate_ref: &str,
    ) -> Result<NativeSessionDescriptor, SessionBackendError> {
        *self.commit_calls.borrow_mut() += 1;
        let mut descriptors = self.descriptors.borrow_mut();
        let descriptor = descriptors
            .get_mut(descriptor_id)
            .ok_or_else(|| SessionBackendError::CommitFailed {
                message: "missing descriptor".to_string(),
            })?;
        descriptor.terminal_session_ref = substrate_ref.to_string();
        descriptor.lifecycle = "attachable".to_string();
        Ok(descriptor.clone())
    }

    fn inspect(
        &self,
        descriptor_id: &str,
    ) -> Result<NativeSessionDescriptor, SessionBackendError> {
        self.descriptors
            .borrow()
            .get(descriptor_id)
            .cloned()
            .ok_or_else(|| SessionBackendError::InspectFailed {
                message: "missing descriptor".to_string(),
            })
    }

    fn list(&self) -> Result<Vec<NativeSessionDescriptor>, SessionBackendError> {
        Ok(self.descriptors.borrow().values().cloned().collect())
    }

    fn reconcile(
        &self,
        substrate_facts: &[SubstrateSessionFacts],
    ) -> Result<Vec<ReconciliationClass>, SessionBackendError> {
        let descriptors = self.list()?;
        let live: BTreeMap<_, _> = substrate_facts
            .iter()
            .filter(|facts| facts.exists)
            .map(|facts| (facts.session_ref.0.clone(), facts))
            .collect();
        let mut by_agent: BTreeMap<String, usize> = BTreeMap::new();
        let mut by_ref: BTreeMap<String, usize> = BTreeMap::new();
        for descriptor in &descriptors {
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
                } else if by_agent.get(&descriptor.agent_instance_id).copied().unwrap_or(0) > 1
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
        Ok(classes)
    }
}

fn sample_plan(kind: &str) -> RuntimeSessionOpenPlan {
    RuntimeSessionOpenPlan {
        schema: "evobuddy.runtime-session-open-plan.v1".to_string(),
        descriptor_id: "session-1".to_string(),
        continuation: ContinuationDecision {
            kind: kind.to_string(),
            heuristic_candidate_source: if kind == "heuristic-resume" {
                Some("resume --last".to_string())
            } else {
                None
            },
            candidate_count: if kind == "heuristic-resume" { 2 } else { 0 },
            candidates: if kind == "heuristic-resume" {
                vec![
                    ContinuationCandidate {
                        candidate_id: "candidate-1".to_string(),
                        label: "Latest".to_string(),
                        provider_conversation_ref: Some("uuid-1".to_string()),
                        source_ref: "session:1".to_string(),
                        observed_at: "2026-07-20T00:00:00.000Z".to_string(),
                        confidence: "medium".to_string(),
                    },
                    ContinuationCandidate {
                        candidate_id: "candidate-2".to_string(),
                        label: "Previous".to_string(),
                        provider_conversation_ref: Some("uuid-2".to_string()),
                        source_ref: "session:2".to_string(),
                        observed_at: "2026-07-20T00:10:00.000Z".to_string(),
                        confidence: "low".to_string(),
                    },
                ]
            } else {
                vec![]
            },
            requires_structured_choice: kind == "heuristic-resume",
            disabled_reason: None,
        },
        intent: evobuddy_tui::session::RuntimeSessionIntent {
            room_id: "taskroom:alpha".to_string(),
            agent_instance_id: "instance-1".to_string(),
            runtime: "codex".to_string(),
            workspace: "/repo".to_string(),
            launch_mode: kind.to_string(),
            provider_conversation_ref: None,
            terminal_session_ref: "tmux:codex:taskroom:alpha:instance-1".to_string(),
            context_packet_ref: Some("context-packet:alpha".to_string()),
            safety_mode: "workspace-write".to_string(),
            expected_evidence_path: "/repo/.evobuddy/evidence-refresh/taskroom:alpha.json"
                .to_string(),
            recovery_hint: "reconcile-existing-before-creating-duplicate".to_string(),
        },
        create_session_request: CreateSessionRequest {
            descriptor_id: "session-1".to_string(),
            session_ref: SubstrateSessionRef(
                "tmux:codex:taskroom:alpha:instance-1".to_string(),
            ),
            launcher_plan_ref: "launch-plan:launch-plan-1".to_string(),
            program: PathBuf::from("codex"),
            args: vec![OsString::from("resume"), OsString::from("--last")],
            cwd: PathBuf::from("/repo"),
            environment_policy_ref: "environment-policy:workspace-write".to_string(),
            display: SessionDisplayMetadata {
                participant: "Builder".to_string(),
                runtime: "codex".to_string(),
                workspace: "/repo".to_string(),
                safety_mode: "workspace-write".to_string(),
                detach_shortcut: "Ctrl+B d".to_string(),
            },
        },
        runtime_capability_ref: "runtime-capability:codex-v1".to_string(),
        launch_command_ref: format!("launch-command:codex:{kind}"),
    }
}

fn open_request() -> RuntimeSessionOpenRequest {
    RuntimeSessionOpenRequest {
        project_root: PathBuf::from("/repo"),
        room_id: "taskroom:alpha".to_string(),
        agent_instance_id: "instance-1".to_string(),
        runtime: "codex".to_string(),
        workspace: PathBuf::from("/repo"),
        mode: Some("fresh-session".to_string()),
        participant: Some("Builder".to_string()),
        provider_conversation_ref: None,
        context_packet_ref: Some("context-packet:alpha".to_string()),
        safety_mode: Some("workspace-write".to_string()),
    }
}

#[test]
fn open_native_session_reserves_creates_and_commits_with_unchanged_create_request() {
    let plan = sample_plan("fresh-session");
    let backend = FakeNativeSessionBackend::with_plan(plan.clone());
    let substrate = FakeTerminalSubstrate::default();
    let router = RuntimeSessionRouter::new(backend.clone(), substrate.clone());

    let result = router
        .open_native_session(&open_request())
        .expect("open native session");

    match result {
        RuntimeSessionResult::Ready {
            action,
            plan: opened,
            descriptor,
            session_facts,
        } => {
            assert_eq!(
                action,
                RuntimeSessionAction::Attach {
                    session_ref: plan.create_session_request.session_ref.clone(),
                }
            );
            assert_eq!(opened.create_session_request, plan.create_session_request);
            assert_eq!(opened.create_session_request.launcher_plan_ref, "launch-plan:launch-plan-1");
            assert_eq!(opened.create_session_request.program, PathBuf::from("codex"));
            assert_eq!(
                opened.create_session_request.args,
                vec![OsString::from("resume"), OsString::from("--last")]
            );
            assert_eq!(opened.create_session_request.cwd, PathBuf::from("/repo"));
            assert_eq!(
                opened.create_session_request.environment_policy_ref,
                "environment-policy:workspace-write"
            );
            assert_eq!(descriptor.lifecycle, "attachable");
            assert!(session_facts.exists);
            assert!(session_facts.child_process_alive);
        }
        other => panic!("unexpected result: {other:?}"),
    }

    assert_eq!(*backend.plan_open_calls.borrow(), 1);
    assert_eq!(*backend.reserve_calls.borrow(), 1);
    assert_eq!(*backend.commit_calls.borrow(), 1);
}

#[test]
fn existing_attachable_session_attaches_without_create() {
    let plan = sample_plan("exact-resume");
    let backend = FakeNativeSessionBackend::with_plan(plan.clone());
    backend.descriptors.borrow_mut().insert(
        plan.descriptor_id.clone(),
        NativeSessionDescriptor {
            descriptor_id: plan.descriptor_id.clone(),
            room_id: plan.intent.room_id.clone(),
            agent_instance_id: plan.intent.agent_instance_id.clone(),
            runtime: plan.intent.runtime.clone(),
            workspace: plan.intent.workspace.clone(),
            terminal_session_ref: plan.intent.terminal_session_ref.clone(),
            lifecycle: "attachable".to_string(),
            launch_command_ref: plan.launch_command_ref.clone(),
            runtime_capability_ref: plan.runtime_capability_ref.clone(),
            safety_mode: plan.intent.safety_mode.clone(),
            context_packet_ref: plan.intent.context_packet_ref.clone(),
        },
    );
    let substrate = FakeTerminalSubstrate::with_sessions(vec![SubstrateSessionFacts {
        session_ref: plan.create_session_request.session_ref.clone(),
        exists: true,
        attached_client_count: 0,
        child_process_alive: true,
        last_activity_at: Some("2026-07-20T00:00:00.000Z".to_string()),
        exit_state: None,
        backend_metadata: BTreeMap::new(),
    }]);
    let router = RuntimeSessionRouter::new(backend.clone(), substrate);

    let result = router
        .open_native_session(&open_request())
        .expect("attach existing");

    match result {
        RuntimeSessionResult::Ready { action, .. } => {
            assert_eq!(
                action,
                RuntimeSessionAction::Attach {
                    session_ref: plan.create_session_request.session_ref.clone(),
                }
            );
        }
        other => panic!("unexpected result: {other:?}"),
    }
    assert_eq!(*backend.reserve_calls.borrow(), 0);
    assert_eq!(*backend.commit_calls.borrow(), 0);
}

#[test]
fn create_failure_after_reserve_returns_failed_without_commit() {
    let plan = sample_plan("fresh-session");
    let backend = FakeNativeSessionBackend::with_plan(plan);
    let substrate = FailingCreateSubstrate {
        inner: FakeTerminalSubstrate::default(),
    };
    let router = RuntimeSessionRouter::new(backend.clone(), substrate);

    let error = router
        .open_native_session(&open_request())
        .expect_err("create must fail");
    assert!(error.to_string().contains("create failed") || error.to_string().contains("create"));
    assert_eq!(*backend.reserve_calls.borrow(), 1);
    assert_eq!(*backend.commit_calls.borrow(), 0);
}

#[test]
fn multi_candidate_heuristic_payload_is_preserved_without_silent_selection() {
    let plan = sample_plan("heuristic-resume");
    let backend = FakeNativeSessionBackend::with_plan(plan.clone());
    let router = RuntimeSessionRouter::new(backend.clone(), FakeTerminalSubstrate::default());

    let result = router
        .open_native_session(&RuntimeSessionOpenRequest {
            mode: Some("heuristic-resume".to_string()),
            ..open_request()
        })
        .expect("open heuristic");

    match result {
        RuntimeSessionResult::NeedsChoice { plan: opened } => {
            assert_eq!(opened.continuation.kind, "heuristic-resume");
            assert_eq!(opened.continuation.candidate_count, 2);
            assert!(opened.continuation.requires_structured_choice);
            assert_eq!(opened.continuation.candidates.len(), 2);
            assert_eq!(opened.continuation.candidates[0].candidate_id, "candidate-1");
            assert_eq!(
                opened.continuation.candidates[1].provider_conversation_ref.as_deref(),
                Some("uuid-2")
            );
        }
        other => panic!("unexpected result: {other:?}"),
    }
    assert_eq!(*backend.reserve_calls.borrow(), 0);
    assert_eq!(*backend.commit_calls.borrow(), 0);
}

#[test]
fn lock_conflict_fails_closed_before_plan_open() {
    let plan = sample_plan("fresh-session");
    let backend = FakeNativeSessionBackend {
        fail_lock: true,
        ..FakeNativeSessionBackend::with_plan(plan)
    };
    let router = RuntimeSessionRouter::new(backend.clone(), FakeTerminalSubstrate::default());

    let error = router
        .open_native_session(&open_request())
        .expect_err("lock conflict");
    assert!(error.to_string().contains("lock") || error.to_string().contains("conflict"));
    assert_eq!(*backend.plan_open_calls.borrow(), 0);
}

#[test]
fn reconcile_classifies_matched_orphaned_conflicted_and_stale() {
    let backend = FakeNativeSessionBackend::default();
    backend.descriptors.borrow_mut().insert(
        "matched".to_string(),
        NativeSessionDescriptor {
            descriptor_id: "matched".to_string(),
            room_id: "taskroom:alpha".to_string(),
            agent_instance_id: "instance-1".to_string(),
            runtime: "codex".to_string(),
            workspace: "/repo".to_string(),
            terminal_session_ref: "tmux:matched".to_string(),
            lifecycle: "attachable".to_string(),
            launch_command_ref: "launch-command:codex:fresh-session".to_string(),
            runtime_capability_ref: "runtime-capability:codex-v1".to_string(),
            safety_mode: "workspace-write".to_string(),
            context_packet_ref: Some("context-packet:alpha".to_string()),
        },
    );
    backend.descriptors.borrow_mut().insert(
        "stale".to_string(),
        NativeSessionDescriptor {
            descriptor_id: "stale".to_string(),
            room_id: "taskroom:beta".to_string(),
            agent_instance_id: "instance-2".to_string(),
            runtime: "claude".to_string(),
            workspace: "/repo".to_string(),
            terminal_session_ref: "tmux:stale".to_string(),
            lifecycle: "attachable".to_string(),
            launch_command_ref: "launch-command:claude:fresh-session".to_string(),
            runtime_capability_ref: "runtime-capability:claude-v1".to_string(),
            safety_mode: "workspace-write".to_string(),
            context_packet_ref: Some("context-packet:beta".to_string()),
        },
    );
    backend.descriptors.borrow_mut().insert(
        "conflict-a".to_string(),
        NativeSessionDescriptor {
            descriptor_id: "conflict-a".to_string(),
            room_id: "taskroom:gamma".to_string(),
            agent_instance_id: "instance-3".to_string(),
            runtime: "opencode".to_string(),
            workspace: "/repo".to_string(),
            terminal_session_ref: "tmux:conflict".to_string(),
            lifecycle: "attachable".to_string(),
            launch_command_ref: "launch-command:opencode:fresh-session".to_string(),
            runtime_capability_ref: "runtime-capability:opencode-v1".to_string(),
            safety_mode: "workspace-write".to_string(),
            context_packet_ref: Some("context-packet:gamma".to_string()),
        },
    );
    backend.descriptors.borrow_mut().insert(
        "conflict-b".to_string(),
        NativeSessionDescriptor {
            descriptor_id: "conflict-b".to_string(),
            room_id: "taskroom:gamma".to_string(),
            agent_instance_id: "instance-3".to_string(),
            runtime: "opencode".to_string(),
            workspace: "/repo".to_string(),
            terminal_session_ref: "tmux:conflict".to_string(),
            lifecycle: "attachable".to_string(),
            launch_command_ref: "launch-command:opencode:fresh-session".to_string(),
            runtime_capability_ref: "runtime-capability:opencode-v1".to_string(),
            safety_mode: "workspace-write".to_string(),
            context_packet_ref: Some("context-packet:gamma".to_string()),
        },
    );

    let substrate = FakeTerminalSubstrate::with_sessions(vec![
        SubstrateSessionFacts {
            session_ref: SubstrateSessionRef("tmux:matched".to_string()),
            exists: true,
            attached_client_count: 0,
            child_process_alive: true,
            last_activity_at: None,
            exit_state: None,
            backend_metadata: BTreeMap::new(),
        },
        SubstrateSessionFacts {
            session_ref: SubstrateSessionRef("tmux:conflict".to_string()),
            exists: true,
            attached_client_count: 0,
            child_process_alive: true,
            last_activity_at: None,
            exit_state: None,
            backend_metadata: BTreeMap::new(),
        },
        SubstrateSessionFacts {
            session_ref: SubstrateSessionRef("tmux:orphan".to_string()),
            exists: true,
            attached_client_count: 0,
            child_process_alive: true,
            last_activity_at: None,
            exit_state: None,
            backend_metadata: BTreeMap::new(),
        },
    ]);
    let router = RuntimeSessionRouter::new(backend, substrate);
    let classes = router.reconcile().expect("reconcile");

    assert!(classes.iter().any(|class| matches!(
        class,
        ReconciliationClass::Matched {
            descriptor_id,
            ..
        } if descriptor_id == "matched"
    )));
    assert!(classes.iter().any(|class| matches!(
        class,
        ReconciliationClass::Stale {
            descriptor_id,
            ..
        } if descriptor_id == "stale"
    )));
    assert!(classes.iter().any(|class| matches!(
        class,
        ReconciliationClass::Conflicted {
            descriptor_id,
            ..
        } if descriptor_id == "conflict-a" || descriptor_id == "conflict-b"
    )));
    assert!(classes.iter().any(|class| matches!(
        class,
        ReconciliationClass::Orphaned {
            terminal_session_ref,
        } if terminal_session_ref == "tmux:orphan"
    )));
}

#[test]
fn node_backend_plan_open_command_uses_structured_argv() {
    let command = evobuddy_tui::backend::session_plan_open_command(
        Path::new("/repo with spaces"),
        "taskroom:alpha",
        "instance-1",
        "codex",
        Path::new("/repo with spaces"),
        Some("fresh-session"),
        Some("Builder"),
    );
    assert_eq!(command.program, "node");
    assert!(command.args.iter().any(|arg| arg == "scripts/evobuddy/evobuddy.mjs"));
    assert!(command.args.iter().any(|arg| arg == "taskroom"));
    assert!(command.args.iter().any(|arg| arg == "session"));
    assert!(command.args.iter().any(|arg| arg == "plan-open"));
    assert!(!command.args.iter().any(|arg| arg.contains("sh -lc") || arg.contains("&&")));
    assert!(command.args.iter().any(|arg| arg == "/repo with spaces"));
}

#[test]
fn node_backend_session_list_command_uses_structured_argv() {
    let command =
        evobuddy_tui::backend::session_list_command(Path::new("/repo with spaces"));
    assert_eq!(command.program, "node");
    assert!(command
        .args
        .iter()
        .any(|arg| arg == "scripts/evobuddy/evobuddy.mjs"));
    assert!(command.args.iter().any(|arg| arg == "taskroom"));
    assert!(command.args.iter().any(|arg| arg == "session"));
    assert!(command.args.iter().any(|arg| arg == "list"));
    assert!(command.args.iter().any(|arg| arg == "--project"));
    assert!(command.args.iter().any(|arg| arg == "/repo with spaces"));
    assert!(command.args.iter().any(|arg| arg == "--json"));
    assert!(!command
        .args
        .iter()
        .any(|arg| arg.contains("sh -lc") || arg.contains("&&")));
}

#[test]
fn parse_session_list_json_returns_descriptors() {
    let stdout = r#"[
      {
        "descriptorId": "session-1",
        "roomId": "taskroom:alpha",
        "agentInstanceId": "instance-1",
        "runtime": "codex",
        "workspace": "/repo",
        "terminalSessionRef": "tmux:codex:taskroom:alpha:instance-1",
        "lifecycle": "attachable",
        "launchCommandRef": "launch-command:codex:fresh-session",
        "runtimeCapabilityRef": "runtime-capability:codex-v1",
        "safetyMode": "workspace-write",
        "contextPacketRef": "context-packet:alpha"
      }
    ]"#;
    let listed = evobuddy_tui::session::parse_session_list_json(stdout).expect("parse list");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].descriptor_id, "session-1");
    assert_eq!(listed[0].lifecycle, "attachable");
    assert_eq!(
        listed[0].terminal_session_ref,
        "tmux:codex:taskroom:alpha:instance-1"
    );
}

#[test]
fn open_native_session_leaves_non_empty_list_after_reserve_and_commit() {
    let plan = sample_plan("fresh-session");
    let backend = FakeNativeSessionBackend::with_plan(plan.clone());
    let substrate = FakeTerminalSubstrate::default();
    let router = RuntimeSessionRouter::new(backend.clone(), substrate);

    assert!(
        backend.list().expect("list before").is_empty(),
        "list must start empty"
    );

    let result = router
        .open_native_session(&open_request())
        .expect("open native session");
    assert!(matches!(
        result,
        RuntimeSessionResult::Ready {
            action: RuntimeSessionAction::Attach { .. },
            ..
        }
    ));

    let listed = backend.list().expect("list after reserve/commit");
    assert!(
        !listed.is_empty(),
        "list must be non-empty after reserve/commit so reconciliation can see descriptors"
    );
    assert!(
        listed.iter().any(|descriptor| {
            descriptor.descriptor_id == plan.descriptor_id
                && descriptor.lifecycle == "attachable"
                && descriptor.agent_instance_id == plan.intent.agent_instance_id
        }),
        "list must include the committed descriptor: {listed:?}"
    );
}

#[test]
fn open_native_runtime_flow_renders_pre_attach_notice_then_guard_order() {
    use evobuddy_tui::substrate::tmux::{format_pre_attach_notice, AttachPath};
    use evobuddy_tui::terminal_mode::{TerminalControl, TerminalModeGuard};

    let plan = sample_plan("fresh-session");
    let notice = format_pre_attach_notice(
        &plan.create_session_request.display,
        &plan.create_session_request.session_ref,
    );
    assert!(notice.contains("Participant: Builder"));
    assert!(notice.contains("Runtime: codex"));
    assert!(notice.contains("Workspace: /repo"));
    assert!(notice.contains("Safety mode: workspace-write"));
    assert!(notice.contains("Session: tmux:codex:taskroom:alpha:instance-1"));
    assert!(notice.contains("Detach: Ctrl+B d"));

    #[derive(Clone, Default)]
    struct OrderControl {
        calls: Rc<RefCell<Vec<&'static str>>>,
    }
    impl TerminalControl for OrderControl {
        fn drain_events(&mut self) -> anyhow::Result<()> {
            self.calls.borrow_mut().push("drain");
            Ok(())
        }
        fn suspend(&mut self) -> anyhow::Result<()> {
            self.calls.borrow_mut().push("suspend");
            Ok(())
        }
        fn restore(&mut self) -> anyhow::Result<()> {
            self.calls.borrow_mut().push("restore");
            Ok(())
        }
    }

    let mut control = OrderControl::default();
    let calls = control.calls.clone();
    {
        let mut guard = TerminalModeGuard::enter(&mut control).expect("enter");
        calls.borrow_mut().push("attach");
        guard.restore().expect("restore");
    }
    assert_eq!(&*calls.borrow(), &["drain", "suspend", "attach", "restore"]);
    assert_eq!(
        AttachPath::DedicatedSocket.as_str(),
        "dedicated-socket"
    );
    assert_eq!(
        AttachPath::NestedTmuxDedicatedSocket.as_str(),
        "nested-tmux-dedicated-socket"
    );
}

#[test]
fn existing_attach_action_keeps_session_count_unchanged() {
    let plan = sample_plan("fresh-session");
    let backend = FakeNativeSessionBackend::with_plan(plan.clone());
    backend.descriptors.borrow_mut().insert(
        plan.descriptor_id.clone(),
        NativeSessionDescriptor {
            descriptor_id: plan.descriptor_id.clone(),
            room_id: plan.intent.room_id.clone(),
            agent_instance_id: plan.intent.agent_instance_id.clone(),
            runtime: plan.intent.runtime.clone(),
            workspace: plan.intent.workspace.clone(),
            terminal_session_ref: plan.intent.terminal_session_ref.clone(),
            lifecycle: "attachable".to_string(),
            launch_command_ref: plan.launch_command_ref.clone(),
            runtime_capability_ref: plan.runtime_capability_ref.clone(),
            safety_mode: plan.intent.safety_mode.clone(),
            context_packet_ref: plan.intent.context_packet_ref.clone(),
        },
    );
    let substrate = FakeTerminalSubstrate::with_sessions(vec![SubstrateSessionFacts {
        session_ref: plan.create_session_request.session_ref.clone(),
        exists: true,
        attached_client_count: 0,
        child_process_alive: true,
        last_activity_at: Some("2026-07-20T00:00:00.000Z".to_string()),
        exit_state: None,
        backend_metadata: BTreeMap::new(),
    }]);
    let before = substrate
        .list_sessions(&SessionScope::All)
        .expect("list before")
        .len();
    let router = RuntimeSessionRouter::new(backend.clone(), substrate.clone());
    let result = router
        .open_native_session(&open_request())
        .expect("open existing");
    match result {
        RuntimeSessionResult::Ready {
            action: RuntimeSessionAction::Attach { session_ref },
            ..
        } => {
            assert_eq!(session_ref, plan.create_session_request.session_ref);
        }
        other => panic!("unexpected result: {other:?}"),
    }
    let after = substrate
        .list_sessions(&SessionScope::All)
        .expect("list after")
        .len();
    assert_eq!(before, after);
    assert_eq!(*backend.reserve_calls.borrow(), 0);
    assert_eq!(*backend.commit_calls.borrow(), 0);
}

struct FailingCreateSubstrate {
    inner: FakeTerminalSubstrate,
}

impl TerminalSubstrate for FailingCreateSubstrate {
    fn probe(&self) -> anyhow::Result<evobuddy_tui::substrate::SubstrateCapabilities> {
        self.inner.probe()
    }

    fn create_session(
        &self,
        _request: &CreateSessionRequest,
    ) -> anyhow::Result<SubstrateSessionFacts> {
        anyhow::bail!("create failed")
    }

    fn attach_interactive(
        &self,
        session: &SubstrateSessionRef,
    ) -> anyhow::Result<evobuddy_tui::substrate::AttachOutcome> {
        self.inner.attach_interactive(session)
    }

    fn inspect(&self, session: &SubstrateSessionRef) -> anyhow::Result<SubstrateSessionFacts> {
        self.inner.inspect(session)
    }

    fn list_sessions(
        &self,
        scope: &SessionScope,
    ) -> anyhow::Result<Vec<SubstrateSessionFacts>> {
        self.inner.list_sessions(scope)
    }

    fn terminate(&self, session: &SubstrateSessionRef) -> anyhow::Result<()> {
        self.inner.terminate(session)
    }
}
