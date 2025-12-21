import { Router } from 'express';
import { Readable } from 'stream';
import { getGlobalModel } from '../services/modelService.js';
import { logApiUsage } from '../services/usageService.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { checkSufficientCredits, deductCredits, ensureCreditAccount } from '../services/creditService.js';
import { calculateCost } from '../services/creditPricingService.js';
import { getUserById } from '../services/userService.js';
import type { ChatCompletionRequest } from '../types/index.js';

const router = Router();

// Proxy chat completions to external AI APIs with streaming support
router.post('/chat/completions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const body = req.body as ChatCompletionRequest;
    const { model_id, messages, temperature = 0.7, max_tokens, stream = true, attachments = [] } = body;

    if (!model_id || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ detail: 'model_id and messages are required' });
    }

    // Get model configuration
    const model = await getGlobalModel(model_id);
    if (!model) {
      return res.status(404).json({ detail: `Model '${model_id}' not found` });
    }

    if (!model.isEnabled) {
      return res.status(400).json({ detail: `Model '${model_id}' is disabled` });
    }

    if (!model.apiKey) {
      return res.status(400).json({ 
        detail: `API Key not configured for model '${model.name}'` 
      });
    }

    const baseUrl = (model.defaultBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const apiModelId = model.apiModelId || model_id;

    // Get user for credit check
    const user = await getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    // Ensure credit account exists
    await ensureCreditAccount(user.id);

    // Estimate cost based on input tokens (rough estimate)
    const estimatedInputTokens = JSON.stringify(messages).length / 4; // Rough estimate
    const estimatedOutputTokens = max_tokens || 500; // Default estimate
    const estimatedCost = await calculateCost(model_id, estimatedInputTokens, estimatedOutputTokens);

    // Check if user has sufficient credits
    const hasCredits = await checkSufficientCredits(user.id, estimatedCost);
    if (!hasCredits) {
      return res.status(402).json({ 
        detail: `Insufficient credits. Required: ${estimatedCost.toFixed(2)}, please recharge your account.` 
      });
    }

    // Prepare messages with system prompt if enabled
    let finalMessages = [...messages];
    
    // Process attachments: convert image attachments to proper format for API
    if (attachments && attachments.length > 0) {
      // Find the last user message and add image attachments to it
      const lastUserMsgIndex = finalMessages.length - 1;
      if (lastUserMsgIndex >= 0 && finalMessages[lastUserMsgIndex].role === 'user') {
        const lastMsg = finalMessages[lastUserMsgIndex];
        const imageAttachments = attachments.filter(att => att.type === 'image');
        
        if (imageAttachments.length > 0) {
          // For OpenAI-style APIs, convert to content array format
          if (model.provider === 'external' || !model.provider) {
            const contentArray: any[] = [{ type: "text", text: lastMsg.content }];
            
            imageAttachments.forEach(att => {
              contentArray.push({
                type: "image_url",
                image_url: { url: att.url }
              });
            });
            
            finalMessages[lastUserMsgIndex] = {
              ...lastMsg,
              content: contentArray as any
            };
          } else if (model.provider === 'gemini') {
            // For Gemini, we need to use parts format with inlineData
            // However, since we're proxying to external API, we'll use OpenAI format
            // The external API should handle Gemini format conversion if needed
            const contentArray: any[] = [{ type: "text", text: lastMsg.content }];
            
            imageAttachments.forEach(att => {
              // Extract base64 data
              const base64Data = att.url.replace(/^data:image\/\w+;base64,/, '');
              const mimeType = att.mimeType || 'image/png';
              
              contentArray.push({
                type: "image_url",
                image_url: { url: att.url }
              });
            });
            
            finalMessages[lastUserMsgIndex] = {
              ...lastMsg,
              content: contentArray as any
            };
          }
        }
      }
    }
    
    // Add system prompt and cacheable content if prompt caching is enabled
    if (model.promptCachingEnabled && model.systemPrompt) {
      // Check if there's already a system message
      const hasSystemMessage = messages.some((msg: any) => msg.role === 'system');
      
      if (!hasSystemMessage) {
        // Build system message content
        let systemContent = model.systemPrompt;
        
        // For Gemini provider, append cacheable content to system prompt
        if (model.provider === 'gemini' && model.cacheableContent) {
          systemContent += '\n\n' + model.cacheableContent;
        }
        
        // Prepend system prompt as the first message
        finalMessages = [
          { role: 'system', content: systemContent },
          ...messages
        ];
      } else {
        // If system message exists, prepend the model's system prompt before it
        const systemMsgIndex = messages.findIndex((msg: any) => msg.role === 'system');
        
        let systemContent = model.systemPrompt;
        if (model.provider === 'gemini' && model.cacheableContent) {
          systemContent += '\n\n' + model.cacheableContent;
        }
        
        finalMessages = [
          { role: 'system', content: systemContent },
          ...messages.slice(0, systemMsgIndex),
          ...messages.slice(systemMsgIndex)
        ];
      }
      
      console.log(`[Chat] Prompt Caching enabled for model ${model_id}, added system prompt (${model.systemPrompt.length} chars)`);
      if (model.cacheableContent) {
        console.log(`[Chat] Added cacheable content (${model.cacheableContent.length} chars)`);
      }
    }

    // Build request payload with streaming enabled
    const payload: any = {
      model: apiModelId,
      messages: finalMessages,
      temperature,
      stream: stream, // Enable streaming
      stream_options: stream ? { include_usage: true } : undefined, // Request usage info in stream
    };
    if (max_tokens) {
      payload.max_tokens = max_tokens;
    }

    // Make request to external API
    console.log(`[Chat] Making request to ${baseUrl}/chat/completions with stream=${stream}`);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${model.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    console.log(`[Chat] External API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetail = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.error?.message || errorJson.message || errorText;
      } catch {}

      // Log failed request
      await logApiUsage(
        req.user!.username,
        model_id,
        model.name,
        model.provider,
        0,
        0,
        false,
        errorDetail
      );

      return res.status(response.status).json({ detail: errorDetail });
    }

    // Check if response is streaming (SSE)
    const contentType = response.headers.get('content-type') || '';
    console.log(`[Chat] Response content-type: ${contentType}, stream param: ${stream}`);
    const isStreaming = contentType.includes('text/event-stream') || 
                        contentType.includes('text/plain') ||
                        stream;
    console.log(`[Chat] isStreaming: ${isStreaming}, has body: ${!!response.body}`);

    if (isStreaming && response.body) {
      // Set up SSE headers for streaming response
      console.log('[Chat] Starting streaming response...');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Track usage from stream
      let tokensInput = 0;
      let tokensOutput = 0;
      let fullContent = '';

      // Create a transform to track content and usage
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Forward the chunk to client immediately
          res.write(chunk);

          // Parse SSE data to extract usage info
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            if (trimmed === 'data: [DONE]') continue;

            try {
              const json = JSON.parse(trimmed.slice(6));
              
              // Extract content for token estimation
              const delta = json.choices?.[0]?.delta;
              if (delta?.content) {
                fullContent += delta.content;
              }

              // Extract usage info (usually in the last chunk)
              if (json.usage) {
                tokensInput = json.usage.prompt_tokens || tokensInput;
                tokensOutput = json.usage.completion_tokens || tokensOutput;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }

        // Send final [DONE] if not already sent
        res.write('data: [DONE]\n\n');
        res.end();

        // Estimate tokens if not provided
        if (tokensOutput === 0 && fullContent) {
          tokensOutput = Math.ceil(fullContent.length / 4);
        }
        if (tokensInput === 0) {
          tokensInput = Math.ceil(JSON.stringify(messages).length / 4);
        }

        // Log successful request after stream completes
        await logApiUsage(
          req.user!.username,
          model_id,
          model.name,
          model.provider,
          tokensInput,
          tokensOutput,
          true
        );

        // Calculate actual cost and deduct credits
        const actualCost = await calculateCost(model_id, tokensInput, tokensOutput);
        const deducted = await deductCredits(
          user.id,
          actualCost,
          `API usage: ${model.name} (${tokensInput} input + ${tokensOutput} output tokens)`,
          undefined
        );

        if (!deducted) {
          console.error(`Failed to deduct credits for user ${user.id}, cost: ${actualCost}`);
        }
      } catch (streamError: any) {
        console.error('Stream error:', streamError);
        // Try to end the response gracefully
        if (!res.writableEnded) {
          res.write(`data: {"error": "${streamError.message}"}\n\n`);
          res.end();
        }
      }
    } else {
      // Non-streaming response (fallback)
      const result = await response.json() as any;

      // Log successful request
      const usage = result.usage || {};
      const tokensInput = usage.prompt_tokens || 0;
      const tokensOutput = usage.completion_tokens || 0;

      await logApiUsage(
        req.user!.username,
        model_id,
        model.name,
        model.provider,
        tokensInput,
        tokensOutput,
        true
      );

      // Calculate actual cost and deduct credits
      const actualCost = await calculateCost(model_id, tokensInput, tokensOutput);
      const deducted = await deductCredits(
        user.id,
        actualCost,
        `API usage: ${model.name} (${tokensInput} input + ${tokensOutput} output tokens)`,
        usage.id || undefined
      );

      if (!deducted) {
        console.error(`Failed to deduct credits for user ${user.id}, cost: ${actualCost}`);
      }

      res.json(result);
    }
  } catch (error: any) {
    console.error('Chat completion error:', error);
    
    if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({ detail: 'Request to AI API timed out' });
    }
    
    res.status(502).json({ detail: `Failed to connect to AI API: ${error.message}` });
  }
});

// Proxy image generation to external AI APIs (OpenAI DALL-E, etc.)
router.post('/images/generations', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { 
      model_id, 
      prompt, 
      size = '1024x1024', 
      quality = 'standard', // For backward compatibility (standard/hd) or gpt-image (auto/high/medium/low)
      style, // 'vivid' | 'natural' - for dall-e-3
      n = 1, // Number of images to generate
      response_format = 'url', // 'url' | 'b64_json'
      output_format, // 'png' | 'jpeg' | 'webp' - for gpt-image
      background, // 'transparent' | 'opaque' | 'auto' - for gpt-image
      output_compression, // 1-100 - for gpt-image
      moderation, // 'auto' | 'low' - for gpt-image
      image, // Optional: for img2img
      mode = 'generate' // 'generate' | 'edit' | 'img2img'
    } = req.body;

    if (!model_id || !prompt) {
      return res.status(400).json({ detail: 'model_id and prompt are required' });
    }

    // If image is provided, redirect to edit endpoint
    if (image && (mode === 'edit' || mode === 'img2img')) {
      // Forward to edit endpoint
      req.body.mode = mode;
      return res.status(400).json({ 
        detail: 'Please use /api/images/edits endpoint for image editing and img2img' 
      });
    }

    // Get model configuration
    const model = await getGlobalModel(model_id);
    if (!model) {
      return res.status(404).json({ detail: `Model '${model_id}' not found` });
    }

    if (!model.isEnabled) {
      return res.status(400).json({ detail: `Model '${model_id}' is disabled` });
    }

    if (!model.apiKey) {
      return res.status(400).json({ 
        detail: `API Key not configured for model '${model.name}'` 
      });
    }

    const baseUrl = (model.defaultBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    
    // Determine the actual model to use
    // Check if model.apiModelId is set, otherwise default to dall-e-3
    const apiModel = model.apiModelId || 'dall-e-3';
    
    // Check if this is a gpt-image model
    const isGptImageModel = ['chatgpt-image-latest', 'gpt-image-1.5', 'gpt-image-1'].includes(apiModel);
    const isDalleModel = ['dall-e-2', 'dall-e-3'].includes(apiModel);
    
    // Validate n parameter based on model
    // dall-e-2 and gpt-image models support n=1-10, dall-e-3 only supports n=1
    const validN = (isDalleModel && apiModel === 'dall-e-3')
      ? 1 // Always 1 for dall-e-3
      : Math.min(Math.max(1, n || 1), 10); // Clamp between 1-10 for others
    
    // Map quality to style if style is not provided (for backward compatibility with DALL-E)
    // quality: 'hd' -> style: 'vivid', quality: 'standard' -> style: 'natural'
    // For gpt-image, quality can be: auto/high/medium/low
    const finalStyle = style || (isDalleModel && quality === 'hd' ? 'vivid' : isDalleModel ? 'natural' : undefined);

    // Get user for credit check
    const user = await getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    // Ensure credit account exists
    await ensureCreditAccount(user.id);

    // Estimate cost for image generation (typically higher than text)
    const estimatedCost = 0.04; // DALL-E 3 standard quality costs ~$0.04 per image

    // Check if user has sufficient credits
    const hasCredits = await checkSufficientCredits(user.id, estimatedCost);
    if (!hasCredits) {
      return res.status(402).json({ 
        detail: `Insufficient credits. Required: ${estimatedCost.toFixed(2)}, please recharge your account.` 
      });
    }

    // Make request to OpenAI DALL-E API
    console.log(`[Image Generation] Making request to ${baseUrl}/images/generations with model: ${apiModel}`);
    
    // Build request body according to API spec
    const requestBody: any = {
      model: apiModel,
      prompt: prompt,
      n: validN,
      size: size,
    };
    
    // Handle different model types
    if (isGptImageModel) {
      // gpt-image models use different parameters
      if (output_format) requestBody.output_format = output_format;
      if (background) requestBody.background = background;
      if (output_compression !== undefined) requestBody.output_compression = output_compression;
      if (moderation) requestBody.moderation = moderation;
      if (quality && ['auto', 'high', 'medium', 'low'].includes(quality)) {
        requestBody.quality = quality;
      }
      // gpt-image defaults to b64_json in response, but can use url
      if (response_format) requestBody.response_format = response_format;
    } else {
      // DALL-E models
      requestBody.response_format = response_format;
      
      // Add style parameter (for dall-e-3, or if explicitly provided)
      if (apiModel === 'dall-e-3' || style) {
        requestBody.style = finalStyle;
      }
      
      // Add quality parameter if provided (for backward compatibility)
      if (quality && !style && ['standard', 'hd'].includes(quality)) {
        requestBody.quality = quality;
      }
    }
    
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${model.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetail = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.error?.message || errorJson.message || errorText;
      } catch {}

      // Log failed request
      await logApiUsage(
        req.user!.username,
        model_id,
        model.name,
        model.provider,
        0,
        0,
        false,
        errorDetail
      );

      return res.status(response.status).json({ detail: errorDetail });
    }

    const result = await response.json() as any;

    // Extract usage information if available (gpt-image returns usage in response)
    let tokensInput = 0;
    let tokensOutput = 0;
    
    if (result.usage) {
      // gpt-image returns detailed usage information
      tokensInput = result.usage.input_tokens || result.usage.total_tokens || 0;
      tokensOutput = result.usage.output_tokens || 0;
    } else {
      // Estimate tokens for image generation (fallback for DALL-E)
      tokensInput = Math.ceil(prompt.length / 4) + 1000;
      tokensOutput = 0;
    }

    // Log successful request
    await logApiUsage(
      req.user!.username,
      model_id,
      model.name,
      model.provider || 'openai',
      tokensInput,
      tokensOutput,
      true
    );

    // Calculate actual cost and deduct credits
    const actualCost = await calculateCost(model_id, tokensInput, tokensOutput);
    const deducted = await deductCredits(
      user.id,
      actualCost,
      `Image generation: ${model.name}`,
      undefined
    );

    if (!deducted) {
      console.error(`Failed to deduct credits for user ${user.id}, cost: ${actualCost}`);
    }

    res.json(result);
  } catch (error: any) {
    console.error('Image generation error:', error);
    
    if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({ detail: 'Request to AI API timed out' });
    }
    
    res.status(502).json({ detail: `Failed to connect to AI API: ${error.message}` });
  }
});

// Image editing and image-to-image generation endpoint
router.post('/images/edits', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { 
      model_id, 
      prompt, 
      image, // base64 encoded image or array of images (for gpt-image, max 4)
      images, // Alternative: array of images
      mode = 'edit', // 'edit' or 'img2img'
      size = '1024x1024', 
      quality = 'standard', // For DALL-E: standard/hd, For gpt-image: auto/high/medium/low
      strength = 0.7, // For image-to-image (0-1)
      mask, // Optional mask for editing specific regions
      background, // 'transparent' | 'opaque' | 'auto' - for gpt-image
      response_format = 'url', // 'url' | 'b64_json'
      n = 1 // Number of images to generate
    } = req.body;

    // Support both single image and array of images
    const imageArray = images || (image ? [image] : []);
    
    if (!model_id || !prompt || imageArray.length === 0) {
      return res.status(400).json({ detail: 'model_id, prompt, and at least one image are required' });
    }
    
    // gpt-image supports up to 4 images
    if (imageArray.length > 4) {
      return res.status(400).json({ detail: 'Maximum 4 images supported for editing' });
    }

    // Get model configuration
    const model = await getGlobalModel(model_id);
    if (!model) {
      return res.status(404).json({ detail: `Model '${model_id}' not found` });
    }

    if (!model.isEnabled) {
      return res.status(400).json({ detail: `Model '${model_id}' is disabled` });
    }

    if (!model.apiKey) {
      return res.status(400).json({ 
        detail: `API Key not configured for model '${model.name}'` 
      });
    }

    const baseUrl = (model.defaultBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const provider = model.provider || 'openai';
    const apiModel = model.apiModelId || 'dall-e-3';
    const isGptImageModel = ['chatgpt-image-latest', 'gpt-image-1.5', 'gpt-image-1'].includes(apiModel);
    
    // Validate n parameter (gpt-image supports 1-10, DALL-E edit supports 1)
    const validN = isGptImageModel 
      ? Math.min(Math.max(1, n || 1), 10) // gpt-image supports 1-10
      : 1; // DALL-E edit only supports 1

    // Get user for credit check
    const user = await getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    // Ensure credit account exists
    await ensureCreditAccount(user.id);

    // Estimate cost for image editing (similar to generation)
    const estimatedCost = mode === 'edit' ? 0.04 : 0.05; // img2img might be slightly more expensive

    // Check if user has sufficient credits
    const hasCredits = await checkSufficientCredits(user.id, estimatedCost);
    if (!hasCredits) {
      return res.status(402).json({ 
        detail: `Insufficient credits. Required: ${estimatedCost.toFixed(2)}, please recharge your account.` 
      });
    }

    let response: Response;
    let result: any;

    // Handle different providers
    if (provider === 'openai' || provider === 'external') {
      if (mode === 'edit') {
        // OpenAI/gpt-image image editing endpoint
        console.log(`[Image Edit] Making request to ${baseUrl}/images/edits with ${imageArray.length} image(s)`);
        
        const formData = new FormData();
        
        // Handle multiple images for gpt-image (up to 4 images)
        if (isGptImageModel && imageArray.length > 1) {
          // gpt-image supports multiple images
          imageArray.forEach((img: string, index: number) => {
            const imageBuffer = Buffer.from(img.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const mimeType = img.match(/data:image\/(\w+);base64/)?.[1] || 'png';
            formData.append('image', new Blob([imageBuffer], { type: `image/${mimeType}` }), `image${index}.${mimeType}`);
          });
        } else {
          // Single image (DALL-E or gpt-image single image)
          const imageBuffer = Buffer.from(imageArray[0].replace(/^data:image\/\w+;base64,/, ''), 'base64');
          const mimeType = imageArray[0].match(/data:image\/(\w+);base64/)?.[1] || 'png';
          formData.append('image', new Blob([imageBuffer], { type: `image/${mimeType}` }), `image.${mimeType}`);
        }
        
        formData.append('prompt', prompt);
        formData.append('model', apiModel);
        formData.append('n', validN.toString());
        formData.append('size', size);
        
        // Add gpt-image specific parameters
        if (isGptImageModel) {
          if (background) formData.append('background', background);
          if (response_format) formData.append('response_format', response_format);
          if (quality && ['auto', 'high', 'medium', 'low'].includes(quality)) {
            formData.append('quality', quality);
          }
        }
        
        if (mask) {
          const maskBuffer = Buffer.from(mask.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          formData.append('mask', new Blob([maskBuffer], { type: 'image/png' }), 'mask.png');
        }

        response = await fetch(`${baseUrl}/images/edits`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${model.apiKey}`,
          },
          body: formData as any,
        });
      } else {
        // OpenAI doesn't support img2img directly, return error
        return res.status(400).json({ 
          detail: 'OpenAI does not support image-to-image generation. Please use Stability AI or another provider.' 
        });
      }
    } else if (provider === 'stability') {
      // Stability AI image-to-image endpoint
      console.log(`[Image ${mode}] Making request to Stability AI`);
      
      const endpoint = mode === 'edit' 
        ? `${baseUrl}/generation/stable-diffusion-xl-1024-v1-0/image-to-image`
        : `${baseUrl}/generation/stable-diffusion-xl-1024-v1-0/image-to-image`;
      
      // Remove data URL prefix if present
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      
      const [width, height] = size.split('x').map(Number);

      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${model.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text_prompts: [{ text: prompt, weight: 1 }],
          init_image: base64Data,
          init_image_mode: mode === 'edit' ? 'IMAGE_STRENGTH' : 'IMAGE_STRENGTH',
          image_strength: strength,
          cfg_scale: 7,
          height: height,
          width: width,
          steps: 30,
          samples: 1,
        }),
      });
    } else {
      return res.status(400).json({ 
        detail: `Provider '${provider}' is not supported for image editing. Supported: openai, stability` 
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetail = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.error?.message || errorJson.message || errorText;
      } catch {}

      // Log failed request
      await logApiUsage(
        req.user!.username,
        model_id,
        model.name,
        provider,
        0,
        0,
        false,
        errorDetail
      );

      return res.status(response.status).json({ detail: errorDetail });
    }

    result = await response.json() as any;

    // Transform Stability AI response to match OpenAI format
    if (provider === 'stability') {
      if (result.artifacts && result.artifacts[0] && result.artifacts[0].base64) {
        result = {
          data: [{
            url: `data:image/png;base64,${result.artifacts[0].base64}`
          }]
        };
      } else {
        throw new Error('No image generated from Stability AI');
      }
    }

    // Extract usage information if available (gpt-image returns usage in response)
    let tokensInput = 0;
    let tokensOutput = 0;
    
    if (result.usage) {
      // gpt-image returns detailed usage information
      tokensInput = result.usage.input_tokens || result.usage.total_tokens || 0;
      tokensOutput = result.usage.output_tokens || 0;
    } else {
      // Estimate tokens for image editing (fallback)
      tokensInput = Math.ceil(prompt.length / 4) + 1000;
      tokensOutput = 0;
    }

    // Log successful request
    await logApiUsage(
      req.user!.username,
      model_id,
      model.name,
      provider,
      tokensInput,
      tokensOutput,
      true
    );

    // Calculate actual cost and deduct credits
    const actualCost = await calculateCost(model_id, tokensInput, tokensOutput);
    const deducted = await deductCredits(
      user.id,
      actualCost,
      `Image ${mode}: ${model.name}`,
      undefined
    );

    if (!deducted) {
      console.error(`Failed to deduct credits for user ${user.id}, cost: ${actualCost}`);
    }

    res.json(result);
  } catch (error: any) {
    console.error('Image editing error:', error);
    
    if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({ detail: 'Request to AI API timed out' });
    }
    
    res.status(502).json({ detail: `Failed to connect to AI API: ${error.message}` });
  }
});

export default router;


