import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/services/hive_service.dart';
import 'core/services/trash_service.dart';
import 'core/theme/aeromind_theme.dart';

void main() {
  _bootstrapApp();
}

void _bootstrapApp() {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (FlutterErrorDetails details) {
    debugPrint('Flutter Error: ${details.exceptionAsString()}');
    debugPrint('Stack trace: ${details.stack}');
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('Platform Error: $error');
    debugPrint('Stack trace: $stack');
    if (kReleaseMode) {
      _crashLog.write('${DateTime.now().toIso8601String()}\n$error\n$stack\n\n');
    }
    return true;
  };

  runApp(const ProviderScope(child: _AppInitializer()));
}

class _CrashLog {
  static final _crashLogFile = _CrashLogFile();
  void write(String message) => _crashLogFile.write(message);
}

final _crashLog = _CrashLog();

class _CrashLogFile {
  void write(String message) {
    try {
      debugPrint('[CrashLog] $message');
    } catch (_) {}
  }
}

bool get kReleaseMode => const bool.fromEnvironment('dart.vm.product');

class _AppInitializer extends ConsumerStatefulWidget {
  const _AppInitializer();

  @override
  ConsumerState<_AppInitializer> createState() => _AppInitializerState();
}

class _AppInitializerState extends ConsumerState<_AppInitializer> {
  bool? _initialized;
  String? _errorMessage;
  bool _isRetrying = false;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    setState(() {
      _isRetrying = true;
      _errorMessage = null;
    });

    try {
      await HiveService.initHive();
      await TrashService.cleanExpired();
      if (mounted) {
        setState(() {
          _initialized = true;
          _isRetrying = false;
        });
      }
    } catch (e) {
      debugPrint('Hive 初始化失败: $e');
      if (mounted) {
        setState(() {
          _initialized = false;
          _errorMessage = e.toString();
          _isRetrying = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_initialized == true) {
      return const AeroMindApp();
    }

    if (_initialized == false) {
      return MaterialApp(
        title: 'AeroMind',
        theme: AeroTheme.dark,
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          backgroundColor: AeroColors.bgDeep,
          body: Center(
            child: _isRetrying
                ? const Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(
                        color: AeroColors.accentBlue,
                      ),
                      SizedBox(height: 24),
                      Text(
                        '正在初始化...',
                        style: TextStyle(
                          fontSize: 14,
                          color: AeroColors.textSecondary,
                        ),
                      ),
                    ],
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.error_outline,
                        size: 64,
                        color: AeroColors.error,
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        '数据初始化失败',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          color: AeroColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 12),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 400),
                        child: const Text(
                          '无法初始化本地数据库，请检查磁盘权限后重试。',
                          style: TextStyle(
                            fontSize: 14,
                            color: AeroColors.textSecondary,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      if (_errorMessage != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(12),
                          margin: const EdgeInsets.symmetric(horizontal: 32),
                          decoration: BoxDecoration(
                            color: AeroColors.bgSurface,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: AeroColors.error.withValues(alpha: 0.3),
                            ),
                          ),
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(
                              fontSize: 11,
                              color: AeroColors.textMuted,
                              fontFamily: 'monospace',
                            ),
                            textAlign: TextAlign.left,
                          ),
                        ),
                      ],
                      const SizedBox(height: 32),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          ElevatedButton.icon(
                            onPressed: _initialize,
                            icon: const Icon(Icons.refresh, size: 16),
                            label: const Text('重试'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AeroColors.accentBlue,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 24,
                                vertical: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
          ),
        ),
      );
    }

    return MaterialApp(
      title: 'AeroMind',
      theme: AeroTheme.dark,
      debugShowCheckedModeBanner: false,
      home: const Scaffold(
        backgroundColor: AeroColors.bgDeep,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(
                color: AeroColors.accentBlue,
              ),
              SizedBox(height: 24),
              Text(
                'AeroMind',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w300,
                  color: AeroColors.textPrimary,
                  letterSpacing: 2,
                ),
              ),
              SizedBox(height: 8),
              Text(
                '正在启动...',
                style: TextStyle(
                  fontSize: 12,
                  color: AeroColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
