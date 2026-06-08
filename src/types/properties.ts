export type PropertyType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'tag'
  | 'select'
  | 'url'
  | 'email'

export interface PropertyTypePref {
  [key: string]: PropertyType // key: property name
}

export interface PropertySchema {
  type: PropertyType
  options?: string[] // for select type
  default?: any
}

export interface PropertyEditorProps {
  keyName: string
  value: any
  type: PropertyType
  options?: string[]
}
