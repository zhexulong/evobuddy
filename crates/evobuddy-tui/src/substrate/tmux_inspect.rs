use anyhow::{bail, Context, Result};
use std::path::Path;
use std::process::{Command, Stdio};

use super::{validate_facts, SessionScope, SubstrateSessionFacts, SubstrateSessionRef};
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};

const SESSION_SEPARATOR: &str = "|||";

pub(crate) fn session_exists(
    binary: &str,
    socket_name: &str,
    session: &SubstrateSessionRef,
) -> Result<bool> {
    let status = Command::new(binary)
        .arg("-L")
        .arg(socket_name)
        .args(["has-session", "-t", &session.0])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .context("check tmux session existence")?;
    Ok(status.success())
}

pub(crate) fn list_session_rows(
    binary: &str,
    socket_name: &str,
    scope: &SessionScope,
) -> Result<Vec<(String, u32, String)>> {
    let format = format!(
        "#{{session_name}}{sep}#{{session_attached}}{sep}#{{session_created}}",
        sep = SESSION_SEPARATOR
    );
    let output = Command::new(binary)
        .arg("-L")
        .arg(socket_name)
        .args(["list-sessions", "-F", &format])
        .output()
        .with_context(|| "run tmux list-sessions".to_string())?;
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

pub(crate) fn pane_pid(
    binary: &str,
    socket_name: &str,
    session: &SubstrateSessionRef,
) -> Result<Option<u32>> {
    let output = Command::new(binary)
        .arg("-L")
        .arg(socket_name)
        .args(["list-panes", "-t", &session.0, "-F", "#{pane_pid}"])
        .output()
        .context("list panes")?;
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

pub(crate) fn session_facts(
    binary: &str,
    socket_name: &str,
    terminated: &RefCell<BTreeSet<String>>,
    session: &SubstrateSessionRef,
    exists: bool,
    attached: u32,
    created: Option<String>,
) -> Result<SubstrateSessionFacts> {
    let child_process_alive = pane_pid(binary, socket_name, session)?
        .map(pid_alive)
        .unwrap_or(false);
    let facts = SubstrateSessionFacts {
        session_ref: session.clone(),
        exists,
        attached_client_count: attached,
        child_process_alive,
        last_activity_at: created,
        exit_state: if exists {
            None
        } else if terminated.borrow().contains(&session.0) {
            Some("terminated".to_string())
        } else {
            None
        },
        backend_metadata: BTreeMap::from([
            ("managedBy".to_string(), "evobuddy".to_string()),
            ("socketName".to_string(), socket_name.to_string()),
            ("taskroomStateDerived".to_string(), "false".to_string()),
        ]),
    };
    validate_facts(&facts)?;
    Ok(facts)
}
