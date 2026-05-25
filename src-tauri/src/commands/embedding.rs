use crate::db;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize)]
pub struct ChunkResult {
    file_path: String,
    chunk_count: usize,
    status: String,
}

/// 将文档分块并存储，使用 AI 生成摘要作为索引
/// 同步的数据库操作通过 spawn_blocking 执行，避免阻塞 tokio 运行时
#[tauri::command]
pub async fn index_document(
    file_path: String,
    content: String,
    base_url: String,
    api_key: String,
    model: String,
) -> Result<ChunkResult, String> {
    let chunks = split_into_chunks(&content, 500, 50);

    // 先生成所有摘要（异步 HTTP 请求）
    let mut summaries = Vec::with_capacity(chunks.len());
    for chunk in &chunks {
        let summary = generate_chunk_summary(chunk, &base_url, &api_key, &model).await.unwrap_or_default();
        summaries.push(summary);
    }

    // 数据库操作放到阻塞线程
    let file_path_clone = file_path.clone();
    let title = Path::new(&file_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let content_len = content.len();
    let chunk_count = chunks.len();

    let db_chunks: Vec<(String, String)> = chunks.into_iter().zip(summaries.into_iter()).collect();

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let conn = db::get_connection().map_err(|e| format!("数据库连接失败: {}", e))?;

        conn.execute("DELETE FROM document_chunks WHERE file_path = ?1", [&file_path_clone])
            .map_err(|e| e.to_string())?;

        for (i, (chunk, summary)) in db_chunks.iter().enumerate() {
            conn.execute(
                "INSERT OR REPLACE INTO document_chunks (file_path, chunk_index, content, embedding, updated_at) VALUES (?1, ?2, ?3, ?4, strftime('%s','now'))",
                rusqlite::params![file_path_clone, i as i32, chunk, summary.as_bytes()],
            ).map_err(|e| e.to_string())?;
        }

        conn.execute(
            "INSERT OR REPLACE INTO document_meta (file_path, title, char_count, chunk_count, last_indexed) VALUES (?1, ?2, ?3, ?4, strftime('%s','now'))",
            rusqlite::params![file_path_clone, title, content_len as i64, chunk_count as i32],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }).await.map_err(|e| format!("任务执行失败: {}", e))??;

    Ok(ChunkResult {
        file_path,
        chunk_count,
        status: "indexed".to_string(),
    })
}

fn split_into_chunks(text: &str, chunk_size: usize, overlap: usize) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    let mut chunks = Vec::new();
    let mut start = 0;

    while start < chars.len() {
        let end = std::cmp::min(start + chunk_size, chars.len());
        let chunk: String = chars[start..end].iter().collect();

        let trimmed = if end < chars.len() {
            if let Some(last_period) = chunk.rfind('。') {
                &chunk[..=last_period]
            } else if let Some(last_newline) = chunk.rfind('\n') {
                &chunk[..=last_newline]
            } else {
                &chunk
            }
        } else {
            &chunk
        };

        chunks.push(trimmed.to_string());
        start += chunk_size - overlap;
    }

    chunks
}

async fn generate_chunk_summary(chunk: &str, base_url: &str, api_key: &str, model: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/chat/completions", base_url);
    let mut req = client.post(&url);
    if !api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }

    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": "用一句话概括以下文本的关键信息，不超过50字。" },
            { "role": "user", "content": chunk }
        ],
        "temperature": 0.1,
        "max_tokens": 100,
        "stream": false
    });

    let resp = req
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("摘要生成失败: HTTP {}", resp.status()));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string())
}
