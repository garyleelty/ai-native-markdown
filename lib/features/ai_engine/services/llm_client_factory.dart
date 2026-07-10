/// LLM 客户端工厂
/// 通过条件导入自动选择平台实现
/// - 原生平台: 使用 dart:io HttpClient
/// - Web 平台: 返回 null (回退到本地识别)
///
/// 使用方式:
///   final client = createLlmClient();
///   final result = await client.callLlm(...);
library;

import 'llm_client_io.dart' if (dart.library.html) 'llm_client_web.dart';

LlmClient createLlmClient() => LlmClient();
