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
    
    // 【优化】过滤低质量推文：点赞数低于5的直接舍弃
    const filteredTweets = tweets.filter(tweet => tweet.likes >= 5);
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

// ====== 格式化数据供 AI 使用 ======
function formatSourcesForAI(sourcesData) {
  const { blogs, podcasts, tweets } = sourcesData;
  
  let output = '';
  
  if (blogs && blogs.length > 0) {
    output += '### 行业博客\n';
    blogs.forEach((blog, i) => {
      output += `${i + 1}. [${blog.source}] ${blog.title}\n`;
      if (blog.content) {
        // 【优化】更精炼的摘要，提取核心价值点
        const keyPoints = blog.content.split('\n')
          .filter(line => line.trim().length > 30 && !line.startsWith('#'))
          .slice(0, 2)
          .map(line => line.trim());
        
        if (keyPoints.length > 0) {
          output += `   💡 ${keyPoints.join(' | ')}\n`;
        }
      }
      output += `   🔗 ${blog.url}\n`;
    });
    output += '\n';
  }
  
  if (podcasts && podcasts.length > 0) {
    output += '### 深度播客\n';
    podcasts.forEach((podcast, i) => {
      output += `${i + 1}. [${podcast.source}] ${podcast.title}\n`;
      if (podcast.transcript) {
        // 【优化】提取商业洞察而非技术细节
        const lines = podcast.transcript.split('\n');
        const insightLines = lines.filter(line => {
          return line.toLowerCase().includes('business') || 
                 line.toLowerCase().includes('strategy') || 
                 line.toLowerCase().includes('market') ||
                 line.toLowerCase().includes('customer') ||
                 line.toLowerCase().includes('technical') ||
                 line.toLowerCase().includes('implementation');
        }).slice(0, 2);
        
        if (insightLines.length > 0) {
          output += `   💡 ${insightLines.join(' | ').substring(0, 150)}...\n`;
        }
      }
      output += `   🔗 ${podcast.url}\n`;
    });
    output += '\n';
  }
  
  if (tweets && tweets.length > 0) {
    output += '### 社交动态\n';
    // 【优化】按点赞数排序，取前8条高质量推文
    const topTweets = tweets
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 8);
    
    topTweets.forEach((tweet, i) => {
      output += `${i + 1}. [@${tweet.handle}] 💯${tweet.likes}\n`;
      output += `   "${tweet.text.substring(0, 100)}${tweet.text.length > 100 ? '...' : ''}"\n`;
      output += `   🔗 ${tweet.url}\n`;
    });
    output += '\n';
  }
  
  return output;
}

// ====== 生成AI摘要（产品经理视角） ======
async function generateDigest(sourcesData) {
  console.log('🧠 正在生成AI产品经理洞察简报...');
  
  const today = new Date().toISOString().split('T')[0];
  const sourcesContext = formatSourcesForAI(sourcesData);
  
  // 【关键】彻底重构prompt，从AI产品经理视角生成
  const prompt = `你是一位深耕AI行业多年的资深产品经理，正在为团队编写内部决策简报。请基于以下真实动态，为${today}提炼一份【AI PM 战略简报】。

${sourcesContext}

## 写作要求（必须严格遵守）：
1. **角色定位**：你不是技术专家，而是产品决策者。关注商业价值、用户体验、竞争壁垒、落地成本。
2. **思考维度**：
   - 对业务的影响（降本/增效/新收入）
   - 用户体验变革（交互模式、使用门槛）
   - 技术（实现过程、边界、难点、趋势、自然语言描述原理）
   - 竞争格局变化（头部玩家战略意图、对比优劣）
   - 个人职业发展（技能需求、市场机会）
3. **结构化输出**（按此顺序，缺一不可）：
   ⚡️ **重磅发布与竞品**：OpenAI/Anthropic/Google等头部公司动作的产品化解读。不超过2条。
   🏗️ **Agent生产力革命**：Agent技术如何重塑B端/C端工作流。聚焦具体场景，避免技术术语。
   📈 **产业战略观察**：SAP/微软等大厂AI整合策略的深层含义。
   💡 **PM行动洞察**：基于今日动态，给出1条可立即执行的产品决策建议。
4. **格式要求**：
   - 每个要点用短句，不超过3行
   - 避免技术细节，多用"用户将..."、"企业可以..."、"这意味着..."句式
   - 总字数严格控制在500字以内
   - 用emoji做视觉锚点，增强可读性`;

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
        console.log('✅ 产品洞察简报生成成功');
        console.log('📋 简报预览:', digest.substring(0, 100) + '...');
        return digest;
      } else if (response.data?.output?.text) {
        const digest = response.data.output.text;
        console.log('✅ 产品洞察简报生成成功');
        console.log('📋 简报预览:', digest.substring(0, 100) + '...');
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

// ====== 推送至飞书（富文本卡片版本） ======
async function sendToFeishu(content) {
  console.log('🚀 正在推送至飞书（富文本卡片）...');
  
  const webhook = process.env.FEISHU_WEBHOOK;
  if (!webhook) {
    throw new Error('❌ FEISHU_WEBHOOK 环境变量未设置');
  }

  // 【关键】飞书富文本卡片格式
  const currentDate = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long'
  });

  // 将内容按段落分割，用于富文本格式化
  const sections = content.split('\n').filter(line => line.trim() !== '');
  
  // 构建富文本卡片内容
  const cardContent = {
    config: {
      wide_screen_mode: true
    },
    header: {
      title: {
        content: `🤖 AI PM 战略简报 | ${currentDate}`,
        tag: 'plain_text'
      },
      template: 'blue'  // 蓝色标题栏
    },
    elements: [
      {
        tag: 'div',
        text: {
          content: '## ⚡️ 重磅发布与竞品',
          tag: 'lark_md'
        }
      },
      {
        tag: 'hr'  // 分割线
      }
    ]
  };

  // 动态构建内容区域
  let currentSection = '';
  let inSection = false;

  sections.forEach(line => {
    if (line.includes('⚡️ **重磅发布与竞品**') || line.includes('⚡️ 重磅发布与竞品')) {
      currentSection = '⚡️ 重磅发布与竞品';
      inSection = true;
      return;
    }
    if (line.includes('🏗️ **Agent生产力革命**') || line.includes('🏗️ Agent生产力革命')) {
      currentSection = '🏗️ Agent生产力革命';
      inSection = true;
      return;
    }
    if (line.includes('📈 **产业战略观察**') || line.includes('📈 产业战略观察')) {
      currentSection = '📈 产业战略观察';
      inSection = true;
      return;
    }
    if (line.includes('💡 **PM行动洞察**') || line.includes('💡 PM行动洞察')) {
      currentSection = '💡 PM行动洞察';
      inSection = true;
      return;
    }

    if (inSection && line.trim() !== '') {
      // 根据不同部分添加不同样式
      if (currentSection === '⚡️ 重磅发布与竞品') {
        cardContent.elements.push({
          tag: 'div',
          text: {
            content: `- ${line.trim().replace(/^- /, '')}`,
            tag: 'lark_md'
          }
        });
      } else if (currentSection === '🏗️ Agent生产力革命') {
        if (cardContent.elements[cardContent.elements.length - 1].tag !== 'hr') {
          cardContent.elements.push({ tag: 'hr' });
          cardContent.elements.push({
            tag: 'div',
            text: {
              content: '## 🏗️ Agent生产力革命',
              tag: 'lark_md'
            }
          });
        }
        cardContent.elements.push({
          tag: 'div',
          text: {
            content: `- ${line.trim().replace(/^- /, '')}`,
            tag: 'lark_md'
          }
        });
      } else if (currentSection === '📈 产业战略观察') {
        if (cardContent.elements[cardContent.elements.length - 1].tag !== 'hr') {
          cardContent.elements.push({ tag: 'hr' });
          cardContent.elements.push({
            tag: 'div',
            text: {
              content: '## 📈 产业战略观察',
              tag: 'lark_md'
            }
          });
        }
        cardContent.elements.push({
          tag: 'div',
          text: {
            content: `- ${line.trim().replace(/^- /, '')}`,
            tag: 'lark_md'
          }
        });
      } else if (currentSection === '💡 PM行动洞察') {
        if (cardContent.elements[cardContent.elements.length - 1].tag !== 'hr') {
          cardContent.elements.push({ tag: 'hr' });
          cardContent.elements.push({
            tag: 'div',
            text: {
              content: '## 💡 PM行动洞察',
              tag: 'lark_md'
            }
          });
        }
        cardContent.elements.push({
          tag: 'div',
          text: {
            content: `🚀 ${line.trim().replace(/^- /, '')}`,
            tag: 'lark_md'
          }
        });
      }
    }
  });

  // 添加底部信息
  cardContent.elements.push({ tag: 'hr' });
  cardContent.elements.push({
    tag: 'note',
    elements: [
      {
        tag: 'plain_text',
        content: `💡 源自 Follow-Builders | ${new Date().toLocaleDateString()} 自动生成`
      }
    ]
  });

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
          'User-Agent': 'AI-Digest-Bot'
        },
        timeout: 15000
      }
    );

    if (response.data?.code === 0) {
      console.log('✅ 战略简报已成功以富文本卡片形式发送至飞书！');
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
async function saveDigestToFile(content) {
  try {
    const filename = `digest_${new Date().toISOString().split('T')[0]}.md`;
    await fs.writeFile(filename, content, 'utf-8');
    console.log(`💾 战略简报已保存到文件: ${filename}`);
  } catch (error) {
    console.error('❌ 保存文件失败:', error.message);
  }
}

// ====== 主流程 ======
async function main() {
  console.log('========================================');
  console.log('🚀 AI产品经理战略简报 - 开始执行（富文本卡片版）');
  console.log('========================================\n');
  
  try {
    // 1. 获取数据（带过滤）
    const sourcesData = await fetchAllSources();
    
    // 2. 生成产品洞察
    const digest = await generateDigest(sourcesData);
    
    // 3. 保存到文件
    await saveDigestToFile(digest);
    
    // 4. 推送至飞书（富文本卡片）
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
