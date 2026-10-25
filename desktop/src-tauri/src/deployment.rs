use crate::{client, network_error, validate_server_url};
use serde::Serialize;
use std::{process::Command, time::Duration};

const SERVICE_NAME: &str = "securelan-server.service";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendStartup {
    mode: &'static str,
    state: &'static str,
}

fn mode() -> Result<&'static str, String> {
    match std::env::var("SECURELAN_DEPLOYMENT_MODE")
        .unwrap_or_else(|_| "CLIENT_DESKTOP".into())
        .as_str()
    {
        "CLIENT_DESKTOP" => Ok("CLIENT_DESKTOP"),
        "SERVER_DESKTOP" => Ok("SERVER_DESKTOP"),
        _ => Err("INVALID_DEPLOYMENT_MODE".into()),
    }
}

async fn ready(base_url: &str) -> Result<bool, String> {
    match client()?
        .get(format!("{base_url}/api/v1/health"))
        .timeout(Duration::from_secs(2))
        .send()
        .await
    {
        Ok(response) => Ok(response.status().is_success()),
        Err(error) if error.is_timeout() || error.is_connect() => Ok(false),
        Err(error) => Err(network_error(&error)),
    }
}

#[tauri::command]
pub async fn deployment_status(base_url: String) -> Result<BackendStartup, String> {
    let deployment_mode = mode()?;
    let server = validate_server_url(&base_url)?;
    Ok(BackendStartup {
        mode: deployment_mode,
        state: if ready(&server.base_url).await? {
            "READY"
        } else {
            "REMOTE_UNAVAILABLE"
        },
    })
}

#[tauri::command]
pub async fn ensure_backend_started(base_url: String) -> Result<BackendStartup, String> {
    let deployment_mode = mode()?;
    let server = validate_server_url(&base_url)?;
    if ready(&server.base_url).await? {
        return Ok(BackendStartup {
            mode: deployment_mode,
            state: "READY",
        });
    }
    if deployment_mode == "CLIENT_DESKTOP" {
        return Ok(BackendStartup {
            mode: deployment_mode,
            state: "REMOTE_UNAVAILABLE",
        });
    }
    let status = Command::new("/usr/bin/systemctl")
        .args(["start", SERVICE_NAME])
        .status()
        .map_err(|_| "SERVICE_MANAGER_UNAVAILABLE")?;
    if !status.success() {
        return Err("BACKEND_START_FAILED".into());
    }
    for _ in 0..20 {
        if ready(&server.base_url).await? {
            return Ok(BackendStartup {
                mode: deployment_mode,
                state: "STARTED",
            });
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    Err("BACKEND_READINESS_TIMEOUT".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn default_mode_is_client() {
        if std::env::var("SECURELAN_DEPLOYMENT_MODE").is_err() {
            assert_eq!(mode().unwrap(), "CLIENT_DESKTOP");
        }
    }

    #[test]
    fn fixed_service_name_cannot_come_from_renderer() {
        assert_eq!(SERVICE_NAME, "securelan-server.service");
    }
}
