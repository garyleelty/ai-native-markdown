import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/note_provider.dart';
import '../../../providers/pane_provider.dart';
import '../../../providers/template_provider.dart';

// ──────────────────────────────────────────────
// 日记快速面板 (Daily Note Panel)
// ──────────────────────────────────────────────
// 展示日历视图（当月）+ 今天的日记预览 + 日期导航
// 标记有日记的日期，点击日期打开对应日记
// ──────────────────────────────────────────────

/// 日记快速面板，可嵌入侧边栏或弹窗展示
class DailyNotePanel extends ConsumerStatefulWidget {
  const DailyNotePanel({super.key});

  @override
  ConsumerState<DailyNotePanel> createState() => _DailyNotePanelState();
}

class _DailyNotePanelState extends ConsumerState<DailyNotePanel> {
  /// 当前日历显示的年月
  late DateTime _currentMonth;

  /// 有日记的日期列表（当前月份）
  List<int> _daysWithNotes = [];

  @override
  void initState() {
    super.initState();
    _currentMonth = DateTime(DateTime.now().year, DateTime.now().month);
    _loadDaysWithNotes();
  }

  /// 加载当月有日记的日期
  Future<void> _loadDaysWithNotes() async {
    try {
      final service = ref.read(dailyNoteServiceProvider);
      final days = await service.getDaysWithNotes(
        _currentMonth.year,
        _currentMonth.month,
      );
      setState(() {
        _daysWithNotes = days;
      });
    } catch (_) {
      setState(() {
        _daysWithNotes = [];
      });
    }
  }

  /// 切换到上个月
  void _prevMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    });
    _loadDaysWithNotes();
  }

  /// 切换到下个月
  void _nextMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    });
    _loadDaysWithNotes();
  }

  /// 跳转到今天
  void _goToToday() {
    final now = DateTime.now();
    setState(() {
      _currentMonth = DateTime(now.year, now.month);
    });
    _loadDaysWithNotes();
  }

  /// 打开指定日期的日记
  Future<void> _openDailyNote(DateTime date) async {
    final service = ref.read(dailyNoteServiceProvider);
    final repo = ref.read(noteRepositoryProvider);
    final (note, isNew) = await service.getNoteForDate(date);
    final existing = await repo.getNote(note.id);
    final wasNew = existing == null;
    if (wasNew) {
      await repo.saveNote(note);
    }
    if (mounted) {
      ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
      if (wasNew) {
        _loadDaysWithNotes();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    return Container(
      decoration: BoxDecoration(
        color: AeroColors.bgSurface,
        borderRadius: BorderRadius.circular(AeroRadius.lg),
        border: Border.all(color: AeroColors.border, width: AeroBorderWidth.thin),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── 标题栏 ──
          _buildHeader(),
          const Divider(height: 1, thickness: AeroBorderWidth.thin),
          // ── 日历视图 ──
          _buildCalendar(today),
          const Divider(height: 1, thickness: AeroBorderWidth.thin),
          // ── 今日日记预览 ──
          _buildTodayPreview(today),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.md),
      child: Row(
        children: [
          const Icon(Icons.calendar_today, size: AeroIconSize.sm, color: AeroColors.accentBlue),
          const SizedBox(width: AeroSpacing.xs + AeroSpacing.xxs),
          const Text(
            '日记',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AeroColors.textPrimary,
            ),
          ),
          const Spacer(),
          // 今天的按钮
          GestureDetector(
            onTap: _goToToday,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.sm, vertical: AeroSpacing.xxs),
              decoration: BoxDecoration(
                color: AeroColors.accentBlue.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AeroRadius.sm),
              ),
              child: const Text(
                '今天',
                style: TextStyle(
                  fontSize: 10,
                  color: AeroColors.accentBlue,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCalendar(DateTime today) {
    final year = _currentMonth.year;
    final month = _currentMonth.month;
    final daysInMonth = DateTime(year, month + 1, 0).day;
    final firstWeekday = DateTime(year, month, 1).weekday; // 1=周一, 7=周日
    final todayDate = today.day;
    final isCurrentMonth =
        year == today.year && month == today.month;

    return Padding(
      padding: const EdgeInsets.all(AeroSpacing.md),
      child: Column(
        children: [
          // 月份导航
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              GestureDetector(
                onTap: _prevMonth,
                child: const Icon(Icons.chevron_left,
                    size: AeroIconSize.lg, color: AeroColors.textSecondary),
              ),
              Text(
                '$year 年 $month 月',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: AeroColors.textPrimary,
                ),
              ),
              GestureDetector(
                onTap: _nextMonth,
                child: const Icon(Icons.chevron_right,
                    size: AeroIconSize.lg, color: AeroColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: AeroSpacing.sm),

          // 星期标题行
          Row(
            children: ['一', '二', '三', '四', '五', '六', '日']
                .map((d) => Expanded(
                      child: Center(
                        child: Text(
                          d,
                          style: const TextStyle(
                            fontSize: 10,
                            color: AeroColors.textMuted,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: AeroSpacing.xs),

          // 日期网格
          ..._buildWeekRows(year, month, daysInMonth, firstWeekday,
              todayDate, isCurrentMonth),
        ],
      ),
    );
  }

  List<Widget> _buildWeekRows(
    int year,
    int month,
    int daysInMonth,
    int firstWeekday,
    int todayDate,
    bool isCurrentMonth,
  ) {
    final rows = <Widget>[];

    // firstWeekday: 1=周一, 7=周日
    // 需要在第一行前面填充 (firstWeekday - 1) 个空位
    final leadingEmpty = firstWeekday - 1;
    final totalCells = leadingEmpty + daysInMonth;
    final totalWeeks = (totalCells / 7).ceil();

    for (int week = 0; week < totalWeeks; week++) {
      final dayWidgets = <Widget>[];

      for (int weekday = 0; weekday < 7; weekday++) {
        final cellIndex = week * 7 + weekday;
        final dayNum = cellIndex - leadingEmpty + 1;

        if (dayNum < 1 || dayNum > daysInMonth) {
          // 空位
          dayWidgets.add(const Expanded(child: SizedBox(height: 28)));
        } else {
          final isToday = isCurrentMonth && dayNum == todayDate;
          final hasNote = _daysWithNotes.contains(dayNum);
          final date = DateTime(year, month, dayNum);
          final isFuture = date.isAfter(DateTime.now());

          dayWidgets.add(
            Expanded(
              child: GestureDetector(
                onTap: isFuture ? null : () => _openDailyNote(date),
                child: Container(
                  height: 28,
                  margin: const EdgeInsets.all(1),
                  decoration: BoxDecoration(
                    color: isToday
                        ? AeroColors.accentBlue.withValues(alpha: 0.2)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(AeroRadius.sm),
                    border: isToday
                        ? Border.all(
                            color: AeroColors.accentBlue, width: AeroBorderWidth.thin)
                        : null,
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Text(
                        '$dayNum',
                        style: TextStyle(
                          fontSize: 11,
                          color: isToday
                              ? AeroColors.accentBlue
                              : isFuture
                                  ? AeroColors.textMuted.withValues(alpha: 0.4)
                                  : AeroColors.textSecondary,
                          fontWeight:
                              isToday ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                      // 有日记的日期下方显示小圆点
                      if (hasNote)
                        Positioned(
                          bottom: AeroSpacing.xxs,
                          child: Container(
                            width: AeroSpacing.xs,
                            height: AeroSpacing.xs,
                            decoration: BoxDecoration(
                              color: isToday
                                  ? AeroColors.accentBlue
                                  : AeroColors.accentCyan,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }
      }

      rows.add(
        Row(children: dayWidgets),
      );
    }

    return rows;
  }

  Widget _buildTodayPreview(DateTime today) {
    return Padding(
      padding: const EdgeInsets.all(AeroSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 日期显示
          Row(
            children: [
              Text(
                DateFormat('MM月dd日').format(today),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AeroColors.textPrimary,
                ),
              ),
              const SizedBox(width: AeroSpacing.xs + AeroSpacing.xxs),
              Text(
                _weekdayName(today.weekday),
                style: const TextStyle(
                  fontSize: 12,
                  color: AeroColors.textMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: AeroSpacing.sm),

          // 打开今天日记的按钮
          GestureDetector(
            onTap: () => _openDailyNote(today),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: AeroSpacing.sm + AeroSpacing.xs, horizontal: AeroSpacing.md),
              decoration: BoxDecoration(
                color: AeroColors.bgElevated,
                borderRadius: BorderRadius.circular(AeroRadius.md),
                border: Border.all(color: AeroColors.border, width: AeroBorderWidth.thin),
              ),
              child: const Row(
                children: [
                  Icon(Icons.edit_note, size: AeroIconSize.md, color: AeroColors.accentBlue),
                  SizedBox(width: AeroSpacing.sm),
                  Text(
                    '打开今天的日记',
                    style: TextStyle(
                      fontSize: 12,
                      color: AeroColors.accentBlue,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Spacer(),
                  Icon(Icons.arrow_forward_ios,
                      size: AeroIconSize.sm - 4, color: AeroColors.textMuted),
                ],
              ),
            ),
          ),

          const SizedBox(height: AeroSpacing.sm),

          // 日记统计
          Row(
            children: [
              _buildStatChip(
                icon: Icons.description_outlined,
                label: '${_daysWithNotes.length} 天有日记',
                color: AeroColors.accentCyan,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatChip({
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AeroSpacing.sm, vertical: AeroSpacing.xxs + 1),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AeroRadius.sm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: AeroIconSize.sm - 4, color: color),
          const SizedBox(width: AeroSpacing.xs),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  String _weekdayName(int weekday) {
    const names = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    return weekday >= 1 && weekday <= 7 ? names[weekday] : '';
  }
}
