/// Web 平台的 LLM API 客户端桩
/// Web 端不支持 dart:io HttpClient，远程识别回退到本地识别
class LlmClient {
  Future<String?> callLlm({
    required String endpoint,
    required String apiKey,
    required String model,
    required int maxTokens,
    required double temperature,
    required String prompt,
  }) async {
    // Web 端暂不支持远程 LLM 调用，返回 null 触发本地回退
    return null;
  }
}
