import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createMissingHeadingsAndBlocksFromAuditReport,
  createMissingNotesFromAuditReport,
  previewMissingAssetLinksFromAuditReport,
  repairMissingAssetLinksFromAuditReport,
  runMigrationAudit,
  type MigrationAuditAssetRepairResult,
  type MigrationAuditIssue,
  type MigrationAuditReport,
} from '@/services/migrationAudit'
import { vaultService } from '@/services/vault'
import { useEditorStore } from '@/stores/editor'

export function useMigrationAudit(options: {
  refreshMarkdownPaths: () => Promise<void>
  sidebarRef: () => any
  editorRef: () => any
  syncOpenTabsFromVault: (paths: string[]) => Promise<void>
  showVersionHistory: () => void
  handleFileSelect: (path: string) => Promise<void>
  handleSearchResultSelect: (payload: { path: string; lineNumber?: number }) => Promise<void>
}) {
  const editorStore = useEditorStore()
  const showMigrationAudit = ref(false)
  const migrationAuditRunning = ref(false)
  const migrationAuditReport = ref<MigrationAuditReport | null>(null)
  const migrationAssetRepairPreview = ref<MigrationAuditAssetRepairResult | null>(null)
  const migrationAssetRepairPreviewIssues = ref<MigrationAuditIssue[]>([])
  const migrationAssetRepairResult = ref<MigrationAuditAssetRepairResult | null>(null)

  const refreshMigrationAuditReport = async (): Promise<MigrationAuditReport> => {
    await options.refreshMarkdownPaths()
    const report = await runMigrationAudit()
    migrationAuditReport.value = report
    return report
  }

  const openMigrationAudit = async () => {
    showMigrationAudit.value = true
    migrationAuditRunning.value = true
    migrationAssetRepairPreview.value = null
    migrationAssetRepairPreviewIssues.value = []
    migrationAssetRepairResult.value = null
    try {
      const report = await refreshMigrationAuditReport()
      if (report.issueCount === 0) {
        ElMessage.success('迁移校验通过')
      } else {
        ElMessage.warning(`发现 ${report.issueCount} 个迁移问题`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ElMessage.error(`迁移校验失败: ${message}`)
    } finally {
      migrationAuditRunning.value = false
    }
  }

  const createMigrationAuditMissingNotes = async () => {
    const report = migrationAuditReport.value
    if (!report || report.summary['missing-note'] === 0) return

    migrationAuditRunning.value = true
    try {
      const result = await createMissingNotesFromAuditReport(report)
      await options.refreshMarkdownPaths()
      await options.sidebarRef()?.refreshTree?.()
      await refreshMigrationAuditReport()
      if (result.created > 0) {
        ElMessage.success(`已创建 ${result.created} 个缺失笔记`)
      } else {
        ElMessage.info('没有可创建的缺失笔记')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ElMessage.error(`创建缺失笔记失败: ${message}`)
    } finally {
      migrationAuditRunning.value = false
    }
  }

  const createMigrationAuditMissingSections = async () => {
    const report = migrationAuditReport.value
    const missingSectionCount = (report?.summary['missing-heading'] ?? 0) + (report?.summary['missing-block'] ?? 0)
    if (!report || missingSectionCount === 0) return

    migrationAuditRunning.value = true
    try {
      const result = await createMissingHeadingsAndBlocksFromAuditReport(report)
      await options.refreshMarkdownPaths()
      await options.sidebarRef()?.refreshTree?.()
      await refreshMigrationAuditReport()
      if (result.created > 0) {
        ElMessage.success(`已补齐 ${result.created} 个标题或块`)
      } else {
        ElMessage.info('没有可补齐的标题或块')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ElMessage.error(`补齐标题或块失败: ${message}`)
    } finally {
      migrationAuditRunning.value = false
    }
  }

  const syncUnmodifiedOpenTabsFromDisk = async (paths: string[]) => {
    for (const path of paths) {
      const tab = editorStore.openTabs.find(item => item.filePath === path)
      if (!tab || tab.isModified) continue

      const updatedContent = await vaultService.readFile(path)
      tab.content = updatedContent
      tab.isModified = false

      if (tab.id === editorStore.activeTabId) {
        editorStore.setContentSilent(updatedContent)
        options.editorRef()?.setContent(updatedContent)
      }
    }
  }

  const emptyAssetRepairResult = (skipped = 0): MigrationAuditAssetRepairResult => ({
    updated: 0,
    skipped,
    paths: [],
    changes: [],
    snapshots: [],
  })

  const modifiedOpenPathSet = () => new Set(
    editorStore.openTabs
      .filter(tab => tab.isModified)
      .map(tab => tab.filePath)
  )

  const splitSafeMigrationAssetIssues = (issues: MigrationAuditIssue[]) => {
    const modifiedPaths = modifiedOpenPathSet()
    const safeIssues = issues.filter(issue => !modifiedPaths.has(issue.sourcePath))
    return {
      safeIssues,
      skippedOpenTabs: issues.length - safeIssues.length,
    }
  }

  const clearMigrationAuditAssetPreview = () => {
    migrationAssetRepairPreview.value = null
    migrationAssetRepairPreviewIssues.value = []
  }

  const showAssetRepairCompletionMessage = (result: MigrationAuditAssetRepairResult) => {
    if (result.updated > 0) {
      ElMessage.success(result.skipped > 0
        ? `已修复 ${result.updated} 个附件链接，跳过 ${result.skipped} 个`
        : `已修复 ${result.updated} 个附件链接`)
    } else if (result.skipped > 0) {
      ElMessage.info(`没有可安全修复的附件链接，跳过 ${result.skipped} 个`)
    } else {
      ElMessage.info('没有可安全修复的附件链接')
    }
  }

  const cancelMigrationAuditAssetRepairPreview = () => {
    clearMigrationAuditAssetPreview()
  }

  const previewMigrationAuditMissingAssets = async () => {
    const report = migrationAuditReport.value
    if (!report) return

    const repairableIssues = report.issues.filter(issue =>
      issue.type === 'missing-asset' && issue.assetCandidates?.length === 1
    )
    if (repairableIssues.length === 0) return
    clearMigrationAuditAssetPreview()
    migrationAssetRepairResult.value = null

    const { safeIssues, skippedOpenTabs } = splitSafeMigrationAssetIssues(repairableIssues)

    if (safeIssues.length === 0) {
      migrationAssetRepairPreview.value = emptyAssetRepairResult(skippedOpenTabs)
      ElMessage.info(`有 ${skippedOpenTabs} 个附件链接位于未保存标签中，已跳过`)
      return
    }

    migrationAuditRunning.value = true
    try {
      const result = await previewMissingAssetLinksFromAuditReport({
        ...report,
        issues: safeIssues,
      })
      const preview = {
        ...result,
        skipped: skippedOpenTabs + result.skipped,
      }
      migrationAssetRepairPreview.value = preview
      migrationAssetRepairPreviewIssues.value = safeIssues

      if (preview.updated > 0) {
        ElMessage.info(`将修复 ${preview.updated} 个附件链接`)
      } else if (preview.skipped > 0) {
        ElMessage.info(`没有可预览的附件链接，跳过 ${preview.skipped} 个`)
      } else {
        ElMessage.info('没有可预览的附件链接')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ElMessage.error(`预览附件修复失败: ${message}`)
    } finally {
      migrationAuditRunning.value = false
    }
  }

  const previewMigrationAuditMissingAsset = async (issue: MigrationAuditIssue, candidatePath: string) => {
    const report = migrationAuditReport.value
    if (!report || issue.type !== 'missing-asset' || !candidatePath) return
    clearMigrationAuditAssetPreview()
    migrationAssetRepairResult.value = null

    const sourceTab = editorStore.openTabs.find(tab => tab.filePath === issue.sourcePath)
    if (sourceTab?.isModified) {
      migrationAssetRepairPreview.value = emptyAssetRepairResult(1)
      ElMessage.info('该附件链接位于未保存标签中，已跳过')
      return
    }

    migrationAuditRunning.value = true
    try {
      const previewIssue = { ...issue, assetCandidates: [candidatePath] }
      const result = await previewMissingAssetLinksFromAuditReport({
        ...report,
        issues: [previewIssue],
      })
      migrationAssetRepairPreview.value = result
      migrationAssetRepairPreviewIssues.value = [previewIssue]

      if (result.updated > 0) {
        ElMessage.info(`将修复 ${result.updated} 个附件链接`)
      } else if (result.skipped > 0) {
        ElMessage.info(`没有可预览的附件链接，跳过 ${result.skipped} 个`)
      } else {
        ElMessage.info('没有可预览的附件链接')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ElMessage.error(`预览附件修复失败: ${message}`)
    } finally {
      migrationAuditRunning.value = false
    }
  }

  const confirmMigrationAuditAssetRepair = async () => {
    const report = migrationAuditReport.value
    const previewIssues = migrationAssetRepairPreviewIssues.value
    if (!report || previewIssues.length === 0) return

    const { safeIssues, skippedOpenTabs } = splitSafeMigrationAssetIssues(previewIssues)
    if (safeIssues.length === 0) {
      clearMigrationAuditAssetPreview()
      migrationAssetRepairResult.value = emptyAssetRepairResult(skippedOpenTabs)
      ElMessage.info(`有 ${skippedOpenTabs} 个附件链接位于未保存标签中，已跳过`)
      return
    }

    migrationAuditRunning.value = true
    try {
      const result = await repairMissingAssetLinksFromAuditReport({
        ...report,
        issues: safeIssues,
      })
      const repairResult = {
        ...result,
        skipped: skippedOpenTabs + result.skipped,
      }
      await syncUnmodifiedOpenTabsFromDisk(result.paths)
      await options.refreshMarkdownPaths()
      await options.sidebarRef()?.refreshTree?.()
      await refreshMigrationAuditReport()
      clearMigrationAuditAssetPreview()
      migrationAssetRepairResult.value = repairResult
      showAssetRepairCompletionMessage(repairResult)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ElMessage.error(`修复附件链接失败: ${message}`)
    } finally {
      migrationAuditRunning.value = false
    }
  }

  const handleMigrationAuditNavigate = (issue: MigrationAuditIssue) => {
    showMigrationAudit.value = false
    void options.handleSearchResultSelect({ path: issue.sourcePath, lineNumber: issue.lineNumber })
  }

  const openMigrationAuditAssetRepairHistory = async () => {
    const snapshotPath = migrationAssetRepairResult.value?.snapshots[0]?.sourcePath
    if (!snapshotPath) return
    showMigrationAudit.value = false
    await options.handleFileSelect(snapshotPath)
    options.showVersionHistory()
  }

  return {
    showMigrationAudit,
    migrationAuditRunning,
    migrationAuditReport,
    migrationAssetRepairPreview,
    migrationAssetRepairResult,
    openMigrationAudit,
    createMigrationAuditMissingNotes,
    createMigrationAuditMissingSections,
    previewMigrationAuditMissingAssets,
    previewMigrationAuditMissingAsset,
    confirmMigrationAuditAssetRepair,
    cancelMigrationAuditAssetRepairPreview,
    handleMigrationAuditNavigate,
    openMigrationAuditAssetRepairHistory,
  }
}
