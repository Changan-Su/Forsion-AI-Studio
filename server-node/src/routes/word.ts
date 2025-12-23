import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { generateWordDocument, generateSimpleWordDocument, parseFormatSpec, WordDocumentSpec } from '../services/wordService.js';

const router = Router();

/**
 * POST /api/word/generate
 * Generate a Word document with specified formatting
 */
router.post('/generate', authMiddleware, async (req: AuthRequest, res) => {
  try {
    console.log('[Word API] Generate request received');
    const { content, formatSpec, messages } = req.body;

    if (!content && !formatSpec) {
      console.error('[Word API] Missing content and formatSpec');
      return res.status(400).json({ 
        detail: 'Either content or formatSpec is required' 
      });
    }

    let buffer: Buffer;

    if (formatSpec && typeof formatSpec === 'object') {
      // Use provided format specification
      console.log('[Word API] Using provided formatSpec');
      buffer = await generateWordDocument(formatSpec as WordDocumentSpec);
    } else if (content && typeof content === 'string') {
      // Parse content to extract format specification
      console.log('[Word API] Parsing content, length:', content.length);
      buffer = await generateSimpleWordDocument(content);
    } else {
      console.error('[Word API] Invalid content or formatSpec format');
      return res.status(400).json({ 
        detail: 'Invalid content or formatSpec format' 
      });
    }

    if (!buffer || buffer.length === 0) {
      console.error('[Word API] Generated buffer is empty');
      return res.status(500).json({ 
        detail: 'Generated Word document is empty' 
      });
    }

    console.log('[Word API] Document generated successfully, size:', buffer.length);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `document_${timestamp}.docx`;

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());

    console.log('[Word API] Sending document, filename:', filename);

    // Send the buffer
    res.send(buffer);
  } catch (error: any) {
    console.error('[Word API] Error generating Word document:', error);
    console.error('[Word API] Error stack:', error.stack);
    res.status(500).json({ 
      detail: 'Failed to generate Word document',
      error: error.message 
    });
  }
});

/**
 * POST /api/word/parse
 * Parse content to extract format specification (for testing/preview)
 */
router.post('/parse', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ 
        detail: 'content is required and must be a string' 
      });
    }

    const spec = parseFormatSpec(content);
    res.json(spec);
  } catch (error: any) {
    console.error('Error parsing format specification:', error);
    res.status(500).json({ 
      detail: 'Failed to parse format specification',
      error: error.message 
    });
  }
});

export default router;

