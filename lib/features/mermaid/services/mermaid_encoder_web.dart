import 'dart:convert';

/// Web 平台 Mermaid 编码器 (base64，无 zlib)
/// 注意: Web 端无 zlib，使用简单 base64 编码
/// 部分 mermaid.ink 版本支持此格式，若不支持将显示错误
class MermaidEncoder {
  static String encodeToUrl(String mermaidCode) {
    final bytes = utf8.encode(mermaidCode);
    final encoded = base64.encode(bytes);
    return 'https://mermaid.ink/img/$encoded';
  }
}
