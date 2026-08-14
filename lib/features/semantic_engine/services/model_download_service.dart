/// ══════════════════════════════════════════════════
/// ModelDownloadService — 模型下载服务
/// ══════════════════════════════════════════════════
/// 断点续传（Range）+ SHA-256 校验，目标为 ONNX 模型与词表文件。
///  - .part 部分文件续传，完成后原子重命名
///  - hash 不匹配时删除并重新下载
///  - 通过 [Downloader] 抽象注入，便于单测（HttpDownloader 为 dart:io 实现）
/// ──────────────────────────────────────────────────

library;

import 'dart:io';
import 'package:crypto/crypto.dart';

/// 服务器忽略 Range 请求（对 start>0 仍返回完整 200 body）时抛出的异常，
/// 用于让服务端从头重下，避免把完整文件追加到已有 .part 上造成内容重复。
class RangeIgnoredException implements Exception {
  final Uri? uri;
  const RangeIgnoredException([this.uri]);
  @override
  String toString() => uri == null ? 'RangeIgnoredException' : 'RangeIgnoredException: $uri';
}

/// 字节下载器抽象（可注入以便测试）
abstract class Downloader {
  /// 从 [start] 字节起拉取，逐块同步回调 [onChunk]，返回完整内容总长度
  Future<int> fetchRange(Uri url, int start, void Function(List<int>) onChunk);
}

/// 基于 dart:io HttpClient 的实现（支持 Range 断点续传）
class HttpDownloader implements Downloader {
  @override
  Future<int> fetchRange(Uri url, int start, void Function(List<int>) onChunk) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 30);
    try {
      final req = await client.getUrl(url);
      if (start > 0) req.headers.set(HttpHeaders.rangeHeader, 'bytes=$start-');
      final resp = await req.close();
      if (start > 0 && resp.statusCode == 200) {
        throw RangeIgnoredException(url); // 服务器忽略 Range，返回了完整内容
      }
      if (resp.statusCode != 200 && resp.statusCode != 206) {
        throw HttpException('下载失败: HTTP ${resp.statusCode}', uri: url);
      }
      final contentLength = start + resp.contentLength;
      await for (final chunk in resp) {
        onChunk(chunk); // 同步写盘，回调内不得 await
      }
      return contentLength;
    } finally {
      client.close(force: true);
    }
  }
}

/// 模型下载服务：断点续传 + SHA-256 校验
class ModelDownloadService {
  final Uri url;
  final String destPath;
  final Downloader downloader;
  final String? expectedSha256;

  ModelDownloadService({
    required this.url,
    required this.destPath,
    required this.downloader,
    this.expectedSha256,
  });

  Future<void> download({required void Function(double) onProgress}) async {
    final dest = File(destPath);
    if (await dest.exists()) {
      if (expectedSha256 == null) {
        onProgress(1); // 无 hash 配置：视为有效，直接跳过
        return;
      }
      if (await _sha256(dest) == expectedSha256) {
        onProgress(1);
        return;
      }
      await dest.delete(); // hash 不匹配：删除损坏文件后重下
    }
    final part = File('$destPath.part');
    var start = 0;
    if (await part.exists()) start = await part.length();
    var written = start;
    var total = start;
    int contentLength;
    try {
      contentLength = await downloader.fetchRange(url, start, (chunk) {
        _writeSync(part, chunk);
        written += chunk.length;
        onProgress(total > 0 ? (written / total).clamp(0.0, 1.0) : 0.0);
      });
    } on RangeIgnoredException {
      // 服务器忽略 Range 返回完整内容：作废 .part，从头重下，避免内容重复
      await part.delete();
      start = 0;
      written = 0;
      total = 0;
      contentLength = await downloader.fetchRange(url, 0, (chunk) {
        _writeSync(part, chunk);
        written += chunk.length;
        onProgress(total > 0 ? (written / total).clamp(0.0, 1.0) : 0.0);
      });
    }
    total = contentLength;
    // 校正进度到 100%
    onProgress(1);
    final hash = await _sha256(part);
    if (expectedSha256 != null && hash != expectedSha256) {
      await part.delete();
      throw StateError('模型哈希校验失败，已删除，请重试');
    }
    await part.rename(destPath);
  }

  void _writeSync(File part, List<int> chunk) {
    final raf = part.openSync(mode: FileMode.append);
    try {
      raf.writeFromSync(chunk);
    } finally {
      raf.closeSync();
    }
  }

  Future<String> _sha256(File f) async {
    final bytes = await f.readAsBytes();
    return sha256.convert(bytes).toString();
  }
}
