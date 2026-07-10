/// 日记存储工厂
/// 条件导入自动选择平台实现:
/// - 原生平台: 使用 dart:io File/Directory
/// - Web 平台: 使用 Hive 存储
library;

import 'daily_note_storage_io.dart' if (dart.library.html) 'daily_note_storage_web.dart';
export 'daily_note_storage_io.dart' if (dart.library.html) 'daily_note_storage_web.dart';

DailyNoteStorage createDailyNoteStorage() => DailyNoteStorage();
