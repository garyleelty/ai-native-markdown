import { ref, computed, watch, onUnmounted } from 'vue'
import { parseFrontmatter } from '@/utils/metadata'
import {
  inferPropertyTypes,
  serializeFrontmatter,
  mergePropertyTypes,
  type PropertyType,
  type PropertyTypePref
} from '@/services/frontmatterService'
import { knowledgeIndex } from '@/services/knowledgeIndex'

interface Props {
  getContent: () => string
  onContentChange: (newContent: string) => void
  filePath: string
}

export function useProperties(props: Props) {
  const frontmatter = ref<Record<string, any>>({})
  const propertyTypes = ref<PropertyTypePref>({})
  const loading = ref(false)
  const showAddProperty = ref(false)

  async function load() {
    loading.value = true
    try {
      const content = props.getContent()
      const { frontmatter: parsed } = parseFrontmatter(content)
      frontmatter.value = parsed

      const inferredTypes = inferPropertyTypes(parsed)

      const record = await knowledgeIndex.getByPath(props.filePath)
      const userPrefs = (record?.propertyTypes || {}) as any

      propertyTypes.value = mergePropertyTypes(inferredTypes, userPrefs)
    } catch (error) {
      console.error('[useProperties] Error loading properties:', error)
    } finally {
      loading.value = false
    }
  }

  function updateProperty(key: string, value: any) {
    frontmatter.value[key] = value
    save()
  }

  function deleteProperty(key: string) {
    delete frontmatter.value[key]
    delete propertyTypes.value[key]
    save()
  }

  async function setPropertyType(key: string, type: PropertyType) {
    propertyTypes.value[key] = type
    await knowledgeIndex.savePropertyTypePref(props.filePath, key, type)
  }

  function addProperty(key: string, value: any, type: PropertyType = 'text') {
    frontmatter.value[key] = value
    propertyTypes.value[key] = type
    save()
  }

  function save() {
    const currentContent = props.getContent()
    const newContent = serializeFrontmatter(frontmatter.value, currentContent)
    props.onContentChange(newContent)
  }

  return {
    frontmatter,
    propertyTypes,
    loading,
    showAddProperty,
    load,
    updateProperty,
    deleteProperty,
    setPropertyType,
    addProperty,
  }
}
