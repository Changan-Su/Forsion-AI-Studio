import { Router } from 'express';
import { getGlobalModel } from '../services/modelService.js';
import { logApiUsage } from '../services/usageService.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { checkSufficientCredits, deductCredits, ensureCreditAccount } from '../services/creditService.js';
import { calculateCost } from '../services/creditPricingService.js';
import { getUserById } from '../services/userService.js';
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
      // Still return the result, but log the error
    }

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


