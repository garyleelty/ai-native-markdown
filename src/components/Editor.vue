<template>
  <div class="editor-wrapper">
    <div class="editor-toolbar">
      <div class="toolbar-inner" ref="toolbarInnerRef">
        <div class="toolbar-scroll-area">
          <el-button-group>
            <el-tooltip content="撤销 (Ctrl+Z)" placement="bottom">
              <el-button :icon="RefreshLeft" native-type="button" aria-label="撤销" @click="handleUndo" />
            </el-tooltip>
            <el-tooltip content="重做 (Ctrl+Shift+Z)" placement="bottom">
              <el-button :icon="RefreshRight" native-type="button" aria-label="重做" @click="handleRedo" />
            </el-tooltip>
            <el-tooltip content="保存 (Ctrl+S)" placement="bottom">
              <el-button :icon="FolderChecked" native-type="button" aria-label="保存" @click="handleSave" />
            </el-tooltip>
          </el-button-group>

          <el-divider direction="vertical" />

          <el-button-group>
            <el-tooltip content="粗体 (Ctrl+B)" placement="bottom">
              <el-button :icon="EditPen" native-type="button" aria-label="加粗" @click="wrapSelection('**', '**')" />
            </el-tooltip>
            <el-tooltip content="斜体 (Ctrl+I)" placement="bottom">
              <el-button native-type="button" aria-label="斜体" @click="wrapSelection('*', '*')">
                <template #icon>
                  <span style="font-style: italic; font-weight: 600;">I</span>
                </template>
              </el-button>
            </el-tooltip>
          </el-button-group>

          <el-divider direction="vertical" />

          <el-button-group>
            <el-tooltip content="行内代码" placement="bottom">
              <el-button :icon="DocumentCopy" native-type="button" aria-label="行内代码" @click="wrapSelection('`', '`')" />
            </el-tooltip>
            <el-tooltip content="代码块" placement="bottom">
              <el-button :icon="Monitor" native-type="button" aria-label="代码块" @click="wrapSelection('```\n', '\n```')" />
            </el-tooltip>
          </el-button-group>

          <el-divider direction="vertical" />

          <el-tooltip content="链接 (Ctrl+K)" placement="bottom">
            <el-button :icon="Link" native-type="button" aria-label="链接" @click="insertLink" />
          </el-tooltip>

          <el-divider direction="vertical" />

          <el-button-group>
            <el-tooltip content="无序列表" placement="bottom">
              <el-button native-type="button" aria-label="无序列表" @click="insertUnorderedList">
                <template #icon>
                  <el-icon><List /></el-icon>
                </template>
              </el-button>
            </el-tooltip>
            <el-tooltip content="有序列表" placement="bottom">
              <el-button native-type="button" aria-label="有序列表" @click="insertOrderedList">
                <template #icon>
                  <span style="font-weight: 700; font-size: 12px;">1.</span>
                </template>
              </el-button>
            </el-tooltip>
          </el-button-group>

          <el-divider direction="vertical" />

          <el-tooltip :content="props.livePreview ? '源码模式' : '实时预览'" placement="bottom">
            <el-button
              :type="props.livePreview ? 'primary' : 'default'"
              native-type="button"
              :icon="props.livePreview ? View : EditPen"
              aria-label="实时预览"
              @click="toggleLivePreview"
            />
          </el-tooltip>

          <el-divider direction="vertical" />

          <el-dropdown trigger="click" placement="bottom-end" class="toolbar-more-dropdown">
            <el-button native-type="button" aria-label="更多编辑操作">
              更多
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu class="toolbar-more-menu">
                <el-dropdown-item>
                  <el-dropdown placement="right-start" trigger="hover" @command="(cmd: string) => insertLine(cmd)">
                    <span class="submenu-trigger">
                      <span class="menu-action-icon">H</span>
                      标题
                      <el-icon class="el-icon--right"><ArrowRight /></el-icon>
                    </span>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="# ">H1 一级标题</el-dropdown-item>
                        <el-dropdown-item command="## ">H2 二级标题</el-dropdown-item>
                        <el-dropdown-item command="### ">H3 三级标题</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </el-dropdown-item>
                <el-dropdown-item @click="wrapSelection('~~', '~~')">
                  <span class="menu-action-icon strike-icon">S</span>
                  删除线
                </el-dropdown-item>
                <el-dropdown-item @click="wrapSelection('> ', '')">
                  <el-icon><ChatDotRound /></el-icon>
                  引用
                </el-dropdown-item>
                <el-dropdown-item @click="insertImage">
                  <el-icon><Picture /></el-icon>
                  图片
                </el-dropdown-item>
                <el-dropdown-item @click="insertTaskList">
                  <el-icon><Finished /></el-icon>
                  任务列表
                </el-dropdown-item>
                <el-dropdown-item divided>
                  <el-dropdown placement="right-start" trigger="hover">
                    <span class="submenu-trigger">
                      <el-icon><Setting /></el-icon>
                      更多设置
                      <el-icon class="el-icon--right"><ArrowRight /></el-icon>
                    </span>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="toggleWordWrap">
                          <el-icon><ScaleToOriginal /></el-icon>
                          {{ wordWrap ? '关闭自动换行' : '开启自动换行' }}
                        </el-dropdown-item>
                        <el-dropdown-item @click="toggleGhostText">
                          <el-icon><MagicStick /></el-icon>
                          {{ settingsStore.ghostTextConfig.enabled ? '关闭智能补全' : '开启智能补全' }}
                        </el-dropdown-item>
                        <el-dropdown-item class="voice-menu-item">
                          <VoiceInputButton mode="toggle" @result="insertText" />
                          <span>语音输入</span>
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <div v-if="toolbarScrollRight" class="toolbar-scroll-fade" />
    </div>
      <FindReplace ref="findReplaceRef" :visible="showFindReplace" @update:visible="showFindReplace = $event" @close="showFindReplace = false" @find="handleFind" @replace="handleReplace" @replace-all="handleReplaceAll" />
    <div class="editor-container" ref="editorContainer"></div>
    <div
      v-if="completionContext"
      class="wiki-link-completion"
      role="listbox"
      aria-label="Wiki Link 建议"
    >
      <div class="completion-header">Wiki Link 建议</div>
      <template v-if="wikiLinkSuggestions.length > 0">
        <button
          v-for="(suggestion, index) in wikiLinkSuggestions"
          :key="suggestion.id"
          class="completion-item"
          :class="{ selected: index === selectedCompletionIndex }"
          type="button"
          role="option"
          :aria-selected="index === selectedCompletionIndex"
          @mouseenter="selectedCompletionIndex = index"
          @mousedown.prevent="applyWikiLinkSuggestion(suggestion)"
        >
          <span class="completion-title">{{ suggestion.title }}</span>
          <span class="completion-path">{{ suggestion.meta }}</span>
        </button>
      </template>
      <div v-else class="completion-empty">{{ completionEmptyText }}</div>
    </div>
    <div
      v-if="tagCompletionContext"
      class="wiki-link-completion tag-completion"
      role="listbox"
      aria-label="标签建议"
    >
      <div class="completion-header">标签建议</div>
      <template v-if="tagSuggestions.length > 0">
        <button
          v-for="(suggestion, index) in tagSuggestions"
          :key="suggestion.tag"
          class="completion-item"
          :class="{ selected: index === tagSelectedIndex }"
          type="button"
          role="option"
          :aria-selected="index === tagSelectedIndex"
          @mouseenter="tagSelectedIndex = index"
          @mousedown.prevent="applyTagSuggestion(suggestion)"
        >
          <span class="completion-title">#{{ suggestion.tag }}</span>
          <span class="completion-path">{{ suggestion.count }} 篇笔记</span>
        </button>
      </template>
      <div v-else class="completion-empty">没有匹配标签</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, onUnmounted, watch, shallowRef, nextTick } from 'vue'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { getObsidianSyntaxHighlighting } from '@/extensions/obsidianTheme'
import { basicSetup } from 'codemirror'
import { indentWithTab } from '@codemirror/commands'
import { useSettingsStore } from '@/stores/settings'
import { ghostTextPlugin, updateGhostTextConfig, ghostTextKeymap, clearGhostText } from '@/extensions/ghost-text/ghostTextPlugin'
import { inlineEditPlugin, inlineEditKeymap } from '@/extensions/inline-edit/inlineEditPlugin'
import { dropHandlerExtension } from '@/extensions/multimodal/dropHandler'
import { aiActionPlugin, aiActionKeymap } from '@/extensions/ai-actions/aiActionPlugin'
import '@/extensions/ai-actions/styles.css'
import { createLivePreviewPlugin } from '@/extensions/live-preview/livePreviewPlugin'
import '@/extensions/live-preview/styles.css'
import { smartPasteExtension } from '@/extensions/smart-paste/pasteHandler'
import { slashCommandExtension } from '@/extensions/slash-command/slashCommandPlugin'
import '@/extensions/slash-command/styles.css'
import { embedSyncService } from '@/services/embedSyncService'
import { useWikiLinkCompletion } from '@/composables/useWikiLinkCompletion'
import { useTagCompletion } from '@/composables/useTagCompletion'
import { useFindReplace } from '@/composables/useFindReplace'
import { useEditorToolbar } from '@/composables/useEditorToolbar'
import FindReplace from './editor/FindReplace.vue'
import VoiceInputButton from '@/components/ui/VoiceInputButton.vue'
import {
  EditPen,
  DocumentCopy,
  Monitor,
  ChatDotRound,
  List,
  Finished,
  Link,
  Picture,
  View,
  ScaleToOriginal,
  MagicStick,
  RefreshLeft,
  RefreshRight,
  FolderChecked,
  Check,
  ArrowDown,
  ArrowRight,
  Setting
} from '@element-plus/icons-vue'

interface Props {
  modelValue?: string
  markdownPaths?: string[]
  currentFile?: string
  readMarkdownFile?: (path: string) => Promise<string>
  embedRefreshKey?: number
  livePreview?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  markdownPaths: () => [],
  currentFile: '',
  embedRefreshKey: 0,
  livePreview: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  update: [content: string]
  'cursor-change': [line: number]
  'selection-change': [text: string]
  'embed-navigate': [target: string]
  'toggle-live-preview': []
  save: []
}>()

const settingsStore = useSettingsStore()

const editorContainer = ref<HTMLElement>()
const editorView = shallowRef<EditorView>()
const toolbarInnerRef = ref<HTMLElement>()
const toolbarScrollRight = ref(false)
const showFindReplace = ref(false)
const findReplaceRef = ref()
const readOnlyCompartment = new Compartment()
const livePreviewCompartment = new Compartment()
const ghostTextCompartment = new Compartment()
const inlineEditCompartment = new Compartment()
const themeCompartment = new Compartment()
const syntaxHighlightCompartment = new Compartment()
const lineWrappingCompartment = new Compartment()
const smartPasteCompartment = new Compartment()
const fontStyleCompartment = new Compartment()
let ignoreNextUpdate = false

const aiActionCompartment = new Compartment()
const activeHeadingFrom = ref(-1)

const createLivePreviewExtensions = () => [
  createLivePreviewPlugin({
    currentFile: () => props.currentFile,
    onEmbedNavigate: (target) => emit('embed-navigate', target),
    dependencyOwnerId: () => props.currentFile ? `editor:${props.currentFile}` : '',
    embedRefreshKey: () => props.embedRefreshKey,
  })
]

function refreshLivePreviewEmbeds(): void {
  if (!editorView.value || !settingsStore.livePreview) return
  editorView.value.dispatch({
    effects: livePreviewCompartment.reconfigure(createLivePreviewExtensions())
  })
}

const {
  completionContext,
  selectedCompletionIndex,
  wikiLinkSuggestions,
  completionEmptyText,
  wikiLinkCompletionKeymap,
  refreshWikiLinkCompletion,
  closeWikiLinkCompletion,
  handleWikiLinkCompletionKeydown,
  applyWikiLinkSuggestion,
} = useWikiLinkCompletion({
  editorView: () => editorView.value,
  markdownPaths: () => props.markdownPaths,
  currentFile: () => props.currentFile,
  readMarkdownFile: props.readMarkdownFile,
})

const {
  completionContext: tagCompletionContext,
  selectedCompletionIndex: tagSelectedIndex,
  tagSuggestions,
  tagCompletionKeymap,
  refreshTagCompletion,
  closeTagCompletion,
  handleTagCompletionKeydown,
  applyTagSuggestion,
  unsubscribe: unsubscribeTagCompletion,
} = useTagCompletion({
  editorView: () => editorView.value,
})

const {
  handleFind,
  handleReplace,
  handleReplaceAll,
} = useFindReplace({
  editorView: () => editorView.value,
  findReplaceRef: () => findReplaceRef.value,
})

const {
  wordWrap,
  wrapSelection,
  insertLine,
  insertLink,
  insertImage,
  insertUnorderedList,
  insertOrderedList,
  insertTaskList,
  insertText,
  setContent,
  getSelectedText,
  scrollToLine,
  toggleWordWrap,
  toggleLivePreview,
  toggleGhostText,
  handleUndo,
  handleRedo,
} = useEditorToolbar({
  editorView: () => editorView.value,
  livePreview: () => props.livePreview,
  currentFile: () => props.currentFile,
  settingsStore: () => settingsStore,
  emit,
})

const handleSave = () => {
  emit('save')
}

const createEditor = () => {
  if (!editorContainer.value) return

  const startState = EditorState.create({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      markdown(),
      themeCompartment.of(oneDark),
      syntaxHighlightCompartment.of(getObsidianSyntaxHighlighting(settingsStore.isDark)),
      wikiLinkCompletionKeymap,
      tagCompletionKeymap,
      keymap.of([indentWithTab]),
      readOnlyCompartment.of(EditorState.readOnly.of(false)),
      livePreviewCompartment.of(props.livePreview ? createLivePreviewExtensions() : []),
      aiActionCompartment.of(settingsStore.enableAIActions ? [aiActionPlugin, aiActionKeymap] : []),
      smartPasteCompartment.of(settingsStore.enableSmartPaste ? [smartPasteExtension] : []),
      slashCommandExtension,
      ghostTextCompartment.of(settingsStore.ghostTextConfig.enabled ? [ghostTextPlugin, ghostTextKeymap] : []),
      inlineEditCompartment.of(settingsStore.enableInlineEdit ? [inlineEditPlugin, inlineEditKeymap] : []),
      dropHandlerExtension,
      lineWrappingCompartment.of(settingsStore.wordWrap ? EditorView.lineWrapping : []),
      placeholder('开始写作...'),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const content = update.state.doc.toString()
          ignoreNextUpdate = true
          emit('update:modelValue', content)
          emit('update', content)
        }
        if (update.selectionSet || update.docChanged) {
          const pos = update.state.selection.main.head
          const line = update.state.doc.lineAt(pos).number
          emit('cursor-change', line)
          const { from, to } = update.state.selection.main
          const selectedText = update.state.sliceDoc(from, to)
          emit('selection-change', selectedText)
        }
        if (update.selectionSet || update.docChanged) {
          refreshWikiLinkCompletion(update.view)
          refreshTagCompletion(update.view)
        }
      }),
      EditorView.domEventHandlers({
        keydown(event, view) {
          if (handleWikiLinkCompletionKeydown(event, view)) return true
          if (handleTagCompletionKeydown(event, view)) return true
          return false
        },
        scroll(_event, view) {
          const scroller = view.scrollDOM
          const scrollTop = scroller.scrollTop
          const pos = view.posAtCoords({ x: 100, y: scrollTop + 50 })
          if (pos === null) return false
          const doc = view.state.doc
          let currentLine = doc.lineAt(pos)
          for (let i = 0; i < 20; i++) {
            const match = currentLine.text.match(/^(#{1,6})\s+(.+)/)
            if (match) {
              activeHeadingFrom.value = currentLine.from
              return false
            }
            if (currentLine.number <= 1) break
            currentLine = doc.line(currentLine.number - 1)
          }
          activeHeadingFrom.value = -1
          return false
        }
      }),
      fontStyleCompartment.of(EditorView.theme({
        '&': {
          height: '100%',
          fontSize: `${settingsStore.editorFontSize}px`,
          fontFamily: settingsStore.editorFontFamily,
          lineHeight: `${settingsStore.editorLineHeight}`
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: settingsStore.editorFontFamily
        },
        '&.cm-focused': {
          outline: 'none'
        }
      }))
    ]
  })

  editorView.value = new EditorView({
    state: startState,
    parent: editorContainer.value
  })

  updateGhostTextConfig(settingsStore.ghostTextConfig)
}

watch(() => props.modelValue, (newValue) => {
  if (ignoreNextUpdate) {
    ignoreNextUpdate = false
    return
  }
  if (editorView.value && newValue !== editorView.value.state.doc.toString()) {
    editorView.value.dispatch({
      changes: {
        from: 0,
        to: editorView.value.state.doc.length,
        insert: newValue
      }
    })
  }
})

watch(() => props.currentFile, (_currentFile, previousFile) => {
  if (previousFile) embedSyncService.clearOwnerDependencies(`editor:${previousFile}`)
  refreshLivePreviewEmbeds()
})

watch(() => props.embedRefreshKey, () => {
  refreshLivePreviewEmbeds()
})

watch(() => props.livePreview, (enabled) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: livePreviewCompartment.reconfigure(
        enabled ? createLivePreviewExtensions() : []
      )
    })
  }
})

watch(() => settingsStore.isDark, (isDark) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: [
        themeCompartment.reconfigure(isDark ? oneDark : []),
        syntaxHighlightCompartment.reconfigure(getObsidianSyntaxHighlighting(isDark)),
      ]
    })
  }
})

watch(() => settingsStore.ghostTextConfig, (config) => {
  updateGhostTextConfig(config)
  if (editorView.value) {
    editorView.value.dispatch({
      effects: ghostTextCompartment.reconfigure(
        config.enabled ? [ghostTextPlugin, ghostTextKeymap] : []
      )
    })
  }
}, { deep: true })

watch(() => settingsStore.enableInlineEdit, (enabled) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: inlineEditCompartment.reconfigure(
        enabled ? [inlineEditPlugin, inlineEditKeymap] : []
      )
    })
  }
})

watch(() => settingsStore.enableAIActions, (enabled) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: aiActionCompartment.reconfigure(
        enabled ? [aiActionPlugin, aiActionKeymap] : []
      )
    })
  }
})

watch(() => settingsStore.enableSmartPaste, (enabled) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: smartPasteCompartment.reconfigure(
        enabled ? [smartPasteExtension] : []
      )
    })
  }
})

watch(wordWrap, (enabled) => {
  if (editorView.value) {
    editorView.value.dispatch({
      effects: lineWrappingCompartment.reconfigure(enabled ? EditorView.lineWrapping : [])
    })
  }
})

watch(
  () => [settingsStore.editorFontSize, settingsStore.editorLineHeight, settingsStore.editorFontFamily],
  () => {
    if (editorView.value) {
      editorView.value.dispatch({
        effects: fontStyleCompartment.reconfigure(EditorView.theme({
          '&': {
            height: '100%',
            fontSize: `${settingsStore.editorFontSize}px`,
            fontFamily: settingsStore.editorFontFamily,
            lineHeight: `${settingsStore.editorLineHeight}`
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: settingsStore.editorFontFamily
          },
          '&.cm-focused': {
            outline: 'none'
          }
        }))
      })
    }
  }
)

defineExpose({
  setContent,
  insertText,
  getSelectedText,
  wrapSelection,
  insertLink,
  scrollToLine,
  activeHeadingFrom
})

onMounted(() => {
  createEditor()

  const checkToolbarScroll = () => {
    if (!toolbarInnerRef.value) return
    const el = toolbarInnerRef.value
    toolbarScrollRight.value = el.scrollWidth > el.clientWidth + 4 && el.scrollLeft < el.scrollWidth - el.clientWidth - 4
  }

  const handleToolbarScroll = () => {
    requestAnimationFrame(checkToolbarScroll)
  }

  if (toolbarInnerRef.value) {
    toolbarInnerRef.value.addEventListener('scroll', handleToolbarScroll, { passive: true })
    checkToolbarScroll()
    const resizeObserver = new ResizeObserver(checkToolbarScroll)
    resizeObserver.observe(toolbarInnerRef.value)
    onUnmounted(() => {
      resizeObserver.disconnect()
      toolbarInnerRef.value?.removeEventListener('scroll', handleToolbarScroll)
    })
  }

  const handleEditorKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && (completionContext.value || tagCompletionContext.value)) {
      e.preventDefault()
      if (completionContext.value) closeWikiLinkCompletion()
      if (tagCompletionContext.value) closeTagCompletion()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault()
      showFindReplace.value = true
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
      e.preventDefault()
      showFindReplace.value = true
      nextTick(() => {
        findReplaceRef.value?.openReplace?.()
      })
    }
  }
  document.addEventListener('keydown', handleEditorKeyDown, true)
  onUnmounted(() => {
    document.removeEventListener('keydown', handleEditorKeyDown, true)
  })
})

onBeforeUnmount(() => {
  if (props.currentFile) embedSyncService.clearOwnerDependencies(`editor:${props.currentFile}`)
  unsubscribeTagCompletion()
  clearGhostText()
  if (editorView.value) {
    editorView.value.destroy()
  }
})
</script>

<style scoped>
.editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--obsidian-bg-primary);
  position: relative;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  height: 36px;
  min-height: 36px;
  padding: 0 8px;
  background: var(--obsidian-bg-secondary);
  border-bottom: 1px solid var(--obsidian-border);
  overflow: hidden;
  box-shadow: none;
  position: relative;
}

.toolbar-inner {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  position: relative;
}

.toolbar-scroll-fade {
  position: absolute;
  top: 0;
  right: 0;
  width: 32px;
  height: 100%;
  background: linear-gradient(to right, transparent, var(--obsidian-bg-secondary));
  pointer-events: none;
  z-index: 1;
}

.toolbar-inner::-webkit-scrollbar {
  display: none;
}

.toolbar-inner :deep(.el-button-group) {
  display: inline-flex;
  flex: 0 0 auto;
}

.toolbar-inner :deep(.el-button) {
  height: 28px;
  min-height: 28px;
  padding: 0 8px;
  border-radius: 4px;
  background: transparent;
  color: var(--obsidian-text-muted);
  border: none;
  box-shadow: none;
}
.toolbar-inner :deep(.el-button:hover) {
  background: var(--obsidian-bg-hover);
  color: var(--obsidian-text-normal);
}
.toolbar-inner :deep(.el-button--primary) {
  background: var(--obsidian-accent-soft);
  color: var(--obsidian-accent);
  border: none;
}
.toolbar-inner :deep(.el-button--primary:hover) {
  background: var(--obsidian-accent-soft);
  color: var(--obsidian-accent);
}

.toolbar-scroll-area {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.toolbar-more-dropdown {
  flex: 0 0 auto;
}

:global(.toolbar-more-menu .el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 150px;
}

:global(.toolbar-more-menu .el-dropdown-menu__item .el-icon) {
  margin-right: 0;
}

:global(.toolbar-more-menu .voice-menu-item) {
  gap: 10px;
}

:global(.toolbar-more-menu .voice-menu-item .el-button) {
  width: 28px;
  height: 28px;
  min-height: 28px;
}

.menu-action-icon {
  display: inline-flex;
  width: 16px;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--obsidian-text-muted);
}

.strike-icon {
  text-decoration: line-through;
}

.submenu-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.toolbar-inner :deep(.el-divider--vertical) {
  margin: 0 4px;
  height: 16px;
  border-left: 1px solid var(--obsidian-border);
}

.editor-container {
  flex: 1;
  overflow: hidden;
}

.editor-container :deep(.cm-editor) {
  height: 100%;
  background: var(--obsidian-bg-primary);
}

.editor-container :deep(.cm-scroller) {
  font-family: var(--font-mono);
  font-size: 15px;
  line-height: 1.75;
  color: var(--obsidian-text-normal);
  padding: var(--space-4) 0;
}

.editor-container :deep(.cm-content) {
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.8;
  padding: 0 var(--space-8);
  max-width: min(720px, 100% - 32px);
  margin: 0 auto;
  caret-color: var(--obsidian-accent);
}

.editor-container :deep(.cm-cursor) {
  border-left-color: var(--obsidian-accent);
  border-left-width: 2px;
}

.editor-container :deep(.cm-selectionBackground) {
  background: rgba(127, 109, 242, 0.2) !important;
}

.editor-container :deep(.cm-focused .cm-selectionBackground) {
  background: rgba(127, 109, 242, 0.25) !important;
}

.editor-container :deep(.cm-gutters) {
  background: var(--obsidian-bg-primary);
  border-right: 1px solid var(--obsidian-border);
  color: var(--obsidian-text-muted);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.8;
}

.editor-container :deep(.cm-activeLineGutter) {
  background: var(--obsidian-bg-hover);
  color: var(--obsidian-text-normal);
}

.editor-container :deep(.cm-activeLine) {
  background: var(--obsidian-bg-hover);
  border-radius: var(--radius-sm);
}

.editor-container :deep(.cm-foldGutter) {
  color: var(--obsidian-text-muted);
}

.editor-container :deep(.cm-placeholder) {
  color: var(--obsidian-text-muted);
  font-style: italic;
}

.wiki-link-completion {
  position: absolute;
  top: 76px;
  left: max(56px, calc((100% - 720px) / 2 + 32px));
  z-index: 30;
  width: min(360px, calc(100% - 32px));
  max-height: 284px;
  padding: 6px;
  overflow: hidden;
  background: var(--obsidian-bg-secondary);
  border: 1px solid var(--obsidian-border);
  border-radius: 8px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}

.completion-header {
  padding: 6px 8px 7px;
  color: var(--obsidian-text-muted);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.completion-item {
  display: grid;
  width: 100%;
  min-height: 44px;
  padding: 7px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--obsidian-text-normal);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.completion-item:hover,
.completion-item.selected {
  background: var(--obsidian-bg-hover);
}

.completion-item.selected {
  box-shadow: inset 2px 0 0 var(--obsidian-accent);
}

.completion-title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.completion-path {
  overflow: hidden;
  color: var(--obsidian-text-muted);
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.completion-empty {
  min-height: 44px;
  padding: 12px 8px;
  color: var(--obsidian-text-muted);
  font-size: 13px;
  line-height: 1.4;
}

@media (max-width: 640px) {
  .editor-toolbar {
    padding: 0 6px;
  }

  .editor-container :deep(.cm-content) {
    padding: 0 var(--space-4);
  }

  .editor-container :deep(.cm-scroller) {
    font-size: 14px;
  }
}

@media (min-width: 1440px) {
  .editor-container :deep(.cm-content) {
    max-width: 800px;
  }
}

@media (min-width: 1920px) {
  .editor-container :deep(.cm-content) {
    max-width: 900px;
  }
}
</style>
