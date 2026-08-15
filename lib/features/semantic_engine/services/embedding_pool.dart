/// ════════════════════════════════════════════════════════════════════════════
/// 嵌入池化：从模型 hidden states 提取句子向量并做 L2 归一化
/// ════════════════════════════════════════════════════════════════════════════
/// - clsPool 取首 token（[CLS]）行；BGE 系列模型卡片明确要求 CLS 池化，
///   mean pooling 会显著降低检索质量
/// - 纯 Dart 函数，无 ONNX 依赖，可在测试中直接验证
library;

import 'dart:math' as math;

/// 对嵌套 hidden states 做 CLS 池化 + L2 归一化。
///
/// [hidden] 为 [seq, dim] 嵌套 List（来自模型输出 value）；
/// 返回归一化后的句子向量。首行为空或零范数时返回全零向量（不产生 NaN）。
List<double> clsPool(List<Object?> hidden, int dims) {
  final clsRow = hidden.isEmpty ? const <Object?>[] : (hidden.first as List);
  final pooled = List<double>.filled(dims, 0);
  for (var d = 0; d < dims && d < clsRow.length; d++) {
    pooled[d] = (clsRow[d] as num).toDouble();
  }
  var norm = 0.0;
  for (final v in pooled) {
    norm += v * v;
  }
  norm = math.sqrt(norm);
  if (norm > 0) {
    for (var d = 0; d < dims; d++) {
      pooled[d] /= norm;
    }
  }
  return pooled;
}