import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deletePathsSequential, movePathsSequential } from '../fileBatch'
import { vaultService } from '@/services/vault'

vi.mock('@/services/vault', () => ({
  vaultService: {
    deletePath: vi.fn(),
    renamePath: vi.fn(),
    readDirectory: vi.fn(),
  },
}))

describe('fileBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes paths sequentially and reports success', async () => {
    vi.mocked(vaultService.deletePath).mockResolvedValue(undefined)

    const result = await deletePathsSequential(['/a.md', '/b.md'])

    expect(result).toEqual({ succeeded: ['/a.md', '/b.md'], failed: [] })
    expect(vaultService.deletePath).toHaveBeenNthCalledWith(1, '/a.md')
    expect(vaultService.deletePath).toHaveBeenNthCalledWith(2, '/b.md')
  })

  it('continues deleting after partial failure', async () => {
    vi.mocked(vaultService.deletePath)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Permission denied'))
      .mockResolvedValueOnce(undefined)

    const result = await deletePathsSequential(['/a.md', '/b.md', '/c.md'])

    expect(result.succeeded).toEqual(['/a.md', '/c.md'])
    expect(result.failed).toEqual([{ path: '/b.md', error: 'Permission denied', errorType: 'permission' }])
  })

  it('returns empty result for empty delete input', async () => {
    await expect(deletePathsSequential([])).resolves.toEqual({ succeeded: [], failed: [] })
    expect(vaultService.deletePath).not.toHaveBeenCalled()
  })

  it('validates target directory before moving', async () => {
    vi.mocked(vaultService.readDirectory).mockRejectedValue(new Error('not found'))

    const result = await movePathsSequential(['/a.md', '/b.md'], '/missing')

    expect(result.succeeded).toEqual([])
    expect(result.failed.map(item => item.path)).toEqual(['/a.md', '/b.md'])
    expect(result.failed.every(item => item.errorType === 'missing')).toBe(true)
    expect(vaultService.renamePath).not.toHaveBeenCalled()
  })

  it('moves paths sequentially and reports partial failures', async () => {
    vi.mocked(vaultService.readDirectory).mockResolvedValue([])
    vi.mocked(vaultService.renamePath)
      .mockResolvedValueOnce({ renamedPaths: [], updatedLinkPaths: [] })
      .mockRejectedValueOnce(new Error('Already exists'))

    const result = await movePathsSequential(['/old/a.md', '/old/b.md'], '/new')

    expect(vaultService.renamePath).toHaveBeenNthCalledWith(1, '/old/a.md', '/new/a.md')
    expect(vaultService.renamePath).toHaveBeenNthCalledWith(2, '/old/b.md', '/new/b.md')
    expect(result.succeeded).toEqual(['/old/a.md'])
    expect(result.failed).toEqual([{ path: '/old/b.md', error: 'Already exists', errorType: 'conflict' }])
  })
})
