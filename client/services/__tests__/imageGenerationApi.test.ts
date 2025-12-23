import { generateImage } from '../imageGenerationService';

// Mock fetch globally
global.fetch = jest.fn();

describe('generateImage API Integration', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('OpenAI DALL-E Integration', () => {
    test('应该成功调用DALL-E API并返回图像URL', async () => {
      const mockImageUrl = 'https://example.com/generated-image.png';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ url: mockImageUrl }]
        })
      });

      const config = {
        apiKey: 'test-api-key',
        provider: 'openai' as const
      };

      const result = await generateImage(config, 'a cute cat', {
        size: '1024x1024',
        quality: 'standard'
      });

      expect(result.imageUrl).toBe(mockImageUrl);
      expect(result.usage).toBeDefined();
      expect(result.usage?.prompt_tokens).toBeGreaterThan(0);
      
      // Verify fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/images/generations'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          }),
          body: expect.stringContaining('dall-e-3')
        })
      );
    });

    test('应该处理API错误', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid API key' }
        })
      });

      const config = {
        apiKey: 'invalid-key',
        provider: 'openai' as const
      };

      await expect(
        generateImage(config, 'test prompt')
      ).rejects.toThrow('Invalid API key');
    });

    test('应该处理网络错误', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const config = {
        apiKey: 'test-key',
        provider: 'openai' as const
      };

      await expect(
        generateImage(config, 'test prompt')
      ).rejects.toThrow('Image generation failed: Network error');
    });

    test('应该处理缺少图像URL的响应', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: []
        })
      });

      const config = {
        apiKey: 'test-key',
        provider: 'openai' as const
      };

      await expect(
        generateImage(config, 'test prompt')
      ).rejects.toThrow('No image URL returned from API');
    });
  });

  describe('Stability AI Integration', () => {
    test('应该成功调用Stability AI并返回base64图像', async () => {
      const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          artifacts: [{ base64: mockBase64 }]
        })
      });

      const config = {
        apiKey: 'test-api-key',
        provider: 'stability' as const
      };

      const result = await generateImage(config, 'a beautiful landscape', {
        provider: 'stability'
      });

      expect(result.imageUrl).toContain('data:image/png;base64,');
      expect(result.imageUrl).toContain(mockBase64);
      expect(result.usage).toBeDefined();
    });

    test('应该处理Stability AI错误', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          message: 'Invalid prompt'
        })
      });

      const config = {
        apiKey: 'test-key',
        provider: 'stability' as const
      };

      await expect(
        generateImage(config, '', { provider: 'stability' })
      ).rejects.toThrow('Invalid prompt');
    });
  });

  describe('配置处理', () => {
    test('应该使用自定义baseUrl', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ url: 'https://example.com/image.png' }]
        })
      });

      const config = {
        apiKey: 'test-key',
        baseUrl: 'https://custom-api.example.com/v1',
        provider: 'openai' as const
      };

      await generateImage(config, 'test prompt');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://custom-api.example.com/v1'),
        expect.any(Object)
      );
    });

    test('应该使用默认OpenAI baseUrl', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ url: 'https://example.com/image.png' }]
        })
      });

      const config = {
        apiKey: 'test-key',
        provider: 'openai' as const
      };

      await generateImage(config, 'test prompt');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.openai.com/v1'),
        expect.any(Object)
      );
    });
  });

  describe('Token估算', () => {
    test('应该估算token使用量', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ url: 'https://example.com/image.png' }]
        })
      });

      const config = {
        apiKey: 'test-key',
        provider: 'openai' as const
      };

      const longPrompt = 'a very detailed and complex image with many elements and descriptions that should result in higher token count';
      const result = await generateImage(config, longPrompt);

      expect(result.usage?.prompt_tokens).toBeGreaterThan(1000);
      expect(result.usage?.completion_tokens).toBe(0);
    });
  });
});




