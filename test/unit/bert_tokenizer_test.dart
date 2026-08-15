/// ══════════════════════════════════════════════════
/// BertTokenizer 分词器单元测试
/// ══════════════════════════════════════════════════
library;

import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:aeromind/features/semantic_engine/services/bert_tokenizer.dart';

Map<String, int> _loadVocab() {
  final raw = File('test/fixtures/vocab.json').readAsStringSync();
  final map = jsonDecode(raw) as Map<String, dynamic>;
  return map.map((k, v) => MapEntry(k, v as int));
}

void main() {
  late BertTokenizer tokenizer;
  setUp(() => tokenizer = BertTokenizer.fromVocab(_loadVocab()));

  test('英文词被 WordPiece 拆分', () {
    final t = tokenizer.encode('flutterkit');
    expect(t.inputIds.first, tokenizer.clsId);
    expect(t.inputIds.last, tokenizer.sepId);
    expect(t.inputIds.contains(2024), isTrue); // flutter
    expect(t.inputIds.contains(2026), isTrue); // ##kit
  });

  test('中文按字切分（BERT-Chinese 行为）', () {
    final t = tokenizer.encode('开发学');
    expect(
      t.inputIds,
      [tokenizer.clsId, 3001, 3002, 3003, tokenizer.sepId],
    ); // 开 + 发 + 学
  });

  test('正常输入不产生 ## 前缀的中文字符', () {
    final t = tokenizer.encode('开发');
    expect(t.inputIds, [tokenizer.clsId, 3001, 3002, tokenizer.sepId]);
    expect(t.inputIds, isNot(containsAll([3004, 3005]))); // 不出现 ##开 / ##发
  });

  test('OOV 词映射为 [UNK]', () {
    final t = tokenizer.encode('zzqqxx');
    expect(t.inputIds, contains(tokenizer.unkId));
  });

  test('注意力掩码与输入等长且全 1', () {
    final t = tokenizer.encode('flutter dart');
    expect(t.attentionMask.length, t.inputIds.length);
    expect(t.attentionMask, everyElement(1));
  });

  test('超长输入被截断到 maxLength', () {
    // 59 个单字 CJK + 两个双子词英文词：第一次 flutterkit 停在 62（未达
    // maxLength-1），第二次从 62 跳到 64 越过阈值，触发中间截断分支。
    // 若未走截断分支，末尾会残留 ##kit，长度会是 65。
    final overshoot = '${List.filled(59, '开').join()} flutterkit flutterkit';
    final t = tokenizer.encode(overshoot, maxLength: 64);
    expect(t.inputIds.length, 64);
    expect(t.inputIds.first, tokenizer.clsId);
    expect(t.inputIds.last, tokenizer.sepId);
    expect(t.inputIds[t.inputIds.length - 2], 2024); // 末尾 ##kit 已被裁剪
  });

  test('超长输入实际触发截断分支（保 [CLS]/[SEP]）', () {
    // 61 个单字 CJK 恰好填到 maxLength-2，再接一个双子词英文词 flutterkit，
    // 一次 addAll 从 62 跳到 64 越过 maxLength-1，触发中间截断分支。
    final overshoot = '${List.filled(61, '开').join()} flutterkit';
    final t = tokenizer.encode(overshoot, maxLength: 64);
    expect(t.inputIds.length, 64);
    expect(t.inputIds.first, tokenizer.clsId);
    expect(t.inputIds.last, tokenizer.sepId);
    expect(t.inputIds.contains(2024), isTrue); // flutter 保留
    expect(t.inputIds.contains(2026), isFalse); // ##kit 已被裁剪
  });

  test('maxLength < 2 时抛出 ArgumentError', () {
    expect(
      () => tokenizer.encode('flutter', maxLength: 1),
      throwsArgumentError,
    );
  });

  test('fromVocabTxt 按行号映射 token id', () {
    final t = BertTokenizer.fromVocabTxt('[PAD]\n[UNK]\n[CLS]\n[SEP]\nflutter\ndart');
    final enc = t.encode('flutter dart');
    expect(enc.inputIds, containsAll([4, 5]));
    expect(enc.inputIds.first, 2); // [CLS] 行号 2
    expect(enc.inputIds.last, 3);  // [SEP] 行号 3
  });
}
