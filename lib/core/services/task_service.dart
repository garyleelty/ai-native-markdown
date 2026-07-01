import '../models/note_model.dart';

/// 任务项
class TaskItem {
  /// 来源笔记 ID
  final String noteId;

  /// 来源笔记标题
  final String noteTitle;

  /// 任务文本
  final String text;

  /// 是否已完成
  final bool isCompleted;

  /// 在笔记中的起始位置
  final int startOffset;

  /// 在笔记中的结束位置
  final int endOffset;

  /// 任务所在行的内容（用于显示上下文）
  final String lineContent;

  const TaskItem({
    required this.noteId,
    required this.noteTitle,
    required this.text,
    required this.isCompleted,
    required this.startOffset,
    required this.endOffset,
    required this.lineContent,
  });

  /// 创建一个更新完成状态的副本
  TaskItem copyWith({
    bool? isCompleted,
    String? text,
  }) {
    return TaskItem(
      noteId: noteId,
      noteTitle: noteTitle,
      text: text ?? this.text,
      isCompleted: isCompleted ?? this.isCompleted,
      startOffset: startOffset,
      endOffset: endOffset,
      lineContent: lineContent,
    );
  }
}

/// 任务服务
class TaskService {
  /// 从单篇笔记中提取任务
  static List<TaskItem> extractTasks(NoteModel note) {
    final tasks = <TaskItem>[];
    final lines = note.rawMarkdown.split('\n');
    int offset = 0;

    final taskPattern = RegExp(r'^\s*[-*]\s+\[([ xX])\]\s+(.+)$');

    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];
      final match = taskPattern.firstMatch(line);

      if (match != null) {
        final isCompleted = match.group(1)!.toLowerCase() == 'x';
        final taskText = match.group(2)!.trim();
        final startInLine = match.start + match.group(0)!.indexOf(match.group(2)!);

        tasks.add(TaskItem(
          noteId: note.id,
          noteTitle: note.title,
          text: taskText,
          isCompleted: isCompleted,
          startOffset: offset + startInLine,
          endOffset: offset + startInLine + taskText.length,
          lineContent: line.trim(),
        ));
      }

      offset += line.length + 1; // +1 for newline
    }

    return tasks;
  }

  /// 从所有笔记中提取任务
  static List<TaskItem> extractAllTasks(List<NoteModel> notes) {
    final allTasks = <TaskItem>[];
    for (final note in notes) {
      allTasks.addAll(extractTasks(note));
    }
    // 按完成状态排序（未完成在前），然后按笔记标题排序
    allTasks.sort((a, b) {
      if (a.isCompleted != b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      return a.noteTitle.compareTo(b.noteTitle);
    });
    return allTasks;
  }

  /// 切换任务的完成状态
  static String toggleTaskInMarkdown(String markdown, int taskStartOffset) {
    final lines = markdown.split('\n');
    int offset = 0;

    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];
      final lineStart = offset;
      final lineEnd = offset + line.length;

      if (taskStartOffset >= lineStart && taskStartOffset <= lineEnd) {
        // 找到这一行，切换 [ ] 或 [x]
        final taskPattern = RegExp(r'^(\s*[-*]\s+\[)([ xX])(\]\s+.+)$');
        final match = taskPattern.firstMatch(line);
        if (match != null) {
          final currentStatus = match.group(2)!;
          final newStatus = currentStatus.toLowerCase() == 'x' ? ' ' : 'x';
          final newLine = '${match.group(1)}$newStatus${match.group(3)}';
          lines[i] = newLine;
        }
        break;
      }

      offset += line.length + 1;
    }

    return lines.join('\n');
  }
}
