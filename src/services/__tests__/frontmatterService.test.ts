import { describe, expect, it } from 'vitest'
import { serializeFrontmatter } from '../frontmatterService'
import { parseFrontmatter } from '@/utils/metadata'

describe('frontmatterService', () => {
  it('removes deleted properties instead of merging them back from the current document', () => {
    const content = [
      '---',
      'title: "Original"',
      'status: "draft"',
      '---',
      '# Body',
    ].join('\n')

    const next = serializeFrontmatter({ title: 'Original' }, content)
    const parsed = parseFrontmatter(next)

    expect(parsed.frontmatter).toEqual({ title: 'Original' })
    expect(next).not.toContain('status:')
    expect(parsed.body).toBe('# Body')
  })

  it('removes the frontmatter block when the last property is deleted', () => {
    const next = serializeFrontmatter({}, '---\ntitle: "Only"\n---\n# Body')

    expect(next).toBe('# Body')
  })
})
