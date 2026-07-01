import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/pane_provider.dart';
import '../../../providers/template_provider.dart';
import '../services/daily_note_service.dart';

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

  /// 是否正在加载
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _currentMonth = DateTime(DateTime.now().year, DateTime.now().month);
    _loadDaysWithNotes();
  }

  /// 加载当月有日记的日期
  Future<void> _loadDaysWithNotes() async {
    setState(() => _isLoading = true);

    try {
      final service = ref.read(dailyNoteServiceProvider);
      final days = await service.getDaysWithNotes(
        _currentMonth.year,
        _currentMonth.month,
      );
      setState(() {
        _daysWithNotes = days;
        _isLoading = false;
      });
    } catch (_) {
      setState(() {
        _daysWithNotes = [];
        _isLoading = false;
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
  void _openDailyNote(DateTime date) async {
    final service = ref.read(dailyNoteServiceProvider);
    final (note, isNew) = await service.getNoteForDate(date);

    // 在面板栈中打开日记
    if (mounted) {
      ref.read(paneStackProvider.notifier).openPane(note.id, note.title);
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    return Container(
      decoration: BoxDecoration(
        color: AeroColors.bgSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AeroColors.border, width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── 标题栏 ──
          _buildHeader(),
          const Divider(height: 1, thickness: 0.5),
          // ── 日历视图 ──
          _buildCalendar(today),
          const Divider(height: 1, thickness: 0.5),
          // ── 今日日记预览 ──
          _buildTodayPreview(today),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          Icon(Icons.calendar_today, size: 14, color: AeroColors.accentBlue),
          const SizedBox(width: 6),
          Text(
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
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AeroColors.accentBlue.withOpacity(0.12),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
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
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          // 月份导航
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              GestureDetector(
                onTap: _prevMonth,
                child: Icon(Icons.chevron_left,
                    size: 18, color: AeroColors.textSecondary),
              ),
              Text(
                '$year 年 $month 月',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: AeroColors.textPrimary,
                ),
              ),
              GestureDetector(
                onTap: _nextMonth,
                child: Icon(Icons.chevron_right,
                    size: 18, color: AeroColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // 星期标题行
          Row(
            children: ['一', '二', '三', '四', '五', '六', '日']
                .map((d) => Expanded(
                      child: Center(
                        child: Text(
                          d,
                          style: TextStyle(
                            fontSize: 10,
                            color: AeroColors.textMuted,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 4),

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
                        ? AeroColors.accentBlue.withOpacity(0.2)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(4),
                    border: isToday
                        ? Border.all(
                            color: AeroColors.accentBlue, width: 0.5)
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
                                  ? AeroColors.textMuted.withOpacity(0.4)
                                  : AeroColors.textSecondary,
                          fontWeight:
                              isToday ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                      // 有日记的日期下方显示小圆点
                      if (hasNote)
                        Positioned(
                          bottom: 2,
                          child: Container(
                            width: 4,
                            height: 4,
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
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 日期显示
          Row(
            children: [
              Text(
                DateFormat('MM月dd日').format(today),
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AeroColors.textPrimary,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                _weekdayName(today.weekday),
                style: TextStyle(
                  fontSize: 12,
                  color: AeroColors.textMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // 打开今天日记的按钮
          GestureDetector(
            onTap: () => _openDailyNote(today),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
              decoration: BoxDecoration(
                color: AeroColors.bgElevated,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AeroColors.border, width: 0.5),
              ),
              child: Row(
                children: [
                  Icon(Icons.edit_note, size: 16, color: AeroColors.accentBlue),
                  const SizedBox(width: 8),
                  Text(
                    '打开今天的日记',
                    style: TextStyle(
                      fontSize: 12,
                      color: AeroColors.accentBlue,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const Spacer(),
                  Icon(Icons.arrow_forward_ios,
                      size: 10, color: AeroColors.textMuted),
                ],
              ),
            ),
          ),

          const SizedBox(height: 8),

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
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: color),
          const SizedBox(width: 4),
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
