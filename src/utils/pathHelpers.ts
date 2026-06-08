/**
 * Shared path/mime helpers used across fileSystem, vaultService, and Electron IPC.
 */

export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path)
}

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
}

export function mimeTypeForPath(filePath: string): string {
  const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0]
  return (ext && MIME_MAP[ext]) || 'application/octet-stream'
}
