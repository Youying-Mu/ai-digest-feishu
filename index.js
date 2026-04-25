// ====== 依赖导入 ======
const axios = require('axios');
const fs = require('fs').promises;

// ====== 配置 ======
const CONFIG = {
  // X (Twitter) 用户列表
  twitterUsers: [
    'OpenAI',
    'GoogleAI',
    'MetaAI',
    'AnthropicAI',
    'xAI'
  ],
  // 博客源
  blogs: [
    { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss' },
    { name: 'Google AI Blog', url: 'https://ai.googleblog.com/feeds/posts/default?alt=rss' },
    { name: 'Meta AI Blog', url: 'https://ai.meta.com/blog/rss/' }
  ],
  // 获取最近的推文数量
  tweetCount: 5,
  // 获取最近的博客文章数量
  blogCount: 3
};

// ====== 获取 X (Twitter) 推文 ======
async function fetchTweets() {
  console.log('🐦 正在获取 X 推文...');
  
  // 模拟数据（实际项目中这里应该调用 Twitter API）
  // 由于 Twitter API 需要认证，这里先用模拟数据演示
  const mockTweets = [
    { user: 'OpenAI', text: '我们发布了新的 GPT-4.5 模型，性能提升 30%' },
    { user: 'GoogleAI', text: 'Gemini 2.0 正式上线，支持多模态推理' },
    { user: 'MetaAI', text: 'Llama 3 开源，100B 参数版本免费使用' },
    { user: 'AnthropicAI', text: 'Claude 3.5 发布，代码生成能力大幅提升' },
    { user: 'xAI', text: 'Grok 2 进入测试阶段，专注于科学推理' }
  ];
  
  console.log(`✅ 获取到 ${mockTweets.length} 条推文`);
  return mockTweets;
}

// ====== 获取博客文章 ======
async function fetchBlogs() {
  console.log('📝 正在获取博客文章...');
  
  // 模拟数据（实际项目中这里应该解析 RSS）
  const mockBlogs = [
    { 
      source: 'OpenAI Blog', 
      title: 'GPT-4.5 技术详解', 
      summary: '新模型在代码生成和数学推理方面有显著提升'
    },
    { 
      source: 'Google AI Blog', 
      title: 'Gemini 2.0 架构解析', 
      summary: '多模态统一架构，支持文本、图像、音频联合推理'
    },
    { 
      source: 'Meta AI Blog', 
      title: 'Llama 3 开源发布', 
      summary: '100B 参数版本性能接近闭源模型，完全免费'
    }
  ];
  
  console.log(`✅ 获取到 ${mockBlogs.length} 篇博客`);
  return mockBlogs;
}

// ====== 格式化数据供 AI 使用 ======
function formatSourcesForAI(sourcesData) {
  const { tweets, blogs } = sourcesData;
  
  let output = '';
  
  if (tweets && tweets.length > 0) {
    output += '### X (Twitter) 动态\n';
    tweets.forEach((tweet, i) => {
      output += `${i + 1}. [@${tweet.user}]: ${tweet.text}\n`;
    });
    output += '\n';
  }
  
  if (blogs && blogs.length > 0) {
    output += '### 博客文章\n';
    blogs.forEach((blog, i) => {
      output += `${i + 1}. [${blog.source}] ${blog.title}\n`;
      output += `   摘要: ${blog.summary}\n`;
    });
    output += '\n';
  }
  
  return output;
}

// ====== 获取所有数据源 ======
async function fetchAllSources() {
  console.log('🔄 正在获取所有数据源...');
  
  try {
    const [tweets, blogs] = await Promise.all([
      fetchTweets(),
      fetchBlogs()
    ]);
    
    return {
      tweets,
      blogs,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ 获取数据失败:', error.message);
    throw error;
  }
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

      if (!response.data?.output?.choices?.[0]?.message?.content) {
        throw new Error('API响应格式不正确');
      }

      const digest = response.data.output.choices[0].message.content;
      console.log('✅ AI摘要生成成功');
      console.log('📋 摘要预览:', digest.substring(0, 100) + '...');
      
      return digest;
      
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

  try {
    const response = await axios.post(
      webhook,
      {
        msg_type: 'text',
        content: {
          text: content
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
