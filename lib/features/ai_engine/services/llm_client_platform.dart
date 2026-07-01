/// LLM API 客户端平台接口
/// 不同平台提供不同实现：
/// - 原生平台: 使用 dart:io HttpClient
/// - Web 平台: 桩实现，返回 null (回退到本地识别)
abstract class LlmClientPlatform {
  Future<String?> callLlm({
    required String endpoint,
    required String apiKey,
    required String model,
    required int maxTokens,
    required double temperature,
    required String prompt,
  });
}
