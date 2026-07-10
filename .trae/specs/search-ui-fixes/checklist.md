# 验收清单

## 功能验证

- [x] 侧边栏搜索框：输入文字时 suffixIcon 清除按钮立即出现
- [x] 侧边栏搜索框：点击清除按钮或手动清空时清除按钮立即消失
- [x] 侧边栏搜索框：搜索无结果时显示"未找到匹配的笔记"提示
- [x] 侧边栏搜索框：结果计数正常显示（如"3 个结果"）
- [x] 正则降级提示：输入无效正则（如 `/[invalid/`）时，显示"正则语法无效，已降级为普通搜索"提示
- [x] 正则搜索正常工作：输入有效正则时正常执行正则匹配且无警告
- [x] 命令面板：搜索框输入文字时显示清除按钮
- [x] 命令面板：点击清除按钮可清空搜索并隐藏按钮
- [x] 命令面板：无匹配命令时仍显示"没有匹配的命令"提示
- [x] Quick Switcher：搜索框输入文字时显示清除按钮
- [x] Quick Switcher：点击清除按钮可清空搜索并隐藏按钮
- [x] Quick Switcher：无结果时显示"未找到匹配的笔记"
- [x] Quick Switcher：加载笔记失败时显示"加载笔记失败，请重试"错误提示
- [x] WikiLink 预览：`_show` 方法返回类型为 `Future<void>` 而非 `void`
- [x] WikiLink 预览：异步操作有 try-catch 保护，异常不会导致未捕获错误

## 代码质量

- [x] `SearchService.searchNotes()` 返回包含 results 和 message 的结构
- [x] `SidebarState` 有 `searchMessage` 字段且 copyWith 支持清除
- [x] `SidebarNotifier.search()` 和 `clearSearch()` 正确处理 searchMessage
- [x] 所有修改文件无静态分析错误
- [x] 搜索相关单元测试全部通过
