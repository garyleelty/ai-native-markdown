export interface MarkdownElementBase {
  type: string
  from: number
  to: number
  line: number
  content?: string
  syntax?: string
}

export interface HeadingElement extends MarkdownElementBase {
  type: 'heading'
  level: number
}

export interface BoldElement extends MarkdownElementBase {
  type: 'bold'
}

export interface ItalicElement extends MarkdownElementBase {
  type: 'italic'
}

export interface StrikethroughElement extends MarkdownElementBase {
  type: 'strikethrough'
}

export interface InlineCodeElement extends MarkdownElementBase {
  type: 'inlineCode'
}

export interface LinkElement extends MarkdownElementBase {
  type: 'link'
  text: string
  url: string
}

export interface ImageElement extends MarkdownElementBase {
  type: 'image'
  alt: string
  url: string
}

export interface BlockquoteElement extends MarkdownElementBase {
  type: 'blockquote'
}

export interface UnorderedListElement extends MarkdownElementBase {
  type: 'unorderedList'
}

export interface OrderedListElement extends MarkdownElementBase {
  type: 'orderedList'
}

export interface TaskListElement extends MarkdownElementBase {
  type: 'taskList'
  checked: boolean
}

export interface HorizontalRuleElement extends MarkdownElementBase {
  type: 'horizontalRule'
}

export interface CodeBlockElement extends MarkdownElementBase {
  type: 'codeBlock'
  lang: string
}

export interface TableElement extends MarkdownElementBase {
  type: 'table'
}

export interface WikiLinkElement extends MarkdownElementBase {
  type: 'wikiLink'
}

export interface KatexInlineElement extends MarkdownElementBase {
  type: 'katexInline'
}

export interface KatexBlockElement extends MarkdownElementBase {
  type: 'katexBlock'
}

export type MarkdownElement =
  | HeadingElement
  | BoldElement
  | ItalicElement
  | StrikethroughElement
  | InlineCodeElement
  | LinkElement
  | ImageElement
  | BlockquoteElement
  | UnorderedListElement
  | OrderedListElement
  | TaskListElement
  | HorizontalRuleElement
  | CodeBlockElement
  | TableElement
  | WikiLinkElement
  | KatexInlineElement
  | KatexBlockElement
