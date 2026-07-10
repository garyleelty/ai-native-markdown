# Checklist

- [x] 1. resumePlugin 方法在 _storages[pluginId] 为 null 时不会崩溃，而是重新创建 storage
- [x] 2. AiChatPlugin.onActivate 中不调用 registerCommand，所有命令只通过 getCommands() 返回
- [x] 3. PluginApi 接口定义了 offNoteOpened、offNoteSaved、offEntitiesRecognized、offPaneStackChanged 方法
- [x] 4. PluginApiImpl.getStorage 正常工作，通过 PluginRegistry 获取对应插件的存储
- [x] 5. PluginApiImpl 实现了所有 off* 事件取消注册方法
- [x] 6. 插件被暂停（禁用）后，重启应用该插件保持禁用状态
- [x] 7. pausePlugin 时正确注销该插件的命令
- [x] 8. 代码通过 dart analyze 静态分析，无错误
