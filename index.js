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

    const content = response.data.output.choices[0].message.content;
    console.log('✅ AI摘要生成成功');
    console.log('📋 摘要预览:', content.substring(0, 100) + '...');
    
    // 清理和格式化内容
    return content.trim().replace(/\n{3,}/g, '\n\n');
    
  } catch (error) {
    console.error('❌ AI生成失败:');
    if (error.response) {
      console.error('API响应状态:', error.response.status);
      console.error('API响应数据:', JSON.stringify(error.response.data, null, 2));
      
      // 处理常见错误
      if (error.response.status === 401) {
        throw new Error('DashScope API密钥无效或过期');
      } else if (error.response.status === 429) {
        throw new Error('API调用频率限制，请稍后重试');
      } else if (error.response.status === 400) {
        throw new Error('请求参数错误，请检查prompt格式');
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('API请求超时，请检查网络连接');
    }
    console.error('错误详情:', error.message);
    throw error;
  }
}

// ====== 飞书推送函数 ======
async function sendToFeishu(content) {
  console.log('📤 准备发送到飞书...');
  
  // 检查环境变量
  if (!process.env.FEISHU_WEBHOOK) {
    console.error('🚨 错误: FEISHU_WEBHOOK 环境变量未设置！');
    throw new Error('FEISHU_WEBHOOK 环境变量缺失');
  }

  const webhookUrl = process.env.FEISHU_WEBHOOK;
  console.log('📡 发送请求到:', webhookUrl.substring(0, 40) + '...');

  // 验证 webhook URL 格式
  if (!webhookUrl.startsWith('https://open.feishu.cn/open-apis/bot/v2/hook/')) {
    throw new Error('飞书 webhook URL 格式不正确');
  }

  try {
    const response = await axios.post(webhookUrl, {
      msg_type: "interactive",
      card: {
        config: { wide_screen_mode: true },
        header: { 
          title: { content: "🚀 每日AI技术摘要", tag: "plain_text" }, 
          template: "blue" 
        },
        elements: [{ 
          tag: "markdown", 
          content: content.substring(0, 4000) // 飞书消息长度限制
        }]
      }
    }, {
      timeout: 10000 // 10秒超时
    });
    
    console.log('✅ 飞书响应状态:', response.status);
    console.log('📋 飞书响应数据:', JSON.stringify(response.data, null, 2));
    
    if (response.data.code === 0) {
      console.log('🎉 飞书消息发送成功！');
      return true;
    } else {
      console.error('❌ 飞书API返回错误:', response.data.msg);
      throw new Error(`飞书API错误: ${response.data.msg}`);
    }
  } catch (error) {
    console.error('🔥 发送到飞书时出错:');
    console.error('错误消息:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('飞书API请求超时');
    }
    throw error;
  }
}

// ====== 主函数 ======
async function main() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`🚀 开始生成 ${today} 的技术摘要...`);
    
    // 1. 生成摘要
    const digest = await generateDigest();
    
    // 2. 发送到飞书
    await sendToFeishu(digest);
    
    console.log('✅ 任务执行成功！');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 任务执行失败:');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    
    // 即使失败也发送错误通知到飞书（可选）
    try {
      if (process.env.FEISHU_WEBHOOK) {
        const errorMessage = `🚨 **任务执行失败**\n\n**错误信息:** ${error.message}\n\n**时间:** ${new Date().toLocaleString('zh-CN')}\n\n**摘要日期:** ${new Date().toISOString().split('T')[0]}`;
        await sendToFeishu(errorMessage);
        console.log('✅ 错误通知已发送到飞书');
      }
    } catch (notifyError) {
      console.error('❌ 发送错误通知失败:', notifyError.message);
    }
    
    process.exit(1);
  }
}

// 启动主函数
console.log('🔧 开始执行AI Digest工作流...');
console.log('📋 配置检查:');
console.log(`   FEISHU_WEBHOOK: ${process.env.FEISHU_WEBHOOK ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`   DASHSCOPE_API_KEY: ${process.env.DASHSCOPE_API_KEY ? '✅ 已设置' : '❌ 未设置'}`);
console.log(`   Node.js 版本: ${process.version}`);

main().catch(error => {
  console.error('❌ 未捕获的异常:', error.message);
  process.exit(1);
});
