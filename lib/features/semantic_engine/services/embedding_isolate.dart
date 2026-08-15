/// ════════════════════════════════════════════════════════════════════════════
/// 嵌入 isolate：后台常驻 worker，owns OrtEnv + Session，逐条推理 text → 向量
library;

import 'dart:io';
import 'dart:isolate';
import 'package:onnxruntime_v2/onnxruntime_v2.dart';
import 'bert_tokenizer.dart';
import 'embedding_pool.dart';

/// isolate 入口：常驻 worker，owns OrtEnv + Session
///
/// args: [control, modelPath, vocabPath, dims, replyPort]
/// - 初始化成功后向 control 发送本 worker 的请求接收端口（SendPort）
/// - 初始化失败向 control 发送 String 错误信号
/// - 推理结果经 replyPort（主 isolate 传入的 ReceivePort）回传
void embeddingWorkerEntry(List<Object?> args) async {
  final control = args[0] as SendPort;
  final modelPath = args[1] as String;
  final vocabPath = args[2] as String;
  final dims = args[3] as int;
  final replyPort = args[4] as SendPort;

  try {
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

    final response = ReceivePort();
    control.send(response.sendPort);

    await for (final req in response) {
      if (req is! List || req.length != 2) continue;
      final id = req[0] as int;
      final text = req[1] as String;
      OrtValueTensor? ids;
      OrtValueTensor? mask;
      OrtValueTensor? seg;
      OrtRunOptions? runOpts;
      try {
        final tokens = tokenizer.encode(text);
        final seq = tokens.inputIds.length;
        ids = OrtValueTensor.createTensorWithDataList(
            tokens.inputIds, [1, seq]);
        mask = OrtValueTensor.createTensorWithDataList(
            tokens.attentionMask, [1, seq]);
        seg = OrtValueTensor.createTensorWithDataList(
            tokens.tokenTypeIds, [1, seq]);
        runOpts = OrtRunOptions();
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
        // BGE 系列模型要求 CLS 池化（首 token 行）+ L2 归一化
        final pooled = clsPool(inner, dims);
        replyPort.send([id, pooled]);
        for (final o in outputs) {
          o?.release();
        }
      } catch (_) {
        replyPort.send([id, null]);
      } finally {
        ids?.release();
        mask?.release();
        seg?.release();
        runOpts?.release();
      }
    }
  } catch (e) {
    control.send('初始化失败: $e');
  }
}