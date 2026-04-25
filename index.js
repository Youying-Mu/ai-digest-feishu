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
      weight: 10 // 博客权重最高
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
      weight: 8 // 播客单词次之
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
            // 根据点赞数计算权重
            const engagementWeight = Math.min(tweet.likes / 10, 5); // 每10个点赞=1权重，上限5
            tweets.push({
              type: 'tweet',
              title: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
              source: `${user.name} (@${user.handle})`,
              url: tweet.url,
              content: tweet.text,
              likes: tweet.likes || 0,
              timestamp: new Date().toISOString(),
              weight: 5 + engagementWeight // 基础权重5 + 互动权重
            });
          });
        }
      });
    }
    
    // 过滤低质量推文（至少20点赞）
    const filteredTweets = tweets.filter(tweet => tweet.likes >= 20);
    console.log(`✅ 获取到 ${filteredTweets.length} 条高质量推文（原始: ${tweets.length}）`);
    return filteredTweets;
  } catch (error) {
    console.error('❌ 获取 X 数据失败:', error.message);
    return [];
  }
}

// ====== 智能选择最重要的3条信息 ======
function selectTop3Sources(allSources) {
  // 首先按权重排序
  const sortedSources = [...allSources].sort((a, b) => {
    // 权重相同时，按时间倒序
    if (b.weight === a.weight) return new Date(b.timestamp) - new Date(a.timestamp);
    return b.weight - a.weight;
  });
  
  // 智能选择：尽量选择不同类型的来源
  const selected = [];
  const typeCount = { blog: 0, podcast: 0, tweet: 0 };
  
  for (const source of sortedSources) {
    if (selected.length >= 3) break;
    
    // 优先选择博客和播客，限制推文数量
    if (source.type === 'tweet' && typeCount.tweet >= 2) continue;
    if (source.type === 'blog' && typeCount.blog >= 2) continue;
    if (source.type === 'podcast' && typeCount.podcast >= 1) continue;
    
    selected.push(source);
    typeCount[source.type]++;
  }
  
  // 如果还是不够3条，从剩余中选择
  if (selected.length < 3) {
    for (const source of sortedSources) {
      if (selected.length >= 3) break;
      if (!selected.some(s => s.url === source.url)) {
        selected.push(source);
      }
    }
  }
  
  console.log('🎯 智能选择的3条最重要信息:');
  selected.forEach((source, i) => {
    console.log(`   ${i + 1}. [${source.type.toUpperCase()}|权重:${Math.round(source.weight)}] ${source.title.substring(0, 60)}...`);
  });
  
  return selected;
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
    
    console.log(`📊 总共获取到 ${allSources.length} 条信息源`);
    
    // 智能选择最重要的3条进行深度分析
    const deepAnalysisSources = selectTop3Sources(allSources);
    
    // 其他信息作为简单概述
    const summarySources = allSources
      .filter(source => !deepAnalysisSources.some(s => s.url === source.url))
      .slice(0, 5); // 最多5条其他信息
    
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

// ====== 生成AI摘要（智能深度解析版） ======
async function generateDigest(sourcesData) {
  console.log('🧠 正在生成智能深度解析...');
  
  const today = new Date().toISOString().split('T')[0];
  const { deepAnalysisSources, summarySources } = sourcesData;
  
  // 构建上下文
  let context = `## ${today} AI技术洞察\n\n`;
  
  // 深度分析的3条信息
  context += '### 🔍 深度分析（3条最重要信息）\n';
  deepAnalysisSources.forEach((source, i) => {
    context += `\n#### 信息 ${i + 1}\n`;
    context += `**类型**: ${source.type === 'blog' ? '技术博客' : source.type === 'podcast' ? '行业播客' : '产品发布'}\n`;
    context += `**标题**: ${source.title}\n`;
    context += `**链接**: ${source.url}\n`;
    context += `**来源**: ${source.source}\n`;
    context += `**权重**: ${Math.round(source.weight)}\n`;
    if (source.content) {
      context += `**内容摘要**: ${source.content.substring(0, 150)}...\n`;
    } else if (source.transcript) {
      context += `**内容摘要**: ${source.transcript.substring(0, 150)}...\n`;
    }
  });
  
  // 其他信息
  if (summarySources.length > 0) {
    context += '\n### 📋 其他值得关注\n';
    summarySources.forEach((source, i) => {
      context += `\n#### 信息 ${i + 1}\n`;
      context += `**标题**: ${source.title}\n`;
      context += `**链接**: ${source.url}\n`;
      context += `**来源**: ${source.source}\n`;
    });
  }
  
  // 【关键】优化后的prompt，确保深度解析但控制字数
  const prompt = `你是一位资深AI技术产品专家，每日为技术决策者提供洞察。请基于${today}的信息，严格按以下要求生成洞察：

${context}

## 严格要求：
1. **深度分析3条**：对最重要的3条信息，每条必须包含：
   📌 一句话概述
   🔗 完整URL
   💎 核心价值
   🎯 技术边界分析（具体效果数字+技术限制+新API）
   💡 产品洞见（解决痛点+目标用户+交互革新+1个主要竞品对比）
   **每条总字数严格控制在250字以内**

2. **其他信息**：对其他${summarySources.length}条信息，每条只包含：
   📌 一句话概述
   🔗 完整URL  
   💎 核心价值

3. **最后**：
   ❓ 1道思考题（30字以内）

4. **整体要求**：
   - 用具体数字和场景，避免模糊描述（如"性能提升"→"延迟从800ms降至480ms"）
   - 技术分析用自然语言，避免代码细节
   - 产品分析突出差异化和用户价值
   - 语言精练专业，删除所有废话
   - **总字数严格控制在1000字以内**
   - 不要包含"原始信息源"、"数据来源"等无关内容`;

  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: 'qwen-plus', // 平衡速度和质量
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
        timeout: 120000 // 120秒超时
      }
    );

    if (response.data?.output?.choices?.[0]?.message?.content) {
      const digest = response.data.output.choices[0].message.content;
      console.log('✅ 深度解析生成成功');
      
      // 字数统计
      const charCount = digest.replace(/\s+/g, '').length;
      const lineCount = digest.split('\n').length;
      console.log(`📊 生成内容: ${charCount}字符, ${lineCount}行`);
      
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

// ====== 推送至飞书（精简专业版） ======
async function sendToFeishu(content) {
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

  const cardContent = {
    config: {
      wide_screen_mode: true
    },
    header: {
      title: {
        content: `AI深度洞察 | ${currentDate}`,
        tag: 'plain_text'
      },
      template: 'indigo'  // 深蓝色，专业感
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
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: `🧠 深度技术分析 | 3条深度+${summarySourcesCount}条概述 | ${new Date().toLocaleTimeString()}`
          }
        ]
      }
    ]
  };

  // 动态获取summarySourcesCount
  let summarySourcesCount = 0;
  if (content.includes('📋 其他值得关注')) {
    const otherSection = content.split('📋 其他值得关注')[1];
    if (otherSection) {
      summarySourcesCount = (otherSection.match(/🔗/g) || []).length;
    }
  }

  cardContent.elements[2].elements[0].content = cardContent.elements[2].elements[0].content.replace('${summarySourcesCount}', summarySourcesCount);

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
          'User-Agent': 'AI-Tech-Insight-Pro'
        },
        timeout: 15000
      }
    );

    if (response.data?.code === 0) {
      console.log('✅ 深度洞察简报已成功发送至飞书！');
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
async function saveDigestToFile(content) {
  try {
    const filename = `digest_${new Date().toISOString().split('T')[0]}.md`;
    
    const fullContent = `${content}\n\n生成时间: ${new Date().toISOString()}`;
    
    await fs.writeFile(filename, fullContent, 'utf-8');
    console.log(`💾 深度洞察已保存到文件: ${filename}`);
  } catch (error) {
    console.error('❌ 保存文件失败:', error.message);
  }
}

// ====== 主流程 ======
async function main() {
  console.log('========================================');
  console.log('🚀 AI深度洞察简报 - 智能选择版');
  console.log('========================================\n');
  
  try {
    // 1. 获取数据
    const sourcesData = await fetchAllSources();
    
    // 2. 生成深度解析
    const digest = await generateDigest(sourcesData);
    
    // 3. 保存到文件
    await saveDigestToFile(digest);
    
    // 4. 推送至飞书
    await sendToFeishu(digest);
    
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
