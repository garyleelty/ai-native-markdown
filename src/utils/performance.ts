/**
 * 性能监控和优化工具
 */

// 性能标记
export function mark(name: string): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name)
  }
}

// 性能测量
export function measure(name: string, startMark: string, endMark: string): void {
  if (typeof performance !== 'undefined' && performance.measure) {
    try {
      performance.measure(name, startMark, endMark)
    } catch {
      // 标记可能不存在
    }
  }
}

// 获取性能条目
export function getPerformanceEntries(name: string): PerformanceEntry[] {
  if (typeof performance !== 'undefined' && performance.getEntriesByName) {
    return performance.getEntriesByName(name)
  }
  return []
}

// 懒加载观察器
export function createLazyLoader(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px',
    threshold: 0.01,
    ...options,
  }
  return new IntersectionObserver(callback, defaultOptions)
}

// 请求空闲回调的 Promise 包装
export function requestIdleCallbackPromise(
  timeout?: number
): Promise<IdleDeadline> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(resolve, { timeout })
    } else {
      setTimeout(() => {
        resolve({
          didTimeout: true,
          timeRemaining: () => 0,
        } as IdleDeadline)
      }, timeout || 1)
    }
  })
}

// 批量处理函数，避免阻塞主线程
export async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => R,
  batchSize: number = 10,
  delayMs: number = 0
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = batch.map(processor)
    results.push(...batchResults)

    if (i + batchSize < items.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return results
}

// 内存使用监控
export function getMemoryInfo(): MemoryInfo | null {
  if ('memory' in performance && (performance as any).memory) {
    const memory = (performance as any).memory
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    }
  }
  return null
}

interface MemoryInfo {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

// 长任务监控
export function observeLongTasks(callback: (entries: PerformanceEntry[]) => void): PerformanceObserver | null {
  if (typeof PerformanceObserver === 'undefined') return null

  try {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries())
    })
    observer.observe({ entryTypes: ['longtask'] })
    return observer
  } catch {
    return null
  }
}

// LCP 监控
export function observeLCP(callback: (entry: PerformanceEntry) => void): PerformanceObserver | null {
  if (typeof PerformanceObserver === 'undefined') return null

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]
      callback(lastEntry)
    })
    observer.observe({ entryTypes: ['largest-contentful-paint'] })
    return observer
  } catch {
    return null
  }
}

// CLS 监控
export function observeCLS(callback: (value: number) => void): PerformanceObserver | null {
  if (typeof PerformanceObserver === 'undefined') return null

  let clsValue = 0

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value
        }
      }
      callback(clsValue)
    })
    observer.observe({ entryTypes: ['layout-shift'] })
    return observer
  } catch {
    return null
  }
}
