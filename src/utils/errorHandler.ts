import { ElMessage } from 'element-plus'

export enum ErrorLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SILENT = 'silent'
}

export interface AppError {
  message: string
  level: ErrorLevel
  source?: string
  originalError?: unknown
}

export function handleError(error: unknown, fallbackMessage = '操作失败', level: ErrorLevel = ErrorLevel.ERROR): AppError {
  const message = error instanceof Error ? error.message : (typeof error === 'string' ? error : fallbackMessage)
  const appError: AppError = { message, level, originalError: error }

  if (level === ErrorLevel.SILENT) {
    console.warn(`[${level}]`, message)
    return appError
  }

  if (level === ErrorLevel.INFO) {
    ElMessage.info(message)
  } else if (level === ErrorLevel.WARNING) {
    ElMessage.warning(message)
  } else {
    ElMessage.error(message)
  }

  return appError
}

export function wrapAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  fallbackMessage?: string,
  level?: ErrorLevel
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (e) {
      handleError(e, fallbackMessage, level)
    }
  }) as T
}
