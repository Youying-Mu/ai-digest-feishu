const axios = require('axios');

// ====== 信息源配置 ======
const SOURCES = {
  blogs: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json",
  podcasts: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json",
  x: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json"
};

// ====== 获取信息源数据 ======
async function fetchSources() {
  console.log('📡 正在获取技术动态信息源...');
  
  const sourcesData = {};
  const cutoffTime = Date.now() - (48 * 60 * 60 * 1000); // 48小时前
  
  try {
    // 并行获取所有源
    const [blogsRes, podcastsRes, xRes] = await Promise.all([
      axios.get(SOURCES.blogs),
      axios.get(SOURCES.podcasts),
      axios.get(SOURCES.x)
    ]);
    
    // 处理 blogs
    const recentBlogs = blogsRes.data.items
      .filter(item => new Date(item.pubDate).getTime() > cutoffTime)
      .slice(0, 10) // 取最近10条
      .map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        source: 'Blog'
      }));
    
    // 处理 podcasts
    const recentPodcasts = podcastsRes.data.items
      .filter(item => new Date(item.pubDate).getTime() > cutoffTime)
      .slice(0, 5)
      .map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        source: 'Podcast'
      }));
    
    // 处理 X (Twitter)
    const recentX = xRes.data.items
      .filter(item => new Date(item.pubDate).getTime() > cutoffTime)
      .slice(0, 15)
      .map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        source: 'X'
      }));
    
    sourcesData.blogs = recentBlogs;
    sourcesData.podcasts = recentPodcasts;
    sourcesData.x = recentX;
    
    console.log(`✅ 信息源获取成功:`);
    console.log(`   - Blogs: ${recentBlogs.length} 条`);
    console.log(`   - Podcasts: ${recentPodcasts.length} 条`);
    console.log(`   - X: ${recentX.length} 条`);
    
    return sourcesData;
    
  } catch (error) {
    console.error('❌ 获取信息源失败:', error.message);
    throw error;
  }
}

// ====== 格式化信息源内容 ======
function formatSourcesForAI(sourcesData) {
  let content = `以下是最近48小时内的AI技术动态：\n\n`;
  
  // Blogs
  if (sourcesData.blogs.length > 0) {
    content += `## 🔥 技术博客更新 (${sourcesData.blogs.length} 篇)\n`;
    sourcesData.blogs.forEach((item, index) => {
      const date = new Date(item.pubDate).toLocaleDateString('zh-CN');
      content += `${index + 1}. [${item.title}](${item.link}) - ${date}\n`;
    });
    content += '\n';
  }
  
  // Podcasts
  if (sourcesData.podcasts.length > 0) {
    content += `## 🎙️ 播客更新 (${sourcesData.podcasts.length} 期)\n`;
    sourcesData.podcasts.forEach((item, index) => {
      const date = new Date(item.pubDate).toLocaleDateString('zh-CN');
      content += `${index + 1}. [${item.title}](${item.link}) - ${date}\n`;
    });
    content += '\n';
  }
  
  // X (Twitter)
  if (sourcesData.x.length > 0) {
    content += `## 🐦 X/Twitter 动态 (${sourcesData.x.length} 条)\n`;
    sourcesData.x.forEach((item, index) => {
      const date = new Date(item.pubDate).toLocaleDateString('zh-CN');
      content += `${index + 1}. ${item.title} - ${date}\n`;
    });
    content += '\n';
  }
  
  return content;
}

// ====== 生成AI摘要 ======
async function generateDigest(sourcesData) {
  console.log('🧠 正在调用AI模型生成技术摘要...');
  
  const today = new Date().toISOString().split('T')[0];
  const sourcesContext = formatSourcesForAI(sourcesData);
  
  const prompt = `你是一位资深AI技术专家，请基于以下真实的技术动态，为${today}生成一份专业的AI技术每日摘要。

${sourcesContext}

## 生成要求：
1. **基于事实**：只总结上面提供的真实内容，不要编造
2. **结构化输出**：
   - 热点技术（从blogs和X中提取重要技术突破）
   - 研究突破（从blogs中提取论文/项目）
   - 产业动态（从X和blogs中提取公司动态）
   - 开发者建议（基于内容给出实用建议）
3. **语言**：简体中文，专业但易懂
4. **字数**：300-500字
5. **格式**：使用Markdown，包含emoji表情`;

  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: 'qwen-max',
        input: {
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (!response.data?.output?.choices?.[0]?.message?.content) {
      throw new Error('API响应格式不正确');
    }

    const digest = response.data.output.choices[0].message.content;
    console.log('✅ AI摘要生成成功');
    console.log('📋 摘要预览:', digest.substring(0, 100) + '...');
    
    return digest;
    
  } catch (error) {
    console.error('❌ AI生成失败:', error.message);
    if (error.response) {
      console.error('API响应:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// ====== 飞书推送 ======
async function sendToFeishu(content) {
  console.log('📤 准备发送到飞书...');
  
  const webhookUrl = process.env.FEISHU_WEBHOOK;
  
  try {
    // 🔑 关键：在消息开头添加关键词 "AI"
    const messageWithKeyword = `AI\n\n${content}`;
    
    const response = await axios.post(webhookUrl, {
      msg_type: "text",
      content: {
        text: messageWithKeyword
      }
    }, {
      timeout: 10000
    });
    
    if (response.data.code === 0) {
      console.log('🎉 飞书消息发送成功！');
      return true;
    } else {
      throw new Error(`飞书API错误: ${response.data.msg}`);
    }
  } catch (error) {
    console.error('🔥 飞书推送失败:', error.message);
    throw error;
  }
}

// ====== 主函数 ======
async function main() {
  try {
    console.log('🚀 开始生成AI技术摘要...\n');
    
    // 1. 获取信息源
    const sourcesData = await fetchSources();
    
    // 2. 生成摘要
    const digest = await generateDigest(sourcesData);
    
    // 3. 发送到飞书
    await sendToFeishu(digest);
    
    console.log('\n✅ 任务执行成功！');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ 任务执行失败:', error.message);
    process.exit(1);
  }
}

// 启动
console.log('🔧 AI Digest 工作流启动');
console.log(`📅 日期: ${new Date().toISOString().split('T')[0]}`);
console.log(`⚙️  Node.js 版本: ${process.version}\n`);

main();
