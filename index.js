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
    
    const blogs = (data.blogs || []).map(blog => ({
      type: 'blog',
      title: blog.title,
      source: blog.name,
      url: blog.url,
      content: blog.content || blog.description || '',
      timestamp: new Date().toISOString()
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
    
    const podcasts = (data.podcasts || []).map(podcast => ({
      type: 'podcast',
      title: podcast.title,
      source: podcast.name,
      url: podcast.url,
      transcript: podcast.transcript || '',
      timestamp: new Date().toISOString()
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
    
    const tweets = [];
    if (data.x && Array.isArray(data.x)) {
      data.x.forEach(user => {
        if (user.tweets && Array.isArray(user.tweets)) {
          user.tweets.forEach(tweet => {
            tweets.push({
              type: 'tweet',
              title: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
              source: `${user.name} (@${user.handle})`,
              url: tweet.url,
              content: tweet.text,
              likes: tweet.likes || 0,
              timestamp: new Date().toISOString()
            });
          });
        }
      });
    }
    
    // 【优化】过滤低质量推文：点赞数低于25的直接舍弃
    const filteredTweets = tweets.filter(tweet => tweet.likes >= 25);
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
    const [blogs, podcasts, tweets] = await Promise.all([
      fetchBlogs(),
      fetchPodcasts(),
      fetchXData()
    ]);
    
    // 合并所有数据源并按时间排序（最新在前）
    const allSources = [
      ...blogs.map(item => ({ ...item, priority: 3 })),    // 博客优先级最高
      ...podcasts.map(item => ({ ...item, priority: 2 })), // 播客次之
      ...tweets.map(item => ({ ...item, priority: 1 }))    // 推文最低
    ].sort((a, b) => {
      // 先按优先级排序，再按时间倒序
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    // 只取前6条最重要的信息
    const topSources = allSources.slice(0, 6);
    
    return {
      sources: topSources,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ 获取数据源失败:', error.message);
    throw error;
  }
}

// ====== 格式化数据供 AI 使用（保持原始结构） ======
function formatSourcesForAI(sourcesData) {
  const { sources } = sourcesData;
  
  let output = '## 今日关键信息源（按优先级排序）\n\n';
  
  sources.forEach((source, index) => {
    output += `### 信息源 ${index + 1}\n`;
    output += `**类型**: ${source.type === 'blog' ? '技术博客' : source.type === 'podcast' ? '行业播客' : '产品/API发布'}\n`;
    output += `**标题**: ${source.title}\n`;
    output += `**来源**: ${source.source}\n`;
    output += `**链接**: ${source.url}\n`;
    
    if (source.content && source.content.trim() !== '') {
      // 提取关键内容片段
      const contentPreview = source.content.substring(0, 300) + (source.content.length > 300 ? '...' : '');
      output += `**内容预览**: ${contentPreview}\n`;
    } else if (source.transcript && source.transcript.trim() !== '') {
      const transcriptPreview = source.transcript.substring(0, 300) + (source.transcript.length > 300 ? '...' : '');
      output += `**内容预览**: ${transcriptPreview}\n`;
    }
    
    output += `\n`;
  });
  
  return output;
}

// ====== 生成AI摘要（逐条深度分析） ======
async function generateDigest(sourcesData) {
  console.log('🧠 正在生成逐条深度分析...');
  
  const today = new Date().toISOString().split('T')[0];
  const sourcesContext = formatSourcesForAI(sourcesData);
  
  // 【关键】彻底重构prompt，逐条分析+思考题
  const prompt = `你是一位资深AI技术产品专家，擅长深度分析每个技术动态。请基于${today}的以下信息源，为每个信息源提供深度分析，并在最后提出一道思考题。

${sourcesContext}

## 分析要求（必须严格遵守）：
1. **逐条分析**：对每个信息源独立分析，不要汇总
2. **分析结构**（对每个信息源，按此顺序）：
   📌 **一句话概述**：用1句话总结该信息的核心
   🔗 **完整链接**：显示完整的URL链接
   💎 **核心价值**：该技术/产品解决了什么核心问题？对用户/企业的价值是什么？
   🎯 **技术边界分析**：
   - 能实现什么具体效果（用数字说明）
   - 技术限制和边界（什么场景不适用）
   - 新发布的API及其关键参数
   💡 **产品洞见**：
   - 解决的核心痛点
   - 目标用户定位
   - 交互方式革新
   - 与1-2个主要竞品的对比分析（用简表）
3. **最后部分**：
   ❓ **思考题**：基于今日所有信息，提出1道深度思考题，帮助读者提升产品思维
4. **写作原则**：
   - 用具体数字和场景，避免模糊描述
   - 技术分析用自然语言，避免代码
   - 产品分析包含具体用户场景
   - 竞品对比要客观，突出差异化
5. **格式要求**：
   - 每个信息源用"---"分隔
   - 每个分析模块用emoji作为视觉锚点
   - 竞品对比用Markdown表格
   - 总字数控制在800字以内
   - 语言精练，直击要害`;

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
          parameters: {
            result_format: 'message'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      if (response.data?.output?.choices?.[0]?.message?.content) {
        const digest = response.data.output.choices[0].message.content;
        console.log('✅ 逐条深度分析生成成功');
        console.log('📋 分析预览:', digest.substring(0, 200) + '...');
        return digest;
      } else if (response.data?.output?.text) {
        const digest = response.data.output.text;
        console.log('✅ 逐条深度分析生成成功');
        console.log('📋 分析预览:', digest.substring(0, 200) + '...');
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
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// ====== 生成原始信息源摘要 ======
function generateSourcesSummary(sourcesData) {
  const { sources } = sourcesData;
  
  let summary = '## 原始信息源清单\n\n';
  
  sources.forEach((source, index) => {
    summary += `### ${index + 1}. ${source.title.substring(0, 60)}${source.title.length > 60 ? '...' : ''}\n`;
    summary += `- **类型**: ${source.type === 'blog' ? '技术博客' : source.type === 'podcast' ? '行业播客' : '产品/API发布'}\n`;
    summary += `- **来源**: ${source.source}\n`;
    summary += `- **链接**: [点击查看完整内容](${source.url})\n`;
    summary += `- **优先级**: ${source.priority}\n\n`;
  });
  
  return summary;
}

// ====== 推送至飞书（逐条深度分析卡片） ======
async function sendToFeishu(content, sourcesData) {
  console.log('🚀 正在推送至飞书（逐条深度分析版）...');
  
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

  // 生成原始信息源摘要
  const sourcesSummary = generateSourcesSummary(sourcesData);
  
  // 【关键】逐条深度分析富文本卡片格式
  const cardContent = {
    config: {
      wide_screen_mode: true
    },
    header: {
      title: {
        content: `AI技术深度洞察 | ${currentDate}`,
        tag: 'plain_text'
      },
      template: 'blue'  // 蓝色，专业深度感
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
          content: '## 📚 原始信息源清单\n\n点击链接查看完整内容',
          tag: 'lark_md'
        }
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
            content: `🔍 深度技术分析 | 生成时间: ${new Date().toLocaleTimeString()}`
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
          'User-Agent': 'AI-Tech-Deep-Dive'
        },
        timeout: 15000
      }
    );

    if (response.data?.code === 0) {
      console.log('✅ 逐条深度分析简报已成功发送至飞书！');
      return true;
    } else {
      console.error('❌ 飞书API返回错误:', response.data);
      throw new Error(`飞书 API 返回错误: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error('❌ 飞书推送失败:', error.message);
    if (error.response) {
      console.error('飞书响应状态:', error.response.status);
      console.error('飞书响应数据:', error.response.data);
    } else if (error.request) {
      console.error('飞书请求超时或无响应');
    }
    throw error;
  }
}

// ====== 保存摘要到文件 ======
async function saveDigestToFile(content, sourcesData) {
  try {
    const filename = `digest_${new Date().toISOString().split('T')[0]}.md`;
    const sourcesSummary = generateSourcesSummary(sourcesData);
    
    const fullContent = `${content}\n\n${'='.repeat(100)}\n\n${sourcesSummary}\n\n生成时间: ${new Date().toISOString()}`;
    
    await fs.writeFile(filename, fullContent, 'utf-8');
    console.log(`💾 深度分析简报已保存到文件: ${filename}`);
  } catch (error) {
    console.error('❌ 保存文件失败:', error.message);
  }
}

// ====== 主流程 ======
async function main() {
  console.log('========================================');
  console.log('🚀 AI技术深度洞察简报 - 逐条分析版');
  console.log('========================================\n');
  
  try {
    // 1. 获取数据（带优先级排序）
    const sourcesData = await fetchAllSources();
    
    console.log(`📊 今日分析 ${sourcesData.sources.length} 个关键信息源`);
    sourcesData.sources.forEach((source, i) => {
      console.log(`   ${i + 1}. [${source.type.toUpperCase()}] ${source.title.substring(0, 50)}...`);
    });
    
    // 2. 生成逐条深度分析
    const digest = await generateDigest(sourcesData);
    
    // 3. 保存到文件
    await saveDigestToFile(digest, sourcesData);
    
    // 4. 推送至飞书（逐条深度分析卡片）
    await sendToFeishu(digest, sourcesData);
    
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
