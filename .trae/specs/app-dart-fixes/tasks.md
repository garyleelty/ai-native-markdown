# Tasks

- [x] 1. 修复笔记ID生成：将第170、323、374行的时间戳ID替换为 repo.generateId()
- [x] 2. 修复4个异步方法返回类型：将 void async 改为 Future<void>
- [x] 3. 增强错误处理：_openTodayDailyNote catch 添加 debugPrint，_buildGraphData 添加 try-catch
- [x] 4. 修复资源释放：dispose() 添加 HiveService.closeHive()，修复 TextEditingController dispose
- [x] 5. 修复 Overlay 互斥和 ESC 行为：重命名方法、新增 _closeAllOverlays、在打开所有overlay前调用关闭
