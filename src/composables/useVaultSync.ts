import { ref } from 'vue'
import { vaultService } from '@/services/vault'
import { embedSyncService } from '@/services/embedSyncService'
import type { useEditorStore } from '@/stores/editor'

interface UseVaultSyncOptions {
  editorStore: ReturnType<typeof useEditorStore>
  sidebarRef: () => any
  refreshMarkdownPaths: () => Promise<void>
  syncOpenTabsFromVault: (event?: any) => Promise<void>
  embedRefreshKey: { value: number }
  isAppDisposed: { value: boolean }
}

export function useVaultSync(options: UseVaultSyncOptions) {
  const {
    editorStore,
    sidebarRef,
    refreshMarkdownPaths,
    syncOpenTabsFromVault,
    embedRefreshKey,
    isAppDisposed,
  } = options

  const isSyncingVaultChange = ref(false)
  const hasPendingVaultChange = ref(false)

  const syncVaultExternalChanges = async (_event?: any) => {
    if (isAppDisposed.value || vaultService.kind !== 'electron-fs') return
    if (isSyncingVaultChange.value) {
      hasPendingVaultChange.value = true
      return
    }

    isSyncingVaultChange.value = true
    try {
      do {
        const eventForSync = hasPendingVaultChange.value ? undefined : _event
        hasPendingVaultChange.value = false
        await vaultService.refreshFromDisk().catch(() => {})
        await refreshMarkdownPaths().catch(() => {})
        await (sidebarRef()?.refreshTree?.() ?? Promise.resolve()).catch(() => {})
        await syncOpenTabsFromVault(eventForSync).catch(() => {})
        embedSyncService.notifyChange(eventForSync?.path || '/workspace')
      } while (hasPendingVaultChange.value && !isAppDisposed.value)
    } catch {
      // External filesystem changes can be partial while sync tools are writing.
    } finally {
      isSyncingVaultChange.value = false
    }
  }

  return { syncVaultExternalChanges }
}
