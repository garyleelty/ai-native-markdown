import 'dart:convert';
import 'dart:io';

/// 原生平台 (桌面/移动端) 的 LLM API 客户端
/// 使用 dart:io HttpClient 发起 HTTP 请求
class LlmClient {
  /// 调用 OpenAI 兼容的 LLM API
  ///
  /// [systemPrompt] 可选的系统提示；为空时不添加 system 消息。
  /// [userPrompt] 当前用户消息。
  /// [history] 可选的历史对话记录，每条包含 'role' 与 'content'。
  Future<String?> callLlm({
    required String endpoint,
    required String apiKey,
    required String model,
    required int maxTokens,
    required double temperature,
    String? systemPrompt,
    required String userPrompt,
    List<Map<String, String>>? history,
  }) async {
    try {
      final httpClient = HttpClient();
      final uri = Uri.parse(endpoint);
      final request = await httpClient.postUrl(uri);

      request.headers.set('Content-Type', 'application/json');
      request.headers.set('Authorization', 'Bearer $apiKey');

      final messages = <Map<String, String>>[];
      if (systemPrompt != null && systemPrompt.isNotEmpty) {
        messages.add({'role': 'system', 'content': systemPrompt});
      }
      if (history != null) {
        for (final msg in history) {
          final role = msg['role'];
          final content = msg['content'];
          if (role != null &&
              content != null &&
              (role == 'user' || role == 'assistant' || role == 'system')) {
            messages.add({'role': role, 'content': content});
          }
        }
      }
      messages.add({'role': 'user', 'content': userPrompt});

      final body = jsonEncode({
        'model': model,
        'messages': messages,
        'max_tokens': maxTokens,
        'temperature': temperature,
      });

      request.write(body);
      final response = await request.close();
      final responseBody = await response.transform(utf8.decoder).join();

      httpClient.close();

      final decoded = jsonDecode(responseBody);
      if (decoded is Map && decoded.containsKey('choices')) {
        final choices = decoded['choices'] as List;
        if (choices.isNotEmpty) {
          final message = choices[0]['message'];
          if (message is Map && message.containsKey('content')) {
            return message['content'] as String;
          }
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }
}
