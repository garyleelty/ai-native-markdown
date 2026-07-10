import 'dart:io';
import 'package:flutter/foundation.dart';

class GitResult {
  final int exitCode;
  final String stdout;
  final String stderr;

  GitResult({required this.exitCode, required this.stdout, required this.stderr});

  bool get success => exitCode == 0;
  String get output => stdout + stderr;
}

class GitCommitInfo {
  final String hash;
  final String message;
  final DateTime date;
  final String author;

  GitCommitInfo({
    required this.hash,
    required this.message,
    required this.date,
    required this.author,
  });
}

class GitBackupService {
  final String workingDirectory;

  GitBackupService({required this.workingDirectory});

  Future<bool> isGitInstalled() async {
    if (kIsWeb) return false;
    try {
      final result = await Process.run('git', ['--version'],
          workingDirectory: workingDirectory);
      return result.exitCode == 0;
    } catch (_) {
      return false;
    }
  }

  Future<bool> isGitRepo() async {
    if (kIsWeb) return false;
    try {
      final gitDir = Directory('$workingDirectory/.git');
      return await gitDir.exists();
    } catch (_) {
      return false;
    }
  }

  Future<GitResult> init() async {
    try {
      await _ensureDir();
      return _runGit(['init']);
    } catch (e) {
      return GitResult(
        exitCode: -1,
        stdout: '',
        stderr: e.toString(),
      );
    }
  }

  Future<GitResult> setUserInfo(String name, String email) async {
    try {
      final result1 = await _runGit(['config', 'user.name', name]);
      if (!result1.success) return result1;
      return _runGit(['config', 'user.email', email]);
    } catch (e) {
      return GitResult(
        exitCode: -1,
        stdout: '',
        stderr: e.toString(),
      );
    }
  }

  Future<GitResult> addRemote(String url, {String name = 'origin'}) async {
    try {
      final hasRemote = await _hasRemote(name);
      if (hasRemote) {
        return _runGit(['remote', 'set-url', name, url]);
      }
      return _runGit(['remote', 'add', name, url]);
    } catch (e) {
      return GitResult(
        exitCode: -1,
        stdout: '',
        stderr: e.toString(),
      );
    }
  }

  Future<GitResult> removeRemote({String name = 'origin'}) async {
    try {
      return _runGit(['remote', 'remove', name]);
    } catch (e) {
      return GitResult(
        exitCode: -1,
        stdout: '',
        stderr: e.toString(),
      );
    }
  }

  Future<String?> getRemoteUrl({String name = 'origin'}) async {
    try {
      final result = await _runGit(['remote', 'get-url', name]);
      if (result.success && result.stdout.trim().isNotEmpty) {
        return result.stdout.trim();
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<GitResult> addAll() async {
    try {
      return _runGit(['add', '-A']);
    } catch (e) {
      return GitResult(
        exitCode: -1,
        stdout: '',
        stderr: e.toString(),
      );
    }
  }

  Future<GitResult> status() async {
    try {
      return _runGit(['status', '--porcelain']);
    } catch (e) {
      return GitResult(
        exitCode: -1,
        stdout: '',
        stderr: e.toString(),
      );
    }
  }

  Future<bool> hasChanges() async {
    try {
      final result = await status();
      return result.success && result.stdout.trim().isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<GitResult> commit(String message) async {
    try {
      final hasChanges = await this.hasChanges();
      if (!hasChanges) {
        return GitResult(
          exitCode: 0,
          stdout: '无变更需要提交',
          stderr: '',
        );
      }
      final now = DateTime.now().toIso8601String();
      final msg = '$message ($now)';
      return _runGit(['commit', '-m', msg]);
    } catch (e) {
      return GitResult(
        exitCode: -1,
        stdout: '',
        stderr: e.toString(),
      );
    }
  }

  Future<GitResult> push({String remote = 'origin', String branch = 'main'}) async {
    try {
      return _runGit(['push', '-u', remote, branch]);
    } catch (e) {
      return GitResult(
        exitCode: -1,
        stdout: '',
        stderr: e.toString(),
      );
    }
  }

  Future<GitResult> pull({String remote = 'origin', String branch = 'main'}) async {
    try {
      return _runGit(['pull', remote, branch]);
    } catch (e) {
      return GitResult(
        exitCode: -1,
        stdout: '',
        stderr: e.toString(),
      );
    }
  }

  Future<GitResult> clone(String url) async {
    try {
      await _ensureDir();
      final dir = Directory(workingDirectory);
      final isEmpty = await dir.list().isEmpty;
      if (!isEmpty) {
        return GitResult(
          exitCode: 1,
          stdout: '',
          stderr: '目标目录不为空，无法 clone',
        );
      }
      return _runGit(['clone', url, '.']);
    } catch (e) {
      return GitResult(
        exitCode: -1,
        stdout: '',
        stderr: e.toString(),
      );
    }
  }

  Future<List<GitCommitInfo>> log({int limit = 20}) async {
    try {
      final result = await _runGit([
        'log',
        '--pretty=format:%H|%s|%ad|%an',
        '--date=iso',
        '-n',
        limit.toString(),
      ]);
      if (!result.success) return [];

      final commits = <GitCommitInfo>[];
      for (final line in result.stdout.split('\n')) {
        final trimmed = line.trim();
        if (trimmed.isEmpty) continue;
        final parts = trimmed.split('|');
        if (parts.length >= 4) {
          try {
            commits.add(GitCommitInfo(
              hash: parts[0],
              message: parts[1],
              date: DateTime.parse(parts[2]),
              author: parts[3],
            ));
          } catch (e) {
            debugPrint('Error parsing git commit: $e');
          }
        }
      }
      return commits;
    } catch (e) {
      debugPrint('Error getting git log: $e');
      return [];
    }
  }

  Future<GitResult> checkout(String commitHash) async {
    try {
      return _runGit(['checkout', commitHash]);
    } catch (e) {
      return GitResult(
        exitCode: -1,
        stdout: '',
        stderr: e.toString(),
      );
    }
  }

  Future<GitResult> resetHard(String commitHash) async {
    try {
      return _runGit(['reset', '--hard', commitHash]);
    } catch (e) {
      return GitResult(
        exitCode: -1,
        stdout: '',
        stderr: e.toString(),
      );
    }
  }

  Future<GitResult> _runGit(List<String> args) async {
    try {
      final result = await Process.run(
        'git',
        args,
        workingDirectory: workingDirectory,
      );
      return GitResult(
        exitCode: result.exitCode,
        stdout: result.stdout.toString().trim(),
        stderr: result.stderr.toString().trim(),
      );
    } catch (e) {
      return GitResult(
        exitCode: -1,
        stdout: '',
        stderr: e.toString(),
      );
    }
  }

  Future<bool> _hasRemote(String name) async {
    try {
      final result = await _runGit(['remote']);
      if (!result.success) return false;
      return result.stdout.split('\n').any((r) => r.trim() == name);
    } catch (_) {
      return false;
    }
  }

  Future<void> _ensureDir() async {
    final dir = Directory(workingDirectory);
    final exists = await dir.exists();
    if (!exists) {
      await dir.create(recursive: true);
    }
  }
}
