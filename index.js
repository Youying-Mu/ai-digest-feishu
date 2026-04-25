require("dotenv").config();
const axios = require("axios");

const FEEDS = {
  blogs: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json",
  podcasts: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json",
  x: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json",
};

async function fetchFeeds() {
  const [blogs, podcasts, x] = await Promise.all([
    axios.get(FEEDS.blogs),
    axios.get(FEEDS.podcasts),
    axios.get(FEEDS.x),
  ]);

  return {
    blogs: blogs.data.slice(0, 3),
    podcasts: podcasts.data.slice(0, 3),
    x: x.data.slice(0, 5),
  };
}

// 🔥 拼prompt（核心优化点）
function buildPrompt(data) {
  return `
You are an AI assistant.

Summarize the following AI updates into a concise daily digest.

Requirements:
- Keep only key insights
- Each item max 2 lines
- Output bilingual (EN + 中文)
- Format clean for reading

Content:
Blogs:
${JSON.stringify(data.blogs)}

Podcasts:
${JSON.stringify(data.podcasts)}

X:
${JSON.stringify(data.x)}
`;
}

// 🔥 调 Qwen
async function callQwen(prompt) {
  const res = await axios.post(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
    {
      model: "qwen-turbo",
      input: { prompt },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data.output.text;
}

// 🔥 飞书卡片
function buildCard(content) {
  return {
    msg_type: "interactive",
    card: {
      header: {
        title: {
          tag: "plain_text",
          content: "AI Digest 每日更新",
        },
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: content,
          },
        },
      ],
    },
  };
}

// 🔥 发送飞书
async function sendToFeishu(card) {
  await axios.post(process.env.FEISHU_WEBHOOK, {
    ...card,
    content: "digest",
  });
}

// 🚀 主流程
async function main() {
  console.log("开始执行...");

  const feeds = await fetchFeeds();
  const prompt = buildPrompt(feeds);

  const summary = await callQwen(prompt);

  const card = buildCard(summary);

  await sendToFeishu(card);

  console.log("完成推送！");
}

main();
