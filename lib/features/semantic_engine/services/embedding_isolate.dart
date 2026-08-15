/// ════════════════════════════════════════════════════════════════════════════
/// 嵌入 isolate：后台常驻 worker，owns OrtEnv + Session，逐条推理 text → 向量
library;

import 'dart:io';
import 'dart:isolate';
import 'dart:math';
import 'package:onnxruntime_v2/onnxruntime_v2.dart';
import 'bert_tokenizer.dart';

/// isolate 入口：常驻 worker，owns OrtEnv + Session
void embeddingWorkerEntry(List<Object?> args) async {
  final control = args[0] as SendPort;
  final modelPath = args[1] as String;
  final vocabPath = args[2] as String;
  final dims = args[3] as int;

  final response = ReceivePort();
  control.send(response.sendPort);

  // 词表文件是 vocab.txt（每行一个 token）
  final vocabText = await File(vocabPath).readAsString();
  final tokenizer = BertTokenizer.fromVocabTxt(vocabText);

  OrtEnv.instance.init();
  final opts = OrtSessionOptions();
  // spike 实测：appendDefaultProviders() 是 async
  await opts.appendDefaultProviders();
  final bytes = await File(modelPath).readAsBytes();
  // spike 实测：fromBuffer 是同步
  final session = OrtSession.fromBuffer(bytes, opts);

  await for (final req in response) {
    if (req is! List || req.length != 2) continue;
    final id = req[0] as int;
    final text = req[1] as String;
    final reply = response.sendPort;
    try {
      final tokens = tokenizer.encode(text);
      final seq = tokens.inputIds.length;
      final ids = OrtValueTensor.createTensorWithDataList(
          tokens.inputIds, [1, seq]);
      final mask = OrtValueTensor.createTensorWithDataList(
          tokens.attentionMask, [1, seq]);
      final seg = OrtValueTensor.createTensorWithDataList(
          tokens.tokenTypeIds, [1, seq]);
      final runOpts = OrtRunOptions();
      final outputs = await session.runAsync(runOpts, {
        'input_ids': ids,
        'attention_mask': mask,
        'token_type_ids': seg,
      });
      final hidden = outputs![0]!;
      // spike 实测：无 asFloat32List()，value 为嵌套 List
      final value = hidden.value;
      final outer = value as List;
      final inner = outer.isEmpty ? <Object?>[] : (outer.first as List);
      final pooled = List<double>.filled(dims, 0);
      var active = 0;
      for (var s = 0; s < seq && s < inner.length; s++) {
        if (tokens.attentionMask[s] == 0) continue;
        active++;
        final row = inner[s] as List;
        for (var d = 0; d < dims && d < row.length; d++) {
          pooled[d] += (row[d] as num).toDouble();
        }
      }
      if (active > 0) {
        for (var d = 0; d < dims; d++) {
          pooled[d] /= active;
        }
      }
      var norm = 0.0;
      for (final v in pooled) {
        norm += v * v;
      }
      norm = sqrt(norm);
      if (norm > 0) {
        for (var d = 0; d < dims; d++) {
          pooled[d] /= norm;
        }
      }
      reply.send([id, pooled]);
      ids.release();
      mask.release();
      seg.release();
      runOpts.release();
      for (final o in outputs) {
        o?.release();
      }
    } catch (e) {
      reply.send([id, null]);
    }
  }
}