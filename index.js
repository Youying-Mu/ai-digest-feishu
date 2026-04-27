// ====== Dependencies Import ======
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// ====== Data Sources Configuration ======
const DATA_SOURCES = {
  blogs: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json",
  podcasts: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json",
  x: "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json"
};

// ====== Cache File Path ======
const CACHE_FILE = path.join(__dirname, 'cache.json');

// ====== Read Cache Safely ======
async function readCache() {
  try {
    const cacheData = await fs.readFile(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(cacheData);
    
    // Check if it's today's data, reset if not
    const cacheDate = cache.lastProcessed?.timestamp ? 
      new Date(cache.lastProcessed.timestamp).toISOString().split('T')[0] : 
      null;
    
    const today = new Date().toISOString().split('T')[0];
    
    if (cacheDate !== today) {
      console.log(`📅 Cache from different date (${cacheDate}), resetting for today`);
      return { 
        lastProcessed: { 
          timestamp: null, 
          urlWithMetadata: {}
        } 
      };
    }
    
    return cache;
  } catch (error) {
    console.log('📝 Cache file does not exist, creating new one');
    return { 
      lastProcessed: { 
        timestamp: null, 
        urlWithMetadata: {}
      } 
    };
  }
}

// ====== Write Cache Safely ======
async function writeCache(cache) {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    console.log('💾 Cache updated successfully');
  } catch (error) {
    console.error('❌ Failed to write cache:', error.message);
  }
}

// ====== Fetch Blog Data ======
async function fetchBlogs() {
  console.log('📝 Fetching blog data...');
  
  try {
    const response = await axios.get(DATA_SOURCES.blogs, { timeout: 8000 });
    const data = response.data;
    
    const blogs = (data.blogs || []).map(blog => ({
      type: 'blog',
      title: blog.title,
      source: blog.name,
      url: blog.url,
      content: blog.content || blog.description || '',
      timestamp: blog.timestamp || new Date().toISOString(),
      weight: 12
    }));
    
    console.log(`✅ Retrieved ${blogs.length} blogs`);
    return blogs;
  } catch (error) {
    console.error('❌ Failed to fetch blog data:', error.message);
    return [];
  }
}

// ====== Fetch Podcast Data ======
async function fetchPodcasts() {
  console.log('🎙️ Fetching podcast data...');
  
  try {
    const response = await axios.get(DATA_SOURCES.podcasts, { timeout: 8000 });
    const data = response.data;
    
    const podcasts = (data.podcasts || []).map(podcast => ({
      type: 'podcast',
      title: podcast.title,
      source: podcast.name,
      url: podcast.url,
      transcript: podcast.transcript || '',
      timestamp: podcast.timestamp || new Date().toISOString(),
      weight: 10
    }));
    
    console.log(`✅ Retrieved ${podcasts.length} podcasts`);
    return podcasts;
  } catch (error) {
    console.error('❌ Failed to fetch podcast data:', error.message);
    return [];
  }
}

// ====== Fetch X (Twitter) Data ======
async function fetchXData() {
  console.log('🐦 Fetching X data...');
  
  try {
    const response = await axios.get(DATA_SOURCES.x, { timeout: 8000 });
    const data = response.data;
    
    const tweets = [];
    if (data.x && Array.isArray(data.x)) {
      data.x.forEach(user => {
        if (user.tweets && Array.isArray(user.tweets)) {
          user.tweets.forEach(tweet => {
            const engagementWeight = Math.min((tweet.likes + tweet.retweets * 2) / 15, 6);
            tweets.push({
              type: 'tweet',
              title: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
              source: `${user.name} (@${user.handle})`,
              url: tweet.url,
              content: tweet.text,
              likes: tweet.likes || 0,
              retweets: tweet.retweets || 0,
              timestamp: tweet.timestamp || new Date().toISOString(),
              weight: 6 + engagementWeight
            });
          });
        }
      });
    }
    
    const filteredTweets = tweets.filter(tweet => tweet.likes >= 10);
    console.log(`✅ Retrieved ${filteredTweets.length} valid tweets`);
    return filteredTweets;
  } catch (error) {
    console.error('❌ Failed to fetch X data:', error.message);
    return [];
  }
}

// ====== Smart Filter: Find Truly "New" Content ======
function findTrulyNewSources(allSources, cachedMetadata) {
  const trulyNewSources = [];
  
  for (const source of allSources) {
    const cachedInfo = cachedMetadata[source.url];
    
    if (!cachedInfo) {
      // Completely new content
      trulyNewSources.push({ ...source, isNew: true });
    } else {
      // Check if content has been updated
      const currentTime = new Date(source.timestamp);
      const cachedTime = new Date(cachedInfo.timestamp);
      
      if (currentTime > cachedTime) {
        trulyNewSources.push({ ...source, isNew: true });
      }
    }
  }
  
  console.log(`📊 Truly new information: ${trulyNewSources.length} items`);
  return trulyNewSources;
}

// ====== Smart Selection: Top 3 Most Important ======
function selectTop3Sources(sources) {
  // Sort by weight
  const sortedSources = [...sources].sort((a, b) => {
    if (b.weight === a.weight) return new Date(b.timestamp) - new Date(a.timestamp);
    return b.weight - a.weight;
  });
  
  // Ensure type diversity
  const selected = [];
  const typeCount = { blog: 0, podcast: 0, tweet: 0 };
  
  // Round 1: Type-balanced selection
  for (const source of sortedSources) {
    if (selected.length >= 3) break;
    
    if (source.type === 'blog' && typeCount.blog >= 1) continue;
    if (source.type === 'podcast' && typeCount.podcast >= 1) continue;
    if (source.type === 'tweet' && typeCount.tweet >= 1) continue;
    
    selected.push(source);
    typeCount[source.type]++;
  }
  
  // Round 2: Fill remaining slots
  if (selected.length < 3) {
    for (const source of sortedSources) {
      if (selected.length >= 3) break;
      if (!selected.some(s => s.url === source.url)) {
        selected.push(source);
      }
    }
  }
  
  console.log('🎯 Smartly selected 3 most important items:');
  selected.forEach((source, i) => {
    console.log(`   ${i + 1}. [${source.type.toUpperCase()}|Weight:${Math.round(source.weight)}] ${source.title.substring(0, 60)}...`);
  });
  
  return selected;
}

// ====== Fetch All Data Sources ======
async function fetchAllSources() {
  console.log('🔄 Fetching all data sources...');
  
  try {
    const [blogs, podcasts, tweets] = await Promise.allSettled([
      fetchBlogs(),
      fetchPodcasts(),
      fetchXData()
    ]);
    
    const allSources = [];
    
    if (blogs.status === 'fulfilled' && blogs.value.length > 0) {
      allSources.push(...blogs.value);
    }
    
    if (podcasts.status === 'fulfilled' && podcasts.value.length > 0) {
      allSources.push(...podcasts.value);
    }
    
    if (tweets.status === 'fulfilled' && tweets.value.length > 0) {
      allSources.push(...tweets.value);
    }
    
    console.log(`📊 Total retrieved: ${allSources.length} items`);
    
    // Read cache
    const cache = await readCache();
    const cachedMetadata = cache.lastProcessed.urlWithMetadata || {};
    
    // Smart filter: find truly "new" content
    const trulyNewSources = findTrulyNewSources(allSources, cachedMetadata);
    
    if (trulyNewSources.length === 0) {
      console.log('✅ No truly new information today, skipping processing');
      return null;
    }
    
    // Smart selection: top 3 for deep analysis
    const deepAnalysisSources = selectTop3Sources(trulyNewSources);
    
    // Other new information
    const summarySources = trulyNewSources.filter(source => 
      !deepAnalysisSources.some(s => s.url === source.url)
    );
    
    console.log(`📋 Other new items count: ${summarySources.length}`);
    
    // Update cache
    const updatedMetadata = { ...cachedMetadata };
    [...deepAnalysisSources, ...summarySources].forEach(source => {
      updatedMetadata[source.url] = {
        timestamp: source.timestamp,
        processedAt: new Date().toISOString(),
        type: source.type
      };
    });
    
    cache.lastProcessed = {
      timestamp: new Date().toISOString(),
      urlWithMetadata: updatedMetadata
    };
    
    await writeCache(cache);
    
    return {
      deepAnalysisSources,
      summarySources,
      timestamp: new Date().toISOString(),
      totalNew: trulyNewSources.length
    };
  } catch (error) {
    console.error('❌ Failed to fetch data sources:', error.message);
    throw error;
  }
}

// ====== Generate AI Summary (Bilingual Version) ======
async function generateDigest(sourcesData) {
  console.log('🧠 Generating bilingual formatted deep analysis...');
  
  const today = new Date().toISOString().split('T')[0];
  const { deepAnalysisSources, summarySources } = sourcesData;
  
  // Build context
  let context = `## ${today} AI Tech Bilingual Insights (${sourcesData.totalNew} new items)\n\n`;
  
  // Deep analysis of 3 items
  context += '### 🔍 Deep Analysis (Top 3 Most Important)\n';
  deepAnalysisSources.forEach((source, i) => {
    context += `\n#### Deep Analysis ${i + 1}\n`;
    context += `**Title**: ${source.title}\n`;
    context += `**Link**: ${source.url}\n`;
    context += `**Source**: ${source.source}\n`;
    context += `**Weight**: ${Math.round(source.weight)}\n`;
    if (source.content) {
      context += `**Summary**: ${source.content.substring(0, 200)}...\n`;
    } else if (source.transcript) {
      context += `**Summary**: ${source.transcript.substring(0, 200)}...\n`;
    }
  });
  
  // Other new items
  if (summarySources.length > 0) {
    context += `\n### 📋 Other New Items (${summarySources.length} items)\n`;
    summarySources.forEach((source, i) => {
      context += `\n#### Other Item ${i + 1}\n`;
      context += `**Title**: ${source.title}\n`;
      context += `**Link**: ${source.url}\n`;
      context += `**Source**: ${source.source}\n`;
    });
  });
  
  // Enhanced bilingual prompt with security
  const prompt = `You are a senior AI tech product expert, providing daily bilingual insights for tech decision-makers. Based on ${today}'s new information, generate analysis following bilingual principles:

${context}

## Strict Requirements:
1. **Deep Analysis of 3**: For the 3 most important items, **each must follow exactly 5 modules in order**:
   📌 One-sentence overview (Chinese dominant, keep English product/tech terms)
   🔗 Full URL  
   💎 Core value (Chinese dominant, keep English tech features)
   🎯 Technical boundary analysis (effects, limitations, new APIs) - Chinese dominant, keep English API names
   💡 Product insights (pain points solved, user positioning, interaction innovation, competitor analysis) - Chinese dominant

2. **All Other New Items**: For remaining ${summarySources.length} items, **each must follow exactly 3 modules in order**:
   📌 One-sentence overview (Chinese dominant, keep English product names)
   🔗 Full URL
   💎 Core value (Chinese dominant, keep English technical terms)
   **Each item limited to 60 characters**

3. **Finally**:
   ❓ 1 thought-provoking question (within 30 characters, Chinese dominant)

4. **Format Requirements**:
   - Strictly follow module order, no shuffling
   - Use 📌 🔗 💎 🎯 💡 symbols to mark modules
   - Deep analysis: each module on separate line
   - Other items: overview+URL+value on same line
   - Concise and professional language

5. **Bilingual Principles**:
   - **Chinese Dominant**: Analysis, explanations, summaries in Chinese
   - **English Preserved**: Product names, brand names, API names, technical terms, company names remain English
   - **Natural Fusion**: e.g., "OpenAI's GPT model", "React framework", "ChatGPT application"

6. **Content Requirements**:
   - Specific numbers and scenarios, avoid vague descriptions
   - Technical analysis highlights effect data
   - Product analysis emphasizes differentiation value

7. **Overall Requirements**:
   - **Total length strictly within 1200 characters**
   - Do not include "original source", "data source" unrelated content`;

  try {
    // Security: Never log sensitive API keys
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: 'qwen-plus',
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
          'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,  // Secure, never logged
          'Content-Type': 'application/json'
        },
        timeout: 150000
      }
    );

    if (response.data?.output?.choices?.[0]?.message?.content) {
      const digest = response.data.output.choices[0].message.content;
      console.log('✅ Bilingual formatted insight generated successfully');
      
      const charCount = digest.replace(/\s+/g, '').length;
      console.log(`📊 Generated content: ${charCount} characters`);
      
      return digest;
    } else {
      console.error('❌ API response format incorrect');
      throw new Error('Cannot parse API response');
    }
      
  } catch (error) {
    console.error('❌ AI generation failed:', error.message);
    throw error;
  }
}

// ====== Send to Feishu (Security Enhanced) ======
async function sendToFeishu(content, sourcesData) {
  console.log('🚀 Sending to Feishu...');
  
  // Security: Validate webhook exists without logging its value
  const webhook = process.env.FEISHU_WEBHOOK;
  if (!webhook) {
    throw new Error('❌ FEISHU_WEBHOOK environment variable not set');
  }

  // Security: Never log the actual webhook URL
  // console.log('Webhook URL:', webhook);  // ❌ NEVER DO THIS!

  const currentDate = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long'
  });

  const { deepAnalysisSources, summarySources } = sourcesData;
  
  const cardContent = {
    config: {
      wide_screen_mode: true
    },
    header: {
      title: {
        content: `AI Bilingual Insights | ${currentDate} (New ${sourcesData.totalNew} items)`,
        tag: 'plain_text'
      },
      template: 'blue'  // Blue indicates bilingual
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
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: `✅ 3 Deep(5 modules) + ${summarySources.length} Others(3 modules) | Beijing Time 16:30 Push`
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(
      webhook,  // Safe reference, not logged
      {
        msg_type: 'interactive',
        card: cardContent
      },
      {
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Tech-Insight-Secure-Bilingual'
        },
        timeout: 20000
      }
    );

    if (response.data?.code === 0) {
      console.log('✅ Bilingual insight summary successfully sent to Feishu!');
      return true;
    } else {
      console.error('❌ Feishu API returned error:', response.data);
      throw new Error('Feishu API error');
    }
  } catch (error) {
    console.error('❌ Feishu push failed:', error.message);
    throw error;
  }
}

// ====== Save Summary to File ======
async function saveDigestToFile(content, sourcesData) {
  try {
    const filename = `digest_${new Date().toISOString().split('T')[0]}_bilingual.md`;
    
    const { deepAnalysisSources, summarySources } = sourcesData;
    const metadata = `# AI Tech Bilingual Insights Summary\nGenerated: ${new Date().toISOString()}\nPush Time: Beijing Time 16:30\nDeep Analysis Count: ${deepAnalysisSources.length}\nOther New Items Count: ${summarySources.length}\nTotal New: ${sourcesData.totalNew}\nFormat: Bilingual(Chinese dominant + English terms)\n`;
    
    const fullContent = `${metadata}\n${'='.repeat(80)}\n\n${content}`;
    
    await fs.writeFile(filename, fullContent, 'utf-8');
    console.log(`💾 Bilingual insight saved to file: ${filename}`);
  } catch (error) {
    console.error('❌ Failed to save file:', error.message);
  }
}

// ====== Main Process ======
async function main() {
  console.log('========================================');
  console.log('🚀 AI Bilingual Insight Summary - Precise Edition');
  console.log('Current Time:', new Date().toISOString());
  console.log('Beijing Time:', new Date(new Date().getTime() + 8*3600*1000).toISOString());
  console.log('========================================\n');
  
  try {
    // 1. Fetch data (with real incremental detection)
    const sourcesData = await fetchAllSources();
    
    // If no new information, skip processing
    if (!sourcesData) {
      console.log('✅ No new information today, task ended');
      return;
    }
    
    // 2. Generate bilingual formatted deep analysis
    const digest = await generateDigest(sourcesData);
    
    // 3. Save to file
    await saveDigestToFile(digest, sourcesData);
    
    // 4. Push to Feishu
    await sendToFeishu(digest, sourcesData);
    
    console.log('\n========================================');
    console.log('✅ All tasks completed successfully!');
    console.log('========================================');
    
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ Task failed:', error.message);
    console.error('========================================');
    process.exit(1);
  }
}

// ====== Launch Program ======
main();
