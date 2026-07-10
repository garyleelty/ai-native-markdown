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
    final gitDir = Directory('$workingDirectory/.git');
    return await gitDir.exists();
  }

  Future<GitResult> init() async {
    _ensureDir();
    return _runGit(['init']);
  }

  Future<GitResult> setUserInfo(String name, String email) async {
    final result1 = await _runGit(['config', 'user.name', name]);
    if (!result1.success) return result1;
    return _runGit(['config', 'user.email', email]);
  }

  Future<GitResult> addRemote(String url, {String name = 'origin'}) async {
    final hasRemote = await _hasRemote(name);
    if (hasRemote) {
      return _runGit(['remote', 'set-url', name, url]);
    }
    return _runGit(['remote', 'add', name, url]);
  }

  Future<GitResult> removeRemote({String name = 'origin'}) async {
    return _runGit(['remote', 'remove', name]);
  }

  Future<String?> getRemoteUrl({String name = 'origin'}) async {
    final result = await _runGit(['remote', 'get-url', name]);
    if (result.success && result.stdout.trim().isNotEmpty) {
      return result.stdout.trim();
    }
    return null;
  }

  Future<GitResult> addAll() async {
    return _runGit(['add', '-A']);
  }

  Future<GitResult> status() async {
    return _runGit(['status', '--porcelain']);
  }

  Future<bool> hasChanges() async {
    final result = await status();
    return result.success && result.stdout.trim().isNotEmpty;
  }

  Future<GitResult> commit(String message) async {
    final now = DateTime.now().toIso8601String();
    final msg = '$message ($now)';
    return _runGit(['commit', '-m', msg, '--allow-empty']);
  }

  Future<GitResult> push({String remote = 'origin', String branch = 'main'}) async {
    return _runGit(['push', '-u', remote, branch]);
  }

  Future<GitResult> pull({String remote = 'origin', String branch = 'main'}) async {
    return _runGit(['pull', remote, branch]);
  }

  Future<GitResult> clone(String url) async {
    _ensureDir();
    final dir = Directory(workingDirectory);
    if (await dir.exists() && dir.listSync().isNotEmpty) {
      return GitResult(
        exitCode: 1,
        stdout: '',
        stderr: '目标目录不为空，无法 clone',
      );
    }
    return _runGit(['clone', url, workingDirectory]);
  }

  Future<List<GitCommitInfo>> log({int limit = 20}) async {
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
        } catch (_) {}
      }
    }
    return commits;
  }

  Future<GitResult> checkout(String commitHash) async {
    return _runGit(['checkout', commitHash]);
  }

  Future<GitResult> resetHard(String commitHash) async {
    return _runGit(['reset', '--hard', commitHash]);
  }

  Future<GitResult> _runGit(List<String> args) async {
    try {
      final result = await Process.run(
        'git',
        args,
        workingDirectory: workingDirectory,
        runInShell: true,
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
    final result = await _runGit(['remote']);
    if (!result.success) return false;
    return result.stdout.split('\n').any((r) => r.trim() == name);
  }

  void _ensureDir() {
    final dir = Directory(workingDirectory);
    if (!dir.existsSync()) {
      dir.createSync(recursive: true);
    }
  }
}
