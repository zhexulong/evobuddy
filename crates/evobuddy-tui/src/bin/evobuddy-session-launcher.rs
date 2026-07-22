use evobuddy_tui::launcher::load_launch_plan;
use std::env;
use std::os::unix::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;

fn read_arg(flag: &str) -> Option<String> {
    let args = env::args().collect::<Vec<_>>();
    args.iter()
        .position(|arg| arg == flag)
        .and_then(|index| args.get(index + 1).cloned())
}

fn main() {
    let project_root = PathBuf::from(read_arg("--project-root").unwrap_or_default());
    let plan_id = read_arg("--plan-id").unwrap_or_default();
    let plan = match load_launch_plan(&project_root, &plan_id) {
        Ok(plan) => plan,
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    };

    let mut command = Command::new(&plan.program);
    command.args(&plan.args).current_dir(&plan.cwd);
    let error = command.exec();
    eprintln!("{error}");
    std::process::exit(1);
}
