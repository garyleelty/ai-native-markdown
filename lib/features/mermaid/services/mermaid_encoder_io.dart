import 'dart:convert';
import 'dart:io';

/// 原生平台 Mermaid 编码器 (dart:io zlib 压缩)
class MermaidEncoder {
  /// 将 Mermaid 代码编码为 mermaid.ink 兼容格式
  /// 返回 Image URL
  static String encodeToUrl(String mermaidCode) {
    final bytes = utf8.encode(mermaidCode);
    final compressed = zlib.encode(bytes);
    final base64 = base64Url.encode(compressed);
    return 'https://mermaid.ink/img/pako:$base64';
  }
}
