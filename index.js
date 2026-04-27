// ====== 依赖导入 ======
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// ====== 数据源配置 ======
const DATA_SOURCES = {
  blogs: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json",
  podcasts: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json",
  x: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json"
};

// ====== 缓存文件路径 ======
const CACHE_FILE = path.join(__dirname, 'cache.json');

// ====== 读取缓存 ======
async function readCache() {
  try {
    const cacheData = await fs.readFile(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(cacheData);
    
    // 检查是否是今天的数据，如果不是则重置
    const cacheDate = cache.lastProcessed?.timestamp ? 
      new Date(cache.lastProcessed.timestamp).toISOString().split('T')[0] : 
      null;
    
    const today = new Date().toISOString().split('T')[0];
    
    if (cacheDate !== today) {
      console.log(`📅 缓存非今日数据(${cacheDate})，重置为今日`);
      return { 
        lastProcessed: { 
          timestamp: null, 
          urlWithMetadata: {}
        } 
      };
    }
    
    return cache;
  } catch (error) {
    console.log('📝 缓存文件不存在，将创建新的');
    return { 
      lastProcessed: { 
        timestamp: null, 
        urlWithMetadata: {}
      } 
    };
  }
}

// ====== 写入缓存 ======
async function writeCache(cache) {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    console.log('💾 缓存已更新');
  } catch (error) {
    console.error('❌ 缓存写入失败:', error.message);
  }
}

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
      timestamp: blog.timestamp || new Date().toISOString(),
      weight: 12
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
      timestamp: podcast.timestamp || new Date().toISOString(),
      weight: 10
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
            const engagementWeight = Math.min((tweet.likes + tweet.retweets * 2) / 15, 6);
            tweets.push({
              type: 'tweet',
              title: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
              source: `${user.name} (@${user.handle})`,
              url: tweet.url,
              content: tweet.text,
              likes: tweet.likes || 0,
              retweets: tweet.retweets || 0,
              timestamp: tweet.timestamp || new Date().toISOString(),
              weight: 6 + engagementWeight
            });
          });
        }
      });
    }
    
    const filteredTweets = tweets.filter(tweet => tweet.likes >= 10);
    console.log(`✅ 获取到 ${filteredTweets.length} 条有效推文`);
    return filteredTweets;
  } catch (error) {
    console.error('❌ 获取 X 数据失败:', error.message);
    return [];
  }
}

// ====== 智能过滤：找出真正的"新内容" ======
function findTrulyNewSources(allSources, cachedMetadata) {
  const trulyNewSources = [];
  
  for (const source of allSources) {
    const cachedInfo = cachedMetadata[source.url];
    
    if (!cachedInfo) {
      // 完全新内容
      trulyNewSources.push({ ...source, isNew: true });
    } else {
      // 检查是否内容有更新
      const currentTime = new Date(source.timestamp);
      const cachedTime = new Date(cachedInfo.timestamp);
      
      if (currentTime > cachedTime) {
        trulyNewSources.push({ ...source, isNew: true });
      }
    }
  }
  
  console.log(`📊 真正的新信息: ${trulyNewSources.length} 条`);
  return trulyNewSources;
}

// ====== 智能选择最重要的3条信息 ======
function selectTop3Sources(sources) {
  // 按权重排序
  const sortedSources = [...sources].sort((a, b) => {
    if (b.weight === a.weight) return new Date(b.timestamp) - new Date(a.timestamp);
    return b.weight - a.weight;
  });
  
  // 确保类型多样性
  const selected = [];
  const typeCount = { blog: 0, podcast: 0, tweet: 0 };
  
  // 第一轮：类型平衡选择
  for (const source of sortedSources) {
    if (selected.length >= 3) break;
    
    if (source.type === 'blog' && typeCount.blog >= 1) continue;
    if (source.type === 'podcast' && typeCount.podcast >= 1) continue;
    if (source.type === 'tweet' && typeCount.tweet >= 1) continue;
    
    selected.push(source);
    typeCount[source.type]++;
  }
  
  // 第二轮：补充不足
  if (selected.length < 3) {
    for (const source of sortedSources) {
      if (selected.length >= 3) break;
      if (!selected.some(s => s.url === source.url)) {
        selected.push(source);
      }
    }
  }
  
  console.log('🎯 智能选择的3条最重要新信息:');
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
    
    // 读取缓存
    const cache = await readCache();
    const cachedMetadata = cache.lastProcessed.urlWithMetadata || {};
    
    // 智能过滤：找出真正的"新内容"
    const trulyNewSources = findTrulyNewSources(allSources, cachedMetadata);
    
    if (trulyNewSources.length === 0) {
      console.log('✅ 今日无真正新信息，跳过处理');
      return null;
    }
    
    // 智能选择最重要的3条进行深度分析
    const deepAnalysisSources = selectTop3Sources(trulyNewSources);
    
    // 其他新信息
    const summarySources = trulyNewSources.filter(source => 
      !deepAnalysisSources.some(s => s.url === source.url)
    );
    
    console.log(`📋 其他新信息数量: ${summarySources.length} 条`);
    
    // 更新缓存
    const updatedMetadata = { ...cachedMetadata };
    [...deepAnalysisSources, ...summarySources].forEach(source => {
      updatedMetadata[source.url] = {
        timestamp: source.timestamp,
        processedAt: new Date().toISOString(),
        type: source.type
      };
    });
    
    cache.lastProcessed = {
      timestamp: new Date().toISOString(),
      urlWithMetadata: updatedMetadata
    };
    
    await writeCache(cache);
    
    return {
      deepAnalysisSources,
      summarySources,
      timestamp: new Date().toISOString(),
      totalNew: trulyNewSources.length
    };
  } catch (error) {
    console.error('❌ 获取数据源失败:', error.message);
    throw error;
  }
}

// ====== 生成AI摘要（中英混用版） ======
async function generateDigest(sourcesData) {
  console.log('🧠 正在生成中英混用格式化深度解析...');
  
  const today = new Date().toISOString().split('T')[0];
  const { deepAnalysisSources, summarySources } = sourcesData;
  
  // 构建上下文
  let context = `## ${today} AI技术中英混用洞察（今日新增${sourcesData.totalNew}条）\n\n`;
  
  // 深度分析的3条信息
  context += '### 🔍 深度分析（3条最重要新信息）\n';
  deepAnalysisSources.forEach((source, i) => {
    context += `\n#### 深度分析 ${i + 1}\n`;
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
  
  // 其他新信息
  if (summarySources.length > 0) {
    context += `\n### 📋 其他新信息（共 ${summarySources.length} 条）\n`;
    summarySources.forEach((source, i) => {
      context += `\n#### 其他信息 ${i + 1}\n`;
      context += `**标题**: ${source.title}\n`;
      context += `**链接**: ${source.url}\n`;
      context += `**来源**: ${source.source}\n`;
    });
  });
  
  // 【关键】支持中英混用的提示词
  const prompt = `你是一位资深AI技术产品专家，每日为技术决策者提供中英混用的专业洞察。请基于${today}的新信息，生成分析时注意：

${context}

## 严格要求：
1. **深度分析3条**：对最重要的3条新信息，**每条必须严格按照以下5个模块顺序输出**：
   📌 信息一句话概述（中文为主，产品名/专业术语保持英文）
   🔗 呈现完整URL  
   💎 核心价值（中文为主，技术特性可保留英文术语）
   🎯 技术边界分析（效果、技术限制、新API）- 中文为主，API名称保持英文
   💡 产品洞见（解决痛点、用户定位、交互革新、竞品对比分析）- 中文为主

2. **其他所有新信息**：对剩余的${summarySources.length}条新信息，**每条必须严格按照以下3个模块顺序输出**：
   📌 信息一句话概述（中文为主，产品名保持英文）
   🔗 呈现完整URL
   💎 核心价值（中文为主，专业术语保持英文）
   **每条严格控制在60字以内**

3. **最后**：
   ❓ 1道思考题（30字以内，中文为主）

4. **格式要求**：
   - 严格按照上述模块顺序，不能打乱
   - 使用 📌 🔗 💎 🎯 💡 符号标记各模块
   - 深度分析部分：每个模块一行
   - 其他信息部分：概述+URL+价值在同一行
   - 语言精练专业，避免废话

5. **中英混用原则**：
   - **中文为主**：分析、解释、总结使用中文
   - **英文保留**：产品名、品牌名、API名称、技术术语、公司名保持英文
   - **自然融合**：如"OpenAI's GPT模型"、"React框架"、"ChatGPT应用"

6. **内容要求**：
   - 用具体数字和场景，避免模糊描述
   - 技术分析突出效果数据
   - 产品分析强调差异化价值

7. **整体要求**：
   - **总字数严格控制在1200字以内**
   - 不要包含"原始信息源"、"数据来源"等无关内容`;

  try {
    // 安全：绝不记录敏感API密钥
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: 'qwen-plus',
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
          'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,  // 安全，绝不会记录
          'Content-Type': 'application/json'
        },
        timeout: 150000
      }
    );

    if (response.data?.output?.choices?.[0]?.message?.content) {
      const digest = response.data.output.choices[0].message.content;
      console.log('✅ 中英混用格式化洞察生成成功');
      
      const charCount = digest.replace(/\s+/g, '').length;
      console.log(`📊 生成内容: ${charCount}字符`);
      
      return digest;
    } else {
      console.error('❌ API响应格式不正确');
      throw new Error('无法解析API响应');
    }
      
  } catch (error) {
    console.error('❌ AI生成失败:', error.message);
    throw error;
  }
}

// ====== 推送至飞书（安全增强） ======
async function sendToFeishu(content, sourcesData) {
  console.log('🚀 正在推送至飞书...');
  
  // 安全：验证webhook是否存在而不记录其值
  const webhook = process.env.FEISHU_WEBHOOK;
  if (!webhook) {
    throw new Error('❌ FEISHU_WEBHOOK 环境变量未设置');
  }

  // 安全：绝不记录实际webhook URL
  // console.log('Webhook URL:', webhook);  // ❌ 绝不这样做！

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
        content: `AI中英混用洞察 | ${currentDate} (新增${sourcesData.totalNew}条)`,
        tag: 'plain_text'
      },
      template: 'blue'  // 蓝色，表示中英混用
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
            content: `✅ 3条深度(5模块) + ${summarySources.length}条其他(3模块) | 北京时间16:30推送`
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(
      webhook,  // 安全引用，不会记录
      {
        msg_type: 'interactive',
        card: cardContent
      },
      {
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Tech-Insight-Secure-Bilingual'
        },
        timeout: 20000
      }
    );

    if (response.data?.code === 0) {
      console.log('✅ 中英混用洞察简报已成功发送至飞书！');
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
    const filename = `digest_${new Date().toISOString().split('T')[0]}_bilingual.md`;
    
    const { deepAnalysisSources, summarySources } = sourcesData;
    const metadata = `# AI技术中英混用洞察摘要\n生成时间: ${new Date().toISOString()}\n推送时间: 北京时间 16:30\n深度分析条数: ${deepAnalysisSources.length}\n其他新信息条数: ${summarySources.length}\n总新增信息: ${sourcesData.totalNew}\n格式: 中英混用(中文为主+英文术语)\n`;
    
    const fullContent = `${metadata}\n${'='.repeat(80)}\n\n${content}`;
    
    await fs.writeFile(filename, fullContent, 'utf-8');
    console.log(`💾 中英混用洞察已保存到文件: ${filename}`);
  } catch (error) {
    console.error('❌ 保存文件失败:', error.message);
  }
}

// ====== 主流程 ======
async function main() {
  console.log('========================================');
  console.log('🚀 AI中英混用洞察简报 - 精确版');
  console.log('当前时间:', new Date().toISOString());
  console.log('北京时间:', new Date(new Date().getTime() + 8*3600*1000).toISOString());
  console.log('========================================\n');
  
  try {
    // 1. 获取数据（带真实增量检测）
    const sourcesData = await fetchAllSources();
    
    // 如果没有新信息，跳过处理
    if (!sourcesData) {
      console.log('✅ 今日无新信息，任务结束');
      return;
    }
    
    // 2. 生成中英混用格式化深度解析
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
