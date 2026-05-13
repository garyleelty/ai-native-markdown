// 侧边栏功能测试脚本
// 在浏览器控制台中运行此脚本进行测试

function testSidebar() {
  const results = [];
  
  // 测试1: 检查DOM结构
  const sidebarPanel = document.querySelector('.sidebar-panel');
  const sidebar = document.querySelector('.sidebar');
  const sidebarNav = document.querySelector('.sidebar-nav');
  const sidebarContent = document.querySelector('.sidebar-content');
  
  results.push(`✓ sidebar-panel 存在: ${!!sidebarPanel}`);
  results.push(`✓ sidebar 存在: ${!!sidebar}`);
  results.push(`✓ sidebar-nav 存在: ${!!sidebarNav}`);
  results.push(`✓ sidebar-content 存在: ${!!sidebarContent}`);
  
  // 测试2: 检查 collapsed 类
  const isCollapsed = sidebarPanel?.classList.contains('collapsed');
  results.push(`✓ sidebar-panel collapsed 状态: ${isCollapsed}`);
  
  // 测试3: 检查 computed style
  if (sidebarPanel) {
    const style = window.getComputedStyle(sidebarPanel);
    results.push(`✓ sidebar-panel width: ${style.width}`);
    results.push(`✓ sidebar-panel opacity: ${style.opacity}`);
    results.push(`✓ sidebar-panel display: ${style.display}`);
  }
  
  // 测试4: 检查按钮
  const toggleBtn = document.querySelector('.toolbar-btn[title="侧边栏"]');
  results.push(`✓ 侧边栏切换按钮存在: ${!!toggleBtn}`);
  
  // 测试5: 模拟点击
  if (toggleBtn) {
    console.log('模拟点击侧边栏切换按钮...');
    toggleBtn.click();
    
    setTimeout(() => {
      const newIsCollapsed = sidebarPanel?.classList.contains('collapsed');
      results.push(`✓ 点击后 collapsed 状态: ${newIsCollapsed}`);
      
      if (sidebarPanel) {
        const newStyle = window.getComputedStyle(sidebarPanel);
        results.push(`✓ 点击后 width: ${newStyle.width}`);
        results.push(`✓ 点击后 opacity: ${newStyle.opacity}`);
      }
      
      console.log('=== 测试结果 ===');
      results.forEach(r => console.log(r));
    }, 500);
  }
  
  return results;
}

// 响应式测试
function testResponsive() {
  const widths = [320, 768, 1024, 1440];
  
  widths.forEach(w => {
    console.log(`\n=== 屏幕宽度 ${w}px ===`);
    window.innerWidth = w;
    window.dispatchEvent(new Event('resize'));
    
    const isMobile = w < 768;
    const isTablet = w >= 768 && w < 1024;
    const isDesktop = w >= 1024;
    
    console.log(`设备类型: ${isMobile ? '移动端' : isTablet ? '平板' : '桌面端'}`);
    
    const sidebarPanel = document.querySelector('.sidebar-panel');
    if (sidebarPanel) {
      console.log(`mobile-drawer 类: ${sidebarPanel.classList.contains('mobile-drawer')}`);
      console.log(`collapsed 类: ${sidebarPanel.classList.contains('collapsed')}`);
    }
  });
}

console.log('侧边栏测试工具已加载');
console.log('运行 testSidebar() 测试侧边栏功能');
console.log('运行 testResponsive() 测试响应式布局');
