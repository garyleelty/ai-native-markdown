export interface RSSPresetFeed {
  title: string
  url: string
  description: string
  category: string
}

export const RSS_PRESET_FEEDS: RSSPresetFeed[] = [
  // === AI ===
  { title: 'OpenAI Blog', url: 'https://openai.com/news/rss.xml', description: 'GPT 更新与 AI 研究', category: 'AI' },
  { title: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', description: 'DeepMind 研究', category: 'AI' },
  { title: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', description: 'Google AI 动态', category: 'AI' },
  { title: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', description: '开源 AI 社区', category: 'AI' },
  { title: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', description: 'LLM 洞察，Django 联合创始人', category: 'AI' },
  { title: '机器之心', url: 'https://www.jiqizhixin.com/rss', description: '国内顶级 AI 媒体', category: 'AI' },
  { title: 'arXiv AI', url: 'https://rss.arxiv.org/rss/cs.AI', description: 'AI 预印本论文', category: 'AI' },
  { title: 'arXiv ML', url: 'https://rss.arxiv.org/rss/cs.LG', description: '机器学习论文', category: 'AI' },
  { title: 'arXiv NLP', url: 'https://rss.arxiv.org/rss/cs.CL', description: 'NLP 论文', category: 'AI' },

  // === 技术社区 ===
  { title: 'Hacker News', url: 'https://hnrss.org/frontpage', description: 'HN 首页热门', category: '技术社区' },
  { title: 'Hacker News Newest', url: 'https://hnrss.org/newest', description: 'HN 最新提交', category: '技术社区' },
  { title: 'Show HN', url: 'https://hnrss.org/show', description: 'HN 项目展示', category: '技术社区' },
  { title: 'Ask HN', url: 'https://hnrss.org/ask', description: 'HN 问答', category: '技术社区' },
  { title: 'V2EX 热门', url: 'https://www.v2ex.com/feed/tab/hot.xml', description: 'V2EX 今日热门', category: '技术社区' },
  { title: 'V2EX 技术', url: 'https://www.v2ex.com/feed/tab/tech.xml', description: 'V2EX 技术讨论', category: '技术社区' },
  { title: '少数派', url: 'https://sspai.com/feed', description: '高效数字生活', category: '技术社区' },
  { title: '阮一峰博客', url: 'https://www.ruanyifeng.com/blog/atom.xml', description: '科技爱好者周刊', category: '技术社区' },
  { title: 'IT之家', url: 'https://www.ithome.com/rss/', description: 'IT 资讯全文', category: '技术社区' },
  { title: 'Dev.to', url: 'https://dev.to/feed', description: '开发者社区', category: '技术社区' },

  // === 科技媒体 ===
  { title: 'TechCrunch', url: 'https://techcrunch.com/feed/', description: '硅谷科技新闻', category: '科技媒体' },
  { title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', description: '科技与文化', category: '科技媒体' },
  { title: 'Wired', url: 'https://www.wired.com/feed/rss', description: 'Wired 杂志', category: '科技媒体' },
  { title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', description: '深度技术分析', category: '科技媒体' },
  { title: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', description: 'MIT 科技评论', category: '科技媒体' },

  // === 前端与设计 ===
  { title: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/', description: '前端设计杂志', category: '前端与设计' },
  { title: 'CSS-Tricks', url: 'https://css-tricks.com/feed/', description: 'CSS 技巧与教程', category: '前端与设计' },
  { title: 'Chrome Dev Blog', url: 'https://developer.chrome.com/blog/feed.xml', description: 'Chrome 开发者博客', category: '前端与设计' },
  { title: 'Product Hunt', url: 'https://www.producthunt.com/feed', description: '新产品发现', category: '前端与设计' },
  { title: 'Dribbble Popular', url: 'https://dribbble.com/shots/popular.rss', description: '热门设计作品', category: '前端与设计' },

  // === 编程语言 ===
  { title: 'React Blog', url: 'https://react.dev/rss.xml', description: 'React 官方博客', category: '编程语言' },
  { title: 'Vue Blog', url: 'https://blog.vuejs.org/feed.rss', description: 'Vue.js 官方博客', category: '编程语言' },
  { title: 'Rust Blog', url: 'https://blog.rust-lang.org/feed.xml', description: 'Rust 官方博客', category: '编程语言' },
  { title: 'Go Blog', url: 'https://go.dev/blog/feed.atom', description: 'Go 官方博客', category: '编程语言' },
  { title: 'Python Blog', url: 'https://blog.python.org/feeds/posts/default', description: 'Python 官方博客', category: '编程语言' },
  { title: 'Node.js Blog', url: 'https://nodejs.org/en/feed/blog.xml', description: 'Node.js 官方博客', category: '编程语言' },
  { title: 'TypeScript Blog', url: 'https://devblogs.microsoft.com/typescript/feed/', description: 'TypeScript 官方博客', category: '编程语言' },
  { title: 'Next.js Blog', url: 'https://nextjs.org/feed.xml', description: 'Next.js 官方更新', category: '编程语言' },
  { title: 'Svelte Blog', url: 'https://svelte.dev/blog/rss.xml', description: 'Svelte 和 SvelteKit', category: '编程语言' },
  { title: 'Tailwind CSS Blog', url: 'https://tailwindcss.com/feeds/feed.xml', description: 'Tailwind CSS 更新', category: '编程语言' },

  // === 大厂工程 ===
  { title: 'GitHub Blog', url: 'https://github.blog/feed/', description: 'GitHub 官方博客', category: '大厂工程' },
  { title: 'GitHub Changelog', url: 'https://github.blog/changelog/feed/', description: 'GitHub 平台更新', category: '大厂工程' },
  { title: 'Cloudflare Blog', url: 'https://blog.cloudflare.com/rss/', description: 'Cloudflare 工程', category: '大厂工程' },
  { title: 'Netflix Tech', url: 'https://netflixtechblog.com/feed', description: 'Netflix 工程', category: '大厂工程' },
  { title: 'AWS Blog', url: 'https://aws.amazon.com/blogs/aws/feed/', description: 'AWS 官方博客', category: '大厂工程' },
  { title: 'Vercel Blog', url: 'https://vercel.com/atom', description: 'Vercel 官方博客', category: '大厂工程' },
  { title: 'Mozilla Hacks', url: 'https://hacks.mozilla.org/feed/', description: 'Mozilla 开发者博客', category: '大厂工程' },
  { title: 'Supabase Blog', url: 'https://supabase.com/rss.xml', description: 'Supabase 官方博客', category: '大厂工程' },
  { title: 'Stripe Blog', url: 'https://stripe.com/blog/feed.rss', description: 'Stripe 工程', category: '大厂工程' },

  // === 安全 ===
  { title: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/', description: '知名安全博客', category: '安全' },
  { title: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', description: '黑客新闻', category: '安全' },
  { title: 'Schneier on Security', url: 'https://www.schneier.com/feed/', description: '安全专家博客', category: '安全' },
  { title: 'Google Security Blog', url: 'https://security.googleblog.com/atom.xml', description: 'Google 安全更新', category: '安全' },
  { title: 'FreeBuf', url: 'https://www.freebuf.com/feed', description: '国内安全资讯', category: '安全' },

  // === 周刊 ===
  { title: 'JavaScript Weekly', url: 'https://javascriptweekly.com/rss/', description: 'JS 生态周刊', category: '周刊' },
  { title: 'This Week in Rust', url: 'https://this-week-in-rust.org/atom.xml', description: 'Rust 社区周刊', category: '周刊' },
  { title: 'Golang Weekly', url: 'https://golangweekly.com/rss/', description: 'Go 生态周刊', category: '周刊' },
  { title: 'ByteByteGo', url: 'https://blog.bytebytego.com/feed', description: '系统设计周刊', category: '周刊' },
]

export const RSS_PRESET_CATEGORIES = [...new Set(RSS_PRESET_FEEDS.map(f => f.category))]
