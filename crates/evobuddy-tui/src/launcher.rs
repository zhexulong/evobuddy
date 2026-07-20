use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LaunchPlan {
    pub schema: String,
    #[serde(rename = "descriptorId")]
    pub descriptor_id: String,
    #[serde(rename = "planId")]
    pub plan_id: String,
    pub program: String,
    pub args: Vec<String>,
    pub cwd: String,
    #[serde(rename = "environmentPolicyRef")]
    pub environment_policy_ref: String,
    #[serde(rename = "contextPacketRef")]
    pub context_packet_ref: Option<String>,
    #[serde(rename = "safetyMode")]
    pub safety_mode: String,
    pub digest: String,
    #[serde(default)]
    pub consumed: bool,
    #[serde(rename = "consumedAt", default)]
    pub consumed_at: Option<String>,
}

fn launch_plan_dir(project_root: &Path) -> PathBuf {
    project_root.join(".evobuddy/native-session-launch-plans")
}

fn launch_plan_path(project_root: &Path, plan_id: &str) -> PathBuf {
    launch_plan_dir(project_root).join(format!("{plan_id}.json"))
}

fn has_control_bytes(value: &str) -> bool {
    value.chars().any(|ch| ch.is_control())
}

pub fn validate_plan_id(plan_id: &str) -> Result<()> {
    if plan_id.is_empty()
        || plan_id.contains("..")
        || has_control_bytes(plan_id)
        || !plan_id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    {
        bail!("invalid plan id");
    }
    Ok(())
}

pub fn sanitize_display_name(value: &str) -> Result<String> {
    if value.trim().is_empty() {
        bail!("display name required");
    }
    if has_control_bytes(value) {
        bail!("control bytes are forbidden in display name");
    }
    if value
        .chars()
        .any(|ch| matches!(ch, ';' | '&' | '|' | '`' | '$' | '<' | '>' | '\\' | '/'))
    {
        bail!("unsafe characters in display name");
    }
    Ok(value.split_whitespace().collect::<Vec<_>>().join(" "))
}

pub fn sanitize_session_name(value: &str) -> Result<String> {
    if value.trim().is_empty() {
        bail!("session name required");
    }
    if has_control_bytes(value) || value.contains(':') || value.contains(';') {
        bail!("unsafe session name");
    }
    if value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    {
        if value.len() > 64 {
            bail!("invalid session name: too long");
        }
        return Ok(value.to_string());
    }
    let slug = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let slug = slug.chars().take(48).collect::<String>();
    if slug.is_empty()
        || !slug
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    {
        bail!("unable to sanitize session name");
    }
    Ok(slug)
}

pub fn parse_launcher_plan_ref(launcher_plan_ref: &str) -> Result<String> {
    if has_control_bytes(launcher_plan_ref) {
        bail!("control bytes are forbidden in launcher plan ref");
    }
    let plan_id = launcher_plan_ref
        .strip_prefix("launch-plan:")
        .unwrap_or(launcher_plan_ref);
    if plan_id.contains('/') || plan_id.contains('\\') || Path::new(plan_id).is_absolute() {
        bail!("invalid launcher plan ref");
    }
    validate_plan_id(plan_id)?;
    Ok(plan_id.to_string())
}

fn shell_escape(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn path_has_symlink(path: &Path) -> Result<bool> {
    let mut current = PathBuf::new();
    for component in path.components() {
        current.push(component);
        if current
            .symlink_metadata()
            .map(|meta| meta.file_type().is_symlink())
            .unwrap_or(false)
        {
            return Ok(true);
        }
    }
    Ok(false)
}

fn current_uid() -> u32 {
    #[cfg(unix)]
    {
        extern "C" {
            fn getuid() -> u32;
        }
        unsafe { getuid() }
    }
    #[cfg(not(unix))]
    {
        0
    }
}

fn assert_owner_only(path: &Path) -> Result<()> {
    let metadata = fs::metadata(path).context("stat launch plan")?;
    let mode = metadata.permissions().mode() & 0o777;
    if mode != 0o600 {
        bail!("launch plan must be owner-only (permission mode {mode:o})");
    }
    #[cfg(unix)]
    if metadata.uid() != current_uid() {
        bail!("launch plan is not owned by current user");
    }
    Ok(())
}

fn plan_body_for_digest(plan: &LaunchPlan) -> LaunchPlan {
    LaunchPlan {
        schema: plan.schema.clone(),
        descriptor_id: plan.descriptor_id.clone(),
        plan_id: plan.plan_id.clone(),
        program: plan.program.clone(),
        args: plan.args.clone(),
        cwd: plan.cwd.clone(),
        environment_policy_ref: plan.environment_policy_ref.clone(),
        context_packet_ref: plan.context_packet_ref.clone(),
        safety_mode: plan.safety_mode.clone(),
        digest: String::new(),
        consumed: false,
        consumed_at: None,
    }
}

pub fn compute_launch_plan_digest(plan: &LaunchPlan) -> Result<String> {
    let canonical = plan_body_for_digest(plan);
    let encoded = serde_json::to_vec(&canonical).context("encode launch plan")?;
    let hash = Sha256::digest(encoded);
    Ok(format!(
        "sha256:{}",
        hash.iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    ))
}

pub fn write_launch_plan(project_root: &Path, plan: &LaunchPlan) -> Result<PathBuf> {
    validate_plan_id(&plan.plan_id)?;
    fs::create_dir_all(launch_plan_dir(project_root)).context("create launch plan dir")?;
    let mut stored = plan.clone();
    stored.consumed = false;
    stored.consumed_at = None;
    stored.digest = compute_launch_plan_digest(&stored)?;
    let path = launch_plan_path(project_root, &stored.plan_id);
    if path_has_symlink(&path)? || path_has_symlink(&launch_plan_dir(project_root))? {
        bail!("refuses to write launch plan through symlink");
    }
    let mut options = fs::OpenOptions::new();
    options.create(true).truncate(true).write(true).mode(0o600);
    let mut file = options.open(&path).context("open launch plan path")?;
    serde_json::to_writer_pretty(&mut file, &stored).context("write launch plan")?;
    let mut perms = fs::metadata(&path)?.permissions();
    perms.set_mode(0o600);
    fs::set_permissions(&path, perms)?;
    Ok(path)
}

pub fn load_launch_plan(project_root: &Path, plan_id: &str) -> Result<LaunchPlan> {
    validate_plan_id(plan_id)?;
    let path = launch_plan_path(project_root, plan_id);
    if path_has_symlink(&path)? {
        bail!("refuses to load launch plan through symlink");
    }
    assert_owner_only(&path)?;
    let text = fs::read_to_string(&path).context("read launch plan")?;
    let plan: LaunchPlan = serde_json::from_str(&text).context("parse launch plan")?;
    if plan.schema != "evobuddy.runtime-launch-plan.v1" {
        bail!("invalid launch plan schema");
    }
    if plan.plan_id != plan_id {
        bail!("launch plan id mismatch");
    }
    let expected = compute_launch_plan_digest(&plan)?;
    if plan.digest != expected {
        bail!("digest mismatch");
    }
    Ok(plan)
}

pub fn consume_launch_plan(project_root: &Path, plan_id: &str) -> Result<LaunchPlan> {
    let mut plan = load_launch_plan(project_root, plan_id)?;
    if plan.consumed {
        bail!("launch plan already consumed (one-use replay rejected)");
    }
    plan.consumed = true;
    plan.consumed_at = Some(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| format!("{}s", duration.as_secs()))
            .unwrap_or_else(|_| "0s".to_string()),
    );
    // Preserve original digest (consumed markers are excluded from digest body).
    let path = launch_plan_path(project_root, plan_id);
    let mut options = fs::OpenOptions::new();
    options.create(true).truncate(true).write(true).mode(0o600);
    let mut file = options
        .open(&path)
        .context("open launch plan for consume")?;
    serde_json::to_writer_pretty(&mut file, &plan).context("write consumed launch plan")?;
    let mut perms = fs::metadata(&path)?.permissions();
    perms.set_mode(0o600);
    fs::set_permissions(&path, perms)?;
    Ok(plan)
}

pub fn build_launcher_argv(project_root: &Path, plan_id: &str) -> Result<Vec<String>> {
    validate_plan_id(plan_id)?;
    Ok(vec![
        "evobuddy-session-launcher".to_string(),
        "--project-root".to_string(),
        project_root.display().to_string(),
        "--plan-id".to_string(),
        plan_id.to_string(),
    ])
}

pub fn build_launcher_command(project_root: PathBuf, plan_id: &str) -> Result<String> {
    let argv = build_launcher_argv(&project_root, plan_id)?;
    Ok(format!(
        "{} --project-root {} --plan-id {}",
        argv[0],
        shell_escape(&argv[2]),
        shell_escape(&argv[4])
    ))
}
