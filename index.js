// ====== 获取并解析信息源 ======
async function fetchSources() {
  console.log('📡 正在获取技术动态信息源...');
  
  const cutoffTime = Date.now() - (48 * 60 * 60 * 1000); // 48小时前
  
  try {
    const [blogsRes, podcastsRes, xRes] = await Promise.all([
      axios.get(SOURCES.blogs),
      axios.get(SOURCES.podcasts),
      axios.get(SOURCES.x)
    ]);
    
    // 处理 blogs - 修复时间字段问题
    const recentBlogs = (blogsRes.data.blogs || [])
      .map(blog => ({
        title: blog.title,
        link: blog.url,
        // 修复：使用 generatedAt 作为备选时间
        pubDate: blog.publishedAt || blogsRes.data.generatedAt || new Date().toISOString(),
        source: 'Blog'
      }))
      .filter(item => new Date(item.pubDate).getTime() > cutoffTime)
      .slice(0, 10);
    
    // 处理 podcasts - 直接使用所有数据（因为时间可能不准确）
    const recentPodcasts = (podcastsRes.data.items || [])
      .map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate || new Date().toISOString(),
        source: 'Podcast'
      }))
      .slice(0, 5); // 只取前5条，不严格按时间筛选
    
    // 处理 X - 保持原有逻辑
    const allXTweets = [];
    if (xRes.data.x && Array.isArray(xRes.data.x)) {
      xRes.data.x.forEach(user => {
        if (user.tweets && Array.isArray(user.tweets)) {
