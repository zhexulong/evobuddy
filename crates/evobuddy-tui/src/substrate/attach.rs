use anyhow::{Context, Result};
use std::io::{self, Write};

use super::{AttachOutcome, SessionDisplayMetadata, SubstrateSessionRef};

const MANAGED_STATUS_LINE: &str = "EvoBuddy | leave: F10 or Ctrl+\\  (also Ctrl+B d)";

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
        "Attaching to native runtime\nParticipant: {}\nRuntime: {}\nWorkspace: {}\nSafety mode: {}\nSession: {}\nLeave session: F10  or  Ctrl+\\  (also Ctrl+B d)\n",
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
    if session_exists {
        return AttachOutcome::Detached;
    }
    if command_success {
        return AttachOutcome::SessionEnded;
    }
    AttachOutcome::AttachFailed
}

pub fn write_pre_attach_notice(notice: &str) -> Result<()> {
    let mut stdout = io::stdout();
    writeln!(stdout, "{notice}").context("write pre-attach notice")?;
    stdout.flush().context("flush pre-attach notice")?;
    Ok(())
}

pub fn choose_attach_path() -> AttachPath {
    if std::env::var_os("TMUX").is_some() {
        AttachPath::NestedTmuxDedicatedSocket
    } else {
        AttachPath::DedicatedSocket
    }
}
