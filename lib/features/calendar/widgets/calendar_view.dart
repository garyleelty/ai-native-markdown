import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/aeromind_theme.dart';
import '../../../providers/template_provider.dart';
import '../../../providers/pane_provider.dart';
import '../../../providers/note_provider.dart';

/// ══════════════════════════════════════════════════
/// CalendarView — 日历视图 (日记导航)
/// ══════════════════════════════════════════════════
/// 功能:
///   - 月视图网格，标记有日记的日期
///   - 点击日期打开/创建日记
///   - 月份导航 (上/下月)
///   - 快捷回到今天
///   - 显示当月日记统计
/// ──────────────────────────────────────────────────

class CalendarView extends ConsumerStatefulWidget {
  const CalendarView({super.key});

  @override
  ConsumerState<CalendarView> createState() => _CalendarViewState();
}

class _CalendarViewState extends ConsumerState<CalendarView> {
  late DateTime _displayMonth;
  List<int> _daysWithNotes = [];
  bool _isLoading = true;
  int _loadVersion = 0;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _displayMonth = DateTime(now.year, now.month);
    _loadMonthData();
  }

  Future<void> _loadMonthData() async {
    final version = ++_loadVersion;
    if (mounted) {
      setState(() => _isLoading = true);
    }
    try {
      final service = ref.read(dailyNoteServiceProvider);
      final days = await service.getDaysWithNotes(
        _displayMonth.year,
        _displayMonth.month,
      );
      if (mounted && version == _loadVersion) {
        setState(() {
          _daysWithNotes = days;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted && version == _loadVersion) setState(() => _isLoading = false);
    }
  }

  void _prevMonth() {
    setState(() {
      _displayMonth =
          DateTime(_displayMonth.year, _displayMonth.month - 1);
    });
    _loadMonthData();
  }

  void _nextMonth() {
    setState(() {
      _displayMonth =
          DateTime(_displayMonth.year, _displayMonth.month + 1);
    });
    _loadMonthData();
  }

  void _goToToday() {
    final now = DateTime.now();
    setState(() {
      _displayMonth = DateTime(now.year, now.month);
    });
    _loadMonthData();
  }

  Future<void> _openNoteForDay(int day) async {
    final date = DateTime(_displayMonth.year, _displayMonth.month, day);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    if (date.isAfter(today)) return;

    try {
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
          _loadMonthData();
        }
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final isCurrentMonth =
        _displayMonth.year == now.year && _displayMonth.month == now.month;
    final statsText = _daysWithNotes.isEmpty
        ? '暂无日记'
        : '${_daysWithNotes.length} 天有日记';

    return Container(
      color: AeroColors.bgSurface,
      child: Column(
        children: [
          // ── 月份导航 ──
          _MonthHeader(
            year: _displayMonth.year,
            month: _displayMonth.month,
            onPrev: _prevMonth,
            onNext: _nextMonth,
            onToday: _goToToday,
          ),
          const Divider(height: 1, thickness: 0.5),
          // ── 星期标题 ──
          _WeekdayHeader(),
          // ── 日期网格 ──
          Expanded(
            child: _isLoading
                ? const Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : _buildDayGrid(today, isCurrentMonth),
          ),
          const Divider(height: 1, thickness: 0.5),
          // ── 底部统计 ──
          _CalendarFooter(
            statsText: statsText,
            totalDays: _daysWithNotes.length,
            daysWithNotes: _daysWithNotes,
            isCurrentMonth: isCurrentMonth,
          ),
        ],
      ),
    );
  }

  Widget _buildDayGrid(DateTime today, bool isCurrentMonth) {
    final daysInMonth = DateTime(
        _displayMonth.year, _displayMonth.month + 1, 0).day;
    final firstWeekday = DateTime(_displayMonth.year, _displayMonth.month, 1)
        .weekday; // 1=周一

    final leadingEmpty = firstWeekday - 1;
    final totalCells = leadingEmpty + daysInMonth;
    final totalWeeks = (totalCells / 7).ceil();

    return Padding(
      padding: const EdgeInsets.all(8),
      child: Column(
        children: List.generate(totalWeeks, (week) {
          return Expanded(
            child: Row(
              children: List.generate(7, (weekday) {
                final cellIndex = week * 7 + weekday;
                final dayNum = cellIndex - leadingEmpty + 1;

                if (dayNum < 1 || dayNum > daysInMonth) {
                  return const Expanded(child: SizedBox());
                }

                final date = DateTime(
                    _displayMonth.year, _displayMonth.month, dayNum);
                final isToday = isCurrentMonth &&
                    dayNum == today.day;
                final hasNote = _daysWithNotes.contains(dayNum);
                final isFuture = date.isAfter(today);

                return Expanded(
                  child: GestureDetector(
                    onTap: () => _openNoteForDay(dayNum),
                    child: Container(
                      margin: const EdgeInsets.all(1.5),
                      decoration: BoxDecoration(
                        color: isToday
                            ? AeroColors.accentBlue.withValues(alpha: 0.2)
                            : hasNote
                                ? AeroColors.accentCyan.withValues(alpha: 0.08)
                                : Colors.transparent,
                        borderRadius: BorderRadius.circular(6),
                        border: isToday
                            ? Border.all(
                                color: AeroColors.accentBlue, width: 0.8)
                            : null,
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            '$dayNum',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight:
                                  isToday ? FontWeight.w700 : FontWeight.w400,
                              color: isToday
                                  ? AeroColors.accentBlue
                                  : isFuture
                                      ? AeroColors.textMuted.withValues(alpha: 0.35)
                                      : AeroColors.textPrimary,
                            ),
                          ),
                          if (hasNote) ...[
                            const SizedBox(height: 2),
                            Container(
                              width: 5,
                              height: 5,
                              decoration: BoxDecoration(
                                color: isToday
                                    ? AeroColors.accentBlue
                                    : AeroColors.accentCyan,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ),
          );
        }),
      ),
    );
  }
}

/// 月份导航头部
class _MonthHeader extends StatelessWidget {
  final int year;
  final int month;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  final VoidCallback onToday;

  const _MonthHeader({
    required this.year,
    required this.month,
    required this.onPrev,
    required this.onNext,
    required this.onToday,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Row(
        children: [
          _NavButton(icon: Icons.chevron_left, onTap: onPrev),
          const Spacer(),
          Text(
            '$year 年 $month 月',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AeroColors.textPrimary,
            ),
          ),
          const Spacer(),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _TodayButton(onTap: onToday),
              const SizedBox(width: 4),
              _NavButton(icon: Icons.chevron_right, onTap: onNext),
            ],
          ),
        ],
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _NavButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: Icon(icon, size: 18, color: AeroColors.textSecondary),
      ),
    );
  }
}

class _TodayButton extends StatelessWidget {
  final VoidCallback onTap;
  const _TodayButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: AeroColors.accentBlue.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(3),
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
    );
  }
}

/// 星期标题行
class _WeekdayHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
    return Container(
      height: 28,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Row(
        children: weekdays.map((d) {
          final isWeekend = d == '六' || d == '日';
          return Expanded(
            child: Center(
              child: Text(
                d,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color:
                      isWeekend ? AeroColors.accentOrange : AeroColors.textMuted,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

/// 底部统计栏
class _CalendarFooter extends StatelessWidget {
  final String statsText;
  final int totalDays;
  final List<int> daysWithNotes;
  final bool isCurrentMonth;

  const _CalendarFooter({
    required this.statsText,
    required this.totalDays,
    required this.daysWithNotes,
    required this.isCurrentMonth,
  });

  @override
  Widget build(BuildContext context) {
    final todayHas = isCurrentMonth && daysWithNotes.contains(DateTime.now().day);

    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          const Icon(Icons.calendar_today, size: 12, color: AeroColors.accentCyan),
          const SizedBox(width: 6),
          Text(
            statsText,
            style: const TextStyle(
              fontSize: 11,
              color: AeroColors.textSecondary,
            ),
          ),
          if (totalDays > 0) ...[
            const SizedBox(width: 8),
            Container(
              width: 4,
              height: 4,
              decoration: BoxDecoration(
                color: AeroColors.accentGreen.withValues(alpha: 0.5),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 4),
            Text(
              todayHas ? '今天已记录 ✓' : '',
              style: const TextStyle(
                fontSize: 10,
                color: AeroColors.textMuted,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
