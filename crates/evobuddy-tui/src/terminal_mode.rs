use anyhow::{Context, Result};
use crossterm::cursor::Show;
use crossterm::event::{poll, read, Event};
use crossterm::terminal::{
    disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen,
};
use crossterm::ExecutableCommand;
use std::io::{self, Write};
use std::time::Duration;

pub trait TerminalControl {
    fn drain_events(&mut self) -> Result<()>;
    fn suspend(&mut self) -> Result<()>;
    fn restore(&mut self) -> Result<()>;
}

pub struct TerminalModeGuard<'a, T: TerminalControl> {
    control: Option<&'a mut T>,
    restored: bool,
}

impl<'a, T: TerminalControl> TerminalModeGuard<'a, T> {
    pub fn enter(control: &'a mut T) -> Result<Self> {
        control.drain_events()?;
        control.suspend()?;
        Ok(Self {
            control: Some(control),
            restored: false,
        })
    }

    pub fn restore(&mut self) -> Result<()> {
        if self.restored {
            return Ok(());
        }
        let control = self
            .control
            .as_mut()
            .context("terminal control unavailable")?;
        self.restored = true;
        control.restore()
    }
}

impl<T: TerminalControl> Drop for TerminalModeGuard<'_, T> {
    fn drop(&mut self) {
        if self.restored {
            return;
        }
        if let Some(control) = self.control.as_mut() {
            let _ = control.restore();
            self.restored = true;
        }
    }
}

#[derive(Debug, Default)]
pub struct CrosstermTerminalControl;

impl TerminalControl for CrosstermTerminalControl {
    fn drain_events(&mut self) -> Result<()> {
        while poll(Duration::from_millis(0)).context("failed to poll pending terminal events")? {
            match read().context("failed to drain terminal event")? {
                Event::Key(_)
                | Event::Mouse(_)
                | Event::Resize(_, _)
                | Event::FocusGained
                | Event::FocusLost
                | Event::Paste(_) => {}
            }
        }
        Ok(())
    }

    fn suspend(&mut self) -> Result<()> {
        let mut stdout = io::stdout();
        stdout
            .flush()
            .context("failed to flush terminal before suspend")?;
        disable_raw_mode().context("failed to disable raw mode")?;
        stdout
            .execute(LeaveAlternateScreen)
            .context("failed to leave alternate screen")?;
        stdout.execute(Show).context("failed to show cursor")?;
        Ok(())
    }

    fn restore(&mut self) -> Result<()> {
        let mut stdout = io::stdout();
        stdout
            .execute(EnterAlternateScreen)
            .context("failed to enter alternate screen")?;
        enable_raw_mode().context("failed to enable raw mode")?;
        Ok(())
    }
}
