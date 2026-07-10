/// 平台环境变量读取
/// 条件导入自动选择平台实现
library;
import 'platform_env_io.dart' if (dart.library.html) 'platform_env_web.dart';

Map<String, String> get platformEnv => PlatformEnvReader.read();
