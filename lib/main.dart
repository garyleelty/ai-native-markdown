import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/services/hive_service.dart';
import 'core/services/trash_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Hive 初始化 (Web 端使用 IndexedDB，出错时继续运行)
  try {
    await HiveService.initHive();
    // 清理回收站中过期项目
    await TrashService.cleanExpired();
  } catch (e) {
    debugPrint('Hive 初始化失败 (Web 端可能受限): $e');
  }

  runApp(const ProviderScope(child: AeroMindApp()));
}
