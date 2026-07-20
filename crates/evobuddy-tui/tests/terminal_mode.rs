use std::cell::RefCell;
use std::rc::Rc;

use evobuddy_tui::terminal_mode::{TerminalControl, TerminalModeGuard};

#[derive(Clone, Default)]
struct FakeTerminalControl {
    calls: Rc<RefCell<Vec<&'static str>>>,
    fail_on_suspend: bool,
    fail_on_restore: bool,
}

impl TerminalControl for FakeTerminalControl {
    fn drain_events(&mut self) -> anyhow::Result<()> {
        self.calls.borrow_mut().push("drain");
        Ok(())
    }

    fn suspend(&mut self) -> anyhow::Result<()> {
        self.calls.borrow_mut().push("suspend");
        if self.fail_on_suspend {
            anyhow::bail!("suspend failed");
        }
        Ok(())
    }

    fn restore(&mut self) -> anyhow::Result<()> {
        self.calls.borrow_mut().push("restore");
        if self.fail_on_restore {
            anyhow::bail!("restore failed");
        }
        Ok(())
    }
}

#[test]
fn guard_drains_suspends_and_restores_once_on_drop() {
    let mut fake = FakeTerminalControl::default();
    let calls = fake.calls.clone();

    {
        let _guard = TerminalModeGuard::enter(&mut fake).expect("enter guard");
    }

    assert_eq!(&*calls.borrow(), &["drain", "suspend", "restore"]);
}

#[test]
fn explicit_restore_is_idempotent_and_drop_does_not_restore_twice() {
    let mut fake = FakeTerminalControl::default();
    let calls = fake.calls.clone();

    {
        let mut guard = TerminalModeGuard::enter(&mut fake).expect("enter guard");
        guard.restore().expect("explicit restore");
    }

    assert_eq!(&*calls.borrow(), &["drain", "suspend", "restore"]);
}

#[test]
fn enter_error_does_not_attempt_restore() {
    let mut fake = FakeTerminalControl {
        fail_on_suspend: true,
        ..FakeTerminalControl::default()
    };
    let calls = fake.calls.clone();

    let error = TerminalModeGuard::enter(&mut fake).err().expect("suspend should fail");

    assert!(error.to_string().contains("suspend failed"));
    assert_eq!(&*calls.borrow(), &["drain", "suspend"]);
}

#[test]
fn restore_error_is_returned_once_and_drop_does_not_repeat_it() {
    let mut fake = FakeTerminalControl {
        fail_on_restore: true,
        ..FakeTerminalControl::default()
    };
    let calls = fake.calls.clone();

    {
        let mut guard = TerminalModeGuard::enter(&mut fake).expect("enter guard");
        let error = guard.restore().expect_err("restore should fail");
        assert!(error.to_string().contains("restore failed"));
    }

    assert_eq!(&*calls.borrow(), &["drain", "suspend", "restore"]);
}
