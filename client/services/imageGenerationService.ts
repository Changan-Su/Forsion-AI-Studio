
import { Attachment } from '../types';

interface ImageGenerationConfig {
  apiKey: string;
  baseUrl?: string;
  provider: 'openai' | 'stability' | 'custom';
}

/**
 * 检测用户输入是否包含绘图意图
 */
export function detectImageGenerationIntent(input: string): {
  isImageRequest: boolean;
  prompt: string;
} {
  const imageKeywords = [
    // 中文关键词
    /画(?:一)?(?:张|幅|个)?(?:图|画|像)/i,
    /生成(?:一)?(?:张|幅|个)?(?:图|画|像|片)/i,
    /绘制(?:一)?(?:张|幅|个)?/i,
    /帮我画/i,
    /给我画/i,
    // 英文关键词
    /draw (?:a |an |the |me )?(?:picture|image|photo|sketch)/i,
    /generate (?:a |an |the |me )?(?:picture|image|photo|sketch)/i,
    /create (?:a |an |the |me )?(?:picture|image|photo|sketch)/i,
    /make (?:a |an |the |me )?(?:picture|image|photo|sketch)/i,
    /paint (?:a |an |the |me )?(?:picture|image|photo|sketch)/i,
    // 命令前缀
    /^\/draw\s+/i,
    /^\/image\s+/i,
    /^\/generate\s+/i,
    /^\/paint\s+/i,
  ];

  // 检查是否包含绘图关键词
  for (const keyword of imageKeywords) {
    if (keyword.test(input)) {
      // 提取提示词（移除命令前缀和关键词）
      let prompt = input
        .replace(/^\/draw\s+/i, '')
        .replace(/^\/image\s+/i, '')
        .replace(/^\/generate\s+/i, '')
        .replace(/^\/paint\s+/i, '')
        .replace(/画(?:一)?(?:张|幅|个)?(?:图|画|像)[：:：]?\s*/i, '')
        .replace(/生成(?:一)?(?:张|幅|个)?(?:图|画|像|片)[：:：]?\s*/i, '')
        .replace(/绘制(?:一)?(?:张|幅|个)?[：:：]?\s*/i, '')
        .replace(/帮我画\s*/i, '')
        .replace(/给我画\s*/i, '')
        .replace(/draw (?:a |an |the |me )?(?:picture|image|photo|sketch)[：:：]?\s*/i, '')
        .replace(/generate (?:a |an |the |me )?(?:picture|image|photo|sketch)[：:：]?\s*/i, '')
        .replace(/create (?:a |an |the |me )?(?:picture|image|photo|sketch)[：:：]?\s*/i, '')
        .replace(/make (?:a |an |the |me )?(?:picture|image|photo|sketch)[：:：]?\s*/i, '')
        .replace(/paint (?:a |an |the |me )?(?:picture|image|photo|sketch)[：:：]?\s*/i, '')
        .trim();

      // 如果没有提取到提示词，使用整个输入
      if (!prompt) {
        prompt = input;
      }

      return { isImageRequest: true, prompt };
    }
  }

  return { isImageRequest: false, prompt: input };
}

/**
 * 使用OpenAI DALL-E生成图像
 */
async function generateWithDALLE(
  config: ImageGenerationConfig,
  prompt: string,
  size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024',
  quality: 'standard' | 'hd' = 'standard'
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/images/generations`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: size,
      quality: quality,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.data || !data.data[0] || !data.data[0].url) {
    throw new Error('No image URL returned from API');
  }
  
  return data.data[0].url;
}

/**
 * 使用Stability AI生成图像
 */
async function generateWithStability(
  config: ImageGenerationConfig,
  prompt: string,
  size: '1024x1024' | '1152x896' | '1216x832' | '1344x768' | '1536x640' | '640x1536' | '768x1344' | '832x1216' | '896x1152' = '1024x1024'
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.stability.ai/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/generation/stable-diffusion-xl-1024-v1-0/text-to-image`;

  const [width, height] = size.split('x').map(Number);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt }],
      cfg_scale: 7,
      height: height,
      width: width,
      steps: 30,
      samples: 1,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Stability AI返回base64图像
  if (data.artifacts && data.artifacts[0] && data.artifacts[0].base64) {
    return `data:image/png;base64,${data.artifacts[0].base64}`;
  }
  
  throw new Error('No image generated');
}

/**
 * 主函数：生成图像
 */
export async function generateImage(
  config: ImageGenerationConfig,
  prompt: string,
  options?: {
    size?: string;
    quality?: 'standard' | 'hd';
    provider?: 'openai' | 'stability';
  }
): Promise<{ imageUrl: string; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  const provider = options?.provider || config.provider || 'openai';
  const size = (options?.size as any) || '1024x1024';
  const quality = options?.quality || 'standard';

  let imageUrl: string;

  try {
    if (provider === 'openai' || provider === 'custom') {
      imageUrl = await generateWithDALLE(config, prompt, size as any, quality);
    } else if (provider === 'stability') {
      imageUrl = await generateWithStability(config, prompt, size as any);
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // 估算token使用（图像生成通常消耗较多token）
    const estimatedTokens = Math.ceil(prompt.length / 4) + 1000; // 图像生成额外消耗

    return {
      imageUrl,
      usage: {
        prompt_tokens: estimatedTokens,
        completion_tokens: 0,
      },
    };
  } catch (error: any) {
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

