/// ════════════════════════════════════════════════════════════════════════════
/// 语义模型档位配置
library;

/// 语义模型档位
enum ModelTier {
  /// 轻量: bge-small-zh-v1.5 (512 维)
  light(
    'bge-small-zh-v1.5',
    512,
    '~95MB fp32（可换 int8 ~25MB）',
    '69a0b846f4f116b5e6aabf9546ea6754d02264f3211a13a1bd69b31b8040749a',
  ),
  /// 高质量: bge-base-zh-v1.5 (768 维)
  base(
    'bge-base-zh-v1.5',
    768,
    '~180MB fp32',
    '', // spike 仅确认 URL 可达；首次下载时记录后填入
  );

  const ModelTier(this.id, this.dims, this.sizeLabel, this.modelHash);

  final String id;
  final int dims;
  final String sizeLabel;
  final String modelHash;

  String get _repoPath => 'Xenova/$id/resolve/main';

  String get onnxPath => '$_repoPath/onnx/model.onnx';

  String get vocabPath => '$_repoPath/vocab.txt';

  String get onnxUrl => 'https://huggingface.co/$onnxPath';

  /// 词表文件：repo 无 vocab.json，真实文件是 vocab.txt（每行一个 token，行号即 id）
  String get vocabUrl => 'https://huggingface.co/$vocabPath';

  /// 指定镜像 host 的下载地址（hf-mirror.com 等）
  String downloadUrl(String host, {required bool vocab}) =>
      'https://$host/${vocab ? vocabPath : onnxPath}';

  /// SHA-256；base 档位在首次下载后补齐
  String? get expectedHash => modelHash.isEmpty ? null : modelHash;

  static ModelTier byId(String id) =>
      ModelTier.values.firstWhere((t) => t.id == id,
          orElse: () => ModelTier.light);
}
