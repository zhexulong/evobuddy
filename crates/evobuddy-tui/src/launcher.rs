use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::os::unix::fs::OpenOptionsExt;
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
}

fn launch_plan_dir(project_root: &Path) -> PathBuf {
    project_root.join(".evobuddy/native-session-launch-plans")
}

fn launch_plan_path(project_root: &Path, plan_id: &str) -> PathBuf {
    launch_plan_dir(project_root).join(format!("{plan_id}.json"))
}

fn validate_plan_id(plan_id: &str) -> Result<()> {
    if plan_id.is_empty()
        || !plan_id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    {
        bail!("invalid plan id");
    }
    Ok(())
}

fn shell_escape(value: &str) -> String {
    format!("'{}'", value.replace('"' , "\"").replace('\'', "'\\''"))
}

pub fn compute_launch_plan_digest(plan: &LaunchPlan) -> Result<String> {
    let mut canonical = plan.clone();
    canonical.digest.clear();
    let encoded = serde_json::to_vec(&canonical).context("encode launch plan")?;
    let hash = Sha256::digest(encoded);
    Ok(format!(
        "sha256:{}",
        hash.iter().map(|byte| format!("{byte:02x}")).collect::<String>()
    ))
}

pub fn write_launch_plan(project_root: &Path, plan: &LaunchPlan) -> Result<PathBuf> {
    validate_plan_id(&plan.plan_id)?;
    fs::create_dir_all(launch_plan_dir(project_root)).context("create launch plan dir")?;
    let mut stored = plan.clone();
    stored.digest = compute_launch_plan_digest(&stored)?;
    let path = launch_plan_path(project_root, &stored.plan_id);
    let mut options = fs::OpenOptions::new();
    options.create(true).truncate(true).write(true).mode(0o600);
    let mut file = options.open(&path).context("open launch plan path")?;
    serde_json::to_writer_pretty(&mut file, &stored).context("write launch plan")?;
    Ok(path)
}

pub fn load_launch_plan(project_root: &Path, plan_id: &str) -> Result<LaunchPlan> {
    validate_plan_id(plan_id)?;
    let path = launch_plan_path(project_root, plan_id);
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

pub fn build_launcher_command(project_root: PathBuf, plan_id: &str) -> Result<String> {
    validate_plan_id(plan_id)?;
    Ok(format!(
        "evobuddy-session-launcher --project-root {} --plan-id {}",
        shell_escape(&project_root.display().to_string()),
        shell_escape(plan_id)
    ))
}
