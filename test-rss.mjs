import { chromium } from 'playwright';

async function testRSS() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  
  console.log('=== RSS 订阅功能测试 ===\n');
  
  try {
    // 1. 访问页面
    console.log('1. 正在访问 http://localhost:1422/ ...');
    await page.goto('http://localhost:1422/', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('   ✓ 页面加载完成\n');
    
    // 2. 等待侧边栏加载
    console.log('2. 等待侧边栏加载...');
    await page.waitForTimeout(1000);
    
    // 3. 查找并点击 RSS 图标（侧边栏第3个图标）
    console.log('3. 正在查找 RSS 订阅图标...');
    
    // 先尝试找到所有的 sidebar 图标
    const sidebarIcons = await page.locator('.sidebar-icon, [class*="sidebar"] svg, .nav-icon').all();
    console.log(`   找到 ${sidebarIcons.length} 个侧边栏图标`);
    
    // 尝试点击第3个图标
    if (sidebarIcons.length >= 3) {
      console.log('   点击第3个图标...');
      await sidebarIcons[2].click();
    } else {
      // 尝试通过 aria-label 或 title 查找
      const rssIcon = page.locator('[aria-label*="RSS"], [title*="RSS"], [aria-label*="订阅"], [title*="订阅"]').first();
      if (await rssIcon.isVisible()) {
        await rssIcon.click();
        console.log('   ✓ 找到并点击了 RSS 图标');
      } else {
        console.log('   ⚠ 未明确找到 RSS 图标，尝试点击第3个图标');
        if (sidebarIcons.length > 0) {
          await sidebarIcons[Math.min(2, sidebarIcons.length - 1)].click();
        }
      }
    }
    
    await page.waitForTimeout(1500);
    console.log('   ✓ RSS 面板已打开\n');
    
    // 4. 查找"添加订阅"按钮
    console.log('4. 查找"添加订阅"按钮...');
    const addButton = page.locator('button:has-text("添加"), button:has-text("订阅"), button:has-text("Add"), [aria-label*="添加"], [aria-label*="订阅"]').first();
    
    if (await addButton.isVisible({ timeout: 3000 })) {
      console.log('   找到添加按钮，正在点击...');
      await addButton.click();
      await page.waitForTimeout(500);
      console.log('   ✓ 添加按钮已点击\n');
    } else {
      console.log('   ⚠ 未找到明确的添加按钮，尝试其他方式...\n');
    }
    
    // 5. 查找输入框并输入 RSS 地址
    console.log('5. 查找 RSS 地址输入框...');
    const inputBox = page.locator('input[type="text"], input[placeholder*="RSS"], input[placeholder*="订阅"], input[placeholder*="feed"], textarea').first();
    
    if (await inputBox.isVisible({ timeout: 3000 })) {
      console.log('   找到输入框，正在输入 RSS 地址...');
      await inputBox.fill('https://sspai.com/feed');
      console.log('   ✓ 已输入: https://sspai.com/feed\n');
    } else {
      console.log('   ⚠ 未找到 RSS 输入框\n');
      // 截图调试
      await page.screenshot({ path: '/Users/tianyi/code/ai-native-markdown/rss-test-debug1.png' });
      console.log('   已保存截图到 rss-test-debug1.png\n');
    }
    
    // 6. 查找提交按钮
    console.log('6. 查找提交按钮...');
    const submitButton = page.locator('button[type="submit"], button:has-text("确定"), button:has-text("提交"), button:has-text("添加"), button:has-text("确认")').first();
    
    if (await submitButton.isVisible({ timeout: 3000 })) {
      console.log('   找到提交按钮，正在点击...');
      await submitButton.click();
      console.log('   ✓ 提交按钮已点击\n');
    } else {
      console.log('   ⚠ 未找到提交按钮，尝试按 Enter 键...');
      await inputBox.press('Enter');
      console.log('   ✓ 已按 Enter 键\n');
    }
    
    // 7. 等待添加成功
    console.log('7. 等待处理结果...');
    await page.waitForTimeout(3000);
    console.log('   ✓ 等待完成\n');
    
    // 8. 查找刷新按钮并点击
    console.log('8. 查找刷新按钮...');
    const refreshButton = page.locator('button:has-text("刷新"), button:has-text("Refresh"), [aria-label*="刷新"]').first();
    
    if (await refreshButton.isVisible({ timeout: 3000 })) {
      console.log('   找到刷新按钮，正在点击...');
      await refreshButton.click();
      console.log('   ✓ 刷新按钮已点击\n');
      await page.waitForTimeout(2000);
    } else {
      console.log('   ⚠ 未找到刷新按钮\n');
    }
    
    // 9. 检查文章列表
    console.log('9. 检查文章列表...');
    const articleItems = await page.locator('[class*="article"], [class*="item"], [class*="feed"], li[class*=""]').all();
    console.log(`   找到 ${articleItems.length} 个可能的文章项\n`);
    
    // 10. 截图记录结果
    console.log('10. 保存测试截图...');
    await page.screenshot({ path: '/Users/tianyi/code/ai-native-markdown/rss-test-result.png', fullPage: true });
    console.log('    ✓ 截图已保存到 rss-test-result.png\n');
    
    console.log('=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试过程中出错:', error.message);
    await page.screenshot({ path: '/Users/tianyi/code/ai-native-markdown/rss-test-error.png', fullPage: true });
    console.log('错误截图已保存到 rss-test-error.png');
  } finally {
    await browser.close();
  }
}

testRSS();