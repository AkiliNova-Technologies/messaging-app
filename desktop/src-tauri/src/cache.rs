use crate::{ServerIdentity, entry, validate_server_url, with_token};
use reqwest::Method;
use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::PathBuf,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};

const OFFLINE_AUTHORIZATION_SECONDS: i64 = 24 * 60 * 60;

pub struct CacheState(pub Mutex<Option<OpenCache>>);

pub struct OpenCache {
    connection: Connection,
    server_key: String,
    user_id: String,
}

impl Default for CacheState {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineSession {
    user: Value,
    authorized_until: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStatus {
    open: bool,
    encrypted: bool,
    offline_authorization_seconds: i64,
}

fn now() -> Result<i64, String> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "CLOCK_ERROR")?
        .as_secs() as i64)
}

fn user_key(user_id: &str) -> String {
    format!("{:x}", Sha256::digest(user_id.as_bytes()))
}

fn cache_path(app: &AppHandle, server: &ServerIdentity, user_id: &str) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|_| "CACHE_PATH_UNAVAILABLE")?
        .join("cache");
    fs::create_dir_all(&directory).map_err(|_| "CACHE_DIRECTORY_FAILED")?;
    Ok(directory.join(format!("{}-{}.db", server.key, user_key(user_id))))
}

fn random_key() -> Result<String, String> {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes).map_err(|_| "CACHE_KEY_GENERATION_FAILED")?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn cache_key_entry(server: &ServerIdentity, user_id: &str) -> Result<keyring::Entry, String> {
    entry(&format!("cache-{}", user_key(user_id)), server)
}

fn open_connection(
    app: &AppHandle,
    server: &ServerIdentity,
    user_id: &str,
    create: bool,
) -> Result<Connection, String> {
    let path = cache_path(app, server, user_id)?;
    let key_entry = cache_key_entry(server, user_id)?;
    let key = match key_entry.get_password() {
        Ok(value) => value,
        Err(_) if create && !path.exists() => {
            let value = random_key()?;
            key_entry
                .set_password(&value)
                .map_err(|_| "CACHE_KEY_STORE_FAILED")?;
            value
        }
        Err(_) => return Err("CACHE_KEY_UNAVAILABLE".into()),
    };
    let connection = Connection::open(path).map_err(|_| "CACHE_OPEN_FAILED")?;
    connection
        .pragma_update(None, "key", format!("x'{key}'"))
        .map_err(|_| "CACHE_UNLOCK_FAILED")?;
    let cipher: Option<String> = connection
        .query_row("PRAGMA cipher_version", [], |row| row.get(0))
        .optional()
        .map_err(|_| "SQLCIPHER_REQUIRED")?;
    if cipher.as_deref().unwrap_or_default().is_empty() {
        return Err("SQLCIPHER_REQUIRED".into());
    }
    connection.execute_batch("PRAGMA cipher_memory_security = ON; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;").map_err(|_| "CACHE_CONFIGURATION_FAILED")?;
    let version: i64 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|_| "CACHE_CORRUPT")?;
    if version > 1 {
        return Err("CACHE_SCHEMA_TOO_NEW".into());
    }
    if version == 0 {
        connection.execute_batch(
        "BEGIN IMMEDIATE;
         CREATE TABLE metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS messages(
           id TEXT PRIMARY KEY,
           conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
           server_sequence INTEGER NOT NULL,
           client_request_id TEXT NOT NULL,
           body TEXT NOT NULL,
           UNIQUE(conversation_id, server_sequence),
         UNIQUE(conversation_id, client_request_id));
         CREATE INDEX IF NOT EXISTS messages_conversation_sequence ON messages(conversation_id, server_sequence);
         CREATE TABLE sync_checkpoints(conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE, server_sequence INTEGER NOT NULL, synchronized_at INTEGER NOT NULL);
         INSERT INTO metadata(key,value) VALUES('schema_version','1');
         PRAGMA user_version = 1;
         COMMIT;"
      ).map_err(|_| "CACHE_MIGRATION_FAILED")?;
    }
    connection
        .query_row("SELECT count(*) FROM metadata", [], |_| Ok(()))
        .map_err(|_| "CACHE_UNLOCK_FAILED")?;
    Ok(connection)
}

fn identity<'a>(
    state: &'a State<'_, CacheState>,
    server: &ServerIdentity,
    user_id: &str,
) -> Result<std::sync::MutexGuard<'a, Option<OpenCache>>, String> {
    let guard = state.0.lock().map_err(|_| "CACHE_STATE_FAILED")?;
    if guard
        .as_ref()
        .is_some_and(|cache| cache.server_key == server.key && cache.user_id == user_id)
    {
        Ok(guard)
    } else {
        Err("CACHE_IDENTITY_MISMATCH".into())
    }
}

#[tauri::command]
pub async fn cache_open_verified(
    app: AppHandle,
    base_url: String,
    user: Value,
    state: State<'_, CacheState>,
) -> Result<(), String> {
    let server = validate_server_url(&base_url)?;
    let user_id = user
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty())
        .ok_or("INVALID_USER")?;
    let verified = with_token(&server.base_url, Method::GET, "/api/v1/auth/me", None).await?;
    if !(200..300).contains(&verified.status) {
        return Err("CACHE_AUTHORIZATION_FAILED".into());
    }
    if verified.body.get("id").and_then(Value::as_str) != Some(user_id) {
        return Err("CACHE_IDENTITY_MISMATCH".into());
    }
    let connection = open_connection(&app, &server, user_id, true)?;
    let timestamp = now()?;
    connection
        .execute(
            "INSERT OR REPLACE INTO metadata(key,value) VALUES('authorized_at',?1)",
            [timestamp.to_string()],
        )
        .map_err(|_| "CACHE_WRITE_FAILED")?;
    connection
        .execute(
            "INSERT OR REPLACE INTO metadata(key,value) VALUES('user',?1)",
            [user.to_string()],
        )
        .map_err(|_| "CACHE_WRITE_FAILED")?;
    entry("last-cache-user", &server)?
        .set_password(user_id)
        .map_err(|_| "CACHE_KEY_STORE_FAILED")?;
    *state.0.lock().map_err(|_| "CACHE_STATE_FAILED")? = Some(OpenCache {
        connection,
        server_key: server.key,
        user_id: user_id.into(),
    });
    Ok(())
}

#[tauri::command]
pub fn cache_restore_offline(
    app: AppHandle,
    base_url: String,
    state: State<'_, CacheState>,
) -> Result<OfflineSession, String> {
    let server = validate_server_url(&base_url)?;
    let user_id = entry("last-cache-user", &server)?
        .get_password()
        .map_err(|_| "NO_OFFLINE_SESSION")?;
    let connection = open_connection(&app, &server, &user_id, false)?;
    let authorized_at: i64 = connection
        .query_row(
            "SELECT value FROM metadata WHERE key='authorized_at'",
            [],
            |row| row.get::<_, String>(0),
        )
        .map_err(|_| "NO_OFFLINE_SESSION")?
        .parse()
        .map_err(|_| "NO_OFFLINE_SESSION")?;
    let authorized_until = authorized_at + OFFLINE_AUTHORIZATION_SECONDS;
    if now()? > authorized_until {
        return Err("OFFLINE_AUTHORIZATION_EXPIRED".into());
    }
    let raw: String = connection
        .query_row("SELECT value FROM metadata WHERE key='user'", [], |row| {
            row.get(0)
        })
        .map_err(|_| "NO_OFFLINE_SESSION")?;
    let user = serde_json::from_str(&raw).map_err(|_| "CACHE_CORRUPT")?;
    *state.0.lock().map_err(|_| "CACHE_STATE_FAILED")? = Some(OpenCache {
        connection,
        server_key: server.key,
        user_id,
    });
    Ok(OfflineSession {
        user,
        authorized_until,
    })
}

#[tauri::command]
pub fn cache_replace_conversations(
    base_url: String,
    user_id: String,
    conversations: Vec<Value>,
    state: State<'_, CacheState>,
) -> Result<(), String> {
    let server = validate_server_url(&base_url)?;
    let mut guard = identity(&state, &server, &user_id)?;
    let cache = guard.as_mut().ok_or("CACHE_CLOSED")?;
    let transaction = cache
        .connection
        .transaction()
        .map_err(|_| "CACHE_WRITE_FAILED")?;
    transaction.execute("CREATE TEMP TABLE IF NOT EXISTS authorized_conversations(id TEXT PRIMARY KEY); DELETE FROM authorized_conversations", []).map_err(|_| "CACHE_WRITE_FAILED")?;
    for value in conversations {
        let id = value
            .get("id")
            .and_then(Value::as_str)
            .ok_or("INVALID_CONVERSATION")?;
        let updated = value.get("updatedAt").and_then(Value::as_str).unwrap_or("");
        transaction
            .execute(
                "INSERT OR REPLACE INTO conversations(id,body,updated_at) VALUES(?1,?2,?3)",
                params![id, value.to_string(), updated],
            )
            .map_err(|_| "CACHE_WRITE_FAILED")?;
        transaction
            .execute(
                "INSERT OR IGNORE INTO authorized_conversations(id) VALUES(?1)",
                [id],
            )
            .map_err(|_| "CACHE_WRITE_FAILED")?;
    }
    transaction
        .execute(
            "DELETE FROM conversations WHERE id NOT IN (SELECT id FROM authorized_conversations)",
            [],
        )
        .map_err(|_| "CACHE_WRITE_FAILED")?;
    transaction
        .commit()
        .map_err(|_| "CACHE_WRITE_FAILED".to_string())
}

#[tauri::command]
pub fn cache_store_messages(
    base_url: String,
    user_id: String,
    messages: Vec<Value>,
    state: State<'_, CacheState>,
) -> Result<(), String> {
    let server = validate_server_url(&base_url)?;
    let mut guard = identity(&state, &server, &user_id)?;
    let transaction = guard
        .as_mut()
        .ok_or("CACHE_CLOSED")?
        .connection
        .transaction()
        .map_err(|_| "CACHE_WRITE_FAILED")?;
    for value in messages {
        let id = value
            .get("id")
            .and_then(Value::as_str)
            .ok_or("INVALID_MESSAGE")?;
        let conversation_id = value
            .get("conversationId")
            .and_then(Value::as_str)
            .ok_or("INVALID_MESSAGE")?;
        let sequence = value
            .get("serverSequence")
            .and_then(Value::as_i64)
            .ok_or("INVALID_MESSAGE")?;
        let request_id = value
            .get("clientRequestId")
            .and_then(Value::as_str)
            .ok_or("INVALID_MESSAGE")?;
        transaction.execute("INSERT OR REPLACE INTO messages(id,conversation_id,server_sequence,client_request_id,body) VALUES(?1,?2,?3,?4,?5)", params![id, conversation_id, sequence, request_id, value.to_string()]).map_err(|_| "CACHE_WRITE_FAILED")?;
        transaction.execute(
            "INSERT INTO sync_checkpoints(conversation_id,server_sequence,synchronized_at) VALUES(?1,?2,?3)
             ON CONFLICT(conversation_id) DO UPDATE SET server_sequence=MAX(server_sequence,excluded.server_sequence), synchronized_at=excluded.synchronized_at",
            params![conversation_id, sequence, now()?],
        ).map_err(|_| "CACHE_WRITE_FAILED")?;
    }
    transaction
        .commit()
        .map_err(|_| "CACHE_WRITE_FAILED".to_string())
}

#[tauri::command]
pub fn cache_read_conversations(
    base_url: String,
    user_id: String,
    state: State<'_, CacheState>,
) -> Result<Vec<Value>, String> {
    let server = validate_server_url(&base_url)?;
    let guard = identity(&state, &server, &user_id)?;
    let mut statement = guard
        .as_ref()
        .ok_or("CACHE_CLOSED")?
        .connection
        .prepare("SELECT body FROM conversations ORDER BY updated_at DESC")
        .map_err(|_| "CACHE_READ_FAILED")?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|_| "CACHE_READ_FAILED")?;
    rows.map(|row| {
        serde_json::from_str(&row.map_err(|_| "CACHE_READ_FAILED".to_string())?)
            .map_err(|_| "CACHE_CORRUPT".into())
    })
    .collect()
}

#[tauri::command]
pub fn cache_read_messages(
    base_url: String,
    user_id: String,
    conversation_id: String,
    state: State<'_, CacheState>,
) -> Result<Vec<Value>, String> {
    let server = validate_server_url(&base_url)?;
    let guard = identity(&state, &server, &user_id)?;
    let mut statement = guard
        .as_ref()
        .ok_or("CACHE_CLOSED")?
        .connection
        .prepare("SELECT body FROM messages WHERE conversation_id=?1 ORDER BY server_sequence")
        .map_err(|_| "CACHE_READ_FAILED")?;
    let rows = statement
        .query_map([conversation_id], |row| row.get::<_, String>(0))
        .map_err(|_| "CACHE_READ_FAILED")?;
    rows.map(|row| {
        serde_json::from_str(&row.map_err(|_| "CACHE_READ_FAILED".to_string())?)
            .map_err(|_| "CACHE_CORRUPT".into())
    })
    .collect()
}

#[tauri::command]
pub fn cache_close(state: State<'_, CacheState>) -> Result<(), String> {
    *state.0.lock().map_err(|_| "CACHE_STATE_FAILED")? = None;
    Ok(())
}

#[tauri::command]
pub fn cache_status(state: State<'_, CacheState>) -> Result<CacheStatus, String> {
    Ok(CacheStatus {
        open: state.0.lock().map_err(|_| "CACHE_STATE_FAILED")?.is_some(),
        encrypted: true,
        offline_authorization_seconds: OFFLINE_AUTHORIZATION_SECONDS,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sqlcipher_encrypts_file_and_rejects_wrong_key() {
        let path = std::env::temp_dir().join(format!(
            "securelan-sqlcipher-{}-{}.db",
            std::process::id(),
            now().unwrap()
        ));
        let connection = Connection::open(&path).unwrap();
        connection
            .pragma_update(
                None,
                "key",
                "x'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'",
            )
            .unwrap();
        let cipher: String = connection
            .query_row("PRAGMA cipher_version", [], |row| row.get(0))
            .unwrap();
        assert!(!cipher.is_empty());
        connection
            .execute("CREATE TABLE proof(value TEXT NOT NULL)", [])
            .unwrap();
        connection
            .execute("INSERT INTO proof VALUES('encrypted')", [])
            .unwrap();
        drop(connection);
        let bytes = fs::read(&path).unwrap();
        assert_ne!(&bytes[..16], b"SQLite format 3\0");
        assert!(
            !bytes
                .windows(b"encrypted".len())
                .any(|window| window == b"encrypted")
        );
        let wrong = Connection::open(&path).unwrap();
        wrong
            .pragma_update(
                None,
                "key",
                "x'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'",
            )
            .unwrap();
        assert!(
            wrong
                .query_row("SELECT value FROM proof", [], |row| row.get::<_, String>(0))
                .is_err()
        );
        drop(wrong);
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn independent_cache_keys_and_user_scopes_differ() {
        assert_ne!(random_key().unwrap(), random_key().unwrap());
        assert_ne!(user_key("user-a"), user_key("user-b"));
    }
}
