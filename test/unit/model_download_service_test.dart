import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/semantic_engine/services/model_download_service.dart';

/// 内存下载器 fake：模拟 Range 断点续传，可计数调用次数
class FakeDownloader implements Downloader {
  final List<int> fullBytes;
  int calls = 0;
  FakeDownloader(this.fullBytes);
  @override
  Future<int> fetchRange(Uri url, int start, void Function(List<int>) onChunk) async {
    calls++;
    onChunk(fullBytes.sublist(start));
    return fullBytes.length;
  }
}

/// 测试内联 SHA-256（走系统 shasum，避免新增依赖）
String sha256Hex(List<int> bytes) {
  final dir = Directory.systemTemp.createTempSync('hash');
  final f = File('${dir.path}/x.bin')..writeAsBytesSync(bytes);
  final proc = Process.runSync('shasum', ['-a', '256', f.path]);
  dir.deleteSync(recursive: true);
  return (proc.stdout as String).trim().split(' ').first;
}

void main() {
  late Directory tempDir;
  setUp(() async { tempDir = await Directory.systemTemp.createTemp('dl_test'); });
  tearDown(() async { await tempDir.delete(recursive: true); });

  test('全新下载调用 onProgress 到 1.0', () async {
    final bytes = List<int>.generate(1024, (i) => i % 256);
    final svc = ModelDownloadService(
      url: Uri.parse('https://example.com/m.onnx'),
      destPath: '${tempDir.path}/m.onnx',
      downloader: FakeDownloader(bytes),
      expectedSha256: null, // 跳过校验
    );
    final progress = <double>[];
    await svc.download(onProgress: progress.add);
    expect(await File('${tempDir.path}/m.onnx').exists(), isTrue);
    expect(progress.last, 1.0);
  });

  test('已存在且 hash 匹配则跳过下载', () async {
    final bytes = List<int>.generate(256, (i) => 65);
    final dest = '${tempDir.path}/m.onnx';
    await File(dest).writeAsBytes(bytes);
    final dl = FakeDownloader(bytes);
    final svc = ModelDownloadService(
      url: Uri.parse('https://example.com/m.onnx'),
      destPath: dest,
      downloader: dl,
      expectedSha256: sha256Hex(bytes),
    );
    await svc.download(onProgress: (_) {});
    expect(dl.calls, 0); // 不触发下载
  });

  test('hash 不匹配删除并重新下载', () async {
    final bytes = List<int>.generate(256, (i) => i);
    final dest = '${tempDir.path}/m.onnx';
    await File(dest).writeAsBytes(List<int>.filled(100, 0)); // 损坏文件
    final svc = ModelDownloadService(
      url: Uri.parse('https://example.com/m.onnx'),
      destPath: dest,
      downloader: FakeDownloader(bytes),
      expectedSha256: sha256Hex(bytes),
    );
    await svc.download(onProgress: (_) {});
    expect(await File(dest).readAsBytes(), bytes);
  });

  test('部分文件断点续传', () async {
    final bytes = List<int>.generate(512, (i) => i % 256);
    final dest = '${tempDir.path}/m.onnx';
    final part = File('$dest.part');
    await part.writeAsBytes(bytes.sublist(0, 200));
    final svc = ModelDownloadService(
      url: Uri.parse('https://example.com/m.onnx'),
      destPath: dest,
      downloader: FakeDownloader(bytes),
      expectedSha256: null,
    );
    await svc.download(onProgress: (_) {});
    expect(await File(dest).readAsBytes(), bytes);
  });
}