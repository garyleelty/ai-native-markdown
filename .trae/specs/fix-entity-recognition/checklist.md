# 验收清单

- [x] _remoteRecognize 方法中文本截断时显式记录 prefixLength 变量
- [x] LLM 返回的 start/end 偏移量正确加上 prefixLength
- [x] 偏移量首次校验使用截断文本长度（truncated.length）而非原始 markdown.length
- [x] 偏移量修正后再次校验是否在原始 markdown 合法范围内
- [x] debounceRecognize 的 Timer 回调被 try-catch 包裹
- [x] 防抖回调捕获异常时，debug 模式下打印错误日志
- [x] 防抖回调捕获异常时，返回空实体列表的 RecognitionResult
- [x] EntityCacheNotifier 定义了容量上限常量（200）
- [x] 调用 updateEntities 添加新笔记时，缓存大小不超过 200
- [x] 缓存超过 200 时，最早插入的笔记被移除
- [x] 调用 updateEntities 更新已有笔记时，该笔记被移到缓存末尾（最新位置）
- [x] 所有现有公开 API（getEntities、clearNote、clearAll、updateEntities）签名保持不变
- [x] 代码通过静态分析（dart analyze 无错误）
