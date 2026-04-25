// 替换 sendToFeishu 函数
async function sendToFeishuAsCard(content) {
  const cardContent = {
    config: { wide_screen_mode: true },
    header: {
      title: { content: `🤖 AI PM 战略简报 | ${new Date().toLocaleDateString()}`, tag: 'plain_text' },
      template: 'blue'
    },
    elements: [
      {
        tag: 'div',
        text: { content: content.replace(/\n/g, '\n\n'), tag: 'lark_md' }
      },
      {
        tag: 'hr'
      },
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: '💡 源自 Follow-Builders | 自动生成' }
        ]
      }
    ]
  };
  
  await axios.post(webhook, {
    msg_type: 'interactive',
    card: cardContent
  });
}
