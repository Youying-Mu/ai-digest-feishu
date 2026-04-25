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
    const response = await axios.get(DATA_SOURCES.blogs, { timeout: 8000 });
    const data = response.data;
    
    const blogs = (data.blogs || []).map(blog => ({
      type: 'blog',
      title: blog.title,
      source: blog.name,
      url: blog.url,
      content: blog.content || blog.description || '',
      timestamp: new Date().toISOString(),
      priority: 3
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
    const response = await axios.get(DATA_SOURCES.podcasts, { timeout: 8000 });
    const data = response.data;
    
    const podcasts = (data.podcasts || []).map(podcast => ({
      type: 'podcast',
      title: podcast.title,
      source: podcast.name,
      url: podcast.url,
      transcript: podcast.transcript || '',
      timestamp: new Date().toISOString(),
      priority: 2
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
    const response = await axios.get(DATA_SOURCES.x, { timeout: 8000 });
    const data = response.data;
    
    const tweets = [];
    if (data.x && Array.isArray(data.x)) {
      data.x.forEach(user => {
        if (user.tweets && Array.isArray(user.tweets)) {
          user.tweets.forEach(tweet => {
            tweets.push({
              type: 'tweet',
              title: tweet.text.substring(0, 80) + (tweet.text.length > 80 ? '...' : ''),
              source: `${user.name} (@${user.handle})`,
              url: tweet.url,
              content: tweet.text,
              likes: tweet.likes || 0,
              timestamp: new Date().toISOString(),
              priority: tweet.likes >= 50 ? 3 : tweet.likes >= 30 ? 2 : 1
            });
          });
        }
      });
    }
    
    // 过滤低质量推文
    const filteredTweets = tweets.filter(tweet => tweet.likes >= 20);
    console.log(`✅ 获取到 ${filteredTweets.length} 条高质量推文（原始: ${tweets.length}）`);
    return filteredTweets;
  } catch (error) {
    console.error('❌ 获取 X 数据失败:', error.message);
    return [];
  }
}

// ====== 获取所有数据源 ======
async function fetchAllSources() {
  console.log('🔄 正在获取所有数据源...');
  
  try {
    const [blogs, podcasts, tweets] = await Promise.allSettled([
      fetchBlogs(),
      fetchPodcasts(),
      fetchXData()
    ]);
    
    const allSources = [];
    
    if (blogs.status === 'fulfilled' && blogs.value.length > 0) {
      allSources.push(...blogs.value);
    }
    
    if (podcasts.status === 'fulfilled' && podcasts.value.length > 0) {
      allSources.push(...podcasts.value);
    }
    
    if (tweets.status === 'fulfilled' && tweets.value.length > 0) {
      allSources.push(...tweets.value);
    }
    
    // 按优先级和时间排序
    allSources.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    // 只取前3条做深度分析，其余做简单概述
    const deepAnalysisSources = allSources.slice(0, 3);
    const summarySources = allSources.slice(3, 6); // 最多再取3条简单概述
    
    console.log(`📊 深度分析 3 条最重要信息`);
    deepAnalysisSources.forEach((source, i) => {
      console.log(`   🔍 ${i + 1}. [${source.type.toUpperCase()}] ${source.title.substring(0, 50)}...`);
    });
    
    console.log(`📊 简单概述 ${summarySources.length} 条其他信息`);
    summarySources.forEach((source, i) => {
      console.log(`   📋 ${i + 1}. [${source.type.toUpperCase()}] ${source.title.substring(0, 50)}...`);
    });
    
    return {
      deepAnalysisSources,
      summarySources,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ 获取数据源失败:', error.message);
    throw error;
  }
}

// ====== 格式化数据供 AI 使用 ======
function formatSourcesForAI(sourcesData) {
  const { deepAnalysisSources, summarySources } = sourcesData;
  
  let output = '## 今日AI技术洞察\n\n';
  
  // 深度分析的3条信息
  output += '### 🔍 深度分析（3条最重要信息）\n\n';
  deepAnalysisSources.forEach((source, index) => {
    output += `#### 信息 ${index + 1}\n`;
    output += `**标题**: ${source.title}\n`;
    output += `**链接**: ${source.url}\n`;
    output += `**类型**: ${source.type}\n`;
    output += `**来源**: ${source.source}\n`;
    if (source.content && source.content.trim() !== '') {
      output += `**摘要**: ${source.content.substring(0, 80)}...\n\n`;
    }
  });
  
  // 简单概述的其他信息
  if (summarySources.length > 0) {
    output += '### 📋 其他值得关注\n\n';
    summarySources.forEach((source, index) => {
      output += `#### 信息 ${index + 1}\n`;
      output += `**标题**: ${source.title}\n`;
      output += `**链接**: ${source.url}\n`;
      output += `**摘要**: ${source.content ? source.content.substring(0, 60) + '...' : '无摘要'}\n\n`;
    });
  }
  
  return output;
}

// ====== 生成AI摘要（极度精简版） ======
async function generateDigest(sourcesData) {
  console.log('🧠 正在生成极度精简洞察...');
  
  const today = new Date().toISOString().split('T')[0];
  const sourcesContext = formatSourcesForAI(sourcesData);
  
  // 【关键】极度精简的prompt，确保不超时
  const prompt = `你是一位AI技术产品专家。请基于${today}的信息，按以下规则生成洞察：

${sourcesContext}

## 严格规则：
1. **深度分析3条**：对最重要的3条信息，每条必须严格包含：
   - 📌 一句话概述（10字内）
   - 🔗 完整URL
   - 💎 核心价值（15字内）
   - 🎯 技术边界（效果+限制+API，20字内）
   - 💡 产品洞见（痛点+用户+交互+竞品，25字内）
   **每条总字数严格≤100字**

2. **其他信息**：对其他信息，每条只包含：
   - 📌 一句话概述（10字内）
   - 🔗 完整URL
   - 💎 核心价值（15字内）

3. **最后**：
   ❓ 1道思考题（20字内）

4. **格式要求**：
   - 用emoji作为视觉锚点
   - 竞品对比用"vs"简写
   - 用数字代替模糊描述
   - 语言极度精练，删除所有废话
   - 总字数≤400字`;

  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: 'qwen-turbo', // 使用最快的模型
        input: {
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        parameters: {
          result_format: 'message'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 90000 // 90秒超时
      }
    );

    if (response.data?.output?.choices?.[0]?.message?.content) {
      const digest = response.data.output.choices[0].message.content;
      console.log('✅ 洞察生成成功');
      console.log('📋 预览:', digest.substring(0, 200) + '...');
      return digest;
    } else if (response.data?.output?.text) {
      const digest = response.data.output.text;
      console.log('✅ 洞察生成成功');
      console.log('📋 预览:', digest.substring(0, 200) + '...');
      return digest;
    } else {
      console.error('❌ API响应格式不正确');
      throw new Error('无法解析API响应');
    }
      
  } catch (error) {
    console.error('❌ AI生成失败:', error.message);
    if (error.response?.data) {
      console.error('API响应:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// ====== 生成原始信息源摘要 ======
function generateSourcesSummary(sourcesData) {
  const { deepAnalysisSources, summarySources } = sourcesData;
  
  let summary = '## 📚 原始信息源\n\n';
  
  // 深度分析的信息源
  summary += '### 🔍 深度分析信息源\n\n';
  deepAnalysisSources.forEach((source, index) => {
    summary += `${index + 1}. [${source.title.substring(0, 40)}${source.title.length > 40 ? '...' : ''}](${source.url})\n`;
    summary += `   来源: ${source.source}\n\n`;
  });
  
  // 其他信息源
  if (summarySources.length > 0) {
    summary += '### 📋 其他信息源\n\n';
    summarySources.forEach((source, index) => {
      summary += `${index + 1}. [${source.title.substring(0, 40)}${source.title.length > 40 ? '...' : ''}](${source.url})\n`;
      summary += `   来源: ${source.source}\n\n`;
    });
  }
  
  return summary;
}

// ====== 推送至飞书 ======
async function sendToFeishu(content, sourcesData) {
  console.log('🚀 正在推送至飞书...');
  
  const webhook = process.env.FEISHU_WEBHOOK;
  if (!webhook) {
    throw new Error('❌ FEISHU_WEBHOOK 环境变量未设置');
  }

  const currentDate = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long'
  });

  const sourcesSummary = generateSourcesSummary(sourcesData);
  
  const cardContent = {
    config: {
      wide_screen_mode: true
    },
    header: {
      title: {
        content: `AI洞察 | ${currentDate}`,
        tag: 'plain_text'
      },
      template: 'orange'  // 橙色，突出精简
    },
    elements: [
      {
        tag: 'div',
        text: {
          content: content,
          tag: 'lark_md'
        }
      },
      {
        tag: 'hr'
      },
      {
        tag: 'div',
        text: {
          content: sourcesSummary,
          tag: 'lark_md'
        }
      },
      {
        tag: 'hr'
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: `⚡ 极简版 | 3条深度+${sourcesData.summarySources.length}条概述 | ${new Date().toLocaleTimeString()}`
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(
      webhook,
      {
        msg_type: 'interactive',
        card: cardContent
      },
      {
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Tech-Insight-Ultra'
        },
        timeout: 10000
      }
    );

    if (response.data?.code === 0) {
      console.log('✅ 洞察简报已成功发送至飞书！');
      return true;
    } else {
      console.error('❌ 飞书API返回错误:', response.data);
      throw new Error('飞书API错误');
    }
  } catch (error) {
    console.error('❌ 飞书推送失败:', error.message);
    throw error;
  }
}

// ====== 保存摘要到文件 ======
async function saveDigestToFile(content, sourcesData) {
  try {
    const filename = `digest_${new Date().toISOString().split('T')[0]}.md`;
    const sourcesSummary = generateSourcesSummary(sourcesData);
    
    const fullContent = `${content}\n\n${'='.repeat(60)}\n\n${sourcesSummary}\n\n生成时间: ${new Date().toISOString()}`;
    
    await fs.writeFile(filename, fullContent, 'utf-8');
    console.log(`💾 洞察已保存到文件: ${filename}`);
  } catch (error) {
    console.error('❌ 保存文件失败:', error.message);
  }
}

// ====== 主流程 ======
async function main() {
  console.log('========================================');
  console.log('🚀 AI技术洞察简报 - 极简高效版');
  console.log('========================================\n');
  
  try {
    // 1. 获取数据
    const sourcesData = await fetchAllSources();
    
    // 2. 生成极度精简洞察
    const digest = await generateDigest(sourcesData);
    
    // 3. 保存到文件
    await saveDigestToFile(digest, sourcesData);
    
    // 4. 推送至飞书
    await sendToFeishu(digest, sourcesData);
    
    console.log('\n========================================');
    console.log('✅ 全部任务成功完成！');
    console.log('========================================');
    
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ 任务失败:', error.message);
    console.error('========================================');
    process.exit(1);
  }
}

// ====== 启动程序 ======
main();
