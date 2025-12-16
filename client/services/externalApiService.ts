
import { Attachment } from "../types";
import { estimateMessageTokens, estimateTokens } from "./tokenUtils.js";

interface ExternalApiConfig {
  apiKey: string;
  baseUrl?: string;
}

// Helper function to build URL and messages
const prepareRequest = (
  config: ExternalApiConfig,
  modelId: string,
  messages: { role: string; content: string }[],
  defaultBaseUrl?: string,
  attachments: Attachment[] = []
) => {
  let baseUrl = config.baseUrl || defaultBaseUrl || 'https://api.openai.com/v1';
  
  baseUrl = baseUrl.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  baseUrl = baseUrl.replace(/\/+$/, '');

  let primaryUrl = '';
  let fallbackUrl = '';

  if (baseUrl.endsWith('/chat/completions')) {
    primaryUrl = baseUrl;
  } else if (baseUrl.endsWith('/v1')) {
    primaryUrl = `${baseUrl}/chat/completions`;
  } else {
    primaryUrl = `${baseUrl}/chat/completions`;
    if (!baseUrl.includes('/v1')) {
      fallbackUrl = `${baseUrl}/v1/chat/completions`;
    }
  }

  if (baseUrl === 'https://api.openai.com') {
    primaryUrl = 'https://api.openai.com/v1/chat/completions';
    fallbackUrl = '';
  }

  const finalMessages = [...messages];
  
  if (attachments.length > 0) {
    const contentArray: any[] = [];
    const lastMsg = finalMessages.pop();
    
    if (lastMsg && lastMsg.role === 'user') {
       contentArray.push({ type: "text", text: lastMsg.content });
       
       attachments.forEach(att => {
         if (att.type === 'image') {
           contentArray.push({
             type: "image_url",
             image_url: { url: att.url }
           });
         }
       });

       finalMessages.push({ role: 'user', content: contentArray as any }); 
    } else {
      if(lastMsg) finalMessages.push(lastMsg);
    }
  }

  return { primaryUrl, fallbackUrl, finalMessages };
};

// Streaming version of generateExternalResponse
export const generateExternalResponseStream = async (
  config: ExternalApiConfig,
  modelId: string,
  messages: { role: string; content: string }[],
  defaultBaseUrl?: string,
  attachments: Attachment[] = [],
  onChunk: (chunk: string, reasoning?: string) => void = () => {},
  enableThinking: boolean = false,
  signal?: AbortSignal
): Promise<{ content: string; reasoning?: string; usage?: { prompt_tokens: number; completion_tokens: number } }> => {
  // Modify the last user message if thinking is enabled
  let finalMessages = [...messages];
  if (enableThinking && finalMessages.length > 0) {
    const lastMsgIdx = finalMessages.length - 1;
    if (finalMessages[lastMsgIdx].role === 'user') {
      const thinkingPrefix = "Think step by step carefully before answering. Show your reasoning process in <think></think> tags before providing your final answer.\n\n";
      finalMessages[lastMsgIdx] = {
        ...finalMessages[lastMsgIdx],
        content: thinkingPrefix + finalMessages[lastMsgIdx].content
      };
    }
  }
  
  const { primaryUrl, fallbackUrl, finalMessages: processedMessages } = prepareRequest(config, modelId, finalMessages, defaultBaseUrl, attachments);

  const performStreamRequest = async (url: string) => {
    return fetch(url, {
      method: 'POST',
      credentials: 'omit',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: processedMessages,
        temperature: 0.7,
        stream: true
      }),
      signal: signal
    });
  };

  let response: Response | undefined;
  let usedUrl = primaryUrl;

  try {
    response = await performStreamRequest(primaryUrl);
    if (response.status === 404 && fallbackUrl) {
      response = await performStreamRequest(fallbackUrl);
      usedUrl = fallbackUrl;
    }
  } catch (err) {
    if (fallbackUrl) {
      try {
        response = await performStreamRequest(fallbackUrl);
        usedUrl = fallbackUrl;
      } catch (fallbackErr) {
        throw new Error(`Network Error: Failed to connect. Check CORS or connection.`);
      }
    } else {
      throw new Error(`Network Error: Failed to connect to ${usedUrl}.`);
    }
  }

  if (!response || !response.ok) {
    const errorText = response ? await response.text() : 'No response';
    throw new Error(`API Error: ${response?.status || 'Unknown'} - ${errorText.slice(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullContent = '';
  let fullReasoning = '';
  let buffer = '';
  let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

  while (true) {
    // Check if request was aborted
    if (signal?.aborted) {
      reader.cancel();
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta;
        
        // Extract usage information if available (usually in the last chunk)
        if (json.usage) {
          usage = json.usage;
        }
        
        if (delta?.content) {
          fullContent += delta.content;
          // Check for <think> tags in progress
          const thinkMatch = fullContent.match(/<think>([\s\S]*?)<\/think>/i);
          if (thinkMatch) {
            const extractedReasoning = thinkMatch[1].trim();
            // Save extracted reasoning to fullReasoning
            if (extractedReasoning) {
              fullReasoning = fullReasoning 
                ? `${fullReasoning}\n${extractedReasoning}` 
                : extractedReasoning;
            }
            const cleanContent = fullContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            onChunk(cleanContent, fullReasoning || undefined);
          } else {
            // Check for incomplete <think> tag (still streaming)
            const incompleteMatch = fullContent.match(/<think>([\s\S]*)$/i);
            if (incompleteMatch) {
              const partialReasoning = incompleteMatch[1].trim();
              const cleanContent = fullContent.replace(/<think>[\s\S]*$/i, '').trim();
              // Don't save partial reasoning yet, wait for complete tag
              onChunk(cleanContent, partialReasoning || fullReasoning || undefined);
            } else {
              onChunk(fullContent, fullReasoning || undefined);
            }
          }
        }
        if (delta?.reasoning_content) {
          fullReasoning += delta.reasoning_content;
          onChunk(fullContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim(), fullReasoning);
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
  }

  // Final cleanup and extraction of <think> tags
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  const allThinkMatches = fullContent.match(thinkRegex);
  if (allThinkMatches) {
    // Extract all reasoning content from think tags
    const extractedReasoning = allThinkMatches
      .map(m => m.replace(/<\/?think>/gi, '').trim())
      .filter(r => r.length > 0)
      .join('\n');
    // Always update fullReasoning if we found reasoning in tags (in case it wasn't captured during streaming)
    if (extractedReasoning) {
      fullReasoning = fullReasoning ? `${fullReasoning}\n${extractedReasoning}` : extractedReasoning;
    }
    // Remove all think tags from content
    fullContent = fullContent.replace(thinkRegex, '').trim();
  }

  // Final callback with cleaned content and reasoning
  onChunk(fullContent, fullReasoning || undefined);

  // If usage wasn't provided in the stream, estimate it
  if (!usage) {
    const inputTokens = estimateMessageTokens(processedMessages);
    const outputTokens = estimateTokens(fullContent);
    usage = {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens
    };
  }

  return { 
    content: fullContent, 
    reasoning: fullReasoning || undefined,
    usage: usage
  };
};

export const generateExternalResponse = async (
  config: ExternalApiConfig,
  modelId: string, // The API model ID (e.g., gpt-4o)
  messages: { role: string; content: string }[],
  defaultBaseUrl?: string,
  attachments: Attachment[] = []
): Promise<{ content: string; reasoning?: string; usage?: { prompt_tokens: number; completion_tokens: number } }> => {
  let baseUrl = config.baseUrl || defaultBaseUrl || 'https://api.openai.com/v1';
  
  // Sanitization: Remove whitespace
  baseUrl = baseUrl.trim();

  // Sanitization: Ensure protocol exists. 
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  
  // Sanitization: Remove trailing slashes
  baseUrl = baseUrl.replace(/\/+$/, '');

  let primaryUrl = '';
  let fallbackUrl = '';

  // Smart URL Construction
  if (baseUrl.endsWith('/chat/completions')) {
    primaryUrl = baseUrl;
  } else if (baseUrl.endsWith('/v1')) {
    primaryUrl = `${baseUrl}/chat/completions`;
  } else {
    primaryUrl = `${baseUrl}/chat/completions`;
    if (!baseUrl.includes('/v1')) {
      fallbackUrl = `${baseUrl}/v1/chat/completions`;
    }
  }

  // Specific override for OpenAI
  if (baseUrl === 'https://api.openai.com') {
    primaryUrl = 'https://api.openai.com/v1/chat/completions';
    fallbackUrl = ''; 
  }

  // Prepare Payload
  // If there are attachments, we need to convert the LAST message to the multimodal array format
  const finalMessages = [...messages];
  
  // Add current user message
  if (attachments.length > 0) {
    // Multimodal Format
    const contentArray: any[] = [];
    
    // 1. Text
    // The last "content" passed in 'messages' arg is usually the user prompt. 
    // However, the 'messages' arg passed from App.tsx includes history + current prompt as simple strings.
    // We need to pop the last message (which is the current user prompt) and reformat it.
    const lastMsg = finalMessages.pop();
    
    if (lastMsg && lastMsg.role === 'user') {
       contentArray.push({ type: "text", text: lastMsg.content });
       
       // 2. Images
       attachments.forEach(att => {
         if (att.type === 'image') {
           contentArray.push({
             type: "image_url",
             image_url: {
               url: att.url // API expects full data URI
             }
           });
         }
       });

       finalMessages.push({ role: 'user', content: contentArray as any }); 
    } else {
      // Should not happen based on App.tsx logic, but fallback
      if(lastMsg) finalMessages.push(lastMsg);
    }

  } else {
    // Standard text-only
    // 'messages' already contains the latest user prompt in standard format, 
    // but App.tsx passes it in.
    // NOTE: The signature of this function takes `messages` which INCLUDES the current prompt.
    // We don't need to do anything here if no attachments.
  }

  const performRequest = async (url: string) => {
    return fetch(url, {
      method: 'POST',
      credentials: 'omit',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: finalMessages,
        temperature: 0.7,
        stream: false 
      })
    });
  };

  let response: Response | undefined;
  let usedUrl = primaryUrl;
  let networkError: Error | null = null;

  try {
    response = await performRequest(primaryUrl);
  } catch (err: any) {
    console.warn(`Primary URL ${primaryUrl} failed with network error:`, err);
    networkError = err;
  }

  if (fallbackUrl && ((response && response.status === 404) || (!response && networkError))) {
    try {
      console.log(`Retrying with fallback URL: ${fallbackUrl}`);
      const fallbackResponse = await performRequest(fallbackUrl);
      if (fallbackResponse.ok || fallbackResponse.status !== 404) {
        response = fallbackResponse;
        usedUrl = fallbackUrl;
        networkError = null;
      }
    } catch (fallbackErr) {
      console.warn(`Fallback URL ${fallbackUrl} also failed:`, fallbackErr);
    }
  }

  if (!response && networkError) {
     throw new Error(`Network Error: Failed to connect to ${usedUrl}. Check CORS, Base URL, or connection.`);
  }

  if (response && !response.ok) {
    const responseText = await response.text();
    try {
      const errorJson = JSON.parse(responseText);
      const errorMsg = errorJson.error?.message || errorJson.message || `API Error: ${response.status}`;
      throw new Error(errorMsg);
    } catch (e: any) {
      if (e.message && !e.message.startsWith('API Error')) {
          const preview = responseText.slice(0, 100).replace(/\n/g, ' ');
          throw new Error(`API Request Failed (${response.status}) at ${usedUrl}: ${preview}...`);
      }
      throw e;
    }
  }

  if (!response) {
      throw new Error("Unknown error occurred: No response received.");
  }

  try {
    const responseText = await response.text();
    const data = JSON.parse(responseText);
    
    let content = data.choices?.[0]?.message?.content || "";
    let reasoning = data.choices?.[0]?.message?.reasoning_content || "";

    const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
    const match = content.match(thinkRegex);
    if (match) {
      if (!reasoning) {
        reasoning = match[1].trim(); 
      }
      content = content.replace(thinkRegex, '').trim();
    }

    if (!content && !reasoning && content !== "") {
        console.warn("Unexpected JSON structure:", data);
        throw new Error("Empty response from model.");
    }
    
    // Extract usage information if available
    let usage = data.usage ? {
      prompt_tokens: data.usage.prompt_tokens || 0,
      completion_tokens: data.usage.completion_tokens || 0
    } : undefined;
    
    // If usage wasn't provided, estimate it
    if (!usage) {
      const inputTokens = estimateMessageTokens(finalMessages);
      const outputTokens = estimateTokens(content);
      usage = {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens
      };
    }
    
    return { content, reasoning, usage };
  } catch (e: any) {
    if (e.message.includes("Empty response")) throw e;
    throw new Error(`Invalid JSON response from server.`);
  }
};
