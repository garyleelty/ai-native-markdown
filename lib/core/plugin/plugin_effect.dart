/// ══════════════════════════════════════════════════
/// PluginEffect — 可逆副作用 (Cordis 风格)
/// ══════════════════════════════════════════════════
/// 参考 Cordis 的 revertible effects 理念：插件执行副作用时，
/// 同步返回该副作用的逆操作（inverse）。框架收集这些逆操作，
/// 插件暂停/销毁时按 LIFO 顺序自动回滚 —— 无需开发者手工维护
/// cleanup 清单，也不存在「做」与「撤」两套分离的代码。
///
/// 效果抽象:
///   Γ → Γ × (Γ → Γ)
/// 执行副作用把状态从 A 改到 B，同时告诉框架「如何撤销」。
/// ──────────────────────────────────────────────────
library;

import 'dart:async';

/// 逆操作（cleanup）：撤销一个已执行的副作用
typedef EffectInverse = FutureOr<void> Function();

/// 可逆副作用回调（生成器形式）
///
/// 回调执行副作用并逐步 `yield` 每一步的逆操作。
/// 若中途抛出异常，已登记步骤的逆操作仍会保留，回滚时执行 ——
/// 即长初始化过程可以部分完成、部分回滚。
typedef EffectCallback = Iterable<EffectInverse> Function();

/// 效果逆操作收集器（disposer）
///
/// 按 LIFO 顺序回滚：假设插件依次执行 E1, E2, E3，
/// 卸载时自动执行 E3⁻¹, E2⁻¹, E1⁻¹。
class EffectDisposer {
  final List<EffectInverse> _inverses = [];
  bool _rolledBack = false;

  /// 是否已执行回滚（此后不能再注册新 effect）
  bool get isRolledBack => _rolledBack;

  /// 已收集的逆操作数量
  int get length => _inverses.length;

  /// 执行一个可逆副作用并收集其逆操作
  ///
  /// [callback] 为生成器函数：函数体执行副作用，每 `yield` 一个
  /// 逆操作即登记一步回滚。例如：
  ///
  /// ```dart
  /// ctx.effect(() sync* {
  ///   ctx.api.registerCommand(cmd);
  ///   yield () => ctx.api.unregisterCommand(cmd.id);
  /// });
  /// ```
  ///
  /// 回调中途抛异常时，已登记的步骤仍保留，回滚时执行（部分回滚）。
  void effect(EffectCallback callback) {
    if (_rolledBack) {
      throw StateError('EffectDisposer 已回滚，不能再注册新的 effect');
    }
    final iterator = callback().iterator;
    while (iterator.moveNext()) {
      _inverses.add(iterator.current);
    }
  }

  /// 直接登记一个逆操作（在自行执行副作用后调用）
  void disposable(EffectInverse inverse) {
    if (_rolledBack) {
      throw StateError('EffectDisposer 已回滚，不能再登记逆操作');
    }
    _inverses.add(inverse);
  }

  /// 按 LIFO 顺序执行全部逆操作并清空
  ///
  /// 幂等：多次调用只执行一次。
  Future<void> rollback() async {
    if (_rolledBack) return;
    _rolledBack = true;
    for (final inverse in _inverses.reversed) {
      await inverse();
    }
    _inverses.clear();
  }
}
