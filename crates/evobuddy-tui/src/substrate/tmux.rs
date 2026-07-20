use anyhow::{bail, Context, Result};
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};
use std::io::{self, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::rc::Rc;

use super::{
    validate_facts, AttachOutcome, CreateSessionRequest, SessionDisplayMetadata, SessionScope,
    SubstrateCapabilities, SubstrateSessionFacts, SubstrateSessionRef, TerminalSubstrate,
};

const SESSION_SEPARATOR: &str = "|||";
const MANAGED_STATUS_LINE: &str = "EvoBuddy-managed | Detach: Ctrl+B d";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttachPath {
    DedicatedSocket,
    NestedTmuxDedicatedSocket,
}

impl AttachPath {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::DedicatedSocket => "dedicated-socket",
            Self::NestedTmuxDedicatedSocket => "nested-tmux-dedicated-socket",
        }
    }
}

pub fn managed_status_line() -> &'static str {
    MANAGED_STATUS_LINE
}

pub fn format_pre_attach_notice(
    display: &SessionDisplayMetadata,
    session: &SubstrateSessionRef,
) -> String {
    format!(
        "Attaching to native runtime\nParticipant: {}\nRuntime: {}\nWorkspace: {}\nSafety mode: {}\nSession: {}\nDetach: Ctrl+B d\n",
        display.participant,
        display.runtime,
        display.workspace,
        display.safety_mode,
        session.0
    )
}

pub fn map_attach_exit_status(
    command_success: bool,
    session_exists: bool,
    interrupted: bool,
) -> AttachOutcome {
    if interrupted {
        return AttachOutcome::Interrupted;
    }
    if command_success && session_exists {
        return AttachOutcome::Detached;
    }
    if command_success && !session_exists {
        return AttachOutcome::SessionEnded;
    }
    AttachOutcome::AttachFailed
}

#[derive(Clone, Default)]
pub struct TmuxSubstrate {
    binary: String,
    socket_name: String,
    terminated: Rc<RefCell<BTreeSet<String>>>,
    last_attach_path: Rc<RefCell<Option<AttachPath>>>,
}

impl TmuxSubstrate {
    pub fn new(binary: &str, socket_name: &str) -> Self {
        Self {
            binary: binary.to_string(),
            socket_name: socket_name.to_string(),
            terminated: Rc::new(RefCell::new(BTreeSet::new())),
            last_attach_path: Rc::new(RefCell::new(None)),
        }
    }

    pub fn last_attach_path(&self) -> Option<AttachPath> {
        *self.last_attach_path.borrow()
    }

    fn command(&self) -> Command {
        let mut command = Command::new(&self.binary);
        command.arg("-L").arg(&self.socket_name);
        command
    }

    fn command_output(&self, args: &[&str]) -> Result<std::process::Output> {
        self.command()
            .args(args)
            .output()
            .with_context(|| format!("run tmux command: {} {}", self.binary, args.join(" ")))
    }

    fn session_exists(&self, session: &SubstrateSessionRef) -> Result<bool> {
        let status = self
            .command()
            .args(["has-session", "-t", &session.0])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .context("check tmux session existence")?;
        Ok(status.success())
    }

    fn list_session_rows(&self, scope: &SessionScope) -> Result<Vec<(String, u32, String)>> {
        let format = format!(
            "#{{session_name}}{sep}#{{session_attached}}{sep}#{{session_created}}",
            sep = SESSION_SEPARATOR
        );
        let output = self.command_output(&["list-sessions", "-F", &format])?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("no server running") {
                return Ok(Vec::new());
            }
            bail!("malformed tmux output");
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| {
                let parts = line.split(SESSION_SEPARATOR).collect::<Vec<_>>();
                if parts.len() != 3 {
                    bail!("malformed tmux output");
                }
                let name = parts[0].to_string();
                if matches!(scope, SessionScope::Prefix(prefix) if !name.starts_with(prefix)) {
                    return Ok(None);
                }
                let attached = parts[1]
                    .parse::<u32>()
                    .map_err(|_| anyhow::anyhow!("malformed tmux output"))?;
                Ok(Some((name, attached, parts[2].to_string())))
            })
            .filter_map(|result| match result {
                Ok(Some(value)) => Some(Ok(value)),
                Ok(None) => None,
                Err(error) => Some(Err(error)),
            })
            .collect()
    }

    fn pane_pid(&self, session: &SubstrateSessionRef) -> Result<Option<u32>> {
        let output = self.command_output(&["list-panes", "-t", &session.0, "-F", "#{pane_pid}"])?;
        if !output.status.success() {
            return Ok(None);
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        let pid = stdout.lines().next().unwrap_or_default().trim();
        if pid.is_empty() {
            return Ok(None);
        }
        Ok(Some(pid.parse::<u32>().context("parse pane pid")?))
    }

    fn pid_alive(pid: u32) -> bool {
        Path::new(&format!("/proc/{pid}")).exists()
    }

    fn session_facts(
        &self,
        session: &SubstrateSessionRef,
        exists: bool,
        attached: u32,
        created: Option<String>,
    ) -> Result<SubstrateSessionFacts> {
        let child_process_alive = self
            .pane_pid(session)?
            .map(Self::pid_alive)
            .unwrap_or(false);
        let facts = SubstrateSessionFacts {
            session_ref: session.clone(),
            exists,
            attached_client_count: attached,
            child_process_alive,
            last_activity_at: created,
            exit_state: if exists {
                None
            } else if self.terminated.borrow().contains(&session.0) {
                Some("terminated".to_string())
            } else {
                None
            },
            backend_metadata: BTreeMap::from([
                ("managedBy".to_string(), "evobuddy".to_string()),
                ("socketName".to_string(), self.socket_name.clone()),
                ("taskroomStateDerived".to_string(), "false".to_string()),
            ]),
        };
        validate_facts(&facts)?;
        Ok(facts)
    }

    fn choose_attach_path(&self) -> AttachPath {
        if std::env::var_os("TMUX").is_some() {
            AttachPath::NestedTmuxDedicatedSocket
        } else {
            AttachPath::DedicatedSocket
        }
    }

    fn run_blocking_attach(
        &self,
        session: &SubstrateSessionRef,
    ) -> Result<std::process::ExitStatus> {
        let path = self.choose_attach_path();
        *self.last_attach_path.borrow_mut() = Some(path);

        let mut command = self.command();
        command
            .arg("attach-session")
            .arg("-t")
            .arg(&session.0)
            .stdin(Stdio::inherit())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit());

        let status = command.status().context("run tmux attach-session")?;
        Ok(status)
    }

    pub fn attach_command_args(&self, session: &SubstrateSessionRef) -> Vec<String> {
        vec![
            self.binary.clone(),
            "-L".to_string(),
            self.socket_name.clone(),
            "attach-session".to_string(),
            "-t".to_string(),
            session.0.clone(),
        ]
    }

    pub fn resolve_attach_path(&self) -> AttachPath {
        self.choose_attach_path()
    }
}

impl TerminalSubstrate for TmuxSubstrate {
    fn probe(&self) -> Result<SubstrateCapabilities> {
        let output = Command::new(&self.binary)
            .arg("-V")
            .output()
            .context("probe tmux version")?;
        if !output.status.success() {
            bail!("tmux version probe failed");
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        if !stdout.starts_with("tmux ") {
            bail!("malformed tmux output");
        }
        Ok(SubstrateCapabilities {
            backend_name: "tmux".to_string(),
            supports_create: true,
            supports_attach: true,
            supports_inspect: true,
            supports_list: true,
            supports_terminate: true,
            unsupported_reason: None,
        })
    }

    fn create_session(&self, request: &CreateSessionRequest) -> Result<SubstrateSessionFacts> {
        let session_name = &request.session_ref.0;
        if self.session_exists(&request.session_ref)? {
            bail!("session already exists");
        }
        let mut command = self.command();
        command
            .arg("new-session")
            .arg("-d")
            .arg("-s")
            .arg(session_name)
            .arg("-c")
            .arg(&request.cwd)
            .arg(&request.program);
        command.args(&request.args);
        let status = command.status().context("create tmux session")?;
        if !status.success() {
            bail!("tmux new-session failed");
        }

        let _ = self.command_output(&[
            "set-option",
            "-t",
            session_name,
            "status-left",
            MANAGED_STATUS_LINE,
        ]);
        let _ =
            self.command_output(&["set-option", "-t", session_name, "status-left-length", "80"]);
        self.terminated.borrow_mut().remove(session_name);
        self.inspect(&request.session_ref)
    }

    fn attach_interactive(&self, session: &SubstrateSessionRef) -> Result<AttachOutcome> {
        if !self.session_exists(session)? {
            bail!("session not found");
        }

        let status = self.run_blocking_attach(session)?;
        let interrupted = match status.code() {
            Some(code) => code == 130 || code == 129,
            None => {
                #[cfg(unix)]
                {
                    use std::os::unix::process::ExitStatusExt;
                    matches!(status.signal(), Some(2) | Some(15))
                }
                #[cfg(not(unix))]
                {
                    false
                }
            }
        };
        let exists = self.session_exists(session).unwrap_or(false);
        Ok(map_attach_exit_status(
            status.success(),
            exists,
            interrupted,
        ))
    }

    fn inspect(&self, session: &SubstrateSessionRef) -> Result<SubstrateSessionFacts> {
        if !self.session_exists(session)? {
            return self.session_facts(session, false, 0, None);
        }
        let rows = self.list_session_rows(&SessionScope::Prefix(session.0.clone()))?;
        let (_, attached, created) = rows
            .into_iter()
            .find(|(name, _, _)| name == &session.0)
            .ok_or_else(|| anyhow::anyhow!("malformed tmux output"))?;
        self.session_facts(session, true, attached, Some(created))
    }

    fn list_sessions(&self, scope: &SessionScope) -> Result<Vec<SubstrateSessionFacts>> {
        self.list_session_rows(scope)?
            .into_iter()
            .map(|(name, attached, created)| {
                self.session_facts(&SubstrateSessionRef(name), true, attached, Some(created))
            })
            .collect()
    }

    fn terminate(&self, session: &SubstrateSessionRef) -> Result<()> {
        let output = self.command_output(&["kill-session", "-t", &session.0])?;
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !output.status.success()
            && !stderr.contains("can't find session")
            && !stderr.contains("no server running")
        {
            bail!("tmux kill-session failed");
        }
        self.terminated.borrow_mut().insert(session.0.clone());
        Ok(())
    }
}

pub fn write_pre_attach_notice(notice: &str) -> Result<()> {
    let mut stdout = io::stdout();
    writeln!(stdout, "{notice}").context("write pre-attach notice")?;
    stdout.flush().context("flush pre-attach notice")?;
    Ok(())
}
