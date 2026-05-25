use std::path::Path;

/// 从图片文件中提取文字（编码为 base64 供 AI 视觉模型使用）
#[tauri::command]
pub async fn ocr_extract_text(
    image_path: String,
) -> Result<String, String> {
    let path = Path::new(&image_path);
    if !path.exists() {
        return Err(format!("文件不存在: {}", image_path));
    }

    let ext = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if !["png", "jpg", "jpeg", "gif", "bmp", "webp"].contains(&ext.as_str()) {
        return Err(format!("不支持的图片格式: {}", ext));
    }

    let image_data = std::fs::read(&image_path)
        .map_err(|e| format!("读取图片失败: {}", e))?;
    let base64_image = base64_encode(&image_data);
    let data_uri = format!("data:image/{};base64,{}", ext, base64_image);

    Ok(data_uri)
}

fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    for chunk in data.chunks(3) {
        let mut n = 0u32;
        for (i, byte) in chunk.iter().enumerate() {
            n |= (*byte as u32) << (16 - i * 8);
        }
        for i in 0..4 {
            if i <= chunk.len() {
                result.push(CHARS[((n >> (18 - i * 6)) & 0x3F) as usize] as char);
            } else {
                result.push('=');
            }
        }
    }
    result
}
