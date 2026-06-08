import type { AgentContext } from './types'
import { parseFrontmatter } from '@/utils/metadata'
import { fileSystem } from '@/services/fileSystem'
import { knowledgeIndex } from '@/services/knowledgeIndex'

class ContextBuilderImpl {
  async build(options?: {
    currentFile?: { path: string; content: string }
    recentFiles?: string[]
    withRag?: boolean
  }): Promise<AgentContext> {
    let currentFile: AgentContext['currentFile'] = null

    if (options?.currentFile) {
      const { frontmatter, body } = parseFrontmatter(options.currentFile.content)
      const tags: string[] = Array.isArray(frontmatter.tags) 
        ? frontmatter.tags 
        : typeof frontmatter.tags === 'string'
        ? frontmatter.tags.split(',').map(t => t.trim())
        : []
      currentFile = {
        path: options.currentFile.path,
        content: options.currentFile.content,
        frontmatter,
        tags
      }
    }

    let backlinks: AgentContext['backlinks'] = []
    let mentions: AgentContext['mentions'] = []

    if (currentFile) {
      try {
        const refs = await knowledgeIndex.getBacklinks(currentFile.path)
        backlinks = refs.map(r => ({ path: r.filePath, context: r.excerpt }))
      } catch {
        // ignore errors
      }
      try {
        const refs = await knowledgeIndex.getUnlinkedMentions(currentFile.path)
        mentions = refs.map(r => ({ path: r.filePath, context: r.excerpt }))
      } catch {
        // ignore errors
      }
    }

    let recentFiles: string[] = []
    if (options?.recentFiles) {
      recentFiles = options.recentFiles
    } else {
      try {
        const fileRecords = await fileSystem.getAllMarkdownFiles()
        recentFiles = fileRecords.map(f => f.path).slice(0, 10)
      } catch {
        // ignore errors
      }
    }

    let ragContext: string | undefined
    if (options?.withRag && currentFile) {
      ragContext = await this.buildRagContext(currentFile)
    }

    return {
      currentFile,
      backlinks,
      mentions,
      recentFiles,
      ragContext
    }
  }

  private async buildRagContext(currentFile: { path: string; content: string }): Promise<string> {
    return '' // placeholder for RAG context
  }
}

export const contextBuilder = new ContextBuilderImpl()
