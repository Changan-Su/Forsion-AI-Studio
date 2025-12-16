
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Attachment } from "../types";
import { estimateGeminiMessageTokens, estimateGeminiTokens } from "./tokenUtils.js";

// Streaming version of generateGeminiResponse
export const generateGeminiResponseStream = async (
  modelId: string,
  prompt: string,
  history: { role: string; parts: { text: string }[] }[] = [],
  apiKey?: string,
  attachments: Attachment[] = [],
  onChunk: (text: string, reasoning?: string) => void = () => {},
  enableThinking: boolean = false,
  signal?: AbortSignal
): Promise<{ text: string; imageUrl?: string; reasoning?: string; usage?: { prompt_tokens: number; completion_tokens: number } }> => {
  const finalKey = apiKey || process.env.API_KEY;

  if (!finalKey) {
    throw new Error("Gemini API Key is missing. Please configure it in Admin Settings.");
  }

  const aiClient = new GoogleGenAI({ apiKey: finalKey });

  try {
    // Handle Nano Banana (Image Generation) - no streaming for image gen
    if (modelId === 'gemini-2.5-flash-image' && attachments.length === 0) {
      // Check if request was aborted before making the request
      if (signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      
      const response = await aiClient.models.generateContent({
        model: modelId,
        contents: { parts: [{ text: prompt }] }
      });
      
      // Check again after request
      if (signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      let generatedText = "";
      let generatedImageUrl: string | undefined = undefined;

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        } else if (part.text) {
          generatedText += part.text;
        }
      }

      if (!generatedText && !generatedImageUrl) {
        return { text: "No content generated." };
      }

      onChunk(generatedText);
      
      // Estimate tokens for image generation
      const inputTokens = estimateGeminiTokens(prompt);
      const outputTokens = generatedText ? estimateGeminiTokens(generatedText) : 0;
      const usage = {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens
      };
      
      return { text: generatedText, imageUrl: generatedImageUrl, usage };

    } else {
      // Standard Chat Models with streaming
      const contents = history.map(msg => ({
        role: msg.role === 'admin' ? 'model' : msg.role,
        parts: msg.parts
      }));

      const currentParts: any[] = [];
      
      // Add thinking instruction if enabled
      const thinkingPrefix = enableThinking 
        ? "Think step by step carefully before answering. Show your reasoning process in <think></think> tags before providing your final answer.\n\n"
        : "";
      
      if (prompt) currentParts.push({ text: thinkingPrefix + prompt });

      if (attachments && attachments.length > 0) {
        attachments.forEach(att => {
          if (att.type === 'image') {
            const base64Data = att.url.split(',')[1];
            currentParts.push({
              inlineData: { mimeType: att.mimeType, data: base64Data }
            });
          }
        });
      }

      contents.push({ role: 'user', parts: currentParts });

      // Use streaming
      const streamResult = await aiClient.models.generateContentStream({
        model: modelId,
        contents: contents,
      });

      let fullText = '';
      let reasoning: string | undefined = undefined;

      for await (const chunk of streamResult) {
        // Check if request was aborted
        if (signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError');
        }
        
        const chunkText = chunk.text || '';
        fullText += chunkText;
        
        // Check for think tags in progress
        const thinkRegex = /<think>([\s\S]*?)<\/redacted_reasoning>/i;
        const match = fullText.match(thinkRegex);
        if (match) {
          reasoning = match[1].trim();
          const displayText = fullText.replace(thinkRegex, '').trim();
          onChunk(displayText, reasoning);
        } else {
          onChunk(fullText, reasoning);
        }
      }

      // Final cleanup - handle all think tags
      const thinkRegexGlobal = /<think>([\s\S]*?)<\/redacted_reasoning>/gi;
      const allMatches = fullText.match(thinkRegexGlobal);
      if (allMatches) {
        // Extract all reasoning content
        const extractedReasoning = allMatches
          .map(m => m.replace(/<\/?redacted_reasoning>/gi, '').trim())
          .join('\n');
        if (extractedReasoning) {
          reasoning = extractedReasoning;
        }
        // Remove all think tags from content
        fullText = fullText.replace(thinkRegexGlobal, '').trim();
      }

      // Final callback with cleaned content
      onChunk(fullText, reasoning);

      // Estimate tokens for Gemini (Gemini API doesn't return usage in streaming)
      const tokenEstimate = estimateGeminiMessageTokens(contents, prompt, attachments);
      const outputTokens = estimateGeminiTokens(fullText);
      const usage = {
        prompt_tokens: tokenEstimate.input,
        completion_tokens: outputTokens
      };

      return { text: fullText, reasoning, usage };
    }

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate content");
  }
};

export const generateGeminiResponse = async (
  modelId: string,
  prompt: string,
  history: { role: string; parts: { text: string }[] }[] = [],
  apiKey?: string,
  attachments: Attachment[] = []
): Promise<{ text: string; imageUrl?: string; reasoning?: string; usage?: { prompt_tokens: number; completion_tokens: number } }> => {
  
  // Prioritize passed key (from Admin Panel), fallback to env
  const finalKey = apiKey || process.env.API_KEY;

  if (!finalKey) {
    throw new Error("Gemini API Key is missing. Please configure it in Admin Settings.");
  }

  const aiClient = new GoogleGenAI({ apiKey: finalKey });

  try {
    // Handle Nano Banana (Image Generation) specifically
    if (modelId === 'gemini-2.5-flash-image' && attachments.length === 0) {
      // Logic for Image GENERATION (Text -> Image)
      const response = await aiClient.models.generateContent({
        model: modelId,
        contents: {
          parts: [{ text: prompt }]
        }
      });

      let generatedText = "";
      let generatedImageUrl: string | undefined = undefined;

      // Parse response for image or text
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        } else if (part.text) {
          generatedText += part.text;
        }
      }

      if (!generatedText && !generatedImageUrl) {
        return { text: "No content generated." };
      }

      // Estimate tokens for image generation
      const inputTokens = estimateGeminiTokens(prompt);
      const outputTokens = generatedText ? estimateGeminiTokens(generatedText) : 0;
      const usage = {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens
      };

      return { text: generatedText, imageUrl: generatedImageUrl, usage };

    } else {
      // Standard Chat Models (Gemini Flash, Gemini Pro) OR Image Generation with Reference
      
      // 1. Convert History
      const contents = history.map(msg => ({
        role: msg.role === 'admin' ? 'model' : msg.role,
        parts: msg.parts
      }));

      // 2. Construct Current Message Parts
      const currentParts: any[] = [];
      
      // Add text prompt
      if (prompt) {
        currentParts.push({ text: prompt });
      }

      // Add attachments (images)
      if (attachments && attachments.length > 0) {
        attachments.forEach(att => {
          if (att.type === 'image') {
            // Strip the data:image/png;base64, prefix if present
            const base64Data = att.url.split(',')[1];
            currentParts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: base64Data
              }
            });
          }
        });
      }

      // Add the new user message
      contents.push({
        role: 'user',
        parts: currentParts
      });

      const response: GenerateContentResponse = await aiClient.models.generateContent({
        model: modelId,
        contents: contents,
      });

      let rawText = response.text || "";
      let reasoning: string | undefined = undefined;

      // Check for <think> tags in Gemini response
      const thinkRegex = /<think>([\s\S]*?)<\/redacted_reasoning>/i;
      const match = rawText.match(thinkRegex);
      if (match) {
        reasoning = match[1].trim();
        rawText = rawText.replace(thinkRegex, '').trim();
      }

      // Estimate tokens for Gemini
      const tokenEstimate = estimateGeminiMessageTokens(contents, prompt, attachments);
      const outputTokens = estimateGeminiTokens(rawText);
      const usage = {
        prompt_tokens: tokenEstimate.input,
        completion_tokens: outputTokens
      };

      return { text: rawText, reasoning: reasoning, usage };
    }

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate content");
  }
};
