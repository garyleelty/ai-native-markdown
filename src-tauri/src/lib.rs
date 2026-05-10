#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::Path;
use walkdir::WalkDir;

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
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    fs::File::create(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
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
            export_markdown
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
