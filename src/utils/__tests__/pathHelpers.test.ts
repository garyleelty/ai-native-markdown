import { describe, it, expect } from 'vitest'
import { isMarkdownPath, mimeTypeForPath } from '../pathHelpers'

describe('isMarkdownPath', () => {
  it('returns true for .md extension', () => {
    expect(isMarkdownPath('/notes/readme.md')).toBe(true)
  })

  it('returns true for .markdown extension', () => {
    expect(isMarkdownPath('/notes/doc.markdown')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isMarkdownPath('/notes/README.MD')).toBe(true)
    expect(isMarkdownPath('/notes/doc.Markdown')).toBe(true)
  })

  it('returns false for non-markdown extensions', () => {
    expect(isMarkdownPath('/notes/file.txt')).toBe(false)
    expect(isMarkdownPath('/notes/file.pdf')).toBe(false)
    expect(isMarkdownPath('/notes/file')).toBe(false)
  })
})

describe('mimeTypeForPath', () => {
  it('returns image/png for .png', () => {
    expect(mimeTypeForPath('/assets/photo.png')).toBe('image/png')
  })

  it('returns image/jpeg for .jpg and .jpeg', () => {
    expect(mimeTypeForPath('/assets/photo.jpg')).toBe('image/jpeg')
    expect(mimeTypeForPath('/assets/photo.jpeg')).toBe('image/jpeg')
  })

  it('returns application/pdf for .pdf', () => {
    expect(mimeTypeForPath('/docs/report.pdf')).toBe('application/pdf')
  })

  it('returns audio/mpeg for .mp3', () => {
    expect(mimeTypeForPath('/audio/clip.mp3')).toBe('audio/mpeg')
  })

  it('returns video/mp4 for .mp4', () => {
    expect(mimeTypeForPath('/video/clip.mp4')).toBe('video/mp4')
  })

  it('is case-insensitive', () => {
    expect(mimeTypeForPath('/assets/PHOTO.PNG')).toBe('image/png')
    expect(mimeTypeForPath('/docs/REPORT.PDF')).toBe('application/pdf')
  })

  it('returns application/octet-stream for unknown extensions', () => {
    expect(mimeTypeForPath('/data/file.xyz')).toBe('application/octet-stream')
    expect(mimeTypeForPath('/data/file')).toBe('application/octet-stream')
  })
})
