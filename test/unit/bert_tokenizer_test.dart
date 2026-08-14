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

  test('中文逐字切分后 WordPiece 合并', () {
    final t = tokenizer.encode('开发学');
    expect(t.inputIds, containsAll([3001, 3004])); // 开发 + ##学
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

  test('fromVocabTxt 按行号映射 token id', () {
    final t = BertTokenizer.fromVocabTxt('[PAD]\n[UNK]\n[CLS]\n[SEP]\nflutter\ndart');
    final enc = t.encode('flutter dart');
    expect(enc.inputIds, containsAll([4, 5]));
    expect(enc.inputIds.first, 2); // [CLS] 行号 2
    expect(enc.inputIds.last, 3);  // [SEP] 行号 3
  });
}
