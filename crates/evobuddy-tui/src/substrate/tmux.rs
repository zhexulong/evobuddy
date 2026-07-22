use anyhow::{bail, Context, Result};
use std::cell::RefCell;
use std::collections::BTreeSet;
use std::process::{Command, Stdio};
use std::rc::Rc;

use crate::launcher::{build_launcher_argv, parse_launcher_plan_ref, sanitize_session_name};

use super::attach;
use super::tmux_inspect::{list_session_rows, session_exists, session_facts};
use super::{
    AttachOutcome, CreateSessionRequest, SessionScope, SubstrateCapabilities,
    SubstrateSessionFacts, SubstrateSessionRef, TerminalSubstrate,
};

pub use super::attach::{
    format_pre_attach_notice, managed_status_line, map_attach_exit_status, write_pre_attach_notice,
    AttachPath,
};

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

    fn run_blocking_attach(
        &self,
        session: &SubstrateSessionRef,
    ) -> Result<std::process::ExitStatus> {
        let path = attach::choose_attach_path();
        *self.last_attach_path.borrow_mut() = Some(path);
        let mut command = self.command();
        command
            .arg("attach-session")
            .arg("-t")
            .arg(&session.0)
            .stdin(Stdio::inherit())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit());
        command.status().context("run tmux attach-session")
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
        attach::choose_attach_path()
    }

    pub fn build_new_session_argv(&self, request: &CreateSessionRequest) -> Result<Vec<String>> {
        let session_name = sanitize_session_name(&request.session_ref.0)
            .with_context(|| format!("invalid session name: {}", request.session_ref.0))?;
        let plan_id = parse_launcher_plan_ref(&request.launcher_plan_ref)
            .context("invalid launcher plan ref")?;
        let project_root = if request.project_root.as_os_str().is_empty() {
            std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
        } else {
            request.project_root.clone()
        };
        let launcher_argv = build_launcher_argv(&project_root, &plan_id)?;
        let mut argv = vec![
            self.binary.clone(),
            "-L".to_string(),
            self.socket_name.clone(),
            "new-session".to_string(),
            "-d".to_string(),
            "-s".to_string(),
            session_name,
            "-c".to_string(),
            request.cwd.display().to_string(),
        ];
        argv.extend(launcher_argv);
        Ok(argv)
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
        let session_name = sanitize_session_name(&request.session_ref.0)
            .with_context(|| format!("invalid session name: {}", request.session_ref.0))?;
        let session_ref = SubstrateSessionRef(session_name.clone());
        if session_exists(&self.binary, &self.socket_name, &session_ref)? {
            bail!("session already exists");
        }
        let argv = self.build_new_session_argv(request)?;
        // Skip binary (argv[0]); Command::new already sets it via self.command().
        let mut command = self.command();
        // argv is [tmux, -L, socket, new-session, ...]; self.command() already has tmux -L socket
        let rest = if argv.len() >= 3 && argv[0] == self.binary {
            &argv[3..]
        } else {
            &argv[1..]
        };
        command.args(rest);
        let status = command.status().context("create tmux session")?;
        if !status.success() {
            bail!("tmux new-session failed");
        }
        let status_line = attach::managed_status_line();
        let _ = self.command_output(&[
            "set-option",
            "-t",
            &session_name,
            "status-left",
            status_line,
        ]);
        let _ = self.command_output(&[
            "set-option",
            "-t",
            &session_name,
            "status-left-length",
            "80",
        ]);
        self.terminated.borrow_mut().remove(&session_name);
        self.inspect(&session_ref)
    }

    fn attach_interactive(&self, session: &SubstrateSessionRef) -> Result<AttachOutcome> {
        if !session_exists(&self.binary, &self.socket_name, session)? {
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
        let exists = session_exists(&self.binary, &self.socket_name, session).unwrap_or(false);
        Ok(attach::map_attach_exit_status(
            status.success(),
            exists,
            interrupted,
        ))
    }

    fn inspect(&self, session: &SubstrateSessionRef) -> Result<SubstrateSessionFacts> {
        if !session_exists(&self.binary, &self.socket_name, session)? {
            return session_facts(
                &self.binary,
                &self.socket_name,
                &self.terminated,
                session,
                false,
                0,
                None,
            );
        }
        let rows = list_session_rows(
            &self.binary,
            &self.socket_name,
            &SessionScope::Prefix(session.0.clone()),
        )?;
        let (_, attached, created) = rows
            .into_iter()
            .find(|(name, _, _)| name == &session.0)
            .ok_or_else(|| anyhow::anyhow!("malformed tmux output"))?;
        session_facts(
            &self.binary,
            &self.socket_name,
            &self.terminated,
            session,
            true,
            attached,
            Some(created),
        )
    }

    fn list_sessions(&self, scope: &SessionScope) -> Result<Vec<SubstrateSessionFacts>> {
        list_session_rows(&self.binary, &self.socket_name, scope)?
            .into_iter()
            .map(|(name, attached, created)| {
                session_facts(
                    &self.binary,
                    &self.socket_name,
                    &self.terminated,
                    &SubstrateSessionRef(name),
                    true,
                    attached,
                    Some(created),
                )
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
