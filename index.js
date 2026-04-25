const axios = require('axios');
const fs = require('fs').promises;

// ===== 数据源 =====
const DATA_SOURCES = {
  blogs: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json",
  podcasts: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json",
  x: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json"
};

// ===== 获取数据 =====
async function fetchAllSources() {
  const [blogsRes, podcastsRes, xRes] = await Promise.all([
    axios.get(DATA_SOURCES.blogs),
    axios.get(DATA_SOURCES.podcasts),
    axios.get(DATA_SOURCES.x)
  ]);

  const blogs = (blogsRes.data.blogs || []).slice(0, 10);
  const podcasts = (podcastsRes.data.podcasts || []).slice(0, 5);

  const tweets = [];
  (xRes.data.x || []).forEach(user => {
    (user.tweets || []).forEach(t => {
      if (t.likes >= 10) {
        tweets.push({
          user: user.name,
          text: t.text,
          url: t.url,
          likes: t.likes
        });
      }
    });
  });

  return { blogs, podcasts, tweets };
}

// ===== 格式化为“可分析数据” =====
function formatForAI(data) {
  let text = '';

  data.blogs.forEach((b, i) => {
    text += `BLOG ${i+1}:
标题: ${b.title}
来源: ${b.name}
链接: ${b.url}
内容: ${b.content?.slice(0,300)}
\n`;
  });

  data.podcasts.forEach((p, i) => {
    text += `PODCAST ${i+1}:
标题: ${p.title}
来源: ${p.name}
链接: ${p.url}
内容: ${p.transcript?.slice(0,300)}
\n`;
  });

  data.tweets.slice(0,10).forEach((t, i) => {
    text += `TWEET ${i+1}:
用户: ${t.user}
点赞: ${t.likes}
内容: ${t.text}
链接: ${t.url}
\n`;
  });

  return text;
}

// ===== 核心：新Prompt =====
async function generateDigest(data) {
  const context = formatForAI(data);
  const today = new Date().toISOString().split('T')[0];

  const prompt = `
你不是写作者，而是“AI行业分析系统”。

请严格基于以下原始信息，输出结构化分析。

禁止编造，所有结论必须可追溯到原文。

==================
原始信息：
${context}
==================

输出结构：

# AI行业简报 (${today})

## 一、关键事实（Facts）
- 每条必须包含：事实 + 来源名称 + 链接
- 不超过6条

## 二、信号提炼（Signals）
- 从facts中归纳变化趋势
- 不超过4条

## 三、行业Pattern
- 抽象为更长期规律（例如：Agent替代SaaS）
- 不超过3条

## 四、PM认知（重点）
- 这是给AI PM最有价值的部分
- 输出“可复用的判断框架”
- 不超过4条

## 五、行动建议（可执行）
- 只能1条
- 必须具体（例如：接入API / 做某功能验证）

要求：
- 全部客观
- 不使用任何emoji
- 每条不超过2行
`;

  const res = await axios.post(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    {
      model: 'qwen-max',
      input: {
        messages: [{ role: 'user', content: prompt }]
      }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`
      }
    }
  );

  return res.data.output.choices[0].message.content;
}

// ===== 飞书（极简结构版）=====
async function sendToFeishu(content) {
  const webhook = process.env.FEISHU_WEBHOOK;

  const card = {
    msg_type: "interactive",
    card: {
      header: {
        title: {
          tag: "plain_text",
          content: "AI行业简报"
        }
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: content
          }
        }
      ]
    }
  };

  await axios.post(webhook, card);
}

// ===== 保存 =====
async function save(content) {
  const file = `digest_${Date.now()}.md`;
  await fs.writeFile(file, content);
}

// ===== 主流程 =====
async function main() {
  const data = await fetchAllSources();
  const digest = await generateDigest(data);
  await save(digest);
  await sendToFeishu(digest);
}

main();
