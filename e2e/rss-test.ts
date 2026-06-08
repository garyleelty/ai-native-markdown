import { chromium } from 'playwright'

async function testRSS() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  })
  const page = await context.newPage()

  try {
    console.log('1. 打开浏览器访问 http://localhost:1421/')
    await page.goto('http://localhost:1421/', { waitUntil: 'networkidle', timeout: 30000 })
    console.log('   页面加载完成')

    // 等待应用初始化
    await page.waitForTimeout(2000)

    console.log('2. 点击侧边栏 RSS 订阅按钮')
    // 正确的选择器: .sidebar-nav .el-menu-item[aria-label="RSS 订阅"]
    const rssButton = page.locator('.sidebar-nav .el-menu-item[aria-label="RSS 订阅"]')
    await rssButton.click()
    console.log('   已点击 RSS 订阅按钮')

    // 等待 RSS 面板加载
    await page.waitForSelector('.rss-tabs', { timeout: 5000 })
    console.log('3. RSS 面板已加载')
    await page.screenshot({ path: '/tmp/rss-panel.png' })

    console.log('4. 在"推荐"标签页中查找"少数派"')
    // 查找少数派 - 在 .discover-item 中包含 "少数派" 文本
    const sspItem = page.locator('.discover-item', { hasText: '少数派' })
    const sspCount = await sspItem.count()
    console.log(`   找到 ${sspCount} 个少数派项`)

    if (sspCount > 0) {
      // 找到少数派项中的订阅按钮
      const subscribeBtn = sspItem.locator('button')
      const btnText = await subscribeBtn.textContent()
      console.log(`   订阅按钮文本: "${btnText}"`)

      if (btnText?.trim() === '订阅') {
        await subscribeBtn.click()
        console.log('5. 已点击订阅按钮')
        // 等待订阅成功消息
        await page.waitForTimeout(2000)

        // 检查是否有成功消息
        const successMsg = page.locator('.el-message--success')
        if (await successMsg.isVisible({ timeout: 3000 }).catch(() => false)) {
          const msgText = await successMsg.textContent()
          console.log(`   订阅成功消息: "${msgText}"`)
        }
      } else if (btnText?.trim() === '已订阅') {
        console.log('   少数派已经订阅过了')
      }
    } else {
      console.log('   未在推荐列表中找到少数派，尝试滚动或筛选')
      // 可能需要滚动列表
    }

    await page.screenshot({ path: '/tmp/rss-subscribe.png' })

    console.log('6. 切换到"订阅列表"标签')
    const feedsTab = page.locator('.el-tabs__item').filter({ hasText: '订阅列表' })
    await feedsTab.click()
    await page.waitForTimeout(1000)
    console.log('   已切换到订阅列表标签')

    // 检查少数派是否在订阅列表中
    const sspFeedItem = page.locator('.feed-item', { hasText: '少数派' })
    const feedCount = await sspFeedItem.count()
    console.log(`   订阅列表中找到 ${feedCount} 个少数派项`)

    if (feedCount > 0) {
      console.log('7. 点击少数派的刷新按钮')
      // 刷新按钮在 .feed-actions 中
      const refreshBtn = sspFeedItem.locator('.feed-actions button').first()
      await refreshBtn.click()
      console.log('   已点击刷新按钮，等待 10 秒获取内容...')
      await page.waitForTimeout(10000)

      // 检查刷新结果
      const successMsg = page.locator('.el-message--success').last()
      if (await successMsg.isVisible({ timeout: 3000 }).catch(() => false)) {
        const msgText = await successMsg.textContent()
        console.log(`   刷新结果: "${msgText}"`)
      }
    } else {
      console.log('   未在订阅列表中找到少数派，等待 10 秒...')
      await page.waitForTimeout(10000)
    }

    await page.screenshot({ path: '/tmp/rss-refreshed.png' })

    console.log('8. 切换到"文章列表"标签')
    const articlesTab = page.locator('.el-tabs__item').filter({ hasText: '文章列表' })
    await articlesTab.click()
    await page.waitForTimeout(2000)
    console.log('   已切换到文章列表标签')

    console.log('9. 检查文章列表内容')
    await page.screenshot({ path: '/tmp/rss-articles.png' })

    // 获取文章列表内容
    const articleItems = page.locator('.article-item')
    const articleCount = await articleItems.count()
    console.log(`   找到 ${articleCount} 篇文章`)

    // 获取文章标题
    const articleTitles = await page.locator('.article-title').allTextContents()
    console.log('\n   文章标题:')
    articleTitles.slice(0, 5).forEach((title, i) => {
      console.log(`   ${i + 1}. ${title.trim()}`)
    })

    // 获取页面文本内容用于检查
    const bodyText = await page.locator('body').innerText()
    console.log('\n=== 页面内容检查 ===')
    console.log('页面包含 "文章":', bodyText.includes('文章'))
    console.log('页面包含 "少数派":', bodyText.includes('少数派') || bodyText.includes('sspai'))
    console.log('页面包含 "RSS":', bodyText.includes('RSS'))
    console.log('页面包含 "导入":', bodyText.includes('导入'))

    // 检查是否有错误
    const errorMsgs = page.locator('.el-message--error')
    const errorCount = await errorMsgs.count()
    if (errorCount > 0) {
      console.log('\n发现错误消息:')
      for (let i = 0; i < Math.min(errorCount, 3); i++) {
        const errText = await errorMsgs.nth(i).textContent().catch(() => '')
        console.log(`  - ${errText}`)
      }
    }

    console.log('\n=== 测试完成 ===')
    console.log('截图文件:')
    console.log('  - /tmp/rss-panel.png (RSS面板)')
    console.log('  - /tmp/rss-subscribe.png (订阅后)')
    console.log('  - /tmp/rss-refreshed.png (刷新后)')
    console.log('  - /tmp/rss-articles.png (文章列表)')

  } catch (error) {
    console.error('测试过程中出错:', error)
    await page.screenshot({ path: '/tmp/rss-error.png' })
    console.log('错误截图已保存到 /tmp/rss-error.png')
  } finally {
    await browser.close()
  }
}

testRSS()