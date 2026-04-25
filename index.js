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
