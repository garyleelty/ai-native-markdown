# 任务列表

- [x] 1. 更新 SearchService：添加带警告信息的搜索结果返回
  - 修改 `searchNotes` 返回 `SearchResponse`（包含 results 和 message）
  - 正则 FormatException 时设置 message: "正则语法无效，已降级为普通搜索"
  - 无依赖

- [x] 2. 更新 SidebarState：添加 searchMessage 字段
  - 在 SidebarState 中添加 `String? searchMessage`
  - 更新 copyWith 方法支持 searchMessage 和 clearSearchMessage
  - 无依赖

- [x] 3. 更新 SidebarNotifier：处理搜索信息
  - 更新 `search` 方法，从 SearchResponse 获取 message 并设置到 state
  - 更新 `clearSearch` 方法清除 searchMessage
  - 依赖任务 1, 2

- [x] 4. 修复 sidebar_container.dart：搜索框 listener 和无结果提示
  - 在 initState 中为 _controller 添加 listener
  - 添加搜索无结果时的空状态提示 "未找到匹配的笔记"
  - 显示 searchMessage 提示（正则降级警告等）
  - 依赖任务 3

- [x] 5. 修复 wiki_link_preview.dart：异步方法安全
  - 将 `void _show(...) async` 改为 `Future<void> _show(...)`
  - 为 _show 方法添加 try-catch 包裹异步操作
  - 无依赖

- [x] 6. 完善 Command Palette：添加清除按钮
  - 为 _searchController 添加 listener 监听文本变化
  - 添加 suffixIcon 清除按钮（有输入时显示）
  - 需要将 _buildSearchBar 改为依赖 Stateful 状态更新
  - 无依赖

- [x] 7. 完善 Quick Switcher：添加清除按钮和错误状态
  - 添加 _loadError 状态字段
  - 搜索框添加 suffixIcon 清除按钮
  - 加载失败时显示错误提示 "加载笔记失败，请重试"
  - 无依赖
