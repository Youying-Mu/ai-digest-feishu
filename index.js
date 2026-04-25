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
      weight: 12 // 博客权重最高
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
      weight: 10 // 播客单词次之
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
            // 根据点赞数和互动计算权重
            const engagementWeight = Math.min((tweet.likes + tweet.retweets * 2) / 15, 6); // 每15互动=1权重，上限6
            tweets.push({
              type: 'tweet',
              title: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
              source: `${user.name} (@${user.handle})`,
              url: tweet.url,
              content: tweet.text,
              likes: tweet.likes || 0,
              retweets: tweet.retweets || 0,
              timestamp: new Date().toISOString(),
              weight: 6 + engagementWeight // 基础权重6 + 互动权重
            });
          });
        }
      });
    }
    
    // 只过滤极低质量推文（至少10点赞）
    const filteredTweets = tweets.filter(tweet => tweet.likes >= 10);
    console.log(`✅ 获取到 ${filteredTweets.length} 条有效推文（原始: ${tweets.length}）`);
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
  
  // 智能选择：确保来源多样性
  const selected = [];
  const typeCount = { blog: 0, podcast: 0, tweet: 0 };
  
  // 第一轮：优先选择高权重且类型平衡
  for (const source of sortedSources) {
    if (selected.length >= 3) break;
    
    // 严格限制每种类型数量
    if (source.type === 'blog' && typeCount.blog >= 1) continue;
    if (source.type === 'podcast' && typeCount.podcast >= 1) continue;
    if (source.type === 'tweet' && typeCount.tweet >= 1) continue;
    
    selected.push(source);
    typeCount[source.type]++;
  }
  
  // 第二轮：如果还不够3条，放宽类型限制
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
    
    // **关键修复**：所有其他信息都显示，不做数量限制
    const summarySources = allSources.filter(source => 
      !deepAnalysisSources.some(s => s.url === source.url)
    );
    
    console.log(`📋 其他信息数量: ${summarySources.length} 条`);
    summarySources.slice(0, 3).forEach((source, i) => {
      console.log(`   ${i + 1}. [${source.type.toUpperCase()}] ${source.title.substring(0, 50)}...`);
    });
    if (summarySources.length > 3) {
      console.log(`   ... 共 ${summarySources.length} 条其他信息`);
    }
    
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

// ====== 生成AI摘要（完整信息版） ======
async function generateDigest(sourcesData) {
  console.log('🧠 正在生成完整深度解析...');
  
  const today = new Date().toISOString().split('T')[0];
  const { deepAnalysisSources, summarySources } = sourcesData;
  
  // 构建上下文
  let context = `## ${today} AI技术完整洞察\n\n`;
  
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
      context += `**内容摘要**: ${source.content.substring(0, 200)}...\n`;
    } else if (source.transcript) {
      context += `**内容摘要**: ${source.transcript.substring(0, 200)}...\n`;
    }
  });
  
  // **关键修复**：所有其他信息都显示
  if (summarySources.length > 0) {
    context += `\n### 📋 其他所有信息（共 ${summarySources.length} 条）\n`;
    summarySources.forEach((source, i) => {
      context += `\n#### 信息 ${i + 1}\n`;
      context += `**类型**: ${source.type === 'blog' ? '技术博客' : source.type === 'podcast' ? '行业播客' : '产品动态'}\n`;
      context += `**标题**: ${source.title}\n`;
      context += `**链接**: ${source.url}\n`;
      context += `**来源**: ${source.source}\n`;
      if (source.content) {
        context += `**摘要**: ${source.content.substring(0, 100)}...\n`;
      }
    });
  }
  
  // 【关键】优化prompt，确保完整展示+字数控制
  const prompt = `你是一位资深AI技术产品专家，每日为技术决策者提供完整洞察。请基于${today}的信息，严格按以下要求生成洞察：

${context}

## 严格要求：
1. **深度分析3条**：对最重要的3条信息，每条必须包含：
   📌 一句话概述
   🔗 完整URL
   💎 核心价值
   🎯 技术边界分析（具体效果数字+技术限制+新API）
   💡 产品洞见（解决痛点+目标用户+交互革新+1个主要竞品对比）
   **每条总字数严格控制在250字以内**

2. **其他所有信息**：对剩余的${summarySources.length}条信息，**每条都必须显示**，格式为：
   📌 一句话概述
   🔗 完整URL   
   💎 核心价值
   **每条严格控制在40字以内**

3. **最后**：
   ❓ 1道思考题（30字以内）

4. **整体要求**：
   - 用具体数字和场景，避免模糊描述（如"性能提升"→"延迟从800ms降至480ms"）
   - 技术分析用自然语言，避免代码细节
   - 产品分析突出差异化和用户价值
   - 语言精练专业，删除所有废话
   - **总字数严格控制在1200字以内**
   - 不要包含"原始信息源"、"数据来源"等无关内容
   - 确保所有${summarySources.length}条其他信息都被完整呈现`;

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
        timeout: 150000 // 150秒超时，确保处理大量信息
      }
    );

    if (response.data?.output?.choices?.[0]?.message?.content) {
      const digest = response.data.output.choices[0].message.content;
      console.log('✅ 完整洞察生成成功');
      
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

// ====== 推送至飞书（完整版） ======
async function sendToFeishu(content, sourcesData) {
  console.log('🚀 正在推送至飞书（完整版）...');
  
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

  const { deepAnalysisSources, summarySources } = sourcesData;
  
  const cardContent = {
    config: {
      wide_screen_mode: true
    },
    header: {
      title: {
        content: `AI完整洞察 | ${currentDate}`,
        tag: 'plain_text'
      },
      template: 'violet'  // 紫色，突出完整性
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
            content: `✅ 3条深度分析 + ${summarySources.length}条完整概述 | 字数: ${content.replace(/\s+/g, '').length} | ${new Date().toLocaleTimeString()}`
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
          'User-Agent': 'AI-Tech-Insight-Full'
        },
        timeout: 20000 // 20秒超时
      }
    );

    if (response.data?.code === 0) {
      console.log('✅ 完整洞察简报已成功发送至飞书！');
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
    const filename = `digest_${new Date().toISOString().split('T')[0]}_full.md`;
    
    const { deepAnalysisSources, summarySources } = sourcesData;
    const metadata = `# AI技术洞察摘要\n生成时间: ${new Date().toISOString()}\n深度分析条数: ${deepAnalysisSources.length}\n其他信息条数: ${summarySources.length}\n总信息源: ${deepAnalysisSources.length + summarySources.length}\n`;
    
    const fullContent = `${metadata}\n${'='.repeat(80)}\n\n${content}`;
    
    await fs.writeFile(filename, fullContent, 'utf-8');
    console.log(`💾 完整洞察已保存到文件: ${filename}`);
  } catch (error) {
    console.error('❌ 保存文件失败:', error.message);
  }
}

// ====== 主流程 ======
async function main() {
  console.log('========================================');
  console.log('🚀 AI完整洞察简报 - 无遗漏版');
  console.log('========================================\n');
  
  try {
    // 1. 获取数据
    const sourcesData = await fetchAllSources();
    
    // 2. 生成完整深度解析
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
