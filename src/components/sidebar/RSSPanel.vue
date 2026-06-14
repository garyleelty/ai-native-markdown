<template>
  <div class="panel">
    <div class="panel-header">
      <span class="panel-title">RSS 订阅</span>
      <el-button :icon="Refresh" native-type="button" size="small" circle aria-label="刷新所有 RSS" @click="refreshAllFeeds" />
    </div>

    <el-tabs v-model="activeTab" class="rss-tabs" stretch>
      <el-tab-pane label="推荐" name="discover">
        <div class="tab-content">
          <div class="discover-header">
            <el-input
              v-model="discoverSearch"
              placeholder="搜索推荐源..."
              size="small"
              clearable
              class="discover-search"
            />
          </div>
          <div class="discover-categories">
            <el-tag
              v-for="cat in categories"
              :key="cat"
              :type="selectedCategory === cat ? '' : 'info'"
              :effect="selectedCategory === cat ? 'dark' : 'plain'"
              size="small"
              class="category-tag"
              @click="toggleCategory(cat)"
            >{{ cat }}</el-tag>
          </div>
          <div class="discover-list">
            <div v-for="preset in filteredPresets" :key="preset.url" class="discover-item">
              <div class="discover-info">
                <div class="discover-title">{{ preset.title }}</div>
                <div class="discover-desc">{{ preset.description }}</div>
              </div>
              <el-button
                size="small"
                :type="isPresetSubscribed(preset.url) ? 'info' : 'primary'"
                :disabled="isPresetSubscribed(preset.url)"
                @click="addPresetFeed(preset)"
              >
                {{ isPresetSubscribed(preset.url) ? '已订阅' : '订阅' }}
              </el-button>
            </div>
            <el-empty v-if="filteredPresets.length === 0" description="没有匹配的推荐源" />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="订阅列表" name="feeds">
        <div class="tab-content">
          <div class="feeds-header">
            <el-input
              v-model="newFeedUrl"
              placeholder="输入 RSS 源 URL"
              size="small"
              clearable
              @keyup.enter="addFeed"
              class="feed-url-input"
            />
            <el-button size="small" type="primary" @click="addFeed">添加</el-button>
          </div>
          <div class="feeds-list">
            <div v-for="feed in feeds" :key="feed.id" class="feed-item">
              <div class="feed-info">
                <div class="feed-title">{{ feed.title || '未命名源' }}</div>
                <div class="feed-url">{{ feed.url }}</div>
                <div class="feed-meta">
                  <span v-if="feed.lastFetchedAt">
                    上次更新: {{ formatDate(feed.lastFetchedAt) }}
                  </span>
                </div>
              </div>
              <div class="feed-actions">
                <el-button size="small" circle :icon="Refresh" @click="fetchFeed(feed.id)" />
                <el-button size="small" circle :icon="Edit" @click="editFeed(feed)" />
                <el-button size="small" circle :icon="Delete" type="danger" @click="deleteFeed(feed.id)" />
              </div>
            </div>
            <el-empty v-if="feeds.length === 0" description="暂无 RSS 订阅" />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="文章列表" name="articles">
        <div class="tab-content">
          <div class="articles-header">
            <el-select v-model="selectedFeedId" placeholder="选择源" clearable size="small" class="feed-select">
              <el-option value="" label="全部" />
              <el-option v-for="feed in feeds" :key="feed.id" :value="feed.id" :label="feed.title || feed.url" />
            </el-select>
            <el-button size="small" @click="fetchAllFeeds">刷新全部</el-button>
          </div>
          <div class="articles-list">
            <div v-for="article in filteredArticles" :key="article.id" class="article-item" :class="{ imported: article.isImported, unread: !article.isRead }" @click="markArticleRead(article.id)">
              <div class="article-header">
                <div class="article-title">
                  <a :href="article.link" target="_blank" rel="noopener noreferrer">{{ article.title || '无标题' }}</a>
                  <el-tag v-if="article.isImported" size="small" type="success">已导入</el-tag>
                </div>
                <div class="article-meta">
                  <span>{{ getFeedTitle(article.feedId) }}</span>
                  <span>{{ formatDate(article.pubDate) }}</span>
                  <span v-for="category in article.categories" :key="category" class="article-category">{{ category }}</span>
                </div>
              </div>
              <div class="article-description" v-html="sanitizeArticleDescription(article.description)" />
              <div class="article-actions">
                <el-button size="small" type="primary" @click="importArticle(article.id)">
                  导入为 Markdown
                </el-button>
              </div>
            </div>
            <el-empty v-if="filteredArticles.length === 0" description="暂无文章" />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="editDialogVisible" title="编辑 RSS 源" width="500px">
      <el-form :model="editingFeed" label-width="80px">
        <el-form-item label="URL">
          <el-input v-model="editingFeed.url" disabled />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="editingFeed.title" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editingFeed.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="自动导入">
          <el-switch v-model="editingFeed.autoImport" />
        </el-form-item>
        <el-form-item label="导入路径">
          <el-input v-model="editingFeed.importPath" />
        </el-form-item>
        <el-form-item label="刷新间隔(分)">
          <el-input-number v-model="editingFeed.fetchIntervalMinutes" :min="5" :max="1440" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveFeedEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Edit, Delete } from '@element-plus/icons-vue'
import { rssService } from '@/services/rss'
import { RSS_PRESET_FEEDS, RSS_PRESET_CATEGORIES, type RSSPresetFeed } from '@/services/rssPresets'
import { sanitizeMarkdown } from '@/utils/security'
import type { RSSFeed, RSSArticle } from '@/types'

const activeTab = ref<'discover' | 'feeds' | 'articles'>('discover')
const feeds = ref<RSSFeed[]>([])
const articles = ref<RSSArticle[]>([])
const selectedFeedId = ref<string>('')
const newFeedUrl = ref('')
const editDialogVisible = ref(false)
const editingFeed = ref<Partial<RSSFeed>>({})
const discoverSearch = ref('')
const selectedCategory = ref<string>('')

const categories = RSS_PRESET_CATEGORIES

const subscribedUrls = computed(() => new Set(feeds.value.map(f => f.url)))

const filteredPresets = computed(() => {
  let list = RSS_PRESET_FEEDS
  if (selectedCategory.value) {
    list = list.filter(f => f.category === selectedCategory.value)
  }
  if (discoverSearch.value.trim()) {
    const q = discoverSearch.value.toLowerCase()
    list = list.filter(f =>
      f.title.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q)
    )
  }
  return list
})

const isPresetSubscribed = (url: string) => subscribedUrls.value.has(url)

const toggleCategory = (cat: string) => {
  selectedCategory.value = selectedCategory.value === cat ? '' : cat
}

const addPresetFeed = async (preset: RSSPresetFeed) => {
  try {
    await rssService.addFeed(preset.url, {
      title: preset.title,
      description: preset.description,
      importPath: '/RSS/'
    })
    await refreshAllFeeds()
    ElMessage.success(`已订阅 ${preset.title}`)
  } catch {
    ElMessage.error('订阅失败')
  }
}

const filteredArticles = computed(() => {
  let list = articles.value
  if (selectedFeedId.value) {
    list = list.filter(a => a.feedId === selectedFeedId.value)
  }
  return list.sort((a, b) => b.pubDate - a.pubDate)
})

const loadFeeds = async () => {
  feeds.value = await rssService.getFeeds()
}

const loadArticles = async () => {
  articles.value = await rssService.getArticles()
}

const refreshAllFeeds = async () => {
  await loadFeeds()
  await loadArticles()
}

const addFeed = async () => {
  const url = newFeedUrl.value.trim()
  if (!url) return

  try {
    new URL(url)
  } catch {
    ElMessage.error('请输入有效的 URL')
    return
  }

  try {
    await rssService.addFeed(url, {
      importPath: '/RSS/'
    })
    newFeedUrl.value = ''
    await refreshAllFeeds()
    ElMessage.success('RSS 源已添加')
  } catch {
    ElMessage.error('添加 RSS 源失败')
  }
}

const fetchFeed = async (feedId: string) => {
  try {
    const result = await rssService.fetchFeed(feedId)
    if (result.error) {
      ElMessage.error(`获取失败: ${result.error}`)
    } else {
      ElMessage.success(`获取成功: ${result.newArticles} 篇新文章, ${result.skippedArticles} 篇已存在`)
    }
    await refreshAllFeeds()
  } catch {
    ElMessage.error('获取 RSS 失败')
  }
}

const fetchAllFeeds = async () => {
  const results = await Promise.allSettled(feeds.value.map(feed => fetchFeed(feed.id)))
  const failed = results.filter(r => r.status === 'rejected').length
  if (failed > 0) {
    ElMessage.warning(`${failed} 个源刷新失败`)
  }
}

const editFeed = (feed: RSSFeed) => {
  editingFeed.value = { ...feed }
  editDialogVisible.value = true
}

const saveFeedEdit = async () => {
  if (!editingFeed.value.id) return
  try {
    await rssService.updateFeed(editingFeed.value.id, editingFeed.value)
    editDialogVisible.value = false
    await refreshAllFeeds()
    ElMessage.success('RSS 源已更新')
  } catch {
    ElMessage.error('更新 RSS 源失败')
  }
}

const deleteFeed = async (feedId: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这个 RSS 源吗？', '确认删除', {
      type: 'warning'
    })
    await rssService.deleteFeed(feedId)
    await refreshAllFeeds()
    ElMessage.success('RSS 源已删除')
  } catch {
    // 用户取消
  }
}

const importArticle = async (articleId: string) => {
  try {
    const paths = await rssService.importArticle(articleId)
    await refreshAllFeeds()
    ElMessage.success(`文章已导入: ${paths.join(', ')}`)
  } catch {
    ElMessage.error('导入文章失败')
  }
}

const markArticleRead = async (articleId: string) => {
  const article = articles.value.find(a => a.id === articleId)
  if (!article || article.isRead) return
  article.isRead = true
  try {
    await rssService.updateArticleRead(articleId, true)
  } catch {
    // Silently fail - visual state already updated
  }
}

const getFeedTitle = (feedId: string) => {
  const feed = feeds.value.find(f => f.id === feedId)
  return feed?.title || feed?.url || '未知来源'
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const sanitizeArticleDescription = (html: string | undefined): string => {
  if (!html) return ''
  return sanitizeMarkdown(html)
}

onMounted(async () => {
  await refreshAllFeeds()
})
</script>

<style scoped>
.rss-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.rss-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 6px;
  border-bottom-color: var(--obsidian-border, rgba(255, 255, 255, 0.06));
}

.rss-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.rss-tabs :deep(.el-tabs__item) {
  height: 32px;
  padding: 0 6px;
  font-size: 11px;
  color: var(--obsidian-text-muted, #999);
}

.rss-tabs :deep(.el-tabs__item.is-active) {
  color: var(--obsidian-accent, #7f6df2);
}

.rss-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.rss-tabs :deep(.el-tab-pane) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 10px 12px 16px;
  min-height: 0;
}

/* 推荐订阅 */
.discover-header {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.discover-search {
  width: 100%;
}

.discover-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.category-tag {
  cursor: pointer;
  transition: all 0.15s ease;
}

.discover-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.discover-item {
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--obsidian-bg-primary, #1e1e1e);
  border: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  transition: border-color 0.15s ease;
}

.discover-item:hover {
  border-color: var(--obsidian-border-hover, rgba(255, 255, 255, 0.12));
}

.discover-info {
  flex: 1;
  min-width: 0;
}

.discover-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--obsidian-text-normal, #dcddde);
  margin-bottom: 2px;
}

.discover-desc {
  font-size: 10px;
  color: var(--obsidian-text-faint, #666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 订阅列表 */
.feeds-header,
.articles-header {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.feed-url-input {
  flex: 1;
}

.feed-select {
  flex: 1;
}

.feeds-list,
.articles-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feed-item {
  padding: 12px;
  border-radius: 6px;
  background: var(--obsidian-bg-primary, #1e1e1e);
  border: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.feed-info {
  flex: 1;
  min-width: 0;
}

.feed-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--obsidian-text-normal, #dcddde);
  margin-bottom: 4px;
}

.feed-url {
  font-size: 11px;
  color: var(--obsidian-text-muted, #999);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-meta {
  font-size: 10px;
  color: var(--obsidian-text-faint, #666);
}

.feed-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.article-item {
  padding: 12px;
  border-radius: 6px;
  background: var(--obsidian-bg-primary, #1e1e1e);
  border: 1px solid var(--obsidian-border, rgba(255, 255, 255, 0.06));
  transition: border-color 0.15s ease;
}

.article-item.imported {
  border-color: var(--el-color-success-light-7);
}

.article-item.unread {
  border-left: 3px solid var(--obsidian-accent);
}

.article-item.unread .article-title a {
  font-weight: 700;
}

.article-header {
  margin-bottom: 8px;
}

.article-title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.article-title a {
  color: var(--obsidian-accent, #7f6df2);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-title a:hover {
  text-decoration: underline;
}

.article-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 10px;
  color: var(--obsidian-text-faint, #666);
}

.article-category {
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--obsidian-accent-soft, rgba(127, 109, 242, 0.15));
  color: var(--obsidian-accent, #7f6df2);
}

.article-description {
  font-size: 12px;
  color: var(--obsidian-text-muted, #999);
  line-height: 1.5;
  max-height: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  margin-bottom: 8px;
}

.article-description :deep(img) {
  display: none;
}

.article-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
