import { Router } from 'express';
import multer from 'multer';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return data.text.trim();
  } catch (error: any) {
    return `[Error extracting PDF text: ${error.message}]`;
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch (error: any) {
    return `[Error extracting Word text: ${error.message}]`;
  }
}

// Parse uploaded file
router.post('/parse-file', authMiddleware, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ detail: 'No file uploaded' });
    }

    const { buffer, originalname, mimetype } = req.file;
    let extractedText = '';

    if (mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf')) {
      extractedText = await extractPdfText(buffer);
    } else if (
      mimetype === 'application/msword' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      originalname.toLowerCase().endsWith('.doc') ||
      originalname.toLowerCase().endsWith('.docx')
    ) {
      extractedText = await extractDocxText(buffer);
    } else if (
      mimetype.startsWith('text/') ||
      originalname.toLowerCase().endsWith('.txt') ||
      originalname.toLowerCase().endsWith('.md')
    ) {
      extractedText = buffer.toString('utf-8');
    } else {
      // Return base64 for unsupported types
      return res.json({
        filename: originalname,
        contentType: mimetype,
        text: null,
        base64: buffer.toString('base64'),
      });
    }

    res.json({
      filename: originalname,
      contentType: mimetype,
      text: extractedText,
      base64: null,
    });
  } catch (error: any) {
    console.error('Parse file error:', error);
    res.status(500).json({ detail: 'Failed to parse file' });
  }
});

// Parse base64 encoded file
router.post('/parse-base64', authMiddleware, async (req: AuthRequest, res) => {
  try {
    let { data, filename, content_type } = req.body;

    if (!data) {
      return res.status(400).json({ detail: 'No data provided' });
    }

    // Remove data URL prefix if present
    if (data.includes(',')) {
      data = data.split(',')[1];
    }

    const buffer = Buffer.from(data, 'base64');
    let extractedText = '';

    if (content_type?.includes('pdf') || filename?.toLowerCase().endsWith('.pdf')) {
      extractedText = await extractPdfText(buffer);
    } else if (
      content_type?.includes('word') ||
      content_type?.includes('msword') ||
      filename?.toLowerCase().endsWith('.doc') ||
      filename?.toLowerCase().endsWith('.docx')
    ) {
      extractedText = await extractDocxText(buffer);
    } else if (
      content_type?.startsWith('text/') ||
      filename?.toLowerCase().endsWith('.txt') ||
      filename?.toLowerCase().endsWith('.md')
    ) {
      extractedText = buffer.toString('utf-8');
    } else {
      return res.json({ text: null, error: 'Unsupported file type for text extraction' });
    }

    res.json({ text: extractedText, filename });
  } catch (error: any) {
    console.error('Parse base64 error:', error);
    res.status(400).json({ detail: 'Invalid base64 data' });
  }
});

export default router;





