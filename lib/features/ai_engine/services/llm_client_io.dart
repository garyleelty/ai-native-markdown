import 'dart:convert';
import 'dart:io';

/// 原生平台 (桌面/移动端) 的 LLM API 客户端
/// 使用 dart:io HttpClient 发起 HTTP 请求
class LlmClient {
  Future<String?> callLlm({
    required String endpoint,
    required String apiKey,
    required String model,
    required int maxTokens,
    required double temperature,
    required String prompt,
  }) async {
    try {
      final httpClient = HttpClient();
      final uri = Uri.parse(endpoint);
      final request = await httpClient.postUrl(uri);

      request.headers.set('Content-Type', 'application/json');
      request.headers.set('Authorization', 'Bearer $apiKey');

      final body = jsonEncode({
        'model': model,
        'messages': [
          {
            'role': 'system',
            'content': '你是一个实体识别助手，只返回 JSON 数组。',
          },
          {'role': 'user', 'content': prompt},
        ],
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
