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
    
    // 【优化】过滤低质量推文：点赞数低于20的直接舍弃（更严格）
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

// ====== 格式化数据供 AI 使用（极简版） ======
function formatSourcesForAI(sourcesData) {
  const { blogs, podcasts, tweets } = sourcesData;
  
  let output = '';
  
  if (blogs && blogs.length > 0) {
    output += '### 【技术博客】\n';
    blogs.slice(0, 3).forEach((blog, i) => {
      output += `${i + 1}. ${blog.title}\n`;
      output += `来源: ${blog.source}\n`;
      output += `链接: ${blog.url}\n\n`;
    });
  }
  
  if (podcasts && podcasts.length > 0) {
    output += '### 【行业播客】\n';
    podcasts.slice(0, 2).forEach((podcast, i) => {
      output += `${i + 1}. ${podcast.title}\n`;
      output += `来源: ${podcast.source}\n`;
      output += `链接: ${podcast.url}\n\n`;
    });
  }
  
  if (tweets && tweets.length > 0) {
    output += '### 【API/产品发布】\n';
    tweets.slice(0, 4).forEach((tweet, i) => {
      output += `${i + 1}. "${tweet.text.substring(0, 120)}${tweet.text.length > 120 ? '...' : ''}"\n`;
      output += `来源: @${tweet.handle} (👍${tweet.likes})\n`;
      output += `链接: ${tweet.url}\n\n`;
    });
  }
  
  return output;
}

// ====== 生成AI摘要（技术边界+产品洞察） ======
async function generateDigest(sourcesData) {
  console.log('🧠 正在生成技术边界与产品洞见...');
  
  const today = new Date().toISOString().split('T')[0];
  const sourcesContext = formatSourcesForAI(sourcesData);
  
  // 【关键】彻底重构prompt，聚焦技术边界、API、产品创新
  const prompt = `你是一位资深技术产品专家，每天为AI产品经理提供最新技术边界和产品洞见。请基于以下${today}的真实动态，生成一份【AI技术与产品洞察简报】。

${sourcesContext}

## 内容要求（必须严格遵守）：
1. **内容定位**：只关注最有价值的信息，拒绝泛泛而谈。
2. **核心结构**：
   🔗 **动态概述**：用3-4条bullet points列出最重要的技术/产品动态，每条包含：
   - 简洁标题
   - 来源链接
   - 1句话核心价值
   
   🎯 **技术边界分析**：针对最重要的1-2个技术动态，分析：
   - 当前技术能实现什么效果（具体场景）
   - 技术边界和限制（什么做不到）
   - 新发布的API及其能力
   
   💡 **产品洞见**：针对最重要的1-2个产品动态，分析：
   - 产品idea创新点
   - 目标用户定位
   - 交互方式革新
   - 与主要竞品的差异化对比（用简表呈现）
   
   ❓ **思考题**：基于今日动态，提出1个深度思考题，帮助读者提升产品思维。

3. **写作原则**：
   - 用具体数字代替模糊描述（不说“性能提升”，说“延迟从2s降至200ms”）
   - 重点关注对AI产品经理实际有用的信息
   - 技术分析要自然语言描述，避免代码细节
   - 产品分析要包含具体场景和用户价值
4. **格式要求**：
   - 每个模块用emoji作为视觉锚点
   - 竞品对比用简单表格呈现
   - 总字数严格控制在600字以内
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
        console.log('✅ 技术与产品洞察生成成功');
        console.log('📋 洞察预览:', digest.substring(0, 150) + '...');
        return digest;
      } else if (response.data?.output?.text) {
        const digest = response.data.output.text;
        console.log('✅ 技术与产品洞察生成成功');
        console.log('📋 洞察预览:', digest.substring(0, 150) + '...');
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

// ====== 生成信息源摘要（极简版） ======
function generateSourcesSummary(sourcesData) {
  const { blogs, podcasts, tweets } = sourcesData;
  
  let summary = '## 原始信息源\n\n';
  
  if (blogs && blogs.length > 0) {
    summary += '### 📚 技术博客\n';
    blogs.slice(0, 3).forEach(blog => {
      summary += `- [${blog.title.substring(0, 50)}${blog.title.length > 50 ? '...' : ''}](${blog.url})\n`;
      summary += `  来源: ${blog.source}\n\n`;
    });
  }
  
  if (podcasts && podcasts.length > 0) {
    summary += '### 🎙️ 行业播客\n';
    podcasts.slice(0, 2).forEach(podcast => {
      summary += `- [${podcast.title.substring(0, 50)}${podcast.title.length > 50 ? '...' : ''}](${podcast.url})\n`;
      summary += `  来源: ${podcast.source}\n\n`;
    });
  }
  
  if (tweets && tweets.length > 0) {
    summary += '### 💻 API/产品发布\n';
    tweets.slice(0, 4).forEach(tweet => {
      summary += `- [@${tweet.handle}: "${tweet.text.substring(0, 40)}${tweet.text.length > 40 ? '...' : ''}"](${tweet.url})\n`;
      summary += `  点赞: ${tweet.likes}\n\n`;
    });
  }
  
  return summary;
}

// ====== 推送至飞书（极简专业卡片） ======
async function sendToFeishu(content, sourcesData) {
  console.log('🚀 正在推送至飞书（技术产品洞察版）...');
  
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

  // 生成信息源摘要
  const sourcesSummary = generateSourcesSummary(sourcesData);
  
  // 【关键】极简专业富文本卡片格式
  const cardContent = {
    config: {
      wide_screen_mode: true
    },
    header: {
      title: {
        content: `AI技术与产品洞察 | ${currentDate}`,
        tag: 'plain_text'
      },
      template: 'indigo'  // 深蓝色，技术感
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
          content: '## 🔗 原始信息源\n\n点击链接查看详细内容',
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
            content: `🧠 聚焦技术边界与产品创新 | 生成时间: ${new Date().toLocaleTimeString()}`
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
          'User-Agent': 'AI-Tech-Insight'
        },
        timeout: 15000
      }
    );

    if (response.data?.code === 0) {
      console.log('✅ 技术产品洞察简报已成功发送至飞书！');
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
    
    const fullContent = `${content}\n\n${'='.repeat(80)}\n\n${sourcesSummary}\n\n生成时间: ${new Date().toISOString()}`;
    
    await fs.writeFile(filename, fullContent, 'utf-8');
    console.log(`💾 技术产品洞察已保存到文件: ${filename}`);
  } catch (error) {
    console.error('❌ 保存文件失败:', error.message);
  }
}

// ====== 主流程 ======
async function main() {
  console.log('========================================');
  console.log('🚀 AI技术与产品洞察简报 - 极简专业版');
  console.log('========================================\n');
  
  try {
    // 1. 获取数据（带严格过滤）
    const sourcesData = await fetchAllSources();
    
    // 2. 生成技术产品洞察
    const digest = await generateDigest(sourcesData);
    
    // 3. 保存到文件
    await saveDigestToFile(digest, sourcesData);
    
    // 4. 推送至飞书（极简专业卡片）
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
