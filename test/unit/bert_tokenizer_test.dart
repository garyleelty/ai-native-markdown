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
    final long = List.filled(800, 'flutter').join(' ');
    final t = tokenizer.encode(long, maxLength: 64);
    expect(t.inputIds.length, lessThanOrEqualTo(64));
    expect(t.inputIds.last, tokenizer.sepId);
  });

  test('单个超长词触发中间截断分支（保 [CLS]/[SEP]）', () {
    final long = List.filled(200, '开发学').join(); // 600 个中文字符
    final t = tokenizer.encode(long, maxLength: 64);
    expect(t.inputIds.length, 64);
    expect(t.inputIds.first, tokenizer.clsId);
    expect(t.inputIds.last, tokenizer.sepId);
  });

  test('fromVocabTxt 按行号映射 token id', () {
    final t = BertTokenizer.fromVocabTxt('[PAD]\n[UNK]\n[CLS]\n[SEP]\nflutter\ndart');
    final enc = t.encode('flutter dart');
    expect(enc.inputIds, containsAll([4, 5]));
    expect(enc.inputIds.first, 2); // [CLS] 行号 2
    expect(enc.inputIds.last, 3);  // [SEP] 行号 3
  });
}
