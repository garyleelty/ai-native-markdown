# Checklist

- [x] C1: hive_service.dart 中不再有 Hive.init('.') 调用
- [x] C2: hive_service.dart 中非 testPath 分支直接调用 await Hive.initFlutter()，无 try-catch 包裹
- [x] C3: lib/core/utils/error_utils.dart 文件存在
- [x] C4: error_utils.dart 中包含 showErrorSnackBar(BuildContext, String) 顶层函数
- [x] C5: error_utils.dart 中包含 showSuccessSnackBar(BuildContext, String) 顶层函数
- [x] C6: showErrorSnackBar 使用 AeroColors.accentRed 作为背景色
- [x] C7: showSuccessSnackBar 使用 AeroColors.accentGreen 作为背景色
- [x] C8: 项目中不再存在空 catch 块 `catch (_) {}` 或 `catch (e) {}`
- [x] C9: 所有之前的空 catch 块现在都包含 debugPrint 记录错误
- [x] C10: flutter analyze 运行通过，无新增错误
