const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// ====== 核心函数：生成AI技术摘要 ======
async function generateDigest() {
  console.log('🧠 正在调用AI模型生成技术摘要...');
  
  const today = new Date().toISOString().split('T')[0];
  const currentDate = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  // 构建提示词
  const prompt = `你是一位资深AI技术专家，请为${currentDate}生成一份专业的AI技术每日摘要。要求：

1. **时效性**：重点关注最近24-48小时内的AI技术动态
2. **专业性**：包含技术细节，避免泛泛而谈
3. **结构化**：按以下格式组织：

## 🚀 今日AI技术摘要 - ${today}

### 🔥 热点技术
- [技术名称]：简要描述技术突破和应用场景
- [技术名称]：简要描述技术突破和应用场景

### 💡 研究突破
- [论文/项目名称]：核心贡献和技术亮点
- [论文/项目名称]：核心贡献和技术亮点

### 🏢 产业动态
- [公司名称]：重要产品发布或技术进展
- [公司名称]：重要产品发布或技术进展

### 📊 技术趋势
- [趋势名称]：当前发展状况和未来预测
- [趋势名称]：当前发展状况和未来预测

### 🎯 开发者建议
- [具体建议]：针对开发者的实用技术建议
- [具体建议]：针对开发者的实用技术建议

4. **语言**：使用简体中文，专业但易懂
5. **字数**：300-500字，信息密度高
6. **避免**：广告、营销内容、重复信息`;

  try {
    // 检查 API 密钥
    if (!process.env.DASHSCOPE_API_KEY) {
      throw new Error('DASHSCOPE_API_KEY 环境变量未设置');
    }

    // 调用DashScope API
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: 'qwen-max',
        input: {
          messages: [
            {
              role: 'system',
              content: '你是一位专业的AI技术分析师，专注于生成高质量的技术摘要。'
            },
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
          'Content-Type': 'application/json',
          'X-DashScope-Plugin': 'header-uuid-plugin',
          'X-Request-Id': uuidv4() // 添加唯一请求ID
        },
        timeout: 30000 // 30秒超时
      }
    );

    // 提取生成的摘要内容
    if (!response.data?.output?.choices?.[0]?.message?.content) {
      throw new Error('API响应格式不正确，缺少生成内容');
    }

    const content
