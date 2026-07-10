# 实体识别问题修复 Spec

## Why

实体识别功能存在三个影响稳定性和正确性的问题：
1. 远程LLM识别时，文本截断发送后返回的偏移量处理存在缺陷，可能导致实体位置标记错误
2. 防抖回调中缺少异常捕获，识别失败时可能导致未捕获异常
3. 实体缓存无容量限制，长时间使用可能导致内存占用持续增长

## What Changes

### 1. 修复远程LLM识别偏移量问题 (`lib/features/ai_engine/services/entity_recognizer.dart`)
- 在 `_remoteRecognize` 方法中，截断文本时显式记录截断前缀长度 `prefixLength`（当前截断策略为从开头截取，故值为0，但为扩展性保留）
- 解析LLM返回结果时，将 `start` 和 `end` 偏移量加上 `prefixLength`
- 修复偏移量校验bug：校验范围使用截断文本长度而非原始markdown长度
- 偏移量修正后再次校验是否在原始markdown的合法范围内

### 2. 防抖回调添加异常保护 (`lib/features/ai_engine/services/entity_recognizer.dart`)
- 在 `debounceRecognize` 的Timer回调中添加try-catch
- 捕获异常时，debug模式下打印错误日志
- 返回空实体列表的RecognitionResult，避免UI崩溃

### 3. EntityCache添加容量上限与FIFO策略 (`lib/providers/ai_provider.dart`)
- EntityCache最多缓存200篇笔记的实体
- 使用简单FIFO淘汰策略：超过容量时移除最早插入的缓存条目
- 更新已有笔记缓存时，将该条目移到缓存末尾（标记为最近使用）
- 保持现有API兼容性（updateEntities、clearNote、clearAll、getEntities方法签名不变）

## Impact

- **影响文件**:
  - `lib/features/ai_engine/services/entity_recognizer.dart`
  - `lib/providers/ai_provider.dart`
- **无破坏性变更**: 所有公开API保持兼容
- **性能影响**: FIFO淘汰操作为O(1)（利用Map插入顺序特性），无性能问题

## ADDED Requirements

1. 远程识别时，截断后返回的实体偏移量必须相对于原始markdown正确
2. 防抖识别过程中发生任何异常，都不能导致未捕获错误，应优雅降级返回空结果
3. EntityCache缓存条目数永不超过200
4. 当缓存满时添加新条目，最早插入的条目被淘汰
5. 更新已有笔记的实体缓存时，该笔记的缓存位置变为最新（不会被优先淘汰）

## MODIFIED Requirements

无
