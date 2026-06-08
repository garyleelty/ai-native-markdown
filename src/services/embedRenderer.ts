import { resolveEmbed } from '@/services/embedResolver'
import { escapeHtml } from '@/utils/security'

export interface ResolveEmbedPlaceholdersOptions {
  sourcePath?: string
  currentContent?: string
  maxDepth?: number
  shouldContinue?: () => boolean
  onDependency?: (filePath: string) => void
}

const DEFAULT_MAX_DEPTH = 3

function canContinue(options: ResolveEmbedPlaceholdersOptions): boolean {
  return options.shouldContinue?.() ?? true
}

function embedNavigationTarget(filePath: string, heading?: string): string {
  return heading ? `${filePath}#${heading}` : filePath
}

function setEmbedError(element: HTMLElement, target: string, message: string): void {
  element.className = 'embed embed-not-found'
  element.dataset.embedResolved = 'true'
  element.innerHTML = [
    '<div class="embed-header">',
    `<span class="embed-path">${escapeHtml(target || 'current file')}</span>`,
    '</div>',
    `<div class="embed-error">${escapeHtml(message)}</div>`,
  ].join('')
}

function renderSourceHeader(resultPath: string | undefined, fallbackTarget: string, label: string): string {
  return [
    '<div class="embed-header">',
    `<button class="embed-source" data-filename="${escapeHtml(resultPath || fallbackTarget)}" type="button">`,
    `<span class="embed-path">${escapeHtml(label)}</span>`,
    '</button>',
    '</div>',
  ].join('')
}

function renderAssetEmbed(element: HTMLElement, resultType: 'image' | 'audio' | 'video' | 'pdf', content: string, resultPath: string | undefined, target: string, label: string): void {
  element.className = `embed embed-${resultType}`
  const header = renderSourceHeader(resultPath, target, label)
  const escapedContent = escapeHtml(content)
  const escapedLabel = escapeHtml(label)

  if (resultType === 'image') {
    element.innerHTML = [
      header,
      `<img src="${escapedContent}" alt="${escapedLabel}" />`,
    ].join('')
    return
  }

  if (resultType === 'audio') {
    element.innerHTML = [
      header,
      `<audio controls preload="metadata" src="${escapedContent}"></audio>`,
    ].join('')
    return
  }

  if (resultType === 'video') {
    element.innerHTML = [
      header,
      `<video controls preload="metadata" src="${escapedContent}"></video>`,
    ].join('')
    return
  }

  element.innerHTML = [
    header,
    `<iframe class="embed-pdf-frame" src="${escapedContent}" title="${escapedLabel}" sandbox></iframe>`,
  ].join('')
}

async function renderEmbedElement(
  element: HTMLElement,
  options: ResolveEmbedPlaceholdersOptions,
  depth: number,
  stack: string[]
): Promise<void> {
  const target = element.dataset.target || ''
  const heading = element.dataset.heading || ''
  const label = heading ? `${target}#${heading}` : target
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH

  if (depth > maxDepth) {
    setEmbedError(element, label, '嵌入层级过深')
    return
  }

  element.classList.add('embed-loading')
  element.textContent = '加载嵌入内容...'

  const result = await resolveEmbed(target, heading || undefined, depth, options.sourcePath, options.currentContent)
  if (!canContinue(options)) return
  if (result.filePath) options.onDependency?.(result.filePath)

  element.classList.remove('embed-loading')
  if (result.type === 'not-found') {
    setEmbedError(element, label, '未找到嵌入目标')
    return
  }

  const isCurrentFileSectionEmbed = result.filePath === options.sourcePath && !target.trim() && Boolean(heading)
  if (result.filePath && stack.includes(result.filePath) && !isCurrentFileSectionEmbed) {
    setEmbedError(element, label, '检测到循环嵌入')
    return
  }

  element.dataset.embedResolved = 'true'
  if (['image', 'audio', 'video', 'pdf'].includes(result.type)) {
    renderAssetEmbed(element, result.type as 'image' | 'audio' | 'video' | 'pdf', result.content || '', result.filePath, target, label)
    return
  }

  element.className = 'embed embed-note'
  const nextStack = result.filePath ? [...stack, result.filePath] : stack
  element.innerHTML = [
    '<div class="embed-header">',
    `<button class="embed-source" data-filename="${escapeHtml(embedNavigationTarget(result.filePath || target, result.heading))}" type="button">`,
    `<span class="embed-path">${escapeHtml(label)}</span>`,
    '</button>',
    '</div>',
    `<div class="embed-content">${result.content || ''}</div>`,
  ].join('')

  await resolveEmbedPlaceholders(element, {
    ...options,
    sourcePath: result.filePath || options.sourcePath,
    currentContent: result.rawContent || options.currentContent,
  }, depth + 1, nextStack)
}

export async function resolveEmbedPlaceholders(
  root: ParentNode,
  options: ResolveEmbedPlaceholdersOptions = {},
  depth = 0,
  stack: string[] = options.sourcePath ? [options.sourcePath] : []
): Promise<void> {
  const elements = Array.from(root.querySelectorAll<HTMLElement>('.embed[data-target]'))
    .filter(element => element.dataset.embedResolved !== 'true')

  for (const element of elements) {
    if (!canContinue(options)) return
    await renderEmbedElement(element, options, depth, stack)
  }
}
