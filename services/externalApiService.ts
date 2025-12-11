
import { Attachment } from "../types";

interface ExternalApiConfig {
  apiKey: string;
  baseUrl?: string;
}

export const generateExternalResponse = async (
  config: ExternalApiConfig,
  modelId: string, // The API model ID (e.g., gpt-4o)
  messages: { role: string; content: string }[],
  defaultBaseUrl?: string,
  attachments: Attachment[] = []
): Promise<{ content: string; reasoning?: string }> => {
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
    
    return { content, reasoning };
  } catch (e: any) {
    if (e.message.includes("Empty response")) throw e;
    throw new Error(`Invalid JSON response from server.`);
  }
};
