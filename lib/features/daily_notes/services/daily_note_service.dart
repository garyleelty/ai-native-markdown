import 'package:intl/intl.dart';
import 'package:path/path.dart' as p;
import '../../../core/models/note_model.dart';
import '../../templates/services/template_service.dart';
import 'daily_note_storage_factory.dart';

// ──────────────────────────────────────────────
// 日记服务 (Daily Note Service)
// ──────────────────────────────────────────────
// 负责:
//   1. 获取或创建今天的日记文件
//   2. 生成带星期的文件名 (如 2026-06-27-周五.md)
//   3. 自动链接昨天/明天的日记
//   4. 支持自定义日记路径和文件名格式
//
// 平台适配:
//   - 原生: dart:io File/Directory
//   - Web:  Hive 存储
// ──────────────────────────────────────────────

/// 日记配置
class DailyNoteConfig {
  /// 日记存放目录（相对于知识库根目录）
  final String folderPath;

  /// 文件名格式模式
  /// 支持占位符: {year}, {month}, {day}, {weekday}, {weekdayShort}
  final String filenamePattern;

  /// 是否自动链接昨天/明天的日记
  final bool autoLinkAdjacent;

  /// 日记使用的模板 ID
  final String templateId;

  const DailyNoteConfig({
    this.folderPath = '日记',
    this.filenamePattern = '{year}-{month}-{day}-{weekday}',
    this.autoLinkAdjacent = true,
    this.templateId = 'builtin.daily',
  });
}

/// 日记服务
class DailyNoteService {
  final String vaultRoot;
  final DailyNoteConfig config;
  final DailyNoteStorage _storage;

  DailyNoteService({
    required this.vaultRoot,
    this.config = const DailyNoteConfig(),
    DailyNoteStorage? storage,
  }) : _storage = storage ?? createDailyNoteStorage();

  /// 获取今天的日记：如果已存在则返回，不存在则创建
  ///
  /// 返回值: (NoteModel, bool) — (笔记, 是否为新创建)
  Future<(NoteModel, bool)> getTodayNote() async {
    return getNoteForDate(DateTime.now());
  }

  /// 获取指定日期的日记
  Future<(NoteModel, bool)> getNoteForDate(DateTime date) async {
    final filePath = _buildFilePath(date);

    if (await _storage.exists(filePath)) {
      // 文件已存在，读取并返回
      final content = await _storage.readAsString(filePath);
      final stat = await _storage.stat(filePath);
      final note = NoteModel(
        id: _generateId(filePath),
        title: _buildTitle(date),
        rawMarkdown: content,
        filePath: filePath,
        createdAt: stat.changed,
        updatedAt: stat.modified,
      );
      return (note, false);
    }

    // 文件不存在，使用模板创建
    final templateService = TemplateService.instance;
    final content = templateService.applyTemplate(
      config.templateId,
      {
        'date': DateFormat('yyyy-MM-dd').format(date),
        'weekday': _weekdayName(date.weekday),
      },
    );

    // 确保目录存在
    final dirPath = _storage.dirname(filePath);
    await _storage.createDir(dirPath, recursive: true);

    // 写入文件
    await _storage.writeAsString(filePath, content);

    final note = NoteModel(
      id: _generateId(filePath),
      title: _buildTitle(date),
      rawMarkdown: content,
      filePath: filePath,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );

    // 如果启用自动链接，尝试链接昨天和明天的日记
    if (config.autoLinkAdjacent) {
      await _linkAdjacentNotes(date);
    }

    return (note, true);
  }

  /// 生成日记文件名
  String generateDailyFilename({DateTime? date}) {
    final d = date ?? DateTime.now();
    return _buildFilename(d);
  }

  /// 检查指定日期是否有日记
  Future<bool> hasNoteForDate(DateTime date) async {
    final filePath = _buildFilePath(date);
    return _storage.exists(filePath);
  }

  /// 获取某月中有日记的日期列表（用于日历标记）
  Future<List<int>> getDaysWithNotes(int year, int month) async {
    final dirPath = p.join(vaultRoot, config.folderPath);
    final prefix = '$year-${month.toString().padLeft(2, '0')}';

    final days = <int>[];

    try {
      final filePaths = await _storage.listFiles(dirPath, prefix);
      for (final filePath in filePaths) {
        final filename = p.basenameWithoutExtension(filePath);
        if (filename.startsWith(prefix)) {
          final parts = filename.split('-');
          if (parts.length >= 3) {
            final day = int.tryParse(parts[2]);
            if (day != null) {
              days.add(day);
            }
          }
        }
      }
    } catch (_) {
      // 目录不存在或读取失败
    }

    days.sort();
    return days;
  }

  /// 获取所有日记文件路径列表（按日期降序）
  Future<List<String>> getAllDailyNotes() async {
    final dirPath = p.join(vaultRoot, config.folderPath);
    return _storage.listFiles(dirPath, '');
  }

  // ──────────────────────────────────────────────
  // 私有方法
  // ──────────────────────────────────────────────

  /// 构建完整文件路径
  String _buildFilePath(DateTime date) {
    final filename = '${_buildFilename(date)}.md';
    return p.join(vaultRoot, config.folderPath, filename);
  }

  /// 构建不含扩展名的文件名
  String _buildFilename(DateTime date) {
    final year = date.year.toString();
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    final weekday = _weekdayName(date.weekday);
    final weekdayShort = _weekdayNameShort(date.weekday);

    return config.filenamePattern
        .replaceAll('{year}', year)
        .replaceAll('{month}', month)
        .replaceAll('{day}', day)
        .replaceAll('{weekday}', weekday)
        .replaceAll('{weekdayShort}', weekdayShort);
  }

  /// 构建日记标题
  String _buildTitle(DateTime date) {
    final dateStr = DateFormat('yyyy-MM-dd').format(date);
    final weekday = _weekdayName(date.weekday);
    return '$dateStr $weekday';
  }

  /// 从文件路径生成确定性 ID
  String _generateId(String filePath) {
    final relative = p.relative(filePath, from: vaultRoot);
    return relative.hashCode.toRadixString(36);
  }

  /// 链接昨天和明天的日记
  ///
  /// 在当前日记的导航链接位置，检查昨天和明天的日记是否存在。
  /// 如果存在，确保双向链接正确。
  Future<void> _linkAdjacentNotes(DateTime date) async {
    final yesterday = date.subtract(const Duration(days: 1));
    final tomorrow = date.add(const Duration(days: 1));

    // 检查昨天的日记是否存在
    final yesterdayPath = _buildFilePath(yesterday);

    if (await _storage.exists(yesterdayPath)) {
      // 昨天的日记存在，在其末尾追加指向今天的链接（如果还没有的话）
      String yesterdayContent = await _storage.readAsString(yesterdayPath);
      final todayFilename = _buildFilename(date);
      if (!yesterdayContent.contains(todayFilename)) {
        yesterdayContent = _updateNavigationLink(
          yesterdayContent,
          'tomorrow',
          todayFilename,
          _weekdayName(date.weekday),
        );
        await _storage.writeAsString(yesterdayPath, yesterdayContent);
      }
    }

    // 检查明天的日记是否存在
    final tomorrowPath = _buildFilePath(tomorrow);

    if (await _storage.exists(tomorrowPath)) {
      // 明天的日记存在，在其开头追加指向今天的链接（如果还没有的话）
      String tomorrowContent = await _storage.readAsString(tomorrowPath);
      final todayFilename = _buildFilename(date);
      if (!tomorrowContent.contains(todayFilename)) {
        tomorrowContent = _updateNavigationLink(
          tomorrowContent,
          'yesterday',
          todayFilename,
          _weekdayName(date.weekday),
        );
        await _storage.writeAsString(tomorrowPath, tomorrowContent);
      }
    }
  }

  /// 更新日记中的导航链接
  ///
  /// [content] 原始内容
  /// [position] 'yesterday' 或 'tomorrow'
  /// [linkTarget] 链接目标文件名（不含扩展名）
  /// [linkLabel] 链接显示文本
  String _updateNavigationLink(
    String content,
    String position,
    String linkTarget,
    String linkLabel,
  ) {
    final linkText = '[[$linkTarget|$linkLabel]]';

    if (position == 'tomorrow') {
      return content.replaceAll('[[明天]]', linkText);
    } else {
      return content.replaceAll('[[昨天]]', linkText);
    }
  }

  /// 中文星期名
  String _weekdayName(int weekday) {
    const names = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    return weekday >= 1 && weekday <= 7 ? names[weekday] : '';
  }

  /// 中文星期名（短）
  String _weekdayNameShort(int weekday) {
    const names = ['', '一', '二', '三', '四', '五', '六', '日'];
    return weekday >= 1 && weekday <= 7 ? names[weekday] : '';
  }
}
