use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};
use clap::Parser;
use evobuddy_tui::app::WorkbenchApp;
use evobuddy_tui::backend::{load_workbench_state, BackendCommand, BackendOptions};
use evobuddy_tui::ui::{render_dashboard_snapshot, run_interactive_app};

#[derive(Debug, Parser)]
#[command(name = "evobuddy-tui")]
struct Cli {
    #[arg(long)]
    project: PathBuf,
    #[arg(long)]
    state_json: Option<PathBuf>,
    #[arg(long, hide = true, num_args = 1.., allow_hyphen_values = true)]
    backend_command: Option<Vec<String>>,
    #[arg(long)]
    input_root: Option<PathBuf>,
    #[arg(long)]
    aggregate_report: Option<PathBuf>,
    #[arg(long)]
    plan1_report: Option<PathBuf>,
    #[arg(long)]
    plan2_report: Option<PathBuf>,
    #[arg(long = "taskroom-report")]
    taskroom_reports: Vec<PathBuf>,
    #[arg(long)]
    headless_snapshot: Option<PathBuf>,
    #[arg(long, default_value_t = 100)]
    headless_width: u16,
    #[arg(long, default_value_t = 32)]
    headless_height: u16,
    #[arg(long, hide = true)]
    frame_dump_path: Option<PathBuf>,
    #[arg(long, default_value_t = false)]
    quit_after_render: bool,
}

fn write_snapshot(path: &PathBuf, text: &str) -> Result<()> {
    fs::write(path, text).with_context(|| format!("failed to write snapshot: {}", path.display()))
}

fn parse_backend_command(argv: Option<Vec<String>>) -> Result<Option<BackendCommand>> {
    let Some(command) = argv else {
        return Ok(None);
    };
    let mut parts = command.into_iter();
    let program = parts
        .next()
        .context("--backend-command requires a program followed by optional args")?;
    Ok(Some(BackendCommand {
        program,
        args: parts.collect(),
    }))
}

fn run() -> Result<()> {
    let cli = Cli::parse();
    let state = load_workbench_state(&BackendOptions {
        project: cli.project.clone(),
        state_json: cli.state_json.clone(),
        backend_command: parse_backend_command(cli.backend_command.clone())?,
        input_root: cli.input_root.clone(),
        aggregate_report: cli.aggregate_report.clone(),
        plan1_report: cli.plan1_report.clone(),
        plan2_report: cli.plan2_report.clone(),
        taskroom_reports: cli.taskroom_reports.clone(),
    })?;

    let app = WorkbenchApp::new(state);
    if let Some(path) = cli.frame_dump_path.as_ref() {
        unsafe { std::env::set_var("EVOBUDDY_TUI_FRAME_DUMP", "1") };
        unsafe { std::env::set_var("EVOBUDDY_TUI_FRAME_DUMP_PATH", path) };
    }
    if cli.headless_snapshot.is_none() && !cli.quit_after_render {
        let mut interactive_app = app;
        return run_interactive_app(&mut interactive_app);
    }

    let snapshot = render_dashboard_snapshot(&app, cli.headless_width, cli.headless_height)?;
    if let Some(path) = cli.headless_snapshot.as_ref() {
        write_snapshot(path, &snapshot)?;
    } else {
        print!("{snapshot}");
    }

    if cli.quit_after_render {
        return Ok(());
    }
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error:#}");
        std::process::exit(1);
    }
}
