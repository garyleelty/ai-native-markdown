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
        await vaultService.refreshFromDisk().catch((e: unknown) => { console.debug('[useVaultSync] refreshFromDisk failed:', e) })
        await refreshMarkdownPaths().catch((e: unknown) => { console.debug('[useVaultSync] refreshMarkdownPaths failed:', e) })
        await (sidebarRef()?.refreshTree?.() ?? Promise.resolve()).catch((e: unknown) => { console.debug('[useVaultSync] refreshTree failed:', e) })
        await syncOpenTabsFromVault(eventForSync).catch((e: unknown) => { console.debug('[useVaultSync] syncOpenTabsFromVault failed:', e) })
        embedSyncService.notifyChange(eventForSync?.path || '/workspace')
      } while (hasPendingVaultChange.value && !isAppDisposed.value)
    } catch (e: unknown) {
      // External filesystem changes can be partial while sync tools are writing.
      console.debug('[useVaultSync] syncVaultExternalChanges outer catch:', e)
    } finally {
      isSyncingVaultChange.value = false
    }
  }

  return { syncVaultExternalChanges }
}
