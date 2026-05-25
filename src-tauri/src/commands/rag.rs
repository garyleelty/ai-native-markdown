use crate::db;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct RagResult {
    chunks: Vec<ChunkMatch>,
    total: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ChunkMatch {
    file_path: String,
    chunk_index: i32,
    content: String,
    relevance: f64,
}

/// 基于关键词匹配的 RAG 检索
#[tauri::command]
pub async fn rag_search(
    query: String,
    top_k: Option<i32>,
    file_filter: Option<String>,
) -> Result<RagResult, String> {
    let k = top_k.unwrap_or(5);
    let query_lower = query.to_lowercase();
    let query_words: Vec<String> = query_lower
        .split(|c: char| c.is_whitespace() || c.is_ascii_punctuation())
        .map(|w| w.to_string())
        .filter(|w| w.len() > 1)
        .collect();

    // 数据库操作放到阻塞线程
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<ChunkMatch>, String> {
        let conn = db::get_connection().map_err(|e| format!("数据库连接失败: {}", e))?;

        let sql = if file_filter.is_some() {
            "SELECT file_path, chunk_index, content FROM document_chunks WHERE file_path = ?1 ORDER BY updated_at DESC".to_string()
        } else {
            "SELECT file_path, chunk_index, content FROM document_chunks ORDER BY updated_at DESC".to_string()
        };

        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

        let rows: Vec<Result<(String, i32, String), _>> = if let Some(ref filter) = file_filter {
            stmt.query_map(rusqlite::params![filter], |row| {
                Ok((row.get::<_,String>(0)?, row.get::<_,i32>(1)?, row.get::<_,String>(2)?))
            }).map_err(|e| e.to_string())?.collect()
        } else {
            stmt.query_map([], |row| {
                Ok((row.get::<_,String>(0)?, row.get::<_,i32>(1)?, row.get::<_,String>(2)?))
            }).map_err(|e| e.to_string())?.collect()
        };

        let mut matches: Vec<ChunkMatch> = rows
            .into_iter()
            .filter_map(|r| r.ok())
            .map(|(file_path, chunk_index, content)| {
                let content_lower = content.to_lowercase();
                let relevance = query_words.iter()
                    .map(|word| {
                        if content_lower.contains(word.as_str()) { 1.0 } else { 0.0 }
                    })
                    .sum::<f64>()
                    / query_words.len().max(1) as f64;

                ChunkMatch { file_path, chunk_index, content, relevance }
            })
            .filter(|m| m.relevance > 0.0)
            .collect();

        matches.sort_by(|a, b| b.relevance.partial_cmp(&a.relevance).unwrap());
        matches.truncate(k as usize);

        Ok(matches)
    }).await.map_err(|e| format!("任务执行失败: {}", e))??;

    let total = result.len();
    Ok(RagResult { chunks: result, total })
}

/// 获取所有已索引文档列表
#[tauri::command]
pub async fn rag_list_documents() -> Result<Vec<serde_json::Value>, String> {
    tokio::task::spawn_blocking(move || -> Result<Vec<serde_json::Value>, String> {
        let conn = db::get_connection().map_err(|e| format!("数据库连接失败: {}", e))?;

        let mut stmt = conn
            .prepare("SELECT file_path, title, char_count, chunk_count, last_indexed FROM document_meta ORDER BY last_indexed DESC")
            .map_err(|e| e.to_string())?;

        let rows = stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "file_path": row.get::<_,String>(0)?,
                "title": row.get::<_,String>(1)?,
                "char_count": row.get::<_,i64>(2)?,
                "chunk_count": row.get::<_,i32>(3)?,
                "last_indexed": row.get::<_,i64>(4)?,
            }))
        }).map_err(|e| e.to_string())?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }).await.map_err(|e| format!("任务执行失败: {}", e))?
}
