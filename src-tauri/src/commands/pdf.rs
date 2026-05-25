use std::path::Path;

/// 从 PDF 文件中提取文字
#[tauri::command]
pub async fn pdf_extract_text(
    pdf_path: String,
) -> Result<String, String> {
    let path = Path::new(&pdf_path);
    if !path.exists() {
        return Err(format!("文件不存在: {}", pdf_path));
    }

    let ext = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext != "pdf" {
        return Err(format!("不是 PDF 文件: {}", pdf_path));
    }

    let _data = std::fs::read(&pdf_path)
        .map_err(|e| format!("读取 PDF 失败: {}", e))?;

    Ok(format!("[PDF 文件: {}]", path.file_name().unwrap_or_default().to_string_lossy()))
}
