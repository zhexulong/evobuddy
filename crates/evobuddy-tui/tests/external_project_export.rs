use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn package_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("package root")
}

fn tui_bin() -> PathBuf {
    env!("CARGO_BIN_EXE_evobuddy-tui").into()
}

#[test]
fn quit_after_render_loads_external_project_without_state_json() {
    let package = package_root();
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let external = std::env::temp_dir().join(format!("evobuddy-tui-qa-render-{stamp}"));
    fs::create_dir_all(&external).expect("create external project");

    let setup = Command::new("node")
        .args([
            package.join("scripts/evobuddy/evobuddy.mjs").as_os_str(),
            std::ffi::OsStr::new("setup"),
            std::ffi::OsStr::new("--project"),
            external.as_os_str(),
            std::ffi::OsStr::new("--runtime"),
            std::ffi::OsStr::new("opencode"),
            std::ffi::OsStr::new("--json"),
        ])
        .current_dir(&external)
        .output()
        .expect("setup external project");
    assert!(
        setup.status.success(),
        "setup failed: {}",
        String::from_utf8_lossy(&setup.stderr)
    );

    let run = Command::new(tui_bin())
        .args([
            "--project",
            external.to_str().expect("utf8"),
            "--quit-after-render",
            "--headless-width",
            "80",
            "--headless-height",
            "24",
        ])
        .current_dir(&external)
        .env("EVOBUDDY_PACKAGE_ROOT", package.as_os_str())
        .output()
        .expect("run tui quit-after-render");

    assert!(
        run.status.success(),
        "evobuddy-tui failed outside repo: status={} stderr={} stdout={}",
        run.status,
        String::from_utf8_lossy(&run.stderr),
        String::from_utf8_lossy(&run.stdout)
    );
    let stdout = String::from_utf8_lossy(&run.stdout);
    assert!(
        stdout.contains("Work inbox")
            || stdout.contains("Needs")
            || stdout.contains("Ready")
            || stdout.contains("No rooms"),
        "snapshot missing Home landmarks:\n{stdout}"
    );

    let _ = fs::remove_dir_all(&external);
}
