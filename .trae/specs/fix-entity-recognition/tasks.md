# 实体识别修复任务

- [x] 任务1: 修复远程LLM识别偏移量问题（依赖：无；可并行）
  - 在 `_remoteRecognize` 中记录 `prefixLength`
  - 解析结果时偏移量加上 `prefixLength`
  - 修复校验逻辑使用截断文本长度
  - 修正偏移量后再次校验原始markdown范围

- [x] 任务2: 防抖回调添加try-catch异常保护（依赖：无；可并行）
  - 在 `debounceRecognize` 的Timer回调中包裹try-catch
  - 异常时debug打印日志，返回空实体结果

- [x] 任务3: EntityCache添加200条上限与FIFO淘汰策略（依赖：无；可并行）
  - 添加 `_maxCacheSize = 200` 常量
  - 修改 `updateEntities` 方法实现FIFO逻辑
  - 更新已有条目时移到末尾
  - 超过容量时移除最早插入的条目
