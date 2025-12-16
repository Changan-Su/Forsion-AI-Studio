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
    const { model_id, messages, temperature = 0.7, max_tokens, stream = true } = body;

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

    // Build request payload with streaming enabled
    const payload: any = {
      model: apiModelId,
      messages,
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

export default router;


