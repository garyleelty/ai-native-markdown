import { vaultService } from '@/services/vault'

export type BatchFileErrorType = 'missing' | 'permission' | 'conflict' | 'cancelled' | 'unknown'

export interface BatchFileFailure {
  path: string
  error: string
  errorType: BatchFileErrorType
}

export interface BatchFileResult {
  succeeded: string[]
  failed: BatchFileFailure[]
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}

function joinPath(directory: string, name: string): string {
  return `${directory.replace(/\/+$/, '')}/${name}`
}

function classifyError(error: unknown): BatchFileErrorType {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  if (message.includes('not found') || message.includes('missing') || message.includes('不存在')) return 'missing'
  if (message.includes('permission') || message.includes('denied') || message.includes('权限')) return 'permission'
  if (message.includes('exists') || message.includes('conflict') || message.includes('已存在')) return 'conflict'
  if (message.includes('cancel')) return 'cancelled'
  return 'unknown'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '未知错误')
}

function failure(path: string, error: unknown): BatchFileFailure {
  return { path, error: errorMessage(error), errorType: classifyError(error) }
}

export async function deletePathsSequential(paths: string[]): Promise<BatchFileResult> {
  const result: BatchFileResult = { succeeded: [], failed: [] }
  for (const path of paths) {
    try {
      await vaultService.deletePath(path)
      result.succeeded.push(path)
    } catch (error) {
      result.failed.push(failure(path, error))
    }
  }
  return result
}

export async function movePathsSequential(paths: string[], targetDirectory: string): Promise<BatchFileResult> {
  const result: BatchFileResult = { succeeded: [], failed: [] }
  try {
    await vaultService.readDirectory(targetDirectory)
  } catch (error) {
    return {
      succeeded: [],
      failed: paths.map(path => failure(path, error)),
    }
  }

  for (const path of paths) {
    try {
      await vaultService.renamePath(path, joinPath(targetDirectory, basename(path)))
      result.succeeded.push(path)
    } catch (error) {
      result.failed.push(failure(path, error))
    }
  }
  return result
}
