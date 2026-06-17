# Phase 2 Files and Knowledge Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file favorites, multi-selection, safe batch operations, graph filters, and Phase 2 accessibility improvements while preserving existing KnowledgePanel simple/advanced behavior.

**Architecture:** Keep batch operations outside vault backends by adding small sequential helper functions around existing `vaultService.deletePath` and `vaultService.renamePath`. Use a Pinia selection store for file tree selection, a composable for favorites persistence, and pure graph filtering helpers consumed by `KnowledgeGraph.vue`.

**Tech Stack:** Vue 3, Pinia, Element Plus, Vitest, existing `safeStorage`, existing `vaultService`, existing knowledge graph types.

---

## File Structure

- Create `src/composables/useFavorites.ts` and `src/composables/__tests__/useFavorites.test.ts`.
- Create `src/stores/fileSelection.ts` and `src/stores/__tests__/fileSelection.test.ts`.
- Create `src/services/fileBatch.ts` and `src/services/__tests__/fileBatch.test.ts`.
- Create `src/utils/graphFilters.ts` and `src/utils/__tests__/graphFilters.test.ts`.
- Modify `src/components/sidebar/FileExplorer.vue` to render favorites, selection affordances, batch toolbar, aria labels, and batch actions.
- Modify `src/components/knowledge/KnowledgeGraph.vue` to render tag/directory/depth filters and apply `filterGraphData`.
- Modify `src/stores/index.ts` to export `useFileSelectionStore`.
- Modify `src/types/index.ts` only if shared filter or batch types are needed.

---

### Task 1: Favorites persistence and tests

**Files:**
- Create: `src/composables/useFavorites.ts`
- Create: `src/composables/__tests__/useFavorites.test.ts`

- [ ] **Step 1: Write tests**

Create tests covering: initially empty favorites, toggle add/remove, duplicate prevention, persistence through `safeStorage`, and `isFavorite(path)`.

Use this expected API:

```ts
const { favorites, toggleFavorite, removeFavorite, isFavorite } = useFavorites()
toggleFavorite('/workspace/A.md')
expect(favorites.value).toEqual([{ name: 'A.md', path: '/workspace/A.md' }])
expect(isFavorite('/workspace/A.md')).toBe(true)
removeFavorite('/workspace/A.md')
expect(isFavorite('/workspace/A.md')).toBe(false)
```

- [ ] **Step 2: Implement composable**

Create `useFavorites` with key `ai-markdown:favorites`, `{ name, path }` entries, 100 item max, and path-derived names.

---

### Task 2: File selection store and tests

**Files:**
- Create: `src/stores/fileSelection.ts`
- Create: `src/stores/__tests__/fileSelection.test.ts`
- Modify: `src/stores/index.ts`

- [ ] **Step 1: Write tests**

Test `setVisiblePaths`, single select, ctrl/meta toggle, shift range select, clear, selected count, and selected path array.

- [ ] **Step 2: Implement store**

Implement Pinia store with:

```ts
selectedPaths: Ref<Set<string>>
lastSelectedPath: Ref<string>
visiblePaths: Ref<string[]>
selectedPathList: ComputedRef<string[]>
selectedCount: ComputedRef<number>
isSelected(path: string): boolean
selectOnly(path: string): void
toggleSelection(path: string): void
selectRange(path: string): void
handleNodeSelection(path: string, event?: MouseEvent): void
clearSelection(): void
setVisiblePaths(paths: string[]): void
```

Range selection uses indexes in `visiblePaths` and includes both endpoints.

Use `Ref<string[]>`, not `Ref<Set<string>>`, for `selectedPaths` to avoid Vue Set mutation reactivity pitfalls. All store methods must assign a new array after changes.

`visiblePaths` represents only currently loaded and visible tree nodes. Because `FileExplorer.vue` lazily loads directory children, it must be refreshed after `loadTreeFromFS()` and after every successful directory expansion in `handleNodeClick`.

---

### Task 3: Batch file operation helpers and tests

**Files:**
- Create: `src/services/fileBatch.ts`
- Create: `src/services/__tests__/fileBatch.test.ts`

- [ ] **Step 1: Write tests**

Mock `vaultService.deletePath` and `vaultService.renamePath`. Cover all-success, partial failure, empty inputs, and sequential execution.

- [ ] **Step 2: Implement helpers**

Expose:

```ts
export type BatchFileErrorType = 'missing' | 'permission' | 'conflict' | 'cancelled' | 'unknown'
export interface BatchFileFailure { path: string; error: string; errorType: BatchFileErrorType }
export interface BatchFileResult { succeeded: string[]; failed: BatchFileFailure[] }
export async function deletePathsSequential(paths: string[]): Promise<BatchFileResult>
export async function movePathsSequential(paths: string[], targetDirectory: string): Promise<BatchFileResult>
```

`movePathsSequential` builds `newPath` as `${targetDirectory}/${basename(path)}` and uses `vaultService.renamePath`.
Before moving any files, `movePathsSequential` must validate that `targetDirectory` exists by calling `vaultService.readDirectory(targetDirectory)`. If validation fails, return all input paths as failed with `errorType: 'missing'` or `errorType: 'permission'` based on the error message.

---

### Task 4: FileExplorer integration

**Files:**
- Modify: `src/components/sidebar/FileExplorer.vue`

- [ ] **Step 1: Integrate favorites UI**

Render a favorites section above recent files when `rootPath` exists and favorites are non-empty. Each item has an open button and an unfavorite button with `aria-label`.

- [ ] **Step 2: Add node selection affordances**

Add a checkbox-style button inside each `.tree-node` with `aria-label="选择 ${node.label}"`, call `fileSelection.handleNodeSelection(data.path, $event)`, and stop propagation. Add selected styling when `fileSelection.isSelected(data.path)`.

- [ ] **Step 3: Add favorite toggle affordance**

Add a star button inside each tree node and a context-menu item `收藏/取消收藏`. Use `toggleFavorite(data.path)`.

- [ ] **Step 4: Add batch toolbar**

When `selectedCount > 0`, show toolbar: selected count, Delete, Move, Clear. Delete confirms with `ElMessageBox.confirm`; Move prompts for target directory path; both call helpers, reload tree, clear succeeded paths, and show partial-failure summary.

- [ ] **Step 5: Maintain visible path list**

Add a local helper in `FileExplorer.vue`:

```ts
const flattenLoadedTreePaths = (nodes: TreeNode[]): string[] => {
  const paths: string[] = []
  const visit = (items: TreeNode[]) => {
    for (const item of items) {
      paths.push(item.path)
      if (item.isExpanded && item.children?.length) visit(item.children)
    }
  }
  visit(nodes)
  return paths
}

const syncVisibleSelectionPaths = () => {
  fileSelection.setVisiblePaths(flattenLoadedTreePaths(treeData.value))
}
```

Call `syncVisibleSelectionPaths()` after `loadTreeFromFS()` builds `treeData`, after `expandTreeNode()` changes expansion state, and after batch operations reload the tree. This keeps Shift range selection aligned with lazy-loaded tree contents.

---

### Task 5: Graph filter helpers and tests

**Files:**
- Create: `src/utils/graphFilters.ts`
- Create: `src/utils/__tests__/graphFilters.test.ts`

- [ ] **Step 1: Write tests**

Use small graph fixtures. Cover tag filtering, directory prefix filtering, depth filtering from current file, combined filters, and empty filters returning equivalent graph.

- [ ] **Step 2: Implement helpers**

Expose:

```ts
export interface GraphFilterOptions {
  searchText?: string
  tags?: string[]
  pathPrefix?: string
  maxDepth?: number
  currentFile?: string
}
export function filterGraphData(data: KnowledgeGraphData, options: GraphFilterOptions): KnowledgeGraphData
export function getAvailableGraphTags(data: KnowledgeGraphData): string[]
export function getAvailableGraphDirectories(data: KnowledgeGraphData): string[]
```

Depth filtering uses BFS over undirected edges from `currentFile` and includes nodes with distance ≤ `maxDepth`. Text search must preserve current behavior by including matching nodes and their direct neighbors. After any filtering, recompute edge-local `linkCount`, `isOrphan`, and `stats` from the filtered nodes and edges.

---

### Task 6: KnowledgeGraph integration

**Files:**
- Modify: `src/components/knowledge/KnowledgeGraph.vue`

- [ ] **Step 1: Add filter state and computed options**

Add `selectedTag`, `selectedDirectory`, and `maxDepth` refs. Keep existing text search behavior by passing `searchQuery` to `filterGraphData`.

- [ ] **Step 2: Add filter controls**

Add accessible controls to the toolbar: tag `<select aria-label="按标签过滤图谱">`, directory `<select aria-label="按目录过滤图谱">`, depth `<input type="range" aria-label="连接深度">`, and clear filters button.

- [ ] **Step 3: Replace inline search filtering**

Use `filterGraphData(visibleGraphData.value, { searchText, tags, pathPrefix, maxDepth, currentFile })` for `filteredGraphData`.

---

### Task 7: Validation

Run:

```bash
npm test -- --run
npm run typecheck
npm run build
```

Expected: all pass.

Manual checks:

- Favorites persist and can be removed.
- Multi-select supports single, Ctrl/Cmd toggle, and Shift range.
- Batch delete and move show confirmation/summary.
- Graph tag/directory/depth filters affect visible nodes.
- Interactive file and graph controls have useful accessible names.

---

## Self-review Notes

- Covers Phase 2 favorites, multi-select, batch delete/move, KnowledgePanel tab simplification via existing work, graph filtering, debounced graph loading via existing work, and accessibility labels for new controls.
- Batch rename remains deferred as allowed by the design.
