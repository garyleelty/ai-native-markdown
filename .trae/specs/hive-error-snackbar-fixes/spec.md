# Hive 初始化修复、错误提示工具与空 catch 块记录

## Why
1. 当前 hive_service.dart 中存在危险的降级逻辑：当 Hive.initFlutter() 失败时，会静默降级到 Hive.init('.')，这会导致数据写入当前工作目录，可能造成数据丢失、权限问题或难以调试的 bug。正确的做法是失败即抛出异常，让调用者处理。
2. 项目缺少统一的 SnackBar 提示工具函数，错误/成功提示分散且样式不统一。
3. 项目中有大量空 catch 块（`catch (_) {}`），异常被静默吞噬，导致问题难以排查。

## What Changes
### 1. 修改 HiveService.initHive()
- 移除 lib/core/services/hive_service.dart 第80-84行的危险降级逻辑（try-catch 中失败后调用 Hive.init('.')）
- 非测试路径下只使用 `await Hive.initFlutter()`，失败则直接抛出异常（不捕获）
- 保留 testPath 参数分支用于单元测试

### 2. 创建 error_utils.dart
- 在 lib/core/utils/ 目录下新建 error_utils.dart
- 提供两个顶层全局函数：
  - `showErrorSnackBar(BuildContext context, String message)`：使用 AeroColors.accentRed 作为背景色
  - `showSuccessSnackBar(BuildContext context, String message)`：使用 AeroColors.accentGreen 作为背景色
- 通过 ScaffoldMessenger.of(context) 显示 SnackBar

### 3. 修复所有空 catch 块
- 查找所有 `catch (_) {}` 或 `catch (e) {}` 形式的空 catch 块
- 将其修改为捕获异常并使用 debugPrint 记录，例如：
  ```dart
  } catch (e) {
    debugPrint('Error: $e');
  }
  ```
- 共涉及21处位置

## Impact
- 修改范围：
  - lib/core/services/hive_service.dart（修改1处）
  - lib/core/utils/error_utils.dart（新建文件）
  - 21个包含空 catch 块的 Dart 文件
- 无破坏性变更：Hive 初始化失败现在会显式抛出，属于修复而非破坏
- 新增工具函数可被全局使用

## 设计决策
1. **Hive 初始化策略**：保留 testPath 用于测试，生产环境严格使用 initFlutter()，失败抛出而非降级。理由：path_provider 提供的路径是平台规范的应用数据目录，降级到 '.' 会导致不可预测的行为。
2. **SnackBar 设计**：使用简单的顶层函数而非类或扩展方法，符合用户要求；仅指定颜色，其他样式使用默认，与项目现有 SnackBar 风格保持一致。
3. **异常记录方式**：使用 debugPrint() 而非 print()，这是 Flutter 推荐的日志方式，在生产环境中会被自动截断处理。
4. **catch 参数命名**：统一使用 `e` 作为异常变量名，方便 debugPrint 输出。
