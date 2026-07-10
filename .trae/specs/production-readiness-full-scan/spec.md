# Flutter lib/ 目录生产级问题全面扫描

## Why
系统性扫描整个 Flutter 项目的 lib/ 目录，找出7类明确指定的生产级代码问题，为后续修复提供完整、准确的问题清单。

## What Changes
- 审计范围：**整个 lib/ 目录**（core/、features/、providers/、app.dart、main.dart）
- 检查 7 类问题：
  1. **空 catch 块**：catch 块内无任何处理代码（含仅注释的情况）
  2. **void async 方法**：返回类型声明为 `void` 且标记为 `async` 的方法（async 方法应返回 Future）
  3. **缺少 try-catch 的 async 方法**：async 方法中执行可能抛出异常的操作（如 IO、网络）但无异常捕获
  4. **dispose 后调用 setState**：在 State 类中，dispose() 之后或 async 间隙后未检查 mounted 就调用 setState
  5. **未使用 uuid 的 ID 生成**：使用 Random、DateTime.now() 等非标准方式生成 ID 而非使用 uuid 包
  6. **缺少 mounted 检查**：StatefulWidget 的 State 中，async/await 之后未检查 `mounted` 属性
  7. **同步 IO 方法**：使用 File/Directory 的同步方法（readAsStringSync、writeAsStringSync、listSync 等）

## Impact
- **只读审计**：仅生成问题报告，不修改任何代码
- 输出：按文件分组，列出每个问题的文件路径、行号、问题类型、代码片段
- 中文报告

## 设计决策
- **搜索策略**：使用 Grep/正则表达式搜索各类问题模式，然后人工验证上下文排除误报
- **误报处理**：
  - 空 catch 块：排除包含日志、重抛（rethrow）、错误处理的情况
  - void async：仅匹配明确声明返回类型为 void 的 async 方法
  - 同步 IO：仅标记在生产代码路径中使用的同步 IO，排除测试/示例代码
  - 缺少 try-catch：重点关注文件操作、网络请求、JSON 解析等可能抛出异常的操作
- **uuid 检查逻辑**：检查项目是否依赖 uuid 包（pubspec.yaml），然后查找非 uuid 的 ID 生成模式
- **输出格式**：按文件路径排序，每个问题包含类型、行号、代码片段
