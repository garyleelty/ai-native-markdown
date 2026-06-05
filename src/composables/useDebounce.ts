import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue'

type CancelableFunction<T extends (...args: any[]) => any> = ((...args: Parameters<T>) => void) & {
  cancel: () => void
}

export function useDebounce<T>(value: Ref<T>, delay: number = 300): Ref<T> {
  const debouncedValue = ref(value.value) as Ref<T>
  let timeout: ReturnType<typeof setTimeout> | null = null
  const clearPending = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  const stop = watch(
    value,
    (newValue) => {
      clearPending()
      timeout = setTimeout(() => {
        debouncedValue.value = newValue
        timeout = null
      }, delay)
    },
    { immediate: true }
  )

  if (getCurrentScope()) {
    onScopeDispose(() => {
      clearPending()
      stop()
    })
  }

  return debouncedValue
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): CancelableFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null

  const debounced = ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      timeout = null
      fn(...args)
    }, delay)
  }) as CancelableFunction<T>

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  if (getCurrentScope()) {
    onScopeDispose(debounced.cancel)
  }

  return debounced
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number = 100
): CancelableFunction<T> {
  let inThrottle = false
  let timeout: ReturnType<typeof setTimeout> | null = null

  const throttled = ((...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      timeout = setTimeout(() => {
        inThrottle = false
        timeout = null
      }, limit)
    }
  }) as CancelableFunction<T>

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    inThrottle = false
  }

  if (getCurrentScope()) {
    onScopeDispose(throttled.cancel)
  }

  return throttled
}
