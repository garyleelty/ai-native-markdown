// src/services/embedSyncService.ts
import type { EditorView } from '@codemirror/view'

export interface EmbedRef {
  view: EditorView
  pos: number
  targetPath: string
}

export interface EmbedSyncChangeEvent {
  changedPath: string
  affectedHostPaths: string[]
}

type ChangeCallback = (event: EmbedSyncChangeEvent) => void

interface DependencyOwner {
  hostPath: string
  dependencies: Set<string>
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function pathTouchesSource(changedPath: string, sourcePath: string): boolean {
  const changed = normalizePath(changedPath)
  const source = normalizePath(sourcePath)
  return changed === '/workspace' || source === changed || source.startsWith(`${changed}/`)
}

class EmbedSyncServiceImpl {
  private refs = new Map<string, Set<EmbedRef>>()
  private dependencyOwners = new Map<string, DependencyOwner>()
  private sourceToOwners = new Map<string, Set<string>>()
  private pendingChanges = new Set<string>()
  private flushHandle: number | null = null
  private changeCallbacks: ChangeCallback[] = []

  registerRef(ref: EmbedRef): void {
    if (!this.refs.has(ref.targetPath)) {
      this.refs.set(ref.targetPath, new Set())
    }
    this.refs.get(ref.targetPath)!.add(ref)
  }

  unregisterRef(ref: EmbedRef): void {
    const set = this.refs.get(ref.targetPath)
    if (set) {
      set.delete(ref)
      if (set.size === 0) this.refs.delete(ref.targetPath)
    }
  }

  notifyChange(changedPath: string): void {
    this.pendingChanges.add(normalizePath(changedPath))
    this.scheduleFlush()
  }

  onDidChange(cb: ChangeCallback): () => void {
    this.changeCallbacks.push(cb)
    return () => {
      this.changeCallbacks = this.changeCallbacks.filter(c => c !== cb)
    }
  }

  getRefsForPath(path: string): EmbedRef[] {
    return [...(this.refs.get(path) || [])]
  }

  replaceOwnerDependencies(ownerId: string, hostPath: string, dependencies: Iterable<string>): void {
    this.removeOwnerFromIndex(ownerId)
    const normalizedDependencies = new Set(
      [...dependencies]
        .map(normalizePath)
        .filter(Boolean)
    )
    this.dependencyOwners.set(ownerId, {
      hostPath: normalizePath(hostPath),
      dependencies: normalizedDependencies,
    })
    this.addOwnerToIndex(ownerId, normalizedDependencies)
  }

  addOwnerDependencies(ownerId: string, hostPath: string, dependencies: Iterable<string>): void {
    const existing = this.dependencyOwners.get(ownerId)
    const merged = new Set(existing?.dependencies ?? [])
    for (const dependency of dependencies) {
      const normalized = normalizePath(dependency)
      if (normalized) merged.add(normalized)
    }
    this.replaceOwnerDependencies(ownerId, existing?.hostPath ?? hostPath, merged)
  }

  clearOwnerDependencies(ownerId: string): void {
    this.removeOwnerFromIndex(ownerId)
    this.dependencyOwners.delete(ownerId)
  }

  getAffectedHostPaths(changedPath: string): string[] {
    const affected = new Set<string>()
    const normalizedChangedPath = normalizePath(changedPath)

    for (const [sourcePath, ownerIds] of this.sourceToOwners.entries()) {
      if (!pathTouchesSource(normalizedChangedPath, sourcePath)) continue
      for (const ownerId of ownerIds) {
        const owner = this.dependencyOwners.get(ownerId)
        if (owner) affected.add(owner.hostPath)
      }
    }

    return [...affected]
  }

  private flushChanges(): void {
    for (const path of this.pendingChanges) {
      const affectedHostPaths = this.getAffectedHostPaths(path)
      if (affectedHostPaths.length === 0) continue
      for (const cb of this.changeCallbacks) {
        cb({ changedPath: path, affectedHostPaths })
      }
    }
    this.pendingChanges.clear()
  }

  private scheduleFlush(): void {
    if (this.flushHandle !== null) return
    const flush = () => {
      this.flushChanges()
      this.flushHandle = null
    }
    if (typeof requestAnimationFrame === 'function') {
      this.flushHandle = requestAnimationFrame(flush)
      return
    }
    this.flushHandle = globalThis.setTimeout(flush, 16) as unknown as number
  }

  private cancelFlush(): void {
    if (this.flushHandle === null) return
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.flushHandle)
    } else {
      globalThis.clearTimeout(this.flushHandle)
    }
    this.flushHandle = null
  }

  private removeOwnerFromIndex(ownerId: string): void {
    const existing = this.dependencyOwners.get(ownerId)
    if (!existing) return
    for (const sourcePath of existing.dependencies) {
      const owners = this.sourceToOwners.get(sourcePath)
      if (!owners) continue
      owners.delete(ownerId)
      if (owners.size === 0) this.sourceToOwners.delete(sourcePath)
    }
  }

  private addOwnerToIndex(ownerId: string, dependencies: Set<string>): void {
    for (const sourcePath of dependencies) {
      if (!this.sourceToOwners.has(sourcePath)) {
        this.sourceToOwners.set(sourcePath, new Set())
      }
      this.sourceToOwners.get(sourcePath)!.add(ownerId)
    }
  }

  clear(): void {
    this.refs.clear()
    this.dependencyOwners.clear()
    this.sourceToOwners.clear()
    this.pendingChanges.clear()
    this.cancelFlush()
  }
}

export const embedSyncService = new EmbedSyncServiceImpl()
