#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::Path;
use walkdir::WalkDir;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Emitter;

#[derive(Serialize, Deserialize, Clone)]
struct AiChatRequest {
    provider: String,
    base_url: String,
    api_key: String,
    model: String,
    messages: Vec<ChatMessageRust>,
    temperature: f64,
    max_tokens: u32,
}

#[derive(Serialize, Deserialize, Clone)]
struct ChatMessageRust {
    role: String,
    content: String,
}

#[tauri::command]
async fn ai_proxy_test(
    provider: String,
    base_url: String,
    api_key: String,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    if provider == "ollama" {
        let url = format!("{}/api/tags", base_url);
        let resp = client.get(&url).send().await.map_err(|e| format!("连接失败: {}", e))?;
        if resp.status().is_success() {
            let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            Ok(data)
        } else {
            Err(format!("Ollama 返回 HTTP {}", resp.status()))
        }
    } else {
        let url = format!("{}/models", base_url);
        let mut req = client.get(&url);
        if !api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", api_key));
        }
        let resp = req.send().await.map_err(|e| format!("连接失败: {}", e))?;
        if resp.status().is_success() {
            let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            Ok(data)
        } else {
            Err(format!("HTTP {}: {}", resp.status(), resp.text().await.unwrap_or_default()))
        }
    }
}

#[tauri::command]
async fn ai_proxy_chat(
    _app: AppHandle,
    request: AiChatRequest,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    if request.provider == "ollama" {
        let url = format!("{}/api/chat", request.base_url);
        let body = serde_json::json!({
            "model": request.model,
            "messages": request.messages,
            "stream": false,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens,
            }
        });
        let resp = client.post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();
            return Err(format!("Ollama 请求失败 ({}): {}", status, err_body));
        }

        let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let content = data["message"]["content"].as_str().unwrap_or("").to_string();
        Ok(content)
    } else {
        let url = format!("{}/chat/completions", request.base_url);
        let mut req_builder = client.post(&url);
        if !request.api_key.is_empty() {
            req_builder = req_builder.header("Authorization", format!("Bearer {}", request.api_key));
        }

        let body = serde_json::json!({
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": false,
        });

        let resp = req_builder
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();
            return Err(format!("请求失败 ({}): {}", status, err_body));
        }

        let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let content = data["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();
        Ok(content)
    }
}

#[tauri::command]
async fn ai_proxy_stream(
    app: AppHandle,
    request: AiChatRequest,
) -> Result<(), String> {
    use futures_util::StreamExt;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let event_id = format!("ai-stream-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis());

    if request.provider == "ollama" {
        let url = format!("{}/api/chat", request.base_url);
        let body = serde_json::json!({
            "model": request.model,
            "messages": request.messages,
            "stream": true,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens,
            }
        });

        let resp = client.post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();
            return Err(format!("Ollama 请求失败 ({}): {}", status, err_body));
        }

        let mut stream = resp.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].trim().to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if line.is_empty() {
                    continue;
                }

                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                    if let Some(content) = json["message"]["content"].as_str() {
                        if !content.is_empty() {
                            let _ = app.emit("ai-chunk", serde_json::json!({
                                "event_id": &event_id,
                                "content": content
                            }));
                        }
                    }
                    if let Some(error) = json["error"].as_str() {
                        let _ = app.emit("ai-chunk", serde_json::json!({
                            "event_id": &event_id,
                            "error": error
                        }));
                    }
                }
            }
        }

        let _ = app.emit("ai-done", serde_json::json!({ "event_id": event_id }));
    } else {
        let url = format!("{}/chat/completions", request.base_url);
        let mut req_builder = client.post(&url);
        if !request.api_key.is_empty() {
            req_builder = req_builder.header("Authorization", format!("Bearer {}", request.api_key));
        }

        let body = serde_json::json!({
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": true,
        });

        let resp = req_builder
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_body = resp.text().await.unwrap_or_default();
            return Err(format!("请求失败 ({}): {}", status, err_body));
        }

        let mut stream = resp.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].trim().to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if !line.starts_with("data: ") {
                    continue;
                }

                let data = &line[6..];
                if data == "[DONE]" {
                    let _ = app.emit("ai-done", serde_json::json!({ "event_id": event_id }));
                    return Ok(());
                }

                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                        if !content.is_empty() {
                            let _ = app.emit("ai-chunk", serde_json::json!({
                                "event_id": &event_id,
                                "content": content
                            }));
                        }
                    }
                }
            }
        }

        let _ = app.emit("ai-done", serde_json::json!({ "event_id": event_id }));
    }

    Ok(())
}

#[tauri::command]
fn read_dir(path: String) -> Result<Vec<serde_json::Value>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err("路径不是文件夹".into());
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = path.file_name()
            .unwrap()
            .to_string_lossy()
            .to_string();

        entries.push(serde_json::json!({
            "name": name,
            "path": path.to_string_lossy().to_string(),
            "is_dir": path.is_dir()
        }));
    }

    Ok(entries)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    
    // 确保父目录存在
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }
    
    // 写入文件
    fs::write(&path, content)
        .map_err(|e| format!("写入文件失败: {}", e))
}

#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    
    // 验证：父路径必须是目录（不能是文件）
    if let Some(parent) = p.parent() {
        if parent.exists() && !parent.is_dir() {
            return Err(format!("父路径 '{}' 不是文件夹", parent.display()));
        }
        // 自动创建不存在的父目录
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }
    
    fs::File::create(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    
    // 验证：父路径必须是目录（不能是文件）
    if let Some(parent) = p.parent() {
        if parent.exists() && !parent.is_dir() {
            return Err(format!("父路径 '{}' 不是文件夹", parent.display()));
        }
    }
    
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(&path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn watch_dir(_path: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn search_files(dir_path: String, query: String) -> Result<Vec<serde_json::Value>, String> {
    let dir = Path::new(&dir_path);
    if !dir.is_dir() {
        return Err("路径不是文件夹".into());
    }

    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    for entry in WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let path = e.path();
            if !path.is_file() {
                return false;
            }
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");
            ext == "md" || ext == "markdown"
        })
    {
        let path = entry.path();
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut matches = Vec::new();
        for (line_idx, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&query_lower) {
                matches.push(serde_json::json!({
                    "line_number": line_idx + 1,
                    "line_content": line.trim().to_string()
                }));
                if matches.len() >= 5 {
                    break;
                }
            }
        }

        if !matches.is_empty() {
            let file_name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            results.push(serde_json::json!({
                "file_path": path.to_string_lossy().to_string(),
                "file_name": file_name,
                "matches": matches
            }));
        }
    }

    Ok(results)
}

#[tauri::command]
fn export_html(content: String, title: String) -> Result<String, String> {
    let html = format!(
        r#"<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        :root {{
            --base: #1e1e2e;
            --mantle: #181825;
            --crust: #11111b;
            --text: #cdd6f4;
            --subtext0: #a6adc8;
            --subtext1: #bac2de;
            --surface0: #313244;
            --surface1: #45475a;
            --overlay0: #6c7086;
            --blue: #89b4fa;
            --lavender: #b4befe;
            --mauve: #cba6f7;
            --green: #a6e3a1;
            --yellow: #f9e2af;
            --red: #f38ba8;
            --peach: #fab387;
            --teal: #94e2d5;
            --sky: #89dceb;
            --pink: #f5c2e7;
        }}
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: var(--base);
            color: var(--text);
            line-height: 1.6;
            padding: 2rem;
            max-width: 900px;
            margin: 0 auto;
        }}
        h1, h2, h3, h4, h5, h6 {{
            color: var(--lavender);
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: 600;
        }}
        h1 {{ font-size: 2em; border-bottom: 2px solid var(--surface0); padding-bottom: 0.3em; }}
        h2 {{ font-size: 1.5em; border-bottom: 1px solid var(--surface0); padding-bottom: 0.3em; }}
        h3 {{ font-size: 1.25em; }}
        p {{
            margin-bottom: 1em;
            color: var(--subtext1);
        }}
        a {{
            color: var(--blue);
            text-decoration: none;
        }}
        a:hover {{
            text-decoration: underline;
        }}
        code {{
            background-color: var(--surface0);
            color: var(--peach);
            padding: 0.2em 0.4em;
            border-radius: 4px;
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 0.9em;
        }}
        pre {{
            background-color: var(--mantle);
            border: 1px solid var(--surface0);
            border-radius: 8px;
            padding: 1em;
            overflow-x: auto;
            margin-bottom: 1em;
        }}
        pre code {{
            background: none;
            color: var(--text);
            padding: 0;
        }}
        blockquote {{
            border-left: 4px solid var(--mauve);
            padding-left: 1em;
            margin-left: 0;
            margin-bottom: 1em;
            color: var(--subtext0);
            font-style: italic;
        }}
        ul, ol {{
            margin-bottom: 1em;
            padding-left: 2em;
        }}
        li {{
            margin-bottom: 0.3em;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1em;
        }}
        th, td {{
            border: 1px solid var(--surface0);
            padding: 0.5em;
            text-align: left;
        }}
        th {{
            background-color: var(--surface0);
            color: var(--lavender);
            font-weight: 600;
        }}
        tr:nth-child(even) {{
            background-color: var(--mantle);
        }}
        hr {{
            border: none;
            border-top: 1px solid var(--surface0);
            margin: 2em 0;
        }}
        img {{
            max-width: 100%;
            height: auto;
            border-radius: 8px;
        }}
        .markdown-body {{
            background-color: var(--base);
        }}
    </style>
</head>
<body>
    <div class="markdown-body">
        {content}
    </div>
</body>
</html>"#
    );
    Ok(html)
}

#[tauri::command]
fn export_markdown(content: String, _file_name: String) -> Result<String, String> {
    Ok(content)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            read_dir,
            read_file,
            write_file,
            create_file,
            create_dir,
            rename_file,
            delete_file,
            watch_dir,
            search_files,
            export_html,
            export_markdown,
            ai_proxy_test,
            ai_proxy_chat,
            ai_proxy_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
