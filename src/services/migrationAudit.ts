import { getAssetEmbedType, resolveAssetPathCandidates } from '@/services/embedResolver'
import type { FileRecord } from '@/services/fileSystem'
import { versionHistory } from '@/services/versionHistory'
import { vaultService } from '@/services/vault'
import {
  createWikiLinkInitialContent,
  findMarkdownBlockLine,
  findMarkdownHeadingLine,
  getCreatableWikiLinkPath,
  parseWikiLinkTarget,
  resolveWikiLinkTarget,
} from '@/utils/wikiLinks'

export type MigrationAuditIssueType =
  | 'missing-note'
  | 'missing-heading'
  | 'missing-block'
  | 'missing-asset'
  | 'unreferenced-asset'
  | 'unsupported-asset'

export type MigrationAuditSyntax = 'link' | 'embed' | 'asset'

export interface MigrationAuditIssue {
  type: MigrationAuditIssueType
  syntax: MigrationAuditSyntax
  sourcePath: string
  lineNumber: number
  target: string
  resolvedPath?: string
  assetCandidates?: string[]
  message: string
}

export interface MigrationAuditReport {
  scannedFiles: number
  issueCount: number
  summary: Record<MigrationAuditIssueType, number>
  issues: MigrationAuditIssue[]
}

export interface MigrationAuditRepairResult {
  created: number
  skipped: number
  paths: string[]
}

export interface MigrationAuditAssetRepairChange {
  sourcePath: string
  lineNumber: number
  before: string
  after: string
  candidatePath: string
}

export interface MigrationAuditAssetRepairSnapshot {
  sourcePath: string
  snapshotId: number
}

export interface MigrationAuditAssetRepairResult {
  updated: number
  skipped: number
  paths: string[]
  changes: MigrationAuditAssetRepairChange[]
  snapshots: MigrationAuditAssetRepairSnapshot[]
}

interface WikiReference {
  syntax: MigrationAuditSyntax
  target: string
  lineNumber: number
}

const WIKI_REFERENCE_RE = /(!)?\[\[([^\]\n]+)\]\]/g

const emptySummary = (): Record<MigrationAuditIssueType, number> => ({
  'missing-note': 0,
  'missing-heading': 0,
  'missing-block': 0,
  'missing-asset': 0,
  'unreferenced-asset': 0,
  'unsupported-asset': 0,
})

function parseFenceMarker(line: string): { marker: '`' | '~'; length: number } | null {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})/)
  if (!match) return null
  const sequence = match[1]
  return {
    marker: sequence[0] as '`' | '~',
    length: sequence.length,
  }
}

function extractWikiReferences(content: string): WikiReference[] {
  const references: WikiReference[] = []
  const lines = content.split('\n')
  let activeFence: { marker: '`' | '~'; length: number } | null = null

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const fence = parseFenceMarker(line)

    if (activeFence) {
      if (fence && fence.marker === activeFence.marker && fence.length >= activeFence.length) {
        activeFence = null
      }
      continue
    }

    if (fence) {
      activeFence = fence
      continue
    }

    WIKI_REFERENCE_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = WIKI_REFERENCE_RE.exec(line)) !== null) {
      const target = match[2].trim()
      if (!target) continue
      references.push({
        syntax: match[1] ? 'embed' : 'link',
        target,
        lineNumber: index + 1,
      })
    }
  }

  return references
}

async function assetExists(target: string, sourcePath: string): Promise<{ exists: boolean; resolvedPath?: string }> {
  const candidates = resolveAssetPathCandidates(target, sourcePath)
  for (const candidate of candidates) {
    try {
      await vaultService.readAsset(candidate)
      return { exists: true, resolvedPath: candidate }
    } catch (error) {
      // Keep trying candidates in the same order used by embed rendering.
      console.error(`[migrationAudit] asset candidate read failed: ${candidate}`, error)
    }
  }
  return { exists: false, resolvedPath: candidates[0] }
}

function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path)
}

async function collectVaultFiles(path = '/workspace'): Promise<FileRecord[]> {
  const entries = await vaultService.readDirectory(path)
  const files: FileRecord[] = []

  for (const entry of entries) {
    files.push(entry)
    if (entry.isDirectory) {
      files.push(...(await collectVaultFiles(entry.path)))
    }
  }

  return files
}

function makeIssue(
  type: MigrationAuditIssueType,
  reference: WikiReference,
  sourcePath: string,
  message: string,
  resolvedPath?: string,
  assetCandidates?: string[]
): MigrationAuditIssue {
  return {
    type,
    syntax: reference.syntax,
    sourcePath,
    lineNumber: reference.lineNumber,
    target: reference.target,
    resolvedPath,
    assetCandidates,
    message,
  }
}

function makeAssetIssue(
  type: 'unreferenced-asset' | 'unsupported-asset',
  path: string,
  message: string
): MigrationAuditIssue {
  return {
    type,
    syntax: 'asset',
    sourcePath: path,
    lineNumber: 0,
    target: path,
    resolvedPath: path,
    message,
  }
}

function createMissingNoteContent(rawTarget: string): string {
  const parsed = parseWikiLinkTarget(rawTarget)
  const lines = [createWikiLinkInitialContent(rawTarget).trimEnd()]

  if (parsed.heading) {
    if (parsed.heading.startsWith('^')) {
      lines.push('', `待补内容。 ${parsed.heading}`)
    } else {
      lines.push('', `## ${parsed.heading}`, '')
    }
  }

  return `${lines.join('\n')}\n`
}

function createMissingSectionPlaceholder(issue: MigrationAuditIssue): string | null {
  const parsed = parseWikiLinkTarget(issue.target)
  if (!parsed.heading) return null

  if (issue.type === 'missing-heading') {
    return `## ${parsed.heading}\n\n待补内容。`
  }

  if (issue.type === 'missing-block') {
    const blockId = parsed.heading.startsWith('^') ? parsed.heading : `^${parsed.heading}`
    return `待补内容。 ${blockId}`
  }

  return null
}

function appendPlaceholders(content: string, placeholders: string[]): string {
  const body = placeholders.join('\n\n')
  if (!content.trim()) return `${body}\n`
  const separator = content.endsWith('\n\n') ? '' : (content.endsWith('\n') ? '\n' : '\n\n')
  return `${content}${separator}${body}\n`
}

function dirname(path: string): string {
  const normalized = path.replace(/\/+$/g, '')
  const index = normalized.lastIndexOf('/')
  return index > 0 ? normalized.slice(0, index) : '/workspace'
}

function workspaceRelativePath(path: string): string {
  return path.replace(/^\/workspace\/?/, '')
}

function basename(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() || path
}

function relativePath(fromDir: string, targetPath: string): string {
  const fromParts = workspaceRelativePath(fromDir).split('/').filter(Boolean)
  const targetParts = workspaceRelativePath(targetPath).split('/').filter(Boolean)

  while (fromParts.length > 0 && targetParts.length > 0 && fromParts[0] === targetParts[0]) {
    fromParts.shift()
    targetParts.shift()
  }

  const prefix = fromParts.map(() => '..')
  const relative = [...prefix, ...targetParts].join('/')
  return relative || basename(targetPath)
}

function compactPath(path: string): string {
  return workspaceRelativePath(path) || path
}

function supportedAssetPaths(files: FileRecord[]): string[] {
  return files
    .filter(file => !file.isDirectory && !isMarkdownPath(file.path) && Boolean(getAssetEmbedType(file.path)))
    .map(file => file.path)
}

function findAssetRepairCandidates(target: string, assetPaths: string[]): string[] {
  const targetName = basename(target).toLowerCase()
  if (!targetName) return []
  return assetPaths.filter(path => basename(path).toLowerCase() === targetName)
}

function missingAssetMessage(target: string, candidates: string[]): string {
  if (candidates.length === 1) {
    return `找不到附件: ${target}；找到同名候选: ${compactPath(candidates[0])}`
  }
  if (candidates.length > 1) {
    return `找不到附件: ${target}；找到 ${candidates.length} 个同名候选`
  }
  return `找不到附件: ${target}`
}

function formatAssetRepairTarget(originalTarget: string, sourcePath: string, candidatePath: string): string {
  if (originalTarget.startsWith('/')) {
    return `/${workspaceRelativePath(candidatePath)}`
  }

  if (originalTarget.startsWith('./') || originalTarget.startsWith('../')) {
    const relative = relativePath(dirname(sourcePath), candidatePath)
    if (originalTarget.startsWith('./') && !relative.startsWith('../') && !relative.startsWith('./')) {
      return `./${relative}`
    }
    return relative
  }

  if (originalTarget.includes('/')) {
    return workspaceRelativePath(candidatePath)
  }

  if (dirname(sourcePath) === dirname(candidatePath)) {
    return basename(candidatePath)
  }

  return workspaceRelativePath(candidatePath)
}

function formatAssetRepairWikiTarget(rawTarget: string, sourcePath: string, candidatePath: string): string {
  const pipeIndex = rawTarget.indexOf('|')
  const targetPart = pipeIndex === -1 ? rawTarget : rawTarget.slice(0, pipeIndex)
  const aliasPart = pipeIndex === -1 ? '' : rawTarget.slice(pipeIndex + 1).trim()
  const parsed = parseWikiLinkTarget(targetPart)
  const nextTarget = formatAssetRepairTarget(parsed.fileTarget, sourcePath, candidatePath)
  return `${nextTarget}${parsed.heading ? `#${parsed.heading}` : ''}${aliasPart ? `|${aliasPart}` : ''}`
}

export async function createMissingNotesFromAuditReport(report: MigrationAuditReport): Promise<MigrationAuditRepairResult> {
  const seenPaths = new Set<string>()
  const paths: string[] = []
  let skipped = 0

  for (const issue of report.issues) {
    if (issue.type !== 'missing-note') continue
    const path = getCreatableWikiLinkPath(issue.target, issue.sourcePath)
    if (!path || seenPaths.has(path)) {
      skipped += 1
      continue
    }
    seenPaths.add(path)

    try {
      await vaultService.readFile(path)
      skipped += 1
      continue
    } catch (error) {
      console.error(`[migrationAudit] note not found, creating: ${path}`, error)
      await vaultService.writeFile(path, createMissingNoteContent(issue.target))
      paths.push(path)
    }
  }

  return {
    created: paths.length,
    skipped,
    paths,
  }
}

export async function createMissingHeadingsAndBlocksFromAuditReport(report: MigrationAuditReport): Promise<MigrationAuditRepairResult> {
  const issuesByPath = new Map<string, MigrationAuditIssue[]>()
  const seen = new Set<string>()
  let skipped = 0

  for (const issue of report.issues) {
    if (issue.type !== 'missing-heading' && issue.type !== 'missing-block') continue
    if (!issue.resolvedPath) {
      skipped += 1
      continue
    }
    const parsed = parseWikiLinkTarget(issue.target)
    if (!parsed.heading) {
      skipped += 1
      continue
    }

    const key = `${issue.resolvedPath}\0${issue.type}\0${parsed.heading}`
    if (seen.has(key)) {
      skipped += 1
      continue
    }
    seen.add(key)
    const pathIssues = issuesByPath.get(issue.resolvedPath) || []
    pathIssues.push(issue)
    issuesByPath.set(issue.resolvedPath, pathIssues)
  }

  const paths: string[] = []
  let created = 0

  for (const [path, issues] of issuesByPath) {
    let content: string
    try {
      content = await vaultService.readFile(path)
    } catch (error) {
      console.error(`[migrationAudit] failed to read file for heading/block repair: ${path}`, error)
      skipped += issues.length
      continue
    }

    const placeholders: string[] = []
    for (const issue of issues) {
      const parsed = parseWikiLinkTarget(issue.target)
      const alreadyExists = issue.type === 'missing-heading'
        ? Boolean(findMarkdownHeadingLine(content, parsed.heading))
        : Boolean(findMarkdownBlockLine(content, parsed.heading))
      if (alreadyExists) {
        skipped += 1
        continue
      }

      const placeholder = createMissingSectionPlaceholder(issue)
      if (!placeholder) {
        skipped += 1
        continue
      }
      placeholders.push(placeholder)
      content = appendPlaceholders(content, [placeholder])
      created += 1
    }

    if (placeholders.length === 0) continue
    await vaultService.writeFile(path, content)
    paths.push(path)
  }

  return { created, skipped, paths }
}

function rewriteMissingAssetLinks(
  content: string,
  sourcePath: string,
  issues: MigrationAuditIssue[]
): { content: string; updated: number; skipped: number; changes: MigrationAuditAssetRepairChange[] } {
  const lines = content.split('\n')
  const issueQueues = new Map<string, MigrationAuditIssue[]>()
  const remainingIssues = new Set(issues)
  const changes: MigrationAuditAssetRepairChange[] = []
  let updated = 0
  let activeFence: { marker: '`' | '~'; length: number } | null = null

  for (const issue of issues) {
    const key = `${issue.lineNumber}\0${issue.target}`
    const queue = issueQueues.get(key) || []
    queue.push(issue)
    issueQueues.set(key, queue)
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const fence = parseFenceMarker(line)

    if (activeFence) {
      if (fence && fence.marker === activeFence.marker && fence.length >= activeFence.length) {
        activeFence = null
      }
      continue
    }

    if (fence) {
      activeFence = fence
      continue
    }

    const lineNumber = index + 1
    if (!issues.some(issue => issue.lineNumber === lineNumber)) continue

    WIKI_REFERENCE_RE.lastIndex = 0
    lines[index] = line.replace(WIKI_REFERENCE_RE, (fullMatch: string, bang: string | undefined, inner: string) => {
      const target = inner.trim()
      const key = `${lineNumber}\0${target}`
      const queue = issueQueues.get(key)
      const issue = queue?.shift()
      const candidatePath = issue?.assetCandidates?.[0]
      if (!issue || !candidatePath) return fullMatch

      remainingIssues.delete(issue)
      updated += 1
      const after = `${bang || ''}[[${formatAssetRepairWikiTarget(target, sourcePath, candidatePath)}]]`
      changes.push({
        sourcePath,
        lineNumber,
        before: fullMatch,
        after,
        candidatePath,
      })
      return after
    })
  }

  return {
    content: lines.join('\n'),
    updated,
    skipped: remainingIssues.size,
    changes,
  }
}

async function buildMissingAssetLinkRepairResult(
  report: MigrationAuditReport,
  options: { write: boolean }
): Promise<MigrationAuditAssetRepairResult> {
  const issuesByPath = new Map<string, MigrationAuditIssue[]>()
  let skipped = 0

  for (const issue of report.issues) {
    if (issue.type !== 'missing-asset') continue
    if (issue.lineNumber <= 0 || issue.assetCandidates?.length !== 1) {
      skipped += 1
      continue
    }
    const pathIssues = issuesByPath.get(issue.sourcePath) || []
    pathIssues.push(issue)
    issuesByPath.set(issue.sourcePath, pathIssues)
  }

  const paths: string[] = []
  const changes: MigrationAuditAssetRepairChange[] = []
  const snapshots: MigrationAuditAssetRepairSnapshot[] = []
  let updated = 0

  for (const [path, issues] of issuesByPath) {
    let content: string
    try {
      content = await vaultService.readFile(path)
    } catch (error) {
      console.error(`[migrationAudit] failed to read file for asset link repair: ${path}`, error)
      skipped += issues.length
      continue
    }

    const result = rewriteMissingAssetLinks(content, path, issues)
    skipped += result.skipped
    if (result.updated === 0 || result.content === content) continue

    if (options.write) {
      const snapshotId = await versionHistory.saveSnapshot(path, content, '迁移附件修复前')
      snapshots.push({ sourcePath: path, snapshotId })
      await vaultService.writeFile(path, result.content)
    }
    paths.push(path)
    updated += result.updated
    changes.push(...result.changes)
  }

  return { updated, skipped, paths, changes, snapshots }
}

export async function previewMissingAssetLinksFromAuditReport(report: MigrationAuditReport): Promise<MigrationAuditAssetRepairResult> {
  return buildMissingAssetLinkRepairResult(report, { write: false })
}

export async function repairMissingAssetLinksFromAuditReport(report: MigrationAuditReport): Promise<MigrationAuditAssetRepairResult> {
  return buildMissingAssetLinkRepairResult(report, { write: true })
}

export async function runMigrationAudit(): Promise<MigrationAuditReport> {
  const markdownFiles = await vaultService.getAllMarkdownFiles()
  const markdownPaths = markdownFiles.map(file => file.path)
  const contentByPath = new Map(markdownFiles.map(file => [file.path, file.content]))
  const vaultFiles = await collectVaultFiles()
  const assetPaths = supportedAssetPaths(vaultFiles)
  const referencedAssetPaths = new Set<string>()
  const issues: MigrationAuditIssue[] = []

  for (const file of markdownFiles) {
    const references = extractWikiReferences(file.content)

    for (const reference of references) {
      const parsed = parseWikiLinkTarget(reference.target)
      const assetType = getAssetEmbedType(parsed.fileTarget)

      if (assetType) {
        const result = await assetExists(parsed.fileTarget, file.path)
        if (result.exists && result.resolvedPath) {
          referencedAssetPaths.add(result.resolvedPath)
        }
        if (!result.exists) {
          const assetCandidates = findAssetRepairCandidates(parsed.fileTarget, assetPaths)
          issues.push(makeIssue(
            'missing-asset',
            reference,
            file.path,
            missingAssetMessage(parsed.fileTarget, assetCandidates),
            result.resolvedPath,
            assetCandidates
          ))
        }
        continue
      }

      const resolvedPath = resolveWikiLinkTarget(reference.target, file.path, markdownPaths)
      if (!resolvedPath) {
        issues.push(makeIssue(
          'missing-note',
          reference,
          file.path,
          `找不到笔记: ${parsed.fileTarget || reference.target}`
        ))
        continue
      }

      if (!parsed.heading) continue

      const resolvedContent = contentByPath.get(resolvedPath)
      if (resolvedContent === undefined) {
        issues.push(makeIssue(
          'missing-note',
          reference,
          file.path,
          `找不到笔记: ${resolvedPath}`,
          resolvedPath
        ))
        continue
      }

      if (parsed.heading.startsWith('^')) {
        if (!findMarkdownBlockLine(resolvedContent, parsed.heading)) {
          issues.push(makeIssue(
            'missing-block',
            reference,
            file.path,
            `找不到块引用: ${parsed.heading}`,
            resolvedPath
          ))
        }
        continue
      }

      if (!findMarkdownHeadingLine(resolvedContent, parsed.heading)) {
        issues.push(makeIssue(
          'missing-heading',
          reference,
          file.path,
          `找不到标题: ${parsed.heading}`,
          resolvedPath
        ))
      }
    }
  }

  for (const file of vaultFiles) {
    if (file.isDirectory || isMarkdownPath(file.path)) continue
    const assetType = getAssetEmbedType(file.path)
    if (!assetType) {
      issues.push(makeAssetIssue(
        'unsupported-asset',
        file.path,
        '当前不支持此附件格式'
      ))
      continue
    }
    if (!referencedAssetPaths.has(file.path)) {
      issues.push(makeAssetIssue(
        'unreferenced-asset',
        file.path,
        '附件未被任何 Wiki Link 或嵌入引用'
      ))
    }
  }

  const summary = emptySummary()
  for (const issue of issues) {
    summary[issue.type] += 1
  }

  return {
    scannedFiles: markdownFiles.length,
    issueCount: issues.length,
    summary,
    issues,
  }
}
