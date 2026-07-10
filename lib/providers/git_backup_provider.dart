import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aeromind/core/services/git_backup_service.dart';
import 'package:aeromind/core/services/hive_service.dart';
import 'package:aeromind/core/services/platform_env.dart';

enum SyncStatus {
  idle,
  syncing,
  success,
  error,
}

class GitBackupState {
  final bool enabled;
  final String remoteUrl;
  final String userName;
  final String userEmail;
  final String branch;
  final bool autoBackup;
  final SyncStatus status;
  final String? lastError;
  final DateTime? lastBackupTime;
  final List<GitCommitInfo> recentCommits;

  const GitBackupState({
    this.enabled = false,
    this.remoteUrl = '',
    this.userName = '',
    this.userEmail = '',
    this.branch = 'main',
    this.autoBackup = false,
    this.status = SyncStatus.idle,
    this.lastError,
    this.lastBackupTime,
    this.recentCommits = const [],
  });

  GitBackupState copyWith({
    bool? enabled,
    String? remoteUrl,
    String? userName,
    String? userEmail,
    String? branch,
    bool? autoBackup,
    SyncStatus? status,
    String? lastError,
    DateTime? lastBackupTime,
    List<GitCommitInfo>? recentCommits,
  }) {
    return GitBackupState(
      enabled: enabled ?? this.enabled,
      remoteUrl: remoteUrl ?? this.remoteUrl,
      userName: userName ?? this.userName,
      userEmail: userEmail ?? this.userEmail,
      branch: branch ?? this.branch,
      autoBackup: autoBackup ?? this.autoBackup,
      status: status ?? this.status,
      lastError: lastError ?? this.lastError,
      lastBackupTime: lastBackupTime ?? this.lastBackupTime,
      recentCommits: recentCommits ?? this.recentCommits,
    );
  }
}

class GitBackupNotifier extends Notifier<GitBackupState> {
  GitBackupService? _service;
  static const String _boxKey = 'git_backup_config';

  @override
  GitBackupState build() {
    _loadFromStorage();
    return const GitBackupState();
  }

  GitBackupService? get service => _service;

  void _loadFromStorage() {
    try {
      final saved = HiveService.metaBox.get(_boxKey);
      if (saved is Map) {
        final map = Map<String, dynamic>.from(saved);
        state = GitBackupState(
          enabled: map['enabled'] == true,
          remoteUrl: map['remoteUrl']?.toString() ?? '',
          userName: map['userName']?.toString() ?? '',
          userEmail: map['userEmail']?.toString() ?? '',
          branch: map['branch']?.toString() ?? 'main',
          autoBackup: map['autoBackup'] == true,
        );
      }
      final lastBackup = HiveService.metaBox.get('git_last_backup_time');
      if (lastBackup != null && lastBackup is int) {
        state = state.copyWith(
          lastBackupTime: DateTime.fromMillisecondsSinceEpoch(lastBackup),
        );
      }
    } catch (_) {}

    _initService();
  }

  void _saveToStorage() {
    try {
      HiveService.metaBox.put(_boxKey, {
        'enabled': state.enabled,
        'remoteUrl': state.remoteUrl,
        'userName': state.userName,
        'userEmail': state.userEmail,
        'branch': state.branch,
        'autoBackup': state.autoBackup,
      });
      if (state.lastBackupTime != null) {
        HiveService.metaBox.put(
          'git_last_backup_time',
          state.lastBackupTime!.millisecondsSinceEpoch,
        );
      }
    } catch (_) {}
  }

  void _initService() {
    if (kIsWeb) return;
    final vaultRoot = _defaultVaultRoot();
    _service = GitBackupService(workingDirectory: vaultRoot);
  }

  void updateConfig({
    String? remoteUrl,
    String? userName,
    String? userEmail,
    String? branch,
    bool? enabled,
    bool? autoBackup,
  }) {
    state = state.copyWith(
      remoteUrl: remoteUrl,
      userName: userName,
      userEmail: userEmail,
      branch: branch,
      enabled: enabled,
      autoBackup: autoBackup,
    );
    _saveToStorage();
  }

  Future<bool> initRepo() async {
    final svc = _service;
    if (svc == null) return false;

    state = state.copyWith(status: SyncStatus.syncing, lastError: null);
    try {
      final isRepo = await svc.isGitRepo();
      if (!isRepo) {
        final initResult = await svc.init();
        if (!initResult.success) {
          state = state.copyWith(
            status: SyncStatus.error,
            lastError: '初始化失败: ${initResult.stderr}',
          );
          return false;
        }
      }
      if (state.userName.isNotEmpty && state.userEmail.isNotEmpty) {
        await svc.setUserInfo(state.userName, state.userEmail);
      }
      if (state.remoteUrl.isNotEmpty) {
        await svc.addRemote(state.remoteUrl);
      }
      state = state.copyWith(status: SyncStatus.success);
      return true;
    } catch (e) {
      state = state.copyWith(
        status: SyncStatus.error,
        lastError: e.toString(),
      );
      return false;
    }
  }

  Future<bool> backup({String message = 'AeroMind 自动备份'}) async {
    final svc = _service;
    if (svc == null) return false;

    state = state.copyWith(status: SyncStatus.syncing, lastError: null);
    try {
      final isRepo = await svc.isGitRepo();
      if (!isRepo) {
        final ok = await initRepo();
        if (!ok) return false;
      }

      await svc.addAll();

      final hasChanges = await svc.hasChanges();
      if (hasChanges) {
        final commitResult = await svc.commit(message);
        if (!commitResult.success && commitResult.stderr.contains('nothing to commit')) {
        } else if (!commitResult.success) {
          state = state.copyWith(
            status: SyncStatus.error,
            lastError: '提交失败: ${commitResult.stderr}',
          );
          return false;
        }
      }

      if (state.remoteUrl.isNotEmpty) {
        final pushResult = await svc.push(branch: state.branch);
        if (!pushResult.success) {
          state = state.copyWith(
            status: SyncStatus.error,
            lastError: '推送失败: ${pushResult.stderr}',
          );
          return false;
        }
      }

      final now = DateTime.now();
      state = state.copyWith(
        status: SyncStatus.success,
        lastBackupTime: now,
      );
      _saveToStorage();
      _refreshCommits();
      return true;
    } catch (e) {
      state = state.copyWith(
        status: SyncStatus.error,
        lastError: e.toString(),
      );
      return false;
    }
  }

  Future<bool> restore() async {
    final svc = _service;
    if (svc == null || state.remoteUrl.isEmpty) return false;

    state = state.copyWith(status: SyncStatus.syncing, lastError: null);
    try {
      final isRepo = await svc.isGitRepo();
      if (!isRepo) {
        final ok = await initRepo();
        if (!ok) return false;
      }

      final pullResult = await svc.pull(branch: state.branch);
      if (!pullResult.success) {
        state = state.copyWith(
          status: SyncStatus.error,
          lastError: '拉取失败: ${pullResult.stderr}',
        );
        return false;
      }

      state = state.copyWith(
        status: SyncStatus.success,
        lastBackupTime: DateTime.now(),
      );
      _refreshCommits();
      return true;
    } catch (e) {
      state = state.copyWith(
        status: SyncStatus.error,
        lastError: e.toString(),
      );
      return false;
    }
  }

  Future<void> _refreshCommits() async {
    final svc = _service;
    if (svc == null) return;
    try {
      final commits = await svc.log(limit: 20);
      state = state.copyWith(recentCommits: commits);
    } catch (_) {}
  }

  Future<List<GitCommitInfo>> loadHistory() async {
    await _refreshCommits();
    return state.recentCommits;
  }

  void clearError() {
    state = state.copyWith(status: SyncStatus.idle, lastError: null);
  }
}

final gitBackupProvider =
    NotifierProvider<GitBackupNotifier, GitBackupState>(() {
  return GitBackupNotifier();
});

String _defaultVaultRoot() {
  if (kIsWeb) {
    return '/aeromind';
  }
  final env = platformEnv;
  final home = env['HOME'] ?? env['USERPROFILE'] ?? '/tmp';
  return '$home/Aeromind';
}
