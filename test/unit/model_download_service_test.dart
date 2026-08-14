import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:crypto/crypto.dart';
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

/// 模拟「服务器忽略 Range、对 start>0 仍返回完整 200」的下载器：
/// 服务端把整份内容塞进 body，HttpDownloader 据此抛 RangeIgnoredException。
class RangeIgnoringDownloader implements Downloader {
  final List<int> fullBytes;
  int calls = 0;
  RangeIgnoringDownloader(this.fullBytes);
  @override
  Future<int> fetchRange(Uri url, int start, void Function(List<int>) onChunk) async {
    calls++;
    if (start > 0) throw const RangeIgnoredException();
    onChunk(fullBytes);
    return fullBytes.length;
  }
}

/// 模拟下载中途网络中断：写入部分数据后抛出 HttpException
class FailingDownloader implements Downloader {
  final List<int> bytes;
  FailingDownloader(this.bytes);
  @override
  Future<int> fetchRange(Uri url, int start, void Function(List<int>) onChunk) async {
    final half = bytes.length ~/ 2;
    onChunk(bytes.sublist(start, start + half));
    throw const HttpException('网络中断');
  }
}

/// 纯 Dart SHA-256（crypto 包），避免依赖系统 shasum 命令
String sha256Hex(List<int> bytes) => sha256.convert(bytes).toString();

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

  test('已存在且 hash 匹配则跳过下载并回报进度 1.0', () async {
    final bytes = List<int>.generate(256, (i) => 65);
    final dest = '${tempDir.path}/m.onnx';
    await File(dest).writeAsBytes(bytes);
    final dl = FakeDownloader(bytes);
    final progress = <double>[];
    final svc = ModelDownloadService(
      url: Uri.parse('https://example.com/m.onnx'),
      destPath: dest,
      downloader: dl,
      expectedSha256: sha256Hex(bytes),
    );
    await svc.download(onProgress: progress.add);
    expect(dl.calls, 0); // 不触发下载
    expect(progress, [1.0]);
  });

  test('已存在且未配置 hash 时跳过下载并回报进度 1.0', () async {
    final bytes = List<int>.generate(256, (i) => 65);
    final dest = '${tempDir.path}/m.onnx';
    await File(dest).writeAsBytes(bytes);
    final dl = FakeDownloader(bytes);
    final progress = <double>[];
    final svc = ModelDownloadService(
      url: Uri.parse('https://example.com/m.onnx'),
      destPath: dest,
      downloader: dl,
      expectedSha256: null, // 无 hash：视为有效，不应删除重下
    );
    await svc.download(onProgress: progress.add);
    expect(dl.calls, 0);
    expect(await File(dest).readAsBytes(), bytes);
    expect(progress, [1.0]);
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

  test('Range 被忽略(200)时删除部分文件并从头重下，内容无重复', () async {
    final bytes = List<int>.generate(512, (i) => i % 256);
    final dest = '${tempDir.path}/m.onnx';
    final part = File('$dest.part');
    await part.writeAsBytes(bytes.sublist(0, 200)); // 已有 200 字节部分文件
    final dl = RangeIgnoringDownloader(bytes);
    final svc = ModelDownloadService(
      url: Uri.parse('https://example.com/m.onnx'),
      destPath: dest,
      downloader: dl,
      expectedSha256: null,
    );
    await svc.download(onProgress: (_) {});
    expect(dl.calls, 2); // 第一次带 Range 失败，第二次从头
    expect(await File(dest).readAsBytes(), bytes); // 无重复、无超长
  });

  test('下载后 hash 不匹配：抛 StateError 且删除 .part 与损坏的 dest', () async {
    final bytes = List<int>.generate(256, (i) => i);
    final dest = '${tempDir.path}/m.onnx';
    await File(dest).writeAsBytes(List<int>.filled(100, 0)); // 损坏文件
    final svc = ModelDownloadService(
      url: Uri.parse('https://example.com/m.onnx'),
      destPath: dest,
      downloader: FakeDownloader(bytes),
      expectedSha256: '0000000000000000000000000000000000000000000000000000000000000000', // 错误 hash
    );
    await expectLater(svc.download(onProgress: (_) {}), throwsA(isA<StateError>()));
    expect(await File('$dest.part').exists(), isFalse); // .part 已删除
    expect(await File(dest).exists(), isFalse); // 损坏的 dest 也已删除
  });

  test('下载中途网络中断时保留 .part 以便续传', () async {
    final bytes = List<int>.generate(512, (i) => i % 256);
    final dest = '${tempDir.path}/m.onnx';
    final svc = ModelDownloadService(
      url: Uri.parse('https://example.com/m.onnx'),
      destPath: dest,
      downloader: FailingDownloader(bytes),
      expectedSha256: null,
    );
    await expectLater(svc.download(onProgress: (_) {}), throwsA(isA<HttpException>()));
    final part = File('$dest.part');
    expect(await part.exists(), isTrue);
    expect(await part.length(), bytes.length ~/ 2);
  });
}
