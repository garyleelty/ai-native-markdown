import { ref } from 'vue'

/**
 * ══════════════════════════════════════════════════
 * useFileSwitching — 文件切换与自动保存的竞态防护
 * ══════════════════════════════════════════════════
 *
 * 背景（issue #2「切换 md 不能瞬间切换，要点多次」）：
 * 原来的 `handleFileSelect` 是「先 await 存盘，再 await 读文件，最后才切 tab」。
 * 连续点击两个文件时，两次调用交错执行：后一次点击先完成切换，前一次点击
 * 的 `readFile` 才 resolve，于是把编辑器又切回第一个文件 —— 用户看到的就是
 * 「点了没反应，要多点几次」。
 *
 * 另外自动保存的 `watch(content) + setTimeout(2000)` 在切换文件后仍会触发，
 * 把新文件的内容写进旧路径（可用性报告 P1-6）。
 *
 * 这里用单调递增的序号（generation token）把「过期的那一次」整个丢掉：
 * 只有最后一次点击能写编辑器，只有最后一次排定的保存能真正落盘。
 */

/** 编辑器 store 的最小依赖面（Pinia 的 useEditorStore 满足它） */
export interface FileSwitchStore {
  content: string
  currentFile: string
  isModified: boolean
  addTab: (filePath: string, content: string) => void
  markSaved: () => void
}

/** 宿主环境提供的能力 */
export interface FileSwitchDeps {
  readFile: (filePath: string) => Promise<string>
  saveFile: (filePath: string, content: string) => Promise<boolean>
  setEditorContent: (content: string) => void
}

/**
 * 防抖保存器：同一时刻只认最后一次 schedule。
 *
 * 切文件会改变 `currentFile`，若旧的定时器仍然触发，就会把新文件的内容
 * 写到旧路径上。用序号比对把过期的那次整个丢掉。
 */
export function createDebouncedSave(
  delay: number,
  run: () => void | Promise<void>,
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  return {
    /** 是否还有待执行的保存 */
    get pending() {
      return timer !== null
    },

    /** 重新排定一次保存（会取消上一次未执行的） */
    schedule() {
      seq += 1
      const mine = seq
      clear()
      timer = setTimeout(() => {
        timer = null
        // 期间又有新的 schedule（例如切换了文件），本次作废
        if (mine !== seq) return
        void run()
      }, delay)
    },

    /** 取消未执行的保存（序号仍递增，作废在途回调） */
    cancel() {
      seq += 1
      clear()
    },
  }
}

export function useFileSwitching(
  store: FileSwitchStore,
  deps: FileSwitchDeps,
) {
  /** 正在切换（供 UI 显示加载态） */
  const switching = ref(false)
  /** 最近一次保存/切换的错误信息，空串表示正常 */
  const lastError = ref('')

  /** 单调递增：每次点击文件自增，只有最新的一次允许写编辑器 */
  let selectSeq = 0

  /** 把当前文件的改动落盘；成功则清除修改标记 */
  const saveCurrentFile = async (): Promise<boolean> => {
    if (!store.currentFile) return true
    const path = store.currentFile
    const ok = await deps.saveFile(path, store.content)
    if (ok) store.markSaved()
    return ok
  }

  /**
   * 切换到指定文件。
   *
   * 任意一次 await 返回后都重新校验序号：若期间用户又点了别的文件，
   * 本次结果直接丢弃，不写编辑器、不加 tab。
   *
   * @returns 'ok'    —— 本次切换生效
   *          'stale' —— 已有更新的点击，本次结果被丢弃（不应更新状态栏）
   *          'error' —— 读文件失败
   */
  const selectFile = async (
    filePath: string,
  ): Promise<'ok' | 'stale' | 'error'> => {
    selectSeq += 1
    const mine = selectSeq

    // 1) 切走前把当前文件的改动落盘（失败不阻断切换，只提示）
    if (store.isModified && store.currentFile) {
      const fromPath = store.currentFile
      const ok = await saveCurrentFile()
      if (mine !== selectSeq) return 'stale'
      lastError.value = ok ? '' : `保存 ${fromPath} 失败`
    }

    // 2) 读新文件（这一步最慢，也是竞态的来源）
    switching.value = true
    let content: string
    try {
      content = await deps.readFile(filePath)
    } catch (e) {
      if (mine !== selectSeq) return 'stale'
      switching.value = false
      lastError.value = `打开 ${filePath} 失败：${String(e)}`
      return 'error'
    }
    // 已有更新的点击，丢弃本次结果（由更晚的那次负责收尾）
    if (mine !== selectSeq) return 'stale'

    // 3) 只有最新的一次才真正切换
    store.addTab(filePath, content)
    deps.setEditorContent(content)
    switching.value = false
    return 'ok'
  }

  return { switching, lastError, selectFile, saveCurrentFile }
}
