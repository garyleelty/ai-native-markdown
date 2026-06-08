import { EditorView } from '@codemirror/view'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

// Obsidian-inspired dark theme for source mode
const obsidianDarkHighlightStyle = HighlightStyle.define([
  // Headings - distinct colors per level
  { tag: tags.heading1, color: '#dcddde', fontWeight: '700', fontSize: '1.4em' },
  { tag: tags.heading2, color: '#dcddde', fontWeight: '700', fontSize: '1.3em' },
  { tag: tags.heading3, color: '#dcddde', fontWeight: '650', fontSize: '1.15em' },
  { tag: tags.heading4, color: '#c9cdd1', fontWeight: '650', fontSize: '1.05em' },
  { tag: tags.heading5, color: '#b5bac1', fontWeight: '600' },
  { tag: tags.heading6, color: '#999', fontWeight: '600' },

  // Emphasis
  { tag: tags.strong, color: '#e8eaed', fontWeight: '700' },
  { tag: tags.emphasis, color: '#e8eaed', fontStyle: 'italic' },
  { tag: tags.strikethrough, color: '#999', textDecoration: 'line-through' },

  // Links
  { tag: tags.link, color: '#7f6df2' },
  { tag: tags.url, color: '#7f6df2', textDecoration: 'underline' },

  // Code
  { tag: tags.monospace, color: '#e8b86d', backgroundColor: 'rgba(232, 184, 109, 0.08)' },
  { tag: tags.processingInstruction, color: '#c792ea' },

  // Quotes
  { tag: tags.quote, color: '#8b949e', fontStyle: 'italic' },

  // Lists
  { tag: tags.list, color: '#7f6df2' },

  // Meta (frontmatter delimiters, etc.)
  { tag: tags.meta, color: '#666' },

  // Comments (HTML comments in markdown)
  { tag: tags.comment, color: '#666', fontStyle: 'italic' },

  // Separators (horizontal rules)
  { tag: tags.contentSeparator, color: '#444' },

  // Keywords (in code blocks)
  { tag: tags.keyword, color: '#c792ea' },
  { tag: tags.string, color: '#c3e88d' },
  { tag: tags.number, color: '#f78c6c' },
  { tag: tags.bool, color: '#89ddff' },
  { tag: tags.null, color: '#89ddff' },
  { tag: tags.propertyName, color: '#82aaff' },
  { tag: tags.variableName, color: '#e8eaed' },
  { tag: tags.operator, color: '#89ddff' },
  { tag: tags.punctuation, color: '#89ddff' },
  { tag: tags.bracket, color: '#666' },
  { tag: tags.atom, color: '#f78c6c' },

  // Definition (function definitions, etc.)
  { tag: tags.definition(tags.variableName), color: '#82aaff' },
  { tag: tags.definition(tags.propertyName), color: '#82aaff' },

  // Type names
  { tag: tags.typeName, color: '#ffcb6b' },
  { tag: tags.className, color: '#ffcb6b' },
  { tag: tags.labelName, color: '#7f6df2' },

  // Special
  { tag: tags.special(tags.string), color: '#f78c6c' },
  { tag: tags.inserted, color: '#c3e88d' },
  { tag: tags.deleted, color: '#f07178' },
  { tag: tags.changed, color: '#ffcb6b' },
])

// Light theme variant
const obsidianLightHighlightStyle = HighlightStyle.define([
  // Headings
  { tag: tags.heading1, color: '#1a1a2e', fontWeight: '700', fontSize: '1.4em' },
  { tag: tags.heading2, color: '#1a1a2e', fontWeight: '700', fontSize: '1.3em' },
  { tag: tags.heading3, color: '#2d2d44', fontWeight: '650', fontSize: '1.15em' },
  { tag: tags.heading4, color: '#3d3d5c', fontWeight: '650', fontSize: '1.05em' },
  { tag: tags.heading5, color: '#4a4a6a', fontWeight: '600' },
  { tag: tags.heading6, color: '#666', fontWeight: '600' },

  // Emphasis
  { tag: tags.strong, color: '#1a1a2e', fontWeight: '700' },
  { tag: tags.emphasis, color: '#1a1a2e', fontStyle: 'italic' },
  { tag: tags.strikethrough, color: '#888', textDecoration: 'line-through' },

  // Links
  { tag: tags.link, color: '#7c3aed' },
  { tag: tags.url, color: '#7c3aed', textDecoration: 'underline' },

  // Code
  { tag: tags.monospace, color: '#b45309', backgroundColor: 'rgba(180, 83, 9, 0.06)' },
  { tag: tags.processingInstruction, color: '#7c3aed' },

  // Quotes
  { tag: tags.quote, color: '#6b7280', fontStyle: 'italic' },

  // Lists
  { tag: tags.list, color: '#7c3aed' },

  // Meta
  { tag: tags.meta, color: '#9ca3af' },

  // Comments
  { tag: tags.comment, color: '#9ca3af', fontStyle: 'italic' },

  // Separators
  { tag: tags.contentSeparator, color: '#d1d5db' },

  // Keywords
  { tag: tags.keyword, color: '#7c3aed' },
  { tag: tags.string, color: '#059669' },
  { tag: tags.number, color: '#d97706' },
  { tag: tags.bool, color: '#2563eb' },
  { tag: tags.null, color: '#2563eb' },
  { tag: tags.propertyName, color: '#2563eb' },
  { tag: tags.variableName, color: '#1a1a2e' },
  { tag: tags.operator, color: '#6b7280' },
  { tag: tags.punctuation, color: '#6b7280' },
  { tag: tags.bracket, color: '#9ca3af' },
  { tag: tags.atom, color: '#d97706' },

  { tag: tags.definition(tags.variableName), color: '#2563eb' },
  { tag: tags.definition(tags.propertyName), color: '#2563eb' },
  { tag: tags.typeName, color: '#b45309' },
  { tag: tags.className, color: '#b45309' },
  { tag: tags.labelName, color: '#7c3aed' },
  { tag: tags.special(tags.string), color: '#d97706' },
  { tag: tags.inserted, color: '#059669' },
  { tag: tags.deleted, color: '#dc2626' },
  { tag: tags.changed, color: '#b45309' },
])

export function getObsidianSyntaxHighlighting(isDark: boolean) {
  return syntaxHighlighting(isDark ? obsidianDarkHighlightStyle : obsidianLightHighlightStyle)
}
