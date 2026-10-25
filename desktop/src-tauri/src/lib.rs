use futures_util::{SinkExt, StreamExt};
use keyring::Entry;
use reqwest::{Client, Method, StatusCode, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::net::IpAddr;
use std::sync::{
    Arc,
    atomic::{AtomicU64, Ordering},
};
use std::time::Duration;
use tauri::{Emitter, State};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{Message, client::IntoClientRequest},
};

mod cache;
mod deployment;

const KEYRING_SERVICE: &str = "com.securelan.messenger";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginInput {
    base_url: String,
    username: String,
    password: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiResult {
    status: u16,
    body: Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionDiagnostic {
    code: String,
    message: &'static str,
    reachable: bool,
}

struct ServerIdentity {
    base_url: String,
    key: String,
}

#[derive(Default)]
struct RealtimeState {
    generation: Arc<AtomicU64>,
}

fn websocket_url(server: &ServerIdentity) -> String {
    let scheme = if server.base_url.starts_with("https://") {
        "wss"
    } else {
        "ws"
    };
    format!(
        "{}{}{}",
        scheme,
        &server.base_url[server.base_url.find("://").unwrap()..],
        "/api/v1/ws"
    )
}

fn validate_server_url(value: &str) -> Result<ServerIdentity, String> {
    let parsed = Url::parse(value).map_err(|_| "INVALID_SERVER_URL".to_string())?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("UNSUPPORTED_SCHEME".into());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("EMBEDDED_CREDENTIALS".into());
    }
    if parsed.query().is_some() || parsed.fragment().is_some() || !matches!(parsed.path(), "" | "/")
    {
        return Err("INVALID_SERVER_URL".into());
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "INVALID_SERVER_URL".to_string())?;
    let canonical_host = host.trim_start_matches('[').trim_end_matches(']');
    let loopback = canonical_host.eq_ignore_ascii_case("localhost")
        || canonical_host
            .parse::<IpAddr>()
            .is_ok_and(|ip| ip.is_loopback());
    if parsed.scheme() == "http" && !loopback {
        return Err("HTTPS_REQUIRED".into());
    }
    let port = parsed
        .port_or_known_default()
        .ok_or_else(|| "INVALID_SERVER_URL".to_string())?;
    let display_host = if canonical_host.contains(':') {
        format!("[{canonical_host}]")
    } else {
        canonical_host.to_ascii_lowercase()
    };
    let base_url = format!("{}://{}:{}", parsed.scheme(), display_host, port);
    let key = format!("{:x}", Sha256::digest(base_url.as_bytes()));
    Ok(ServerIdentity { base_url, key })
}

fn entry(kind: &str, server: &ServerIdentity) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, &format!("{kind}-{}", server.key))
        .map_err(|_| "KEYRING_UNAVAILABLE".into())
}

fn client() -> Result<Client, String> {
    Client::builder()
        .build()
        .map_err(|_| "TLS_CONFIGURATION_ERROR".into())
}

fn network_error(error: &reqwest::Error) -> String {
    let detail = format!("{error:?}").to_ascii_lowercase();
    if detail.contains("expired") {
        "TLS_CERTIFICATE_EXPIRED"
    } else if detail.contains("not valid for")
        || detail.contains("hostname")
        || detail.contains("certnotvalidforname")
    {
        "TLS_HOSTNAME_MISMATCH"
    } else if detail.contains("unknownissuer")
        || detail.contains("unknown issuer")
        || detail.contains("certificate")
        || detail.contains("tls")
    {
        "TLS_CERTIFICATE_UNTRUSTED"
    } else if detail.contains("dns")
        || detail.contains("name or service not known")
        || detail.contains("failed to lookup")
    {
        "DNS_FAILURE"
    } else if detail.contains("connection refused") {
        "CONNECTION_REFUSED"
    } else {
        "SERVER_UNAVAILABLE"
    }
    .into()
}

async fn response_result(response: reqwest::Response) -> Result<ApiResult, String> {
    let status = response.status().as_u16();
    let body = response.json::<Value>().await.unwrap_or(Value::Null);
    Ok(ApiResult { status, body })
}

#[tauri::command]
async fn connection_diagnostics(base_url: String) -> Result<ConnectionDiagnostic, String> {
    let server = validate_server_url(&base_url)?;
    match client()?
        .get(format!("{}/api/v1/health", server.base_url))
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => Ok(ConnectionDiagnostic {
            code: "SERVER_REACHABLE".into(),
            message: "SecureLAN server reached. Sign in to establish an authenticated connection.",
            reachable: true,
        }),
        Ok(response)
            if matches!(
                response.status(),
                StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN
            ) =>
        {
            Ok(ConnectionDiagnostic {
                code: "AUTHENTICATION_REQUIRED".into(),
                message: "The server is reachable and requires authentication.",
                reachable: true,
            })
        }
        Ok(_) => Ok(ConnectionDiagnostic {
            code: "UNEXPECTED_RESPONSE".into(),
            message: "The address responded, but it does not appear to be a compatible SecureLAN server.",
            reachable: false,
        }),
        Err(error) => {
            let code = network_error(&error);
            let message = diagnostic_message(&code);
            Ok(ConnectionDiagnostic {
                code,
                message,
                reachable: false,
            })
        }
    }
}

fn diagnostic_message(code: &str) -> &'static str {
    match code {
        "TLS_CERTIFICATE_EXPIRED" => {
            "The server certificate has expired. Contact your SecureLAN administrator."
        }
        "TLS_HOSTNAME_MISMATCH" => "The server address does not match its certificate.",
        "TLS_CERTIFICATE_UNTRUSTED" => "The server certificate is not trusted on this device.",
        "DNS_FAILURE" => "The SecureLAN server name could not be resolved.",
        "CONNECTION_REFUSED" => {
            "The server refused the connection. Check that SecureLAN is running."
        }
        _ => "Unable to reach the SecureLAN server.",
    }
}

#[tauri::command]
async fn auth_login(input: LoginInput) -> Result<ApiResult, String> {
    let server = validate_server_url(&input.base_url)?;
    let response = client()?
        .post(format!("{}/api/v1/auth/login", server.base_url))
        .json(&serde_json::json!({"username":input.username,"password":input.password}))
        .send()
        .await
        .map_err(|e| network_error(&e))?;
    let status = response.status();
    let mut body = response.json::<Value>().await.unwrap_or(Value::Null);
    if status.is_success() {
        let token = body
            .get("accessToken")
            .and_then(Value::as_str)
            .ok_or("INVALID_LOGIN_RESPONSE")?;
        entry("session", &server)?
            .set_password(token)
            .map_err(|_| "KEYRING_WRITE_FAILED")?;
        if let Some(object) = body.as_object_mut() {
            object.remove("accessToken");
        }
    }
    Ok(ApiResult {
        status: status.as_u16(),
        body,
    })
}

async fn with_token(
    base_url: &str,
    method: Method,
    path: &str,
    body: Option<Value>,
) -> Result<ApiResult, String> {
    let server = validate_server_url(base_url)?;
    let token = entry("session", &server)?
        .get_password()
        .map_err(|_| "NO_SESSION")?;
    let mut request = client()?
        .request(method, format!("{}{}", server.base_url, path))
        .bearer_auth(token);
    if let Some(value) = body {
        request = request.json(&value);
    }
    response_result(request.send().await.map_err(|e| network_error(&e))?).await
}

#[tauri::command]
async fn auth_restore(base_url: String) -> Result<ApiResult, String> {
    let server = validate_server_url(&base_url)?;
    match with_token(&server.base_url, Method::GET, "/api/v1/auth/me", None).await {
        Ok(result) if result.status == 401 => {
            let _ = entry("session", &server)?.delete_credential();
            Ok(result)
        }
        other => other,
    }
}

#[tauri::command]
async fn auth_logout(base_url: String, realtime: State<'_, RealtimeState>) -> Result<(), String> {
    realtime.generation.fetch_add(1, Ordering::SeqCst);
    let server = validate_server_url(&base_url)?;
    let active = entry("session", &server)?;
    let token = match active.get_password() {
        Ok(value) => value,
        Err(_) => return Ok(()),
    };
    let result = client()?
        .post(format!("{}/api/v1/auth/logout", server.base_url))
        .bearer_auth(&token)
        .send()
        .await;
    if result.is_err() {
        entry("pending-revocation", &server)?
            .set_password(&token)
            .map_err(|_| "KEYRING_WRITE_FAILED")?;
    }
    active
        .delete_credential()
        .map_err(|_| "KEYRING_DELETE_FAILED")?;
    Ok(())
}

#[tauri::command]
async fn realtime_start(
    app: tauri::AppHandle,
    base_url: String,
    realtime: State<'_, RealtimeState>,
) -> Result<(), String> {
    let server = validate_server_url(&base_url)?;
    let token = entry("session", &server)?
        .get_password()
        .map_err(|_| "NO_SESSION")?;
    let url = websocket_url(&server);
    let generation = realtime.generation.fetch_add(1, Ordering::SeqCst) + 1;
    let marker = realtime.generation.clone();
    tauri::async_runtime::spawn(async move {
        let mut attempt = 0u32;
        loop {
            if marker.load(Ordering::SeqCst) != generation {
                break;
            }
            let _=app.emit("securelan://realtime-state",serde_json::json!({"state":if attempt==0{"CONNECTING"}else{"RECONNECTING"},"attempt":attempt}));
            let request_result = url.clone().into_client_request().and_then(|mut request| {
                let header = tokio_tungstenite::tungstenite::http::HeaderValue::from_str(&format!(
                    "Bearer {token}"
                ))
                .map_err(|_| {
                    tokio_tungstenite::tungstenite::Error::Io(std::io::Error::new(
                        std::io::ErrorKind::InvalidInput,
                        "invalid authorization header",
                    ))
                })?;
                request.headers_mut().insert("Authorization", header);
                Ok(request)
            });
            let result = match request_result {
                Ok(request) => connect_async(request).await,
                Err(e) => Err(e),
            };
            match result {
                Ok((mut socket, _)) => {
                    attempt = 0;
                    let _ = app.emit(
                        "securelan://realtime-state",
                        serde_json::json!({"state":"CONNECTED"}),
                    );
                    while marker.load(Ordering::SeqCst) == generation {
                        match tokio::time::timeout(Duration::from_secs(30), socket.next()).await {
                            Ok(Some(Ok(Message::Text(value)))) => {
                                if let Ok(event) = serde_json::from_str::<Value>(&value) {
                                    let _ = app.emit("securelan://realtime-event", event);
                                }
                            }
                            Ok(Some(Ok(Message::Ping(value)))) => {
                                let _ = socket.send(Message::Pong(value)).await;
                            }
                            Ok(Some(Ok(Message::Close(_)))) | Ok(Some(Err(_))) | Ok(None) => break,
                            Err(_) => {
                                if socket.send(Message::Ping(Vec::new().into())).await.is_err() {
                                    break;
                                }
                            }
                            _ => {}
                        }
                    }
                    let _ = socket.close(None).await;
                }
                Err(_) => {}
            }
            if marker.load(Ordering::SeqCst) != generation {
                break;
            }
            attempt = attempt.saturating_add(1);
            let delay = 2u64.pow(attempt.min(5));
            tokio::time::sleep(Duration::from_secs(delay)).await;
        }
        let _ = app.emit(
            "securelan://realtime-state",
            serde_json::json!({"state":"DISCONNECTED"}),
        );
    });
    Ok(())
}

#[tauri::command]
fn realtime_stop(realtime: State<'_, RealtimeState>) {
    realtime.generation.fetch_add(1, Ordering::SeqCst);
}

#[tauri::command]
async fn auth_request(
    base_url: String,
    method: String,
    path: String,
    body: Option<Value>,
) -> Result<ApiResult, String> {
    if !path.starts_with("/api/v1/") {
        return Err("INVALID_API_PATH".into());
    }
    let method = Method::from_bytes(method.as_bytes()).map_err(|_| "INVALID_METHOD")?;
    with_token(&base_url, method, &path, body).await
}

#[tauri::command]
async fn retry_pending_revocation(base_url: String) -> Result<(), String> {
    let server = validate_server_url(&base_url)?;
    let pending = entry("pending-revocation", &server)?;
    let token = match pending.get_password() {
        Ok(value) => value,
        Err(_) => return Ok(()),
    };
    let response = client()?
        .post(format!("{}/api/v1/auth/logout", server.base_url))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| network_error(&e))?;
    if response.status().is_success() || response.status() == StatusCode::UNAUTHORIZED {
        let _ = pending.delete_credential();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            connection_diagnostics,
            auth_login,
            auth_restore,
            auth_logout,
            auth_request,
            retry_pending_revocation,
            realtime_start,
            realtime_stop,
            cache::cache_open_verified,
            cache::cache_restore_offline,
            cache::cache_replace_conversations,
            cache::cache_store_messages,
            cache::cache_read_conversations,
            cache::cache_read_messages,
            cache::cache_close,
            cache::cache_status,
            deployment::deployment_status,
            deployment::ensure_backend_started
        ])
        .manage(RealtimeState::default())
        .manage(cache::CacheState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn permits_only_loopback_http() {
        assert!(validate_server_url("http://127.0.0.1:8080").is_ok());
        assert!(validate_server_url("http://[::1]:8080").is_ok());
        assert_eq!(
            validate_server_url("http://192.168.1.10:8080")
                .err()
                .as_deref(),
            Some("HTTPS_REQUIRED")
        );
    }
    #[test]
    fn rejects_unsafe_urls() {
        assert!(validate_server_url("ftp://securelan.local").is_err());
        assert!(validate_server_url("https://user:pass@securelan.local").is_err());
        assert!(validate_server_url("https://securelan.local/path").is_err());
    }
    #[test]
    fn scopes_credentials_to_normalized_server_identity() {
        let first = validate_server_url("https://SECURELAN.local:8080/").unwrap();
        let same = validate_server_url("https://securelan.local:8080").unwrap();
        let other = validate_server_url("https://192.168.1.100:8080").unwrap();
        assert_eq!(first.key, same.key);
        assert_ne!(first.key, other.key);
    }
    #[test]
    fn derives_secure_websocket_urls() {
        let secure = validate_server_url("https://192.168.1.10:8080").unwrap();
        assert_eq!(websocket_url(&secure), "wss://192.168.1.10:8080/api/v1/ws");
        let local = validate_server_url("http://127.0.0.1:8080").unwrap();
        assert_eq!(websocket_url(&local), "ws://127.0.0.1:8080/api/v1/ws");
    }
}
