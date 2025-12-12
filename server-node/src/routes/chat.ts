import { Router } from 'express';
import { getGlobalModel } from '../services/modelService.js';
import { logApiUsage } from '../services/usageService.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import type { ChatCompletionRequest } from '../types/index.js';

const router = Router();

// Proxy chat completions to external AI APIs
router.post('/chat/completions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const body = req.body as ChatCompletionRequest;
    const { model_id, messages, temperature = 0.7, max_tokens } = body;

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

    // Build request payload
    const payload: any = {
      model: apiModelId,
      messages,
      temperature,
    };
    if (max_tokens) {
      payload.max_tokens = max_tokens;
    }

    // Make request to external API
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${model.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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

    const result = await response.json();

    // Log successful request
    const usage = result.usage || {};
    await logApiUsage(
      req.user!.username,
      model_id,
      model.name,
      model.provider,
      usage.prompt_tokens || 0,
      usage.completion_tokens || 0,
      true
    );

    res.json(result);
  } catch (error: any) {
    console.error('Chat completion error:', error);
    
    if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({ detail: 'Request to AI API timed out' });
    }
    
    res.status(502).json({ detail: `Failed to connect to AI API: ${error.message}` });
  }
});

export default router;

