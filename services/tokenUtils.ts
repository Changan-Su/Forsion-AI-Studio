/**
 * Token estimation utilities
 * Provides approximate token counting for models that don't return usage information
 */

/**
 * Rough estimation of tokens based on text length
 * This is a simple approximation: ~4 characters per token for English text
 * For other languages, this may vary, but it's a reasonable default
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough estimate: 1 token ≈ 4 characters for English
  // For mixed content, we use a slightly more conservative estimate
  return Math.ceil(text.length / 3.5);
}

/**
 * Estimate tokens for messages array
 * Accounts for message structure overhead (role, content formatting)
 */
export function estimateMessageTokens(messages: Array<{ role: string; content: string | any[] }>): number {
  let totalTokens = 0;
  
  for (const msg of messages) {
    // Base overhead per message: role name + formatting (~4 tokens)
    totalTokens += 4;
    
    if (typeof msg.content === 'string') {
      totalTokens += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      // Multimodal content (text + images)
      for (const item of msg.content) {
        if (item.type === 'text' && typeof item.text === 'string') {
          totalTokens += estimateTokens(item.text);
        } else if (item.type === 'image_url') {
          // Images typically count as ~85 tokens per image (for base64 encoded)
          // This is a rough estimate for vision models
          totalTokens += 85;
        }
      }
    }
  }
  
  return totalTokens;
}

/**
 * Estimate tokens for Gemini API
 * Gemini uses a different tokenization, but we use a similar approximation
 */
export function estimateGeminiTokens(text: string): number {
  if (!text) return 0;
  // Gemini tokenization is similar but slightly different
  // Using ~3.5 characters per token as a reasonable estimate
  return Math.ceil(text.length / 3.5);
}

/**
 * Estimate tokens for Gemini messages with parts
 */
export function estimateGeminiMessageTokens(
  history: Array<{ role: string; parts: Array<{ text?: string; inlineData?: any }> }>,
  currentPrompt: string,
  attachments: Array<{ type: string; url: string }> = []
): { input: number; output: number } {
  let inputTokens = 0;
  
  // History messages
  for (const msg of history) {
    inputTokens += 4; // Role overhead
    for (const part of msg.parts) {
      if (part.text) {
        inputTokens += estimateGeminiTokens(part.text);
      } else if (part.inlineData) {
        // Images in Gemini count as tokens
        inputTokens += 85;
      }
    }
  }
  
  // Current prompt
  inputTokens += estimateGeminiTokens(currentPrompt);
  inputTokens += 4; // Message overhead
  
  // Attachments
  for (const att of attachments) {
    if (att.type === 'image') {
      inputTokens += 85; // Image tokens
    }
  }
  
  return { input: inputTokens, output: 0 }; // Output will be calculated from response
}

