# AeroMind 生产级修复 v1 - 实施验证检查点

## Checkpoint Group 1: 构建与运行时
- [x] Checkpoint 1.1: `flutter clean && flutter pub get` 成功执行
- [x] Checkpoint 1.2: `flutter build macos --debug` 构建成功 (build/macos/Build/Products/Debug/aeromind.app)
- [x] Checkpoint 1.3: 应用可启动运行
- [ ] Checkpoint 1.4: Release 模式构建验证 (本轮未验证)

## Checkpoint Group 2: 静态分析
- [x] Checkpoint 2.1: `dart analyze lib/` 0 errors, 0 warnings
- [x] Checkpoint 2.2: 仅剩 2 个 info 级别问题 (library_private_types_in_public_api)
- [x] Checkpoint 2.3: 无 TODO/FIXME/HACK 残留注释
- [x] Checkpoint 2.4: 无空 catch 块 (所有 catch 均有错误处理逻辑)
- [ ] Checkpoint 2.5: 无硬编码密钥/密码 (API key 均通过 Hive 存储，未发现硬编码)

## Checkpoint Group 3: 测试
- [x] Checkpoint 3.1: `flutter test` 全部通过 (89 tests, 0 failures)
- [ ] Checkpoint 3.2: 新增代码测试覆盖率 100% (部分关键路径缺少独立测试)
- [ ] Checkpoint 3.3: 缓存失效逻辑测试缺失
- [ ] Checkpoint 3.4: 实体识别偏移量边界测试缺失
- [ ] Checkpoint 3.5: 安全相关测试缺失 (路径遍历、XSS防护)

## Checkpoint Group 4: 全局错误处理 (FR-1)
- [x] Checkpoint 4.1: FlutterError.onError 已设置
- [x] Checkpoint 4.2: PlatformDispatcher.instance.onError 已设置
- [ ] Checkpoint 4.3: Release 模式错误有用户反馈而非仅 debugPrint
- [ ] Checkpoint 4.4: 未使用 runZonedGuarded 包裹 runApp 捕获异步错误
- [ ] Checkpoint 4.5: Isolate 错误未捕获
- [x] Checkpoint 4.6: Hive 初始化失败显示错误页面
- [ ] Checkpoint 4.7: Hive 错误页面无重试按钮

## Checkpoint Group 5: 数据保存可靠性 (FR-2)
- [x] Checkpoint 5.1: _doSave 有 try-catch
- [x] Checkpoint 5.2: _autoSave Timer 回调有 try-catch
- [x] Checkpoint 5.3: _loadNote 有 try-catch
- [ ] Checkpoint 5.4: dispose 保存可靠 (当前 addPostFrameCallback 在 unmount 后执行，context/ref 可能失效)
- [ ] Checkpoint 5.5: 自动保存防抖时间为 2 秒 (当前为 1 秒，与设置描述不符)
- [ ] Checkpoint 5.6: 保存失败用户始终可见反馈 (自动保存失败仅 debugPrint)

## Checkpoint Group 6: ID 与数据一致性 (FR-3)
- [x] Checkpoint 6.1: 笔记 ID 使用 UUID v4
- [ ] Checkpoint 6.2: saveNote 通过 NoteNotifier 统一调用 (22 处直接调用 repo.saveNote，缓存不失效)
- [x] Checkpoint 6.3: saveNote 自动维护 updatedAt
- [ ] Checkpoint 6.4: updatedAt 支持版本恢复等场景保留原始时间戳 (当前强制覆盖)
- [x] Checkpoint 6.5: 路径使用 p.join 拼接
- [ ] Checkpoint 6.6: syncToFile 有路径遍历防护 (高危漏洞)
- [x] Checkpoint 6.7: FileService JSON 转义补全
- [ ] Checkpoint 6.8: _escapeJson 使用 dart:convert jsonEncode (手动实现不完整)
- [ ] Checkpoint 6.9: trash_service ID 生成使用 uuid (已修复但需回归验证)

## Checkpoint Group 7: Hive 初始化安全 (FR-4)
- [x] Checkpoint 7.1: Hive 初始化失败显示错误页面
- [ ] Checkpoint 7.2: Hive box 打开失败正确清理资源
- [ ] Checkpoint 7.3: 应用退出时 await HiveService.closeHive() (当前 dispose 中未 await)
- [x] Checkpoint 7.4: 移除了 Hive.init('.') 危险降级

## Checkpoint Group 8: 插件系统修复 (FR-5)
- [x] Checkpoint 8.1: resumePlugin 有 null 检查
- [x] Checkpoint 8.2: AI 聊天插件命令不重复注册
- [ ] Checkpoint 8.3: PluginApi 事件注销方法完整 (off* 方法存在但需验证插件调用)
- [x] Checkpoint 8.4: getStorage 返回正确的 PluginStorage
- [ ] Checkpoint 8.5: PluginApiImpl 不持有失效的 WidgetRef (需验证生命周期)
- [x] Checkpoint 8.6: 插件状态持久化到 Hive

## Checkpoint Group 9: Git 备份修复 (FR-6)
- [x] Checkpoint 9.1: 移除了 --allow-empty 参数
- [x] Checkpoint 9.2: 使用异步 IO 方法
- [x] Checkpoint 9.3: 移除了 runInShell: true
- [ ] Checkpoint 9.4: clone 空目录检查正确 (macOS .DS_Store 等隐藏文件导致误判)
- [ ] Checkpoint 9.5: 默认分支非硬编码 (当前硬编码 main)
- [ ] Checkpoint 9.6: Git 参数注入防护 (name/email/url/remote/branch 未验证以 - 开头)
- [ ] Checkpoint 9.7: commitHash 格式验证
- [x] Checkpoint 9.8: 异步初始化有加载状态

## Checkpoint Group 10: 实体识别修复 (FR-7)
- [ ] Checkpoint 10.1: @人名 偏移量正确 (match.start 指向空白符而非 @，偏移错误)
- [ ] Checkpoint 10.2: #标签 偏移量正确 (同上问题)
- [x] Checkpoint 10.3: 防抖回调有 try-catch
- [x] Checkpoint 10.4: EntityCache 容量上限 200 条
- [ ] Checkpoint 10.5: LLM 返回 JSON 对 markdown 代码块包裹有容错
- [ ] Checkpoint 10.6: 重叠实体去重逻辑完善

## Checkpoint Group 11: Overlay 统一管理 (FR-8)
- [ ] Checkpoint 11.1: 使用 OverlayType 枚举统一管理 (仍使用 5+ 个 boolean 标志)
- [ ] Checkpoint 11.2: 同一时间只有一个主要 overlay 打开 (基本互斥但 wiki link completer 等局部浮层未管理)
- [x] Checkpoint 11.3: ESC 按打开顺序逆序关闭
- [ ] Checkpoint 11.4: 打开新 overlay 时正确等待旧 overlay 关闭完成
- [ ] Checkpoint 11.5: 知识图谱关闭动画一致 (直接重置值 vs reverse 动画)
- [ ] Checkpoint 11.6: Overlay 遮罩/动画/点击背景关闭行为统一

## Checkpoint Group 12: 搜索功能修复 (FR-9)
- [x] Checkpoint 12.1: 搜索 TextField suffixIcon 响应输入变化
- [x] Checkpoint 12.2: 搜索无结果时显示提示
- [x] Checkpoint 12.3: 正则搜索无效时给用户提示
- [ ] Checkpoint 12.4: 编辑器内搜索结果高亮所有匹配项 (当前只选中当前项)
- [ ] Checkpoint 12.5: 搜索区分大小写/正则/全字匹配选项
- [ ] Checkpoint 12.6: 搜索替换有确认提示

## Checkpoint Group 13: 笔记操作错误处理 (FR-10)
- [ ] Checkpoint 13.1: 所有 void async 改为 Future<void> async (需全面 grep 验证)
- [x] Checkpoint 13.2: 复制/重命名/恢复/删除有 try-catch
- [ ] Checkpoint 13.3: 所有 addPostFrameCallback 有 mounted 检查 (至少 10+ 处缺失)

## Checkpoint Group 14: UI/UX 前端设计
- [ ] Checkpoint 14.1: LiveMarkdownEditor 支持跨多行选择
- [ ] Checkpoint 14.2: LiveMarkdownEditor Ctrl+A 全选功能正常
- [ ] Checkpoint 14.3: 源码模式显示实体高亮 (当前仅阅读模式高亮)
- [ ] Checkpoint 14.4: 右侧 AI 面板可折叠/隐藏
- [ ] Checkpoint 14.5: Overlay 打开时禁用全局快捷键
- [ ] Checkpoint 14.6: 响应式布局适配小屏幕
- [ ] Checkpoint 14.7: 侧边栏拖拽调整宽度热区足够大
- [ ] Checkpoint 14.8: 浅色主题完整可用或移除选项
- [ ] Checkpoint 14.9: 任务复选框点击不触发笔记打开
- [ ] Checkpoint 14.10: 知识图谱圆形揭示动画从按钮位置开始
- [ ] Checkpoint 14.11: 侧边栏 resizer 有悬停视觉反馈
- [ ] Checkpoint 14.12: 模板画廊支持键盘导航
- [x] Checkpoint 14.13: HTML 导出功能存在
- [ ] Checkpoint 14.14: HTML 导出防 XSS (javascript: 链接未过滤，高危)
- [ ] Checkpoint 14.15: 删除笔记文案与回收站功能一致 ("不可撤销"文案矛盾)

## Checkpoint Group 15: 验收标准 (AC)
- [x] Checkpoint 15.1: AC-1 应用正常启动加载笔记
- [ ] Checkpoint 15.2: AC-2 Hive 初始化失败显示友好错误页面 (有页面但无重试/错误详情)
- [ ] Checkpoint 15.3: AC-3 快速切换笔记内容不丢失 (dispose 保存有风险)
- [ ] Checkpoint 15.4: AC-4 保存失败有明确 SnackBar 反馈 (自动保存失败无 UI 反馈)
- [ ] Checkpoint 15.5: AC-5 Overlay 互斥 (部分实现)
- [ ] Checkpoint 15.6: AC-6 ESC 关闭 overlay 焦点回编辑器
- [x] Checkpoint 15.7: AC-7 UUID 避免 ID 碰撞
- [ ] Checkpoint 15.8: AC-8 Wiki 链接点击跳转/创建 (需手动验证)
- [ ] Checkpoint 15.9: AC-9 Git 备份不产生空提交 (已修复但 clone 有 bug)
- [ ] Checkpoint 15.10: AC-10 5分钟正常使用无未捕获异常 (需长期运行测试)
