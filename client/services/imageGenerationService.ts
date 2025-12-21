
import { Attachment } from '../types';

interface ImageGenerationConfig {
  apiKey: string;
  baseUrl?: string;
  provider: 'openai' | 'stability' | 'custom';
}

/**
 * 检测用户输入是否包含图像编辑或以图生图意图
 * 
 * 策略：只有在非常明确的编辑意图时才返回 true，否则应该让图片作为上下文传递给普通聊天
 */
export function detectImageEditIntent(input: string, hasImageAttachment: boolean): {
  isEditRequest: boolean;
  isImg2ImgRequest: boolean;
  prompt: string;
  mode: 'edit' | 'img2img' | 'none';
} {
  // If no image attachment, not an edit/img2img request
  if (!hasImageAttachment) {
    return { isEditRequest: false, isImg2ImgRequest: false, prompt: input, mode: 'none' };
  }

  // Check for explicit commands first - these are the MOST reliable indicators
  const editCommands = [
    /^\/edit\s+/i,
    /^\/edit-image\s+/i,
    /^\/修改\s+/i,
    /^\/编辑\s+/i,
    /^\/p图\s+/i,
  ];

  const img2imgCommands = [
    /^\/img2img\s+/i,
    /^\/image-to-image\s+/i,
    /^\/以图生图\s+/i,
    /^\/参考\s+/i,
  ];

  // Check edit commands
  for (const cmd of editCommands) {
    if (cmd.test(input)) {
      const prompt = input.replace(cmd, '').trim();
      return { isEditRequest: true, isImg2ImgRequest: false, prompt, mode: 'edit' };
    }
  }

  // Check img2img commands
  for (const cmd of img2imgCommands) {
    if (cmd.test(input)) {
      const prompt = input.replace(cmd, '').trim();
      return { isEditRequest: false, isImg2ImgRequest: true, prompt, mode: 'img2img' };
    }
  }

  // STRICT auto-detect: Only very specific patterns that clearly indicate editing intent
  // These must be highly specific to avoid false positives
  const strictEditKeywords = [
    // Very specific Chinese edit patterns
    /^(?:帮我|给我|请|麻烦)?(?:修改|编辑|p)(?:一下|下)?(?:这张|这个)?(?:图|图片|照片)/i,
    /^把(?:这张|这个)?(?:图|图片|照片).*(?:改|变|换)成/i,
    /^(?:在|给)(?:这张|这个)?(?:图|图片|照片).*(?:上|里)(?:添加|加上|加个|画上)/i,
    /^(?:删除|去掉|移除|擦除)(?:这张|这个)?(?:图|图片|照片).*(?:的|里的|中的)?(?:背景|部分|内容)/i,
    /^(?:替换|更换|换掉)(?:这张|这个)?(?:图|图片|照片)/i,
    // Very specific English edit patterns  
    /^(?:please\s+)?(?:edit|modify|change|alter)\s+(?:this|the)\s+(?:image|picture|photo)/i,
    /^(?:please\s+)?(?:remove|delete|erase)\s+(?:the\s+)?(?:background|object)/i,
    /^(?:please\s+)?(?:add|insert)\s+.*\s+(?:to|in|into)\s+(?:this|the)\s+(?:image|picture)/i,
  ];

  const strictImg2ImgKeywords = [
    // Very specific Chinese img2img patterns
    /^(?:参考|基于|根据)(?:这张|这个)?(?:图|图片|照片).*(?:重新)?(?:生成|创建|画|做)/i,
    /^(?:用|按照)(?:这张|这个)?(?:图|图片|照片).*(?:风格|样式).*生成/i,
    /^(?:生成|创建|画).*(?:类似|相似|像)(?:这张|这个)?(?:图|图片|照片)/i,
    /^以图生图/i,
    /^(?:模仿|复刻)(?:这张|这个)?(?:图|图片|照片).*(?:风格|样式)/i,
    // Very specific English img2img patterns
    /^(?:generate|create|make)\s+.*\s+(?:similar to|like|based on)\s+(?:this|the)\s+(?:image|picture)/i,
    /^(?:use\s+)?(?:this|the)\s+(?:image|picture).*(?:as\s+)?(?:reference|inspiration|style)/i,
    /^(?:recreate|reproduce)\s+.*\s+(?:in\s+)?(?:this|the)\s+(?:style|manner)/i,
  ];

  // Check for STRICT edit keywords
  for (const keyword of strictEditKeywords) {
    if (keyword.test(input)) {
      return { isEditRequest: true, isImg2ImgRequest: false, prompt: input, mode: 'edit' };
    }
  }

  // Check for STRICT img2img keywords
  for (const keyword of strictImg2ImgKeywords) {
    if (keyword.test(input)) {
      return { isEditRequest: false, isImg2ImgRequest: true, prompt: input, mode: 'img2img' };
    }
  }

  // Default: if image is attached but no specific keywords, treat as normal chat with image context
  // This allows the AI to see and analyze the image content
  return { isEditRequest: false, isImg2ImgRequest: false, prompt: input, mode: 'none' };
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
  quality: 'standard' | 'hd' = 'standard',
  model: 'dall-e-2' | 'dall-e-3' = 'dall-e-3',
  n: number = 1,
  style?: 'vivid' | 'natural'
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/images/generations`;

  // Validate n parameter based on model
  const validN = model === 'dall-e-2' 
    ? Math.min(Math.max(1, n || 1), 10) // dall-e-2 supports 1-10
    : 1; // dall-e-3 only supports 1

  // Build request body according to API spec
  const requestBody: any = {
    model: model,
    prompt: prompt,
    n: validN,
    size: size,
    response_format: 'url',
  };

  // Add style parameter (for dall-e-3, or if explicitly provided)
  if (model === 'dall-e-3' || style) {
    requestBody.style = style || (quality === 'hd' ? 'vivid' : 'natural');
  }

  // Add quality parameter for backward compatibility (some APIs may prefer this)
  if (quality && !style) {
    requestBody.quality = quality;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
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
    model?: 'dall-e-2' | 'dall-e-3';
    n?: number;
    style?: 'vivid' | 'natural';
  }
): Promise<{ imageUrl: string; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  const provider = options?.provider || config.provider || 'openai';
  const size = (options?.size as any) || '1024x1024';
  const quality = options?.quality || 'standard';
  const model = options?.model || 'dall-e-3';
  const n = options?.n || 1;
  const style = options?.style;

  let imageUrl: string;

  try {
    if (provider === 'openai' || provider === 'custom') {
      imageUrl = await generateWithDALLE(config, prompt, size as any, quality, model, n, style);
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


/**
 * 编辑图像 - 基于上传的图片和提示词进行修改
 */
export async function editImage(
  config: ImageGenerationConfig,
  prompt: string,
  imageBase64: string,
  options?: {
    size?: string;
    quality?: 'standard' | 'hd';
    provider?: 'openai' | 'stability';
    mask?: string; // Optional mask for specific region editing
  }
): Promise<{ imageUrl: string; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  const provider = options?.provider || config.provider || 'openai';
  const size = (options?.size as any) || '1024x1024';
  const quality = options?.quality || 'standard';

  let imageUrl: string;

  try {
    if (provider === 'openai' || provider === 'custom') {
      imageUrl = await editWithOpenAI(config, prompt, imageBase64, size as any, quality, options?.mask);
    } else if (provider === 'stability') {
      imageUrl = await editWithStability(config, prompt, imageBase64, size as any);
    } else {
      throw new Error(`Unsupported provider for editing: ${provider}`);
    }

    // Estimate token usage
    const estimatedTokens = Math.ceil(prompt.length / 4) + 1000;

    return {
      imageUrl,
      usage: {
        prompt_tokens: estimatedTokens,
        completion_tokens: 0,
      },
    };
  } catch (error: any) {
    throw new Error(`Image editing failed: ${error.message}`);
  }
}

/**
 * 以图生图 - 使用上传的图片作为参考生成新图片
 */
export async function imageToImage(
  config: ImageGenerationConfig,
  prompt: string,
  imageBase64: string,
  options?: {
    size?: string;
    strength?: number; // 0-1, how much to deviate from original
    provider?: 'stability';
  }
): Promise<{ imageUrl: string; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  const provider = options?.provider || config.provider || 'stability';
  const size = (options?.size as any) || '1024x1024';
  const strength = options?.strength || 0.7;

  if (provider === 'openai' || provider === 'custom') {
    throw new Error('OpenAI does not support image-to-image generation. Please use Stability AI.');
  }

  let imageUrl: string;

  try {
    if (provider === 'stability') {
      imageUrl = await img2imgWithStability(config, prompt, imageBase64, size as any, strength);
    } else {
      throw new Error(`Unsupported provider for img2img: ${provider}`);
    }

    // Estimate token usage
    const estimatedTokens = Math.ceil(prompt.length / 4) + 1200;

    return {
      imageUrl,
      usage: {
        prompt_tokens: estimatedTokens,
        completion_tokens: 0,
      },
    };
  } catch (error: any) {
    throw new Error(`Image-to-image generation failed: ${error.message}`);
  }
}

/**
 * OpenAI 图像编辑
 */
async function editWithOpenAI(
  config: ImageGenerationConfig,
  prompt: string,
  imageBase64: string,
  size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024',
  quality: 'standard' | 'hd' = 'standard',
  mask?: string
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/images/edits`;

  // Convert base64 to blob
  const imageBlob = await fetch(imageBase64).then(r => r.blob());
  
  const formData = new FormData();
  formData.append('image', imageBlob, 'image.png');
  formData.append('prompt', prompt);
  formData.append('n', '1');
  formData.append('size', size);
  
  if (mask) {
    const maskBlob = await fetch(mask).then(r => r.blob());
    formData.append('mask', maskBlob, 'mask.png');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: formData,
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
 * Stability AI 图像编辑
 */
async function editWithStability(
  config: ImageGenerationConfig,
  prompt: string,
  imageBase64: string,
  size: '1024x1024' | '1152x896' | '1216x832' | '1344x768' | '1536x640' | '640x1536' | '768x1344' | '832x1216' | '896x1152' = '1024x1024'
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.stability.ai/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/generation/stable-diffusion-xl-1024-v1-0/image-to-image`;

  const [width, height] = size.split('x').map(Number);
  
  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt, weight: 1 }],
      init_image: base64Data,
      init_image_mode: 'IMAGE_STRENGTH',
      image_strength: 0.5, // Medium strength for editing
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
  
  if (data.artifacts && data.artifacts[0] && data.artifacts[0].base64) {
    return `data:image/png;base64,${data.artifacts[0].base64}`;
  }
  
  throw new Error('No image generated');
}

/**
 * Stability AI 以图生图
 */
async function img2imgWithStability(
  config: ImageGenerationConfig,
  prompt: string,
  imageBase64: string,
  size: '1024x1024' | '1152x896' | '1216x832' | '1344x768' | '1536x640' | '640x1536' | '768x1344' | '832x1216' | '896x1152' = '1024x1024',
  strength: number = 0.7
): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.stability.ai/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/generation/stable-diffusion-xl-1024-v1-0/image-to-image`;

  const [width, height] = size.split('x').map(Number);
  
  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt, weight: 1 }],
      init_image: base64Data,
      init_image_mode: 'IMAGE_STRENGTH',
      image_strength: strength,
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
  
  if (data.artifacts && data.artifacts[0] && data.artifacts[0].base64) {
    return `data:image/png;base64,${data.artifacts[0].base64}`;
  }
  
  throw new Error('No image generated');
}


