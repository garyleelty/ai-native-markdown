import { describe, expect, it } from 'vitest'
import { inferPropertyType, inferPropertyTypes, serializeFrontmatter, mergePropertyTypes } from '../frontmatterService'
import type { PropertyTypePref } from '@/types/properties'
import { parseFrontmatter } from '@/utils/metadata'

describe('frontmatterService', () => {
  describe('inferPropertyType', () => {
    it('infers boolean from true/false values', () => {
      expect(inferPropertyType('published', true)).toBe('boolean')
      expect(inferPropertyType('published', false)).toBe('boolean')
    })

    it('infers boolean from string "true"/"false"', () => {
      expect(inferPropertyType('published', 'true')).toBe('boolean')
      expect(inferPropertyType('published', 'false')).toBe('boolean')
    })

    it('infers date from ISO date strings', () => {
      expect(inferPropertyType('created', '2024-01-15')).toBe('date')
      expect(inferPropertyType('created', '2024-01-15T10:30')).toBe('date')
    })

    it('does not infer date from non-date strings', () => {
      expect(inferPropertyType('note', 'not-a-date')).toBe('text')
    })

    it('infers url from http/https strings', () => {
      expect(inferPropertyType('website', 'https://example.com')).toBe('url')
      expect(inferPropertyType('website', 'http://example.com')).toBe('url')
    })

    it('infers email from email-like strings', () => {
      expect(inferPropertyType('contact', 'user@example.com')).toBe('email')
    })

    it('does not infer email from invalid email strings', () => {
      expect(inferPropertyType('contact', 'user@')).toBe('text')
      expect(inferPropertyType('contact', '@example.com')).toBe('text')
    })

    it('infers number from numeric values', () => {
      expect(inferPropertyType('count', 42)).toBe('number')
      expect(inferPropertyType('count', 3.14)).toBe('number')
      expect(inferPropertyType('count', 0)).toBe('number')
    })

    it('infers number from numeric strings', () => {
      expect(inferPropertyType('count', '42')).toBe('number')
      expect(inferPropertyType('count', '-7')).toBe('number')
      expect(inferPropertyType('count', '3.14')).toBe('number')
    })

    it('infers tag from array of hashtag strings', () => {
      expect(inferPropertyType('tags', ['#project', '#wip'])).toBe('tag')
    })

    it('infers tag from single hashtag string', () => {
      expect(inferPropertyType('tag', '#project')).toBe('tag')
    })

    it('infers tag from key name containing "tag"', () => {
      expect(inferPropertyType('tags', 'some value')).toBe('tag')
      expect(inferPropertyType('myTag', 'some value')).toBe('tag')
    })

    it('infers date from key name containing "date"/"created"/"updated"', () => {
      expect(inferPropertyType('dueDate', 'some value')).toBe('date')
      expect(inferPropertyType('createdAt', 'some value')).toBe('date')
      expect(inferPropertyType('updatedAt', 'some value')).toBe('date')
    })

    it('infers url from key name containing "link"/"url"', () => {
      expect(inferPropertyType('sourceLink', 'some value')).toBe('url')
      expect(inferPropertyType('profileUrl', 'some value')).toBe('url')
    })

    it('infers email from key name containing "email"', () => {
      expect(inferPropertyType('contactEmail', 'some value')).toBe('email')
    })

    it('falls back to text for unrecognized patterns', () => {
      expect(inferPropertyType('title', 'Hello World')).toBe('text')
      expect(inferPropertyType('description', 'A note')).toBe('text')
    })

    it('value-based inference takes priority over key-name inference', () => {
      expect(inferPropertyType('dateCompleted', true)).toBe('boolean')
      expect(inferPropertyType('tagCount', 5)).toBe('number')
    })
  })

  describe('inferPropertyTypes', () => {
    it('infers types for all properties in frontmatter', () => {
      const types = inferPropertyTypes({
        title: 'My Note',
        published: true,
        count: 42,
        website: 'https://example.com',
        tags: ['#project'],
      })

      expect(types.title).toBe('text')
      expect(types.published).toBe('boolean')
      expect(types.count).toBe('number')
      expect(types.website).toBe('url')
      expect(types.tags).toBe('tag')
    })

    it('returns empty object for empty frontmatter', () => {
      expect(inferPropertyTypes({})).toEqual({})
    })
  })

  describe('mergePropertyTypes', () => {
    it('merges user prefs over inferred types for existing keys', () => {
      const inferred: PropertyTypePref = { title: 'text', count: 'number', date: 'date' }
      const userPrefs: PropertyTypePref = { count: 'text', date: 'text' }

      const merged = mergePropertyTypes(inferred, userPrefs)

      expect(merged.title).toBe('text')
      expect(merged.count).toBe('text')
      expect(merged.date).toBe('text')
    })

    it('ignores user prefs for keys not present in inferred', () => {
      const inferred: PropertyTypePref = { title: 'text' }
      const userPrefs: PropertyTypePref = { unknown: 'number' }

      const merged = mergePropertyTypes(inferred, userPrefs)

      expect(merged).toEqual({ title: 'text' })
    })

    it('preserves all inferred types when user prefs is empty', () => {
      const inferred: PropertyTypePref = { title: 'text', count: 'number' }
      const merged = mergePropertyTypes(inferred, {})

      expect(merged).toEqual({ title: 'text', count: 'number' })
    })
  })

  describe('serializeFrontmatter', () => {
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

    it('skips undefined and null values', () => {
      const next = serializeFrontmatter(
        { title: 'Test', empty: undefined as any, gone: null as any },
        '# Body'
      )
      expect(next).not.toContain('empty')
      expect(next).not.toContain('gone')
      expect(next).toContain('title')
    })

    it('skips empty strings', () => {
      const next = serializeFrontmatter(
        { title: 'Test', blank: '' },
        '# Body'
      )
      expect(next).not.toContain('blank')
    })

    it('skips empty arrays', () => {
      const next = serializeFrontmatter(
        { title: 'Test', tags: [] },
        '# Body'
      )
      expect(next).not.toContain('tags')
    })

    it('serializes arrays as YAML list', () => {
      const next = serializeFrontmatter(
        { tags: ['a', 'b'] },
        '# Body'
      )
      expect(next).toContain('tags:')
      expect(next).toContain('  - "a"')
      expect(next).toContain('  - "b"')
    })

    it('serializes booleans and numbers without quotes', () => {
      const next = serializeFrontmatter(
        { published: true, count: 42 },
        '# Body'
      )
      expect(next).toContain('published: true')
      expect(next).toContain('count: 42')
    })

    it('preserves body content when adding frontmatter', () => {
      const next = serializeFrontmatter(
        { title: 'Test' },
        '# Hello\n\nWorld'
      )
      expect(next).toContain('# Hello\n\nWorld')
    })
  })
})
