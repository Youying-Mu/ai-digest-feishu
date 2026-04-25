// ====== 依赖导入 ======
const axios = require('axios');
const fs = require('fs').promises;

// ====== 数据源配置 ======
const DATA_SOURCES = {
  blogs: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json",
  podcasts: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json",
  x: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json"
};

// ====== 获取博客数据 ======
async function fetchBlogs() {
  console.log('📝 正在获取博客数据...');
  
  try {
    const response = await axios.get(DATA_SOURCES.blogs);
    const data = response.data;
    
    // 提取博客信息
    const blogs = (data.blogs || []).map(blog => ({
      source: blog.name,
      title: blog.title,
      url: blog.url,
      content: blog.content || blog.description || ''
    }));
    
    console.log(`✅ 获取到 ${blogs.length} 篇博客`);
    return blogs;
  } catch (error) {
    console.error('❌ 获取博客数据失败:', error.message);
    return [];
  }
}

// ====== 获取播客数据 ======
async function fetchPodcasts() {
  console.log('🎙️ 正在获取播客数据...');
  
  try {
    const response = await axios.get(DATA_SOURCES.podcasts);
    const data = response.data;
    
    // 提取播客信息
    const podcasts = (data.podcasts || []).map(podcast => ({
      source: podcast.name,
      title: podcast.title,
      url: podcast.url,
      transcript: podcast.transcript || ''
    }));
    
    console.log(`✅ 获取到 ${podcasts.length} 个播客`);
    return podcasts;
  } catch (error) {
    console.error('❌ 获取播客数据失败:', error.message);
    return [];
  }
}

// ====== 获取 X (Twitter) 数据 ======
async function fetchXData() {
  console.log('🐦 正在获取 X 数据...');
  
  try {
    const response = await axios.get(DATA_SOURCES.x);
    const data = response.data;
    
    // 提取推文信息
    const tweets = [];
    if (data.x && Array.isArray(data.x)) {
      data.x.forEach(user => {
        if (user.tweets && Array.isArray(user.tweets)) {
          user.tweets.forEach(tweet => {
            tweets.push({
              user: user.name,
              handle: user.handle,
              text: tweet.text,
              url: tweet.url,
              likes: tweet.likes || 0
            });
          });
        }
      });
    }
    
    console.log(`✅ 获取到 ${tweets.length} 条推文`);
    return tweets;
  } catch (error) {
    console.error('❌ 获取 X 数据失败:', error.message);
    return [];
  }
}

// ====== 获取所有数据源 ======
async function fetchAllSources() {
  console.log('🔄 正在获取所有数据源...');
  
  try {
    const [blogs, podcasts, tweets] = await Promise.all([
      fetchBlogs(),
      fetchPodcasts(),
      fetchXData()
    ]);
    
    return {
      blogs,
      podcasts,
      tweets,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ 获取数据源失败:', error.message);
    throw error;
  }
}

// ====== 格式化数据供 AI 使用 ======
function formatSourcesForAI(sourcesData) {
  const { blogs, podcasts, tweets } = sourcesData;
  
  let output = '';
  
  // 博客部分
  if (blogs && blogs.length > 0) {
    output += '### 博客文章\n';
    blogs.forEach((blog, i) => {
      output += `${i + 1}. [${blog.source}] ${blog.title}\n`;
      if (blog.content) {
        // 截取前200个字符作为摘要
        const summary = blog.content.substring(0, 200).replace(/\n/g, ' ') + (blog.content.length > 200 ? '...' : '');
        output += `   摘要: ${summary}\n`;
      }
      output += `   链接: ${blog.url}\n`;
    });
    output += '\n';
  }
  
  // 播客部分
  if (podcasts && podcasts.length > 0) {
    output += '### 播客节目\n';
    podcasts.forEach((podcast, i) => {
      output += `${i + 1}. [${podcast.source}] ${podcast.title}\n`;
      if (podcast.transcript) {
        // 提取播客转录文本的关键内容
        const lines = podcast.transcript.split('\n');
        const keyLines = lines.filter(line => {
          // 过滤掉时间戳行，保留实际对话内容
          return !line.match(/^\s*Speaker\s+\d+\s*\|\s*\d+:\d+/) && line.trim().length > 50;
        }).slice(0, 3); // 取前3个关键句子
        
        if (keyLines.length > 0) {
          output += `   关键内容: ${keyLines.join(' ').substring(0, 200)}...\n`;
        }
      }
      output += `   链接: ${podcast.url}\n`;
    });
    output += '\n';
  }
  
  // X 推文部分
  if (tweets && tweets.length > 0) {
    output += '### X (Twitter) 动态\n';
    // 按点赞数排序，取前10条热门推文
    const topTweets = tweets
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 10);
    
    topTweets.forEach((tweet, i) => {
      output += `${i + 1}. [@${tweet.handle}]: ${tweet.text}\n`;
      output += `   链接: ${tweet.url}\n`;
    });
    output += '\n';
  }
  
  return output;
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

  // 添加重试机制
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
          },
          // 【关键】指定返回格式为 message 格式
          parameters: {
            result_format: 'message'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60秒超时
        }
      );

      // 【修正】检查响应格式
      if (response.data?.output?.choices?.[0]?.message?.content) {
        // message 格式
        const digest = response.data.output.choices[0].message.content;
        console.log('✅ AI摘要生成成功 (message格式)');
        console.log('📋 摘要预览:', digest.substring(0, 100) + '...');
        return digest;
      } else if (response.data?.output?.text) {
        // text 格式（备用）
        const digest = response.data.output.text;
        console.log('✅ AI摘要生成成功 (text格式)');
        console.log('📋 摘要预览:', digest.substring(0, 100) + '...');
        return digest;
      } else {
        console.error('❌ API响应格式不正确');
        console.error('完整响应:', JSON.stringify(response.data, null, 2));
        throw new Error('无法解析API响应');
      }
      
    } catch (error) {
      if (attempt === maxRetries) {
        console.error('❌ AI生成失败（已重试最大次数）:', error.message);
        if (error.response) {
          console.error('API响应:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
      }
      
      console.log(`⏳ AI生成超时，正在重试 (${attempt + 1}/${maxRetries})...`);
      // 等待2秒后重试
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// ====== 推送至飞书 ======
async function sendToFeishu(content) {
  console.log('🚀 正在推送至飞书...');
  
  const webhook = process.env.FEISHU_WEBHOOK;
  if (!webhook) {
    throw new Error('❌ FEISHU_WEBHOOK 环境变量未设置');
  }

  // 【关键】在消息开头添加关键词
  // 请将 "[AI日报]" 替换为你在飞书机器人中设置的关键词
  const keyword = '[AI日报]';
  const message = `${keyword}\n\n${content}`;

  try {
    const response = await axios.post(
      webhook,
      {
        msg_type: 'text',
        content: {
          text: message
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.data?.code === 0) {
      console.log('✅ 摘要已成功发送至飞书！');
      return true;
    } else {
      throw new Error(`飞书 API 返回错误: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error('❌ 飞书推送失败:', error.message);
    if (error.response) {
      console.error('飞书响应:', error.response.data);
    }
    throw error;
  }
}

// ====== 保存摘要到文件（可选） ======
async function saveDigestToFile(content) {
  try {
    const filename = `digest_${new Date().toISOString().split('T')[0]}.md`;
    await fs.writeFile(filename, content, 'utf-8');
    console.log(`💾 摘要已保存到文件: ${filename}`);
  } catch (error) {
    console.error('❌ 保存文件失败:', error.message);
  }
}

// ====== 主流程 ======
async function main() {
  console.log('========================================');
  console.log('🚀 AI 技术日报 - 开始执行');
  console.log('========================================\n');
  
  try {
    // 1. 获取数据
    const sourcesData = await fetchAllSources();
    
    // 2. 生成摘要
    const digest = await generateDigest(sourcesData);
    
    // 3. 保存到文件（可选）
    await saveDigestToFile(digest);
    
    // 4. 推送至飞书
    await sendToFeishu(digest);
    
    console.log('\n========================================');
    console.log('✅ 全部任务完成！');
    console.log('========================================');
    
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ 执行失败:', error);
    console.error('========================================');
    process.exit(1);
  }
}

// ====== 启动程序 ======
main();
