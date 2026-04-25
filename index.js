require("dotenv").config();
const axios = require("axios");

const FEEDS = {
  blogs: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json",
  podcasts: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json",
  x: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json",
};

async function fetchFeeds() {
  try {
    const [blogs, podcasts, x] = await Promise.all([
      axios.get(FEEDS.blogs, { timeout: 10000 }),
      axios.get(FEEDS.podcasts, { timeout: 10000 }),
      axios.get(FEEDS.x, { timeout: 10000 }),
    ]);

    return {
      blogs: blogs.data.slice(0, 3),
      podcasts: podcasts.data.slice(0, 3),
      x: x.data.slice(0, 5),
    };
  } catch (error) {
    console.error('获取 feeds 失败:', error.message);
    throw error;
  }
}

function buildPrompt(data) {
  return `
You are an AI assistant specialized in summarizing AI/tech content.

Summarize the following AI updates into a concise daily digest.

Requirements:
- Keep only key insights and most important updates
- Each item maximum 2 lines
- Output bilingual format (English first, then Chinese translation)
- Format clean for reading in a card
- Focus on actionable insights and trends

Content:
Blogs:
${JSON.stringify(data.blogs)}

Podcasts:
${JSON.stringify(data.podcasts)}

X (Twitter):
${JSON.stringify(data.x)}
`;
}

async function callQwen(prompt) {
  if (!process.env.QWEN_API_KEY) {
    throw new Error('QWEN_API_KEY environment variable is not set');
  }

  try {
    const res = await axios.post(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
      {
        model: "qwen-turbo",
        input: { prompt },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    if (res.data.output && res.data.output.text) {
      return res.data.output.text;
    } else {
      throw new Error('Qwen API returned unexpected response format');
    }
  } catch (error) {
    console.error('Qwen API 调用失败:', error.response?.data || error.message);
    throw error;
  }
}

function buildCard(content) {
  // 确保内容格式化为飞书 Markdown
  const formattedContent = content.replace(/\n{3,}/g, '\n\n').trim();
  
  return {
    msg_type: "interactive",
    card: {
      config: {
        wide_screen_mode: true,
      },
      header: {
        title: {
          tag: "plain_text",
          content: "🤖 AI Digest 每日更新 | Daily AI Digest",
        },
        template: "blue",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: formattedContent,
          },
        },
        {
          tag: "hr"
        },
        {
          tag: "note",
          elements: [
            {
              tag: "plain_text",
              content: `更新时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
            }
          ]
        }
      ],
    },
  };
}

async function sendToFeishu(card) {
  if (!process.env.FEISHU_WEBHOOK) {
    throw new Error('FEISHU_WEBHOOK environment variable is not set');
  }

  try {
    const response = await axios.post(process.env.FEISHU_WEBHOOK, card, {
      timeout: 10000,
    });
    
    if (response.data.StatusCode !== 0) {
      console.error('飞书推送失败:', response.data);
      throw new Error('飞书推送失败');
    }
    console.log('✅ 飞书推送成功');
    return true;
  } catch (error) {
    console.error('飞书推送错误:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 开始执行 AI Digest 任务...');
  console.log(`📅 当前时间: ${new Date().toISOString()}`);

  try {
    // 1. 获取 feeds
    console.log('📥 获取 feeds 数据...');
    const feeds = await fetchFeeds();
    console.log(`✅ 获取到 feeds: 博客 ${feeds.blogs.length} 条, 播客 ${feeds.podcasts.length} 条, X ${feeds.x.length} 条`);

    // 2. 调用 Qwen 生成摘要
    console.log('🧠 调用 Qwen 生成摘要...');
    const prompt = buildPrompt(feeds);
    const summary = await callQwen(prompt);
    console.log('✅ 摘要生成成功');

    // 3. 构建飞书卡片
    console.log('🎨 构建飞书卡片...');
    const card = buildCard(summary);

    // 4. 推送到飞书
    console.log('📤 推送到飞书...');
    await sendToFeishu(card);

    console.log('🎉 任务完成！');
    return true;
  } catch (error) {
    console.error('❌ 任务执行失败:', error.message);
    // 可以考虑在这里添加错误通知
    throw error;
  }
}

// 立即执行或通过 GitHub Actions 触发
main().catch(error => {
  console.error('程序异常退出:', error);
  process.exit(1);
});
