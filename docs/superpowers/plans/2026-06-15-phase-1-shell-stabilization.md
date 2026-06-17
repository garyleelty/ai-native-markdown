# Phase 1 Shell Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the app shell by resolving Phase 1 review items around header sizing, sidebar rail sizing, recent-file validation, and responsive panel visibility.

**Architecture:** Keep already-correct tab context menu and sidebar tab constants unchanged. Add a focused responsive panel composable for layout policy, and add a small recent-files service so WelcomePage and FileExplorer stop duplicating cleanup rules. Keep UI changes minimal and compatible with existing Pinia/settings state.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Element Plus, Vitest, existing `safeStorage`, existing `vaultService`.

---

## File Structure

- Create `src/services/recentFiles.ts`: shared recent-file read/write/add/validate helpers using `safeStorage` and `vaultService.readFile`.
- Create `src/services/__tests__/recentFiles.test.ts`: unit tests for recent-file cleanup, dedupe, limit, and invalid path removal.
- Create `src/composables/useResponsivePanels.ts`: computes protected desktop panel visibility from viewport width and current settings widths.
- Create `src/composables/__tests__/useResponsivePanels.test.ts`: unit tests for editor-width protection and hide priority.
- Modify `src/components/sidebar/FileExplorer.vue`: use `recentFilesService` for load/add/select cleanup.
- Modify `src/components/WelcomePage.vue`: use `recentFilesService.validateRecentFiles` instead of local duplicated validation.
- Modify `src/App.vue`: remove duplicated header height source and wire responsive panel visibility through `useResponsivePanels`.
- Modify `src/styles/app.css`: define header height through CSS variable, compact sidebar rail, preserve mobile header via same variable if needed.
- No functional change to `src/types/index.ts`, `src/stores/settings.ts`, `src/composables/useTabManagement.ts`, or `src/components/workbench/TabContextMenu.vue`; they already satisfy Phase 1 items.

---

### Task 1: Shared recent files service

**Files:**
- Create: `src/services/recentFiles.ts`
- Create: `src/services/__tests__/recentFiles.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/services/__tests__/recentFiles.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recentFilesService, RECENT_FILES_STORAGE_KEY } from '../recentFiles'
import { safeStorage } from '@/utils/security'
import { vaultService } from '@/services/vault'

vi.mock('@/services/vault', () => ({
  vaultService: {
    readFile: vi.fn(),
  },
}))

describe('recentFilesService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('normalizes and limits stored recent files', () => {
    safeStorage.set(RECENT_FILES_STORAGE_KEY, [
      { name: 'A.md', path: '/vault/A.md' },
      { name: '', path: '/vault/bad.md' },
      { name: 'MissingPath.md', path: '' },
      { name: 'B.md', path: '/vault/B.md' },
    ])

    expect(recentFilesService.loadRecentFiles()).toEqual([
      { name: 'A.md', path: '/vault/A.md' },
      { name: 'B.md', path: '/vault/B.md' },
    ])
  })

  it('adds a file to the top and removes duplicates', () => {
    safeStorage.set(RECENT_FILES_STORAGE_KEY, [
      { name: 'Old.md', path: '/vault/Old.md' },
      { name: 'Note.md', path: '/vault/Note.md' },
    ])

    const files = recentFilesService.addRecentFile('/vault/Note.md')

    expect(files).toEqual([
      { name: 'Note.md', path: '/vault/Note.md' },
      { name: 'Old.md', path: '/vault/Old.md' },
    ])
    expect(safeStorage.get(RECENT_FILES_STORAGE_KEY, [])).toEqual(files)
  })

  it('removes a file from the recent list', () => {
    safeStorage.set(RECENT_FILES_STORAGE_KEY, [
      { name: 'A.md', path: '/vault/A.md' },
      { name: 'B.md', path: '/vault/B.md' },
    ])

    const files = recentFilesService.removeRecentFile('/vault/A.md')

    expect(files).toEqual([{ name: 'B.md', path: '/vault/B.md' }])
    expect(safeStorage.get(RECENT_FILES_STORAGE_KEY, [])).toEqual(files)
  })

  it('validates stored recent files and persists only readable markdown files', async () => {
    safeStorage.set(RECENT_FILES_STORAGE_KEY, [
      { name: 'Keep.md', path: '/vault/Keep.md' },
      { name: 'Drop.md', path: '/vault/Drop.md' },
      { name: 'Keep2.md', path: '/vault/Keep2.md' },
    ])
    vi.mocked(vaultService.readFile).mockImplementation(async (path: string) => {
      if (path.includes('Drop')) throw new Error('missing')
      return '# ok'
    })

    const files = await recentFilesService.validateRecentFiles()

    expect(files).toEqual([
      { name: 'Keep.md', path: '/vault/Keep.md' },
      { name: 'Keep2.md', path: '/vault/Keep2.md' },
    ])
    expect(safeStorage.get(RECENT_FILES_STORAGE_KEY, [])).toEqual(files)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/__tests__/recentFiles.test.ts --run`

Expected: FAIL because `src/services/recentFiles.ts` does not exist.

- [ ] **Step 3: Implement shared recent files service**

Create `src/services/recentFiles.ts` with:

```ts
import { vaultService } from '@/services/vault'
import { safeStorage } from '@/utils/security'

export interface RecentFileEntry {
  name: string
  path: string
}

export const RECENT_FILES_STORAGE_KEY = 'recent_files'
const MAX_RECENT_FILES = 10

function nameFromPath(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}

function normalizeRecentFiles(value: unknown): RecentFileEntry[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const normalized: RecentFileEntry[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const path = typeof (item as RecentFileEntry).path === 'string' ? (item as RecentFileEntry).path : ''
    if (!path || seen.has(path)) continue
    const storedName = typeof (item as RecentFileEntry).name === 'string' ? (item as RecentFileEntry).name : ''
    const name = storedName || nameFromPath(path)
    if (!name) continue
    seen.add(path)
    normalized.push({ name, path })
    if (normalized.length >= MAX_RECENT_FILES) break
  }
  return normalized
}

function persist(files: RecentFileEntry[]): void {
  safeStorage.set(RECENT_FILES_STORAGE_KEY, files.slice(0, MAX_RECENT_FILES))
}

export const recentFilesService = {
  loadRecentFiles(): RecentFileEntry[] {
    return normalizeRecentFiles(safeStorage.get<RecentFileEntry[]>(RECENT_FILES_STORAGE_KEY, []))
  },

  addRecentFile(path: string): RecentFileEntry[] {
    if (!path) return this.loadRecentFiles()
    const next = normalizeRecentFiles([
      { name: nameFromPath(path), path },
      ...this.loadRecentFiles().filter(file => file.path !== path),
    ])
    persist(next)
    return next
  },

  removeRecentFile(path: string): RecentFileEntry[] {
    const next = this.loadRecentFiles().filter(file => file.path !== path)
    persist(next)
    return next
  },

  async validateRecentFiles(): Promise<RecentFileEntry[]> {
    const stored = this.loadRecentFiles()
    const valid: RecentFileEntry[] = []
    for (const file of stored) {
      try {
        await vaultService.readFile(file.path)
        valid.push(file)
      } catch {
        // Missing or unreadable files are removed from the recent list.
      }
    }
    if (valid.length < stored.length) persist(valid)
    return valid
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/services/__tests__/recentFiles.test.ts --run`

Expected: PASS.

---

### Task 2: Use recent files service in UI

**Files:**
- Modify: `src/components/sidebar/FileExplorer.vue`
- Modify: `src/components/WelcomePage.vue`

- [ ] **Step 1: Update FileExplorer imports and recent helpers**

In `src/components/sidebar/FileExplorer.vue`, add a relative import to match the existing import style in that file:

```ts
import { recentFilesService, type RecentFileEntry } from '../../services/recentFiles'
```

Change:

```ts
const recentFiles = ref<Array<{ name: string; path: string }>>([])
```

to:

```ts
const recentFiles = ref<RecentFileEntry[]>([])
```

Replace `addRecentFile` and `loadRecentFiles` with:

```ts
const addRecentFile = (path: string) => {
  recentFiles.value = recentFilesService.addRecentFile(path)
}

const loadRecentFiles = async () => {
  recentFiles.value = await recentFilesService.validateRecentFiles()
}

const handleRecentFileSelect = async (path: string) => {
  try {
    await vaultService.readFile(path)
    emit('select', path)
  } catch {
    recentFiles.value = recentFilesService.removeRecentFile(path)
    ElMessage.warning('最近文件不存在，已从列表移除')
  }
}
```

Change the recent item click handler from:

```vue
@click="emit('select', f.path)"
```

to:

```vue
@click="handleRecentFileSelect(f.path)"
```

- [ ] **Step 2: Update FileExplorer mounted call if necessary**

Find the existing `onMounted` block. If it calls `loadRecentFiles()` without `await`, change that line to:

```ts
await loadRecentFiles()
```

If the mounted callback is not async, change it to `onMounted(async () => { ... })` and keep the existing statements in their current order.

- [ ] **Step 3: Update WelcomePage to use service**

In `src/components/WelcomePage.vue`, add:

```ts
import { recentFilesService, type RecentFileEntry } from '@/services/recentFiles'
```

Change the recent files ref to:

```ts
const recentFiles = ref<RecentFileEntry[]>([])
```

Replace the local recent-file validation body in the `loadRecentFiles` function with the shared service. Keep the existing `try/finally` shape if present so loading state is always cleared:

```ts
const loadRecentFiles = async () => {
  recentFilesLoading.value = true
  try {
    recentFiles.value = (await recentFilesService.validateRecentFiles()).slice(0, 8)
  } finally {
    recentFilesLoading.value = false
  }
}
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/services/__tests__/recentFiles.test.ts --run`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

---

### Task 3: Responsive panel visibility composable

**Files:**
- Create: `src/composables/useResponsivePanels.ts`
- Create: `src/composables/__tests__/useResponsivePanels.test.ts`
- Modify: `src/App.vue`

- [ ] **Step 1: Write failing tests**

Create `src/composables/__tests__/useResponsivePanels.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import { getProtectedPanelVisibility } from '../useResponsivePanels'

describe('getProtectedPanelVisibility', () => {
  const base = {
    viewportWidth: 1800,
    sidebarVisible: true,
    sidebarWidth: 280,
    aiVisible: true,
    aiPanelWidth: 380,
    graphVisible: true,
    graphPaneWidth: 480,
    rightDockVisible: true,
    rightDockWidth: 300,
    minEditorWidth: 400,
  }

  it('keeps all panels when enough width is available', () => {
    expect(getProtectedPanelVisibility(base)).toEqual({
      ai: true,
      graph: true,
      rightDock: true,
    })
  })

  it('hides right dock first, then graph, then AI to protect editor width', () => {
    expect(getProtectedPanelVisibility({ ...base, viewportWidth: 1300 })).toEqual({
      ai: true,
      graph: false,
      rightDock: false,
    })

    expect(getProtectedPanelVisibility({ ...base, viewportWidth: 960 })).toEqual({
      ai: false,
      graph: false,
      rightDock: false,
    })
  })

  it('keeps user-hidden panels hidden', () => {
    expect(getProtectedPanelVisibility({
      ...base,
      viewportWidth: 1800,
      aiVisible: false,
      rightDockVisible: false,
    })).toEqual({
      ai: false,
      graph: true,
      rightDock: false,
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/composables/__tests__/useResponsivePanels.test.ts --run`

Expected: FAIL because `useResponsivePanels.ts` does not exist.

- [ ] **Step 3: Implement responsive panel composable**

Create `src/composables/useResponsivePanels.ts` with:

```ts
import { computed, type ComputedRef } from 'vue'

export interface ProtectedPanelInput {
  viewportWidth: number
  sidebarVisible: boolean
  sidebarWidth: number
  aiVisible: boolean
  aiPanelWidth: number
  graphVisible: boolean
  graphPaneWidth: number
  rightDockVisible: boolean
  rightDockWidth: number
  minEditorWidth?: number
}

export interface ProtectedPanelVisibility {
  ai: boolean
  graph: boolean
  rightDock: boolean
}

const DEFAULT_MIN_EDITOR_WIDTH = 400
const SHELL_PADDING_ALLOWANCE = 24

export function getProtectedPanelVisibility(input: ProtectedPanelInput): ProtectedPanelVisibility {
  const minEditorWidth = input.minEditorWidth ?? DEFAULT_MIN_EDITOR_WIDTH
  const visible = {
    ai: input.aiVisible,
    graph: input.graphVisible,
    rightDock: input.rightDockVisible,
  }

  const usedWidth = () => {
    return SHELL_PADDING_ALLOWANCE
      + (input.sidebarVisible ? input.sidebarWidth : 0)
      + (visible.ai ? input.aiPanelWidth : 0)
      + (visible.graph ? input.graphPaneWidth : 0)
      + (visible.rightDock ? input.rightDockWidth : 0)
  }

  const editorWidth = () => input.viewportWidth - usedWidth()

  const hideOrder: Array<keyof ProtectedPanelVisibility> = ['rightDock', 'graph', 'ai']
  for (const key of hideOrder) {
    if (editorWidth() >= minEditorWidth) break
    visible[key] = false
  }

  return visible
}

export function useResponsivePanels(input: {
  viewportWidth: () => number
  isNarrowViewport: () => boolean
  sidebarVisible: () => boolean
  sidebarWidth: () => number
  aiVisible: () => boolean
  aiPanelWidth: () => number
  graphVisible: () => boolean
  graphPaneWidth: () => number
  rightDockVisible: () => boolean
  rightDockWidth: () => number
  minEditorWidth?: number
}): {
  protectedPanels: ComputedRef<ProtectedPanelVisibility>
} {
  const protectedPanels = computed(() => {
    if (input.isNarrowViewport()) {
      return {
        ai: input.aiVisible(),
        graph: input.graphVisible(),
        rightDock: input.rightDockVisible(),
      }
    }
    return getProtectedPanelVisibility({
      viewportWidth: input.viewportWidth(),
      sidebarVisible: input.sidebarVisible(),
      sidebarWidth: input.sidebarWidth(),
      aiVisible: input.aiVisible(),
      aiPanelWidth: input.aiPanelWidth(),
      graphVisible: input.graphVisible(),
      graphPaneWidth: input.graphPaneWidth(),
      rightDockVisible: input.rightDockVisible(),
      rightDockWidth: input.rightDockWidth(),
      minEditorWidth: input.minEditorWidth,
    })
  })

  return { protectedPanels }
}
```

- [ ] **Step 4: Wire App.vue to the composable**

In `src/App.vue`, import:

```ts
import { useResponsivePanels } from './composables/useResponsivePanels'
```

Find the existing `showDesktopAIPanel`, `showDesktopGraphPane`, and `showDesktopRightDock` computed values. Replace them with composable-backed values, preserving the existing guards for open tabs, primary file workspace, and graph/right-dock mutual exclusion:

```ts
const { protectedPanels } = useResponsivePanels({
  viewportWidth: () => viewportWidth.value,
  isNarrowViewport: () => isNarrowViewport.value,
  sidebarVisible: () => sidebarVisible.value,
  sidebarWidth: () => settingsStore.sidebarWidth,
  aiVisible: () => settingsStore.showAIPanel,
  aiPanelWidth: () => settingsStore.aiPanelWidth,
  graphVisible: () => settingsStore.showGraphPane,
  graphPaneWidth: () => settingsStore.graphPaneWidth,
  rightDockVisible: () => settingsStore.showRightDock,
  rightDockWidth: () => settingsStore.rightDockWidth,
  minEditorWidth: 400,
})

const showDesktopAIPanel = computed(() => !isNarrowViewport.value && protectedPanels.value.ai)
const showDesktopGraphPane = computed(() =>
  !isNarrowViewport.value &&
  protectedPanels.value.graph &&
  editorStore.openTabs.length > 0 &&
  isPrimaryFileWorkspaceVisible.value
)
const showDesktopRightDock = computed(() =>
  !isNarrowViewport.value &&
  protectedPanels.value.rightDock &&
  editorStore.openTabs.length > 0 &&
  isPrimaryFileWorkspaceVisible.value &&
  (!showDesktopGraphPane.value || viewportWidth.value >= 1500)
)
```

If `showDesktopAIPanel` already exists, update only its computed body to use `protectedPanels.value.ai`.

Also update the desktop AI panel template condition from:

```vue
v-if="settingsStore.showAIPanel && !isNarrowViewport"
```

to:

```vue
v-if="showDesktopAIPanel"
```

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/composables/__tests__/useResponsivePanels.test.ts --run`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

---

### Task 4: Header and sidebar CSS cleanup

**Files:**
- Modify: `src/App.vue`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Remove duplicate Element Plus header height prop**

In `src/App.vue`, change:

```vue
<el-header class="app-header" height="44px">
```

to:

```vue
<el-header class="app-header">
```

- [ ] **Step 2: Use CSS variable for header height**

In `src/styles/app.css`, change `.app-header` height to:

```css
.app-header {
  --app-header-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--app-header-height);
  padding: 0 12px;
  background: var(--obsidian-bg-primary);
  border-bottom: 1px solid var(--obsidian-border);
  flex-shrink: 0;
  -webkit-app-region: drag;
  user-select: none;
  box-shadow: var(--shadow-sm);
  transition: var(--theme-transition);
}
```

Find the mobile breakpoint that sets `.app-header { height: 40px; }` and change it to:

```css
.app-header {
  --app-header-height: 40px;
}
```

- [ ] **Step 3: Compact sidebar rail**

In `src/styles/app.css`, update sidebar nav sizing:

```css
.sidebar-nav {
  width: 48px;
  padding: 6px 2px;
}

.sidebar-nav .el-menu-item {
  width: 42px;
  height: 42px;
  gap: 1px;
}

.sidebar-nav .nav-label {
  max-width: 40px;
  font-size: 9px;
  line-height: 11px;
}
```

Keep the existing non-sizing declarations in those rules unchanged.

- [ ] **Step 4: Run typecheck and build**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

---

### Task 5: Phase 1 verification

**Files:**
- Verify only; do not create new files unless fixing a failure.

- [ ] **Step 1: Run all unit tests**

Run: `npm test -- --run`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Manual smoke checks if a browser is available**

Check:

- Header height stays consistent on desktop and mobile widths.
- Sidebar icon rail is compact and labels do not clip badly.
- Right-clicking a tab opens the context menu at the pointer.
- `src/types/index.ts` remains the only source of `SIDEBAR_TABS`, and both `src/stores/settings.ts` and `src/components/Sidebar.vue` import it.
- `src/composables/useTabManagement.ts` still uses `MouseEvent.clientX/clientY`, and `src/components/workbench/TabContextMenu.vue` still clamps menu coordinates to the viewport.
- FileExplorer recent files remove missing files before opening.
- Opening AI, graph, and right dock together on medium widths does not collapse the editor below a usable width.

---

## Self-review Notes

- Phase 1 spec coverage: all required Phase 1 items are either implemented or explicitly verified as already satisfied.
- No placeholders are intentionally left in the task steps.
- Type names used by later tasks are defined in earlier tasks: `RecentFileEntry`, `recentFilesService`, `getProtectedPanelVisibility`, and `ProtectedPanelVisibility`.
