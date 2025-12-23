import { detectImageGenerationIntent } from '../imageGenerationService';

describe('detectImageGenerationIntent', () => {
  describe('中文关键词检测', () => {
    test('应该检测到"画一张图"', () => {
      const result = detectImageGenerationIntent('画一张图：一只可爱的小猫');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('一只可爱的小猫');
    });

    test('应该检测到"生成图片"', () => {
      const result = detectImageGenerationIntent('生成一张图片：美丽的日落');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('美丽的日落');
    });

    test('应该检测到"绘制"', () => {
      const result = detectImageGenerationIntent('绘制一幅风景画');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('风景画');
    });

    test('应该检测到"帮我画"', () => {
      const result = detectImageGenerationIntent('帮我画一个机器人');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('一个机器人');
    });

    test('应该检测到"给我画"', () => {
      const result = detectImageGenerationIntent('给我画一朵花');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('一朵花');
    });
  });

  describe('英文关键词检测', () => {
    test('应该检测到"draw a picture"', () => {
      const result = detectImageGenerationIntent('draw a picture of a cute cat');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('a cute cat');
    });

    test('应该检测到"generate an image"', () => {
      const result = detectImageGenerationIntent('generate an image of a sunset');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('a sunset');
    });

    test('应该检测到"create a photo"', () => {
      const result = detectImageGenerationIntent('create a photo of mountains');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('mountains');
    });

    test('应该检测到"make an image"', () => {
      const result = detectImageGenerationIntent('make an image of a robot');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('a robot');
    });

    test('应该检测到"paint a picture"', () => {
      const result = detectImageGenerationIntent('paint a picture of flowers');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('flowers');
    });
  });

  describe('命令前缀检测', () => {
    test('应该检测到"/draw"命令', () => {
      const result = detectImageGenerationIntent('/draw a beautiful landscape');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('a beautiful landscape');
    });

    test('应该检测到"/image"命令', () => {
      const result = detectImageGenerationIntent('/image cute puppies playing');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('cute puppies playing');
    });

    test('应该检测到"/generate"命令', () => {
      const result = detectImageGenerationIntent('/generate futuristic city');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('futuristic city');
    });

    test('应该检测到"/paint"命令', () => {
      const result = detectImageGenerationIntent('/paint abstract art');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('abstract art');
    });
  });

  describe('非图像生成请求', () => {
    test('普通聊天消息不应该被检测为图像生成', () => {
      const result = detectImageGenerationIntent('你好，今天天气怎么样？');
      expect(result.isImageRequest).toBe(false);
    });

    test('包含"图"但不是绘图意图的消息', () => {
      const result = detectImageGenerationIntent('这张图表显示了数据趋势');
      expect(result.isImageRequest).toBe(false);
    });

    test('英文普通对话', () => {
      const result = detectImageGenerationIntent('What is the weather like today?');
      expect(result.isImageRequest).toBe(false);
    });
  });

  describe('边界情况', () => {
    test('只有命令前缀没有提示词应该使用整个输入', () => {
      const result = detectImageGenerationIntent('/draw');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toBe('/draw');
    });

    test('空字符串', () => {
      const result = detectImageGenerationIntent('');
      expect(result.isImageRequest).toBe(false);
    });

    test('大小写不敏感', () => {
      const result = detectImageGenerationIntent('DRAW A PICTURE of a cat');
      expect(result.isImageRequest).toBe(true);
      expect(result.prompt).toContain('cat');
    });
  });
});




