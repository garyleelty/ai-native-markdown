<template>
  <el-dialog
    v-model="visible"
    title="迁移校验"
    width="920px"
    class="migration-audit-dialog responsive-dialog"
    append-to-body
  >
    <div v-if="running" class="audit-loading" role="status">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>正在扫描 Wiki Link、嵌入、标题、块引用和附件...</span>
    </div>

    <template v-else-if="report">
      <div class="audit-summary" aria-label="迁移校验摘要">
        <div class="summary-item">
          <span>扫描文件</span>
          <strong>{{ report.scannedFiles }}</strong>
        </div>
        <div class="summary-item">
          <span>问题总数</span>
          <strong>{{ report.issueCount }}</strong>
        </div>
        <div class="summary-tags">
          <el-tag size="small" :type="report.summary['missing-note'] ? 'danger' : 'info'">笔记 {{ report.summary['missing-note'] }}</el-tag>
          <el-tag size="small" :type="report.summary['missing-heading'] ? 'warning' : 'info'">标题 {{ report.summary['missing-heading'] }}</el-tag>
          <el-tag size="small" :type="report.summary['missing-block'] ? 'warning' : 'info'">块 {{ report.summary['missing-block'] }}</el-tag>
          <el-tag size="small" :type="report.summary['missing-asset'] ? 'danger' : 'info'">附件 {{ report.summary['missing-asset'] }}</el-tag>
          <el-tag size="small" :type="report.summary['unreferenced-asset'] ? 'warning' : 'info'">未引用 {{ report.summary['unreferenced-asset'] }}</el-tag>
          <el-tag size="small" :type="report.summary['unsupported-asset'] ? 'danger' : 'info'">不支持 {{ report.summary['unsupported-asset'] }}</el-tag>
        </div>
      </div>

      <div v-if="assetRepairResult" class="asset-repair-report" aria-label="最近附件修复报告">
        <div class="asset-repair-header">
          <strong>最近附件修复</strong>
          <span>
            已更新 {{ assetRepairResult.updated }} 个，跳过 {{ assetRepairResult.skipped }} 个
            <template v-if="assetRepairResult.snapshots.length > 0">，快照 {{ assetRepairResult.snapshots.length }} 个</template>
          </span>
          <div v-if="assetRepairResult.snapshots.length > 0" class="asset-repair-actions">
            <el-button size="small" type="primary" text native-type="button" @click="$emit('openAssetRepairHistory')">
              打开版本历史
            </el-button>
          </div>
        </div>
        <div v-if="visibleAssetRepairChanges.length > 0" class="asset-repair-changes">
          <div
            v-for="change in visibleAssetRepairChanges"
            :key="`${change.sourcePath}:${change.lineNumber}:${change.before}:${change.after}`"
            class="asset-repair-change"
          >
            <span class="asset-repair-source">{{ formatSource(change.sourcePath, change.lineNumber) }}</span>
            <span class="asset-repair-diff">
              <code>{{ change.before }}</code>
              <span class="asset-repair-arrow">→</span>
              <code>{{ change.after }}</code>
            </span>
          </div>
          <div v-if="hiddenAssetRepairChangeCount > 0" class="asset-repair-more">
            还有 {{ hiddenAssetRepairChangeCount }} 条
          </div>
        </div>
      </div>

      <div v-if="assetRepairPreview" class="asset-repair-report asset-repair-preview" aria-label="附件修复预览">
        <div class="asset-repair-header">
          <strong>待修复附件链接</strong>
          <span>将更新 {{ assetRepairPreview.updated }} 个，跳过 {{ assetRepairPreview.skipped }} 个</span>
          <div class="asset-repair-actions">
            <el-button size="small" native-type="button" @click="$emit('cancelAssetRepairPreview')">取消</el-button>
            <el-button
              size="small"
              type="primary"
              native-type="button"
              :disabled="assetRepairPreview.updated === 0"
              @click="$emit('confirmAssetRepair')"
            >
              确认修复
            </el-button>
          </div>
        </div>
        <div v-if="visibleAssetRepairPreviewChanges.length > 0" class="asset-repair-changes">
          <div
            v-for="change in visibleAssetRepairPreviewChanges"
            :key="`${change.sourcePath}:${change.lineNumber}:${change.before}:${change.after}`"
            class="asset-repair-change"
          >
            <span class="asset-repair-source">{{ formatSource(change.sourcePath, change.lineNumber) }}</span>
            <span class="asset-repair-diff">
              <code>{{ change.before }}</code>
              <span class="asset-repair-arrow">→</span>
              <code>{{ change.after }}</code>
            </span>
          </div>
          <div v-if="hiddenAssetRepairPreviewChangeCount > 0" class="asset-repair-more">
            还有 {{ hiddenAssetRepairPreviewChangeCount }} 条
          </div>
        </div>
      </div>

      <el-empty v-if="report.issueCount === 0" description="未发现迁移问题" :image-size="56" />

      <el-table
        v-else
        :data="report.issues"
        size="small"
        max-height="420"
        class="audit-table"
      >
        <el-table-column label="类型" width="92">
          <template #default="{ row }">
            <el-tag size="small" :type="tagType(row.type)">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="语法" width="72">
          <template #default="{ row }">
            {{ syntaxLabel(row.syntax) }}
          </template>
        </el-table-column>
        <el-table-column label="来源" min-width="190">
          <template #default="{ row }">
            <span class="source-path">{{ formatSource(row.sourcePath, row.lineNumber) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="target" label="目标" min-width="180" />
        <el-table-column prop="message" label="说明" min-width="180" />
        <el-table-column label="操作" width="240">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button v-if="row.lineNumber > 0" size="small" type="primary" text native-type="button" @click="$emit('navigate', row)">打开</el-button>
              <template v-if="row.type === 'missing-asset' && row.assetCandidates?.length > 1">
                <el-select
                  v-model="selectedAssetCandidateByIssue[issueKey(row)]"
                  class="asset-candidate-select"
                  size="small"
                  placeholder="选择附件"
                  aria-label="选择附件"
                  :teleported="false"
                >
                  <el-option
                    v-for="candidate in row.assetCandidates"
                    :key="candidate"
                    :label="compactPath(candidate)"
                    :value="candidate"
                  />
                </el-select>
                <el-button
                  size="small"
                  type="primary"
                  text
                  native-type="button"
                  :disabled="!selectedAssetCandidateByIssue[issueKey(row)]"
                  @click="previewSelectedAsset(row)"
                >
                  预览
                </el-button>
              </template>
              <span v-else-if="row.lineNumber <= 0" class="source-muted">-</span>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </template>

    <el-empty v-else description="尚未运行校验" :image-size="56" />

    <template #footer>
      <el-button
        v-if="missingNoteCount > 0"
        native-type="button"
        :loading="running"
        @click="$emit('createMissingNotes')"
      >
        创建缺失笔记 {{ missingNoteCount }}
      </el-button>
      <el-button
        v-if="missingSectionCount > 0"
        native-type="button"
        :loading="running"
        @click="$emit('createMissingSections')"
      >
        补齐标题/块 {{ missingSectionCount }}
      </el-button>
      <el-button
        v-if="repairableMissingAssetCount > 0"
        native-type="button"
        :loading="running"
        @click="$emit('previewMissingAssets')"
      >
        预览附件修复 {{ repairableMissingAssetCount }}
      </el-button>
      <el-button native-type="button" @click="visible = false">关闭</el-button>
      <el-button type="primary" native-type="button" :loading="running" @click="$emit('rerun')">重新校验</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import type { MigrationAuditAssetRepairResult, MigrationAuditIssue, MigrationAuditIssueType, MigrationAuditReport } from '@/services/migrationAudit'

const props = defineProps<{
  modelValue: boolean
  report: MigrationAuditReport | null
  running: boolean
  assetRepairPreview?: MigrationAuditAssetRepairResult | null
  assetRepairResult?: MigrationAuditAssetRepairResult | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'rerun'): void
  (e: 'createMissingNotes'): void
  (e: 'createMissingSections'): void
  (e: 'previewMissingAssets'): void
  (e: 'previewMissingAsset', issue: MigrationAuditIssue, candidatePath: string): void
  (e: 'confirmAssetRepair'): void
  (e: 'cancelAssetRepairPreview'): void
  (e: 'openAssetRepairHistory'): void
  (e: 'navigate', issue: MigrationAuditIssue): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const selectedAssetCandidateByIssue = reactive<Record<string, string>>({})

const typeLabels: Record<MigrationAuditIssueType, string> = {
  'missing-note': '笔记',
  'missing-heading': '标题',
  'missing-block': '块',
  'missing-asset': '附件',
  'unreferenced-asset': '未引用',
  'unsupported-asset': '不支持',
}

const missingNoteCount = computed(() => props.report?.summary['missing-note'] ?? 0)
const missingSectionCount = computed(() =>
  (props.report?.summary['missing-heading'] ?? 0) + (props.report?.summary['missing-block'] ?? 0)
)
const repairableMissingAssetCount = computed(() =>
  props.report?.issues.filter(issue => issue.type === 'missing-asset' && issue.assetCandidates?.length === 1).length ?? 0
)
const visibleAssetRepairChanges = computed(() => props.assetRepairResult?.changes.slice(0, 5) ?? [])
const hiddenAssetRepairChangeCount = computed(() =>
  Math.max(0, (props.assetRepairResult?.changes.length ?? 0) - visibleAssetRepairChanges.value.length)
)
const visibleAssetRepairPreviewChanges = computed(() => props.assetRepairPreview?.changes.slice(0, 5) ?? [])
const hiddenAssetRepairPreviewChangeCount = computed(() =>
  Math.max(0, (props.assetRepairPreview?.changes.length ?? 0) - visibleAssetRepairPreviewChanges.value.length)
)

const typeLabel = (type: MigrationAuditIssueType) => typeLabels[type]

const issueKey = (issue: MigrationAuditIssue) => `${issue.sourcePath}\0${issue.lineNumber}\0${issue.target}`

const syntaxLabel = (syntax: MigrationAuditIssue['syntax']) => {
  if (syntax === 'embed') return '嵌入'
  if (syntax === 'asset') return '附件'
  return '链接'
}

const previewSelectedAsset = (issue: MigrationAuditIssue) => {
  const candidatePath = selectedAssetCandidateByIssue[issueKey(issue)]
  if (!candidatePath) return
  emit('previewMissingAsset', issue, candidatePath)
}

const tagType = (type: MigrationAuditIssueType) => (
  type === 'missing-note' || type === 'missing-asset' || type === 'unsupported-asset' ? 'danger' : 'warning'
)

const compactPath = (path: string) => path.replace(/^\/workspace\/?/, '') || path
const formatSource = (path: string, lineNumber: number) => (
  lineNumber > 0 ? `${compactPath(path)}:${lineNumber}` : compactPath(path)
)
</script>

<style scoped>
.audit-loading {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--obsidian-text-muted);
}

.audit-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 16px;
  margin-bottom: 14px;
}

.summary-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--obsidian-text-muted);
  font-size: 12px;
}

.summary-item strong {
  color: var(--obsidian-text-normal);
  font-size: 18px;
}

.summary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.audit-table {
  width: 100%;
}

.asset-repair-report {
  border-top: 1px solid var(--obsidian-border, var(--el-border-color));
  border-bottom: 1px solid var(--obsidian-border, var(--el-border-color));
  padding: 10px 0;
  margin-bottom: 12px;
}

.asset-repair-header {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: var(--obsidian-text-muted);
}

.asset-repair-header strong {
  color: var(--obsidian-text-normal);
  font-size: 13px;
}

.asset-repair-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.asset-repair-changes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.asset-repair-change {
  display: grid;
  grid-template-columns: minmax(130px, 0.7fr) minmax(0, 1.8fr);
  gap: 10px;
  align-items: start;
  font-size: 12px;
}

.asset-repair-source {
  color: var(--obsidian-text-muted);
  font-family: var(--font-mono, monospace);
  word-break: break-all;
}

.asset-repair-diff {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.asset-repair-diff code {
  min-width: 0;
  color: var(--obsidian-text-normal);
  font-family: var(--font-mono, monospace);
  white-space: normal;
  overflow-wrap: anywhere;
}

.asset-repair-arrow,
.asset-repair-more {
  color: var(--obsidian-text-faint);
}

.source-path {
  color: var(--obsidian-text-muted);
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  word-break: break-all;
}

.source-muted {
  color: var(--obsidian-text-faint);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.asset-candidate-select {
  width: 128px;
}

@media (max-width: 640px) {
  .asset-repair-change {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .asset-repair-diff {
    align-items: flex-start;
    flex-direction: column;
  }

  .asset-repair-actions {
    width: 100%;
    justify-content: flex-end;
    margin-left: 0;
  }
}
</style>
