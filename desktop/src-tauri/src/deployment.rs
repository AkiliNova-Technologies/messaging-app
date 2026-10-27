use crate::{client, network_error, validate_server_url};
use serde::Serialize;
use std::time::Duration;

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

fn desktop_process_launch_enabled() -> bool {
    false
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
    debug_assert!(!desktop_process_launch_enabled());
    Ok(BackendStartup {
        mode: deployment_mode,
        state: "BOOT_MANAGED_UNAVAILABLE",
    })
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
    fn server_startup_is_not_exposed_to_the_renderer() {
        assert!(!desktop_process_launch_enabled());
    }
}
