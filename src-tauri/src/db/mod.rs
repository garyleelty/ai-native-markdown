use rusqlite::{Connection, Result as SqlResult};
use std::sync::Mutex;
use std::path::PathBuf;
use once_cell::sync::Lazy;

static DB_PATH: Lazy<Mutex<Option<PathBuf>>> = Lazy::new(|| Mutex::new(None));
static SCHEMA_INITIALIZED: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

pub fn set_db_path(path: PathBuf) {
    let mut db_path = DB_PATH.lock().unwrap();
    *db_path = Some(path);
}

pub fn get_connection() -> SqlResult<Connection> {
    let db_path = DB_PATH.lock().unwrap();
    let path = db_path.as_ref().expect("数据库路径未初始化");
    let conn = Connection::open(path)?;

    // 只初始化一次 schema
    let mut initialized = SCHEMA_INITIALIZED.lock().unwrap();
    if !*initialized {
        initialize_schema(&conn)?;
        *initialized = true;
    }

    Ok(conn)
}

fn initialize_schema(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS document_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding BLOB,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
            UNIQUE(file_path, chunk_index)
        );

        CREATE INDEX IF NOT EXISTS idx_chunks_file_path ON document_chunks(file_path);
        CREATE INDEX IF NOT EXISTS idx_chunks_updated ON document_chunks(updated_at);

        CREATE TABLE IF NOT EXISTS document_meta (
            file_path TEXT PRIMARY KEY,
            title TEXT,
            summary TEXT,
            tags TEXT,
            char_count INTEGER DEFAULT 0,
            chunk_count INTEGER DEFAULT 0,
            last_indexed INTEGER NOT NULL DEFAULT 0
        );
    ")?;
    Ok(())
}
