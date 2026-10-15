import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createDebouncedSave,
  useFileSwitching,
  type FileSwitchStore,
} from '../src/composables/useFileSwitching'

/** 一个可控的假 store，行为对齐 Pinia 的 useEditorStore */
function makeStore(): FileSwitchStore & { tabPaths: string[] } {
  const store = {
    content: '',
    currentFile: '',
    isModified: false,
    tabPaths: [] as string[],
    addTab(filePath: string, content: string) {
      if (!store.tabPaths.includes(filePath)) store.tabPaths.push(filePath)
      store.currentFile = filePath
      store.content = content
      store.isModified = false
    },
    markSaved() {
      store.isModified = false
    },
  }
  return store
}

/** 可手动 resolve 的 Promise，用来精确编排交错顺序 */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useFileSwitching', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('连续点击两个文件时，只有最后一次生效（issue #2 的核心回归）', async () => {
    const store = makeStore()
    const a = deferred<string>()
    const b = deferred<string>()
    const writes: string[] = []

    const { selectFile } = useFileSwitching(store, {
      readFile: (p) => (p === 'a.md' ? a.promise : b.promise),
      saveFile: async () => true,
      setEditorContent: (c) => writes.push(c),
    })

    // 用户快速点了两次：第一次的读盘还没回来
    const first = selectFile('a.md')
    const second = selectFile('b.md')

    // 后点的 b.md 先返回 —— 它才是用户最终想要的那个文件
    b.resolve('CONTENT_B')
    expect(await second).toBe('ok')

    // 先点的 a.md 迟到返回，必须被丢弃，不能把编辑器切回去
    a.resolve('CONTENT_A')
    expect(await first).toBe('stale')

    expect(store.currentFile).toBe('b.md')
    expect(store.content).toBe('CONTENT_B')
    // 迟到的 a.md 从未写过编辑器
    expect(writes).toEqual(['CONTENT_B'])
  })

  it('切换时读盘失败返回 error 并记录可读的错误信息', async () => {
    const store = makeStore()
    const { selectFile, lastError } = useFileSwitching(store, {
      readFile: async () => {
        throw new Error('EACCES')
      },
      saveFile: async () => true,
      setEditorContent: () => {},
    })

    expect(await selectFile('secret.md')).toBe('error')
    expect(lastError.value).toContain('secret.md')
    expect(lastError.value).toContain('EACCES')
    expect(store.currentFile).toBe('')
  })

  it('切走前把当前文件的改动落盘，并按路径写入（不是新文件的内容）', async () => {
    const store = makeStore()
    store.currentFile = 'a.md'
    store.content = 'EDITED_A'
    store.isModified = true

    const saved: Array<[string, string]> = []
    const { selectFile } = useFileSwitching(store, {
      readFile: async () => 'CONTENT_B',
      saveFile: async (path, content) => {
        saved.push([path, content])
        return true
      },
      setEditorContent: () => {},
    })

    expect(await selectFile('b.md')).toBe('ok')
    expect(saved).toEqual([['a.md', 'EDITED_A']])
    expect(store.currentFile).toBe('b.md')
    expect(store.content).toBe('CONTENT_B')
  })

  it('盘存失败不阻断切换，但把错误留在 lastError', async () => {
    const store = makeStore()
    store.currentFile = 'a.md'
    store.content = 'EDITED_A'
    store.isModified = true

    const { selectFile, lastError } = useFileSwitching(store, {
      readFile: async () => 'CONTENT_B',
      saveFile: async () => false,
      setEditorContent: () => {},
    })

    expect(await selectFile('b.md')).toBe('ok')
    expect(lastError.value).toContain('a.md')
    // 仍然切过去了，用户不会卡住
    expect(store.currentFile).toBe('b.md')
  })

  it('saveCurrentFile 成功时清除修改标记', async () => {
    const store = makeStore()
    store.currentFile = 'a.md'
    store.content = 'X'
    store.isModified = true

    const { saveCurrentFile } = useFileSwitching(store, {
      readFile: async () => '',
      saveFile: async () => true,
      setEditorContent: () => {},
    })

    expect(await saveCurrentFile()).toBe(true)
    expect(store.isModified).toBe(false)
  })
})

describe('createDebouncedSave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('只执行最后一次排定的保存', async () => {
    const runs: number[] = []
    const save = createDebouncedSave(2000, () => {
      runs.push(Date.now())
    })

    save.schedule()
    vi.advanceTimersByTime(1000)
    save.schedule() // 重排，前一次的定时器应被清掉
    vi.advanceTimersByTime(2000)
    await vi.runOnlyPendingTimersAsync()

    expect(runs).toHaveLength(1)
  })

  it('cancel 后在途回调不会落盘（防「新内容写进旧路径」）', async () => {
    let ran = false
    const save = createDebouncedSave(2000, () => {
      ran = true
    })

    save.schedule()
    vi.advanceTimersByTime(1000)
    save.cancel()
    vi.advanceTimersByTime(5000)
    await vi.runOnlyPendingTimersAsync()

    expect(ran).toBe(false)
    expect(save.pending).toBe(false)
  })

  it('pending 反映是否有待执行的保存', () => {
    const save = createDebouncedSave(2000, () => {})
    expect(save.pending).toBe(false)
    save.schedule()
    expect(save.pending).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(save.pending).toBe(false)
  })
})
