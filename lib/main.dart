import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/services/hive_service.dart';
import 'core/services/trash_service.dart';
import 'core/theme/aeromind_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (FlutterErrorDetails details) {
    debugPrint('Flutter Error: ${details.exceptionAsString()}');
    debugPrint('Stack trace: ${details.stack}');
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('Platform Error: $error');
    debugPrint('Stack trace: $stack');
    return true;
  };

  bool hiveInitialized = false;
  try {
    await HiveService.initHive();
    await TrashService.cleanExpired();
    hiveInitialized = true;
  } catch (e) {
    debugPrint('Hive 初始化失败: $e');
  }

  if (hiveInitialized) {
    runApp(const ProviderScope(child: AeroMindApp()));
  } else {
    runApp(
      MaterialApp(
        title: 'AeroMind',
        theme: AeroTheme.dark,
        debugShowCheckedModeBanner: false,
        home: const Scaffold(
          backgroundColor: AeroColors.bgDeep,
          body: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 64,
                  color: AeroColors.accentRed,
                ),
                SizedBox(height: 24),
                Text(
                  '数据初始化失败',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: AeroColors.textPrimary,
                  ),
                ),
                SizedBox(height: 12),
                Text(
                  '无法初始化本地数据库，请检查磁盘权限后重启应用。',
                  style: TextStyle(
                    fontSize: 14,
                    color: AeroColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
