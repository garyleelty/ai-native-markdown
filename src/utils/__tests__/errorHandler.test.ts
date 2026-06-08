// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('element-plus', () => ({
  ElMessage: {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }
}))

import { handleError, wrapAsync, ErrorLevel } from '../errorHandler'
import { ElMessage } from 'element-plus'

describe('handleError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Error 实例时提取 message', () => {
    const result = handleError(new Error('出错了'))
    expect(result.message).toBe('出错了')
    expect(result.originalError).toBeInstanceOf(Error)
  })

  it('字符串错误时使用该字符串作为 message', () => {
    const result = handleError('网络异常')
    expect(result.message).toBe('网络异常')
    expect(result.originalError).toBe('网络异常')
  })

  it('非 Error 非字符串时使用 fallbackMessage', () => {
    const result = handleError(123, '默认提示')
    expect(result.message).toBe('默认提示')
    expect(result.originalError).toBe(123)
  })

  it('非 Error 非字符串且未提供 fallbackMessage 时使用默认值', () => {
    const result = handleError(null)
    expect(result.message).toBe('操作失败')
  })

  it('返回的 AppError 包含正确的 level', () => {
    const info = handleError('msg', 'fb', ErrorLevel.INFO)
    const warning = handleError('msg', 'fb', ErrorLevel.WARNING)
    const error = handleError('msg', 'fb', ErrorLevel.ERROR)
    const silent = handleError('msg', 'fb', ErrorLevel.SILENT)

    expect(info.level).toBe(ErrorLevel.INFO)
    expect(warning.level).toBe(ErrorLevel.WARNING)
    expect(error.level).toBe(ErrorLevel.ERROR)
    expect(silent.level).toBe(ErrorLevel.SILENT)
  })

  it('INFO 级别调用 ElMessage.info', () => {
    handleError('提示信息', 'fb', ErrorLevel.INFO)
    expect(ElMessage.info).toHaveBeenCalledWith('提示信息')
    expect(ElMessage.warning).not.toHaveBeenCalled()
    expect(ElMessage.error).not.toHaveBeenCalled()
  })

  it('WARNING 级别调用 ElMessage.warning', () => {
    handleError('警告信息', 'fb', ErrorLevel.WARNING)
    expect(ElMessage.warning).toHaveBeenCalledWith('警告信息')
    expect(ElMessage.info).not.toHaveBeenCalled()
    expect(ElMessage.error).not.toHaveBeenCalled()
  })

  it('ERROR 级别（默认）调用 ElMessage.error', () => {
    handleError('错误信息')
    expect(ElMessage.error).toHaveBeenCalledWith('错误信息')
    expect(ElMessage.info).not.toHaveBeenCalled()
    expect(ElMessage.warning).not.toHaveBeenCalled()
  })

  it('SILENT 级别不调用 ElMessage，仅 console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    handleError('静默信息', 'fb', ErrorLevel.SILENT)

    expect(ElMessage.info).not.toHaveBeenCalled()
    expect(ElMessage.warning).not.toHaveBeenCalled()
    expect(ElMessage.error).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith('[silent]', '静默信息')

    warnSpy.mockRestore()
  })
})

describe('wrapAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功时返回函数结果', async () => {
    const fn = async (x: number) => x * 2
    const wrapped = wrapAsync(fn)
    const result = await wrapped(5)
    expect(result).toBe(10)
  })

  it('失败时显式返回 undefined', async () => {
    const fn = async () => { throw new Error('boom') }
    const wrapped = wrapAsync(fn)
    const result = await wrapped()
    expect(result).toBeUndefined()
  })

  it('失败时调用 handleError 并传入 fallbackMessage', async () => {
    const fn = async () => { throw new Error('原始错误') }
    const wrapped = wrapAsync(fn, '自定义回退消息')
    await wrapped()
    expect(ElMessage.error).toHaveBeenCalledWith('原始错误')
  })

  it('失败时非 Error 非字符串异常使用 fallbackMessage', async () => {
    const fn = async () => { throw 42 }
    const wrapped = wrapAsync(fn, '回退消息')
    await wrapped()
    expect(ElMessage.error).toHaveBeenCalledWith('回退消息')
  })

  it('返回类型可以是 undefined', async () => {
    const fn = async (s: string): Promise<string> => {
      if (s === 'fail') throw new Error('fail')
      return s.toUpperCase()
    }
    const wrapped = wrapAsync(fn)
    const successResult = await wrapped('hello')
    const failResult = await wrapped('fail')

    expect(successResult).toBe('HELLO')
    expect(failResult).toBeUndefined()
  })

  it('支持自定义 ErrorLevel 参数', async () => {
    const fn = async () => { throw new Error('警告级错误') }
    const wrapped = wrapAsync(fn, '回退', ErrorLevel.WARNING)
    await wrapped()
    expect(ElMessage.warning).toHaveBeenCalledWith('警告级错误')
    expect(ElMessage.error).not.toHaveBeenCalled()
  })

  it('SILENT 级别不调用 ElMessage', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fn = async () => { throw new Error('静默错误') }
    const wrapped = wrapAsync(fn, '回退', ErrorLevel.SILENT)
    const result = await wrapped()

    expect(result).toBeUndefined()
    expect(ElMessage.info).not.toHaveBeenCalled()
    expect(ElMessage.warning).not.toHaveBeenCalled()
    expect(ElMessage.error).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith('[silent]', '静默错误')

    warnSpy.mockRestore()
  })

  it('保留原函数的参数', async () => {
    const fn = async (a: number, b: string, c: boolean) => `${a}-${b}-${c}`
    const wrapped = wrapAsync(fn)
    const result = await wrapped(1, 'test', true)
    expect(result).toBe('1-test-true')
  })
})
