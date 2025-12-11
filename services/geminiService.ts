
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Attachment } from "../types";

export const generateGeminiResponse = async (
  modelId: string,
  prompt: string,
  history: { role: string; parts: { text: string }[] }[] = [],
  apiKey?: string,
  attachments: Attachment[] = []
): Promise<{ text: string; imageUrl?: string; reasoning?: string }> => {
  
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

      return { text: generatedText, imageUrl: generatedImageUrl };

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
      const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
      const match = rawText.match(thinkRegex);
      if (match) {
        reasoning = match[1].trim();
        rawText = rawText.replace(thinkRegex, '').trim();
      }

      return { text: rawText, reasoning: reasoning };
    }

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate content");
  }
};
