import { Document, Paragraph, TextRun, AlignmentType, HeadingLevel, Packer, ExternalHyperlink, UnderlineType } from 'docx';

export interface ParagraphFormat {
  text: string;
  fontSize?: number; // in points (pt)
  fontFamily?: string;
  color?: string; // hex color without #
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  heading?: 1 | 2 | 3 | 4 | 5 | 6;
  bullet?: boolean;
  numbered?: boolean;
  indent?: number; // in twips (1/1440 inch)
}

export interface WordDocumentSpec {
  paragraphs: ParagraphFormat[];
  title?: string;
}

/**
 * Parse inline Markdown formatting (bold, italic, code) from text
 * Returns an array of TextRun objects for a paragraph
 */
function parseInlineFormatting(text: string, defaultFontSize: number = 12, defaultFont: string = 'Microsoft YaHei'): TextRun[] {
  if (!text || text.trim().length === 0) {
    return [new TextRun({
      text: text,
      size: defaultFontSize * 2,
      font: defaultFont
    })];
  }
  
  const runs: TextRun[] = [];
  
  // Regex patterns for Markdown formatting (order matters - most specific first)
  // We'll use a different approach: parse the text character by character, tracking formatting
  let i = 0;
  let currentText = '';
  let currentBold = false;
  let currentItalic = false;
  let currentCode = false;
  
  while (i < text.length) {
    // Check for bold + italic: ***text***
    if (text.substring(i, i + 3) === '***' && text.indexOf('***', i + 3) !== -1) {
      // Flush current text
      if (currentText) {
        runs.push(new TextRun({
          text: currentText,
          size: defaultFontSize * 2,
          font: currentCode ? 'Consolas' : defaultFont,
          bold: currentBold,
          italics: currentItalic,
          color: currentCode ? '2E7D32' : undefined,
        }));
        currentText = '';
      }
      
      // Find closing ***
      const endIndex = text.indexOf('***', i + 3);
      if (endIndex !== -1) {
        const formattedText = text.substring(i + 3, endIndex);
        runs.push(new TextRun({
          text: formattedText,
          size: defaultFontSize * 2,
          font: defaultFont,
          bold: true,
          italics: true,
        }));
        i = endIndex + 3;
        continue;
      }
    }
    
    // Check for bold: **text**
    if (text.substring(i, i + 2) === '**' && text.indexOf('**', i + 2) !== -1) {
      // Flush current text
      if (currentText) {
        runs.push(new TextRun({
          text: currentText,
          size: defaultFontSize * 2,
          font: currentCode ? 'Consolas' : defaultFont,
          bold: currentBold,
          italics: currentItalic,
          color: currentCode ? '2E7D32' : undefined,
        }));
        currentText = '';
      }
      
      // Find closing **
      const endIndex = text.indexOf('**', i + 2);
      if (endIndex !== -1) {
        const formattedText = text.substring(i + 2, endIndex);
        runs.push(new TextRun({
          text: formattedText,
          size: defaultFontSize * 2,
          font: defaultFont,
          bold: true,
        }));
        i = endIndex + 2;
        continue;
      }
    }
    
    // Check for italic: *text* (but not **)
    if (text[i] === '*' && text[i + 1] !== '*') {
      const endIndex = text.indexOf('*', i + 1);
      if (endIndex !== -1 && (endIndex === i + 1 || text[endIndex + 1] !== '*')) {
        // Flush current text
        if (currentText) {
          runs.push(new TextRun({
            text: currentText,
            size: defaultFontSize * 2,
            font: currentCode ? 'Consolas' : defaultFont,
            bold: currentBold,
            italics: currentItalic,
            color: currentCode ? '2E7D32' : undefined,
          }));
          currentText = '';
        }
        
        const formattedText = text.substring(i + 1, endIndex);
        runs.push(new TextRun({
          text: formattedText,
          size: defaultFontSize * 2,
          font: defaultFont,
          italics: true,
        }));
        i = endIndex + 1;
        continue;
      }
    }
    
    // Check for inline code: `text`
    if (text[i] === '`') {
      const endIndex = text.indexOf('`', i + 1);
      if (endIndex !== -1) {
        // Flush current text
        if (currentText) {
          runs.push(new TextRun({
            text: currentText,
            size: defaultFontSize * 2,
            font: currentCode ? 'Consolas' : defaultFont,
            bold: currentBold,
            italics: currentItalic,
            color: currentCode ? '2E7D32' : undefined,
          }));
          currentText = '';
        }
        
        const formattedText = text.substring(i + 1, endIndex);
        runs.push(new TextRun({
          text: formattedText,
          size: defaultFontSize * 2,
          font: 'Consolas',
          color: '2E7D32', // Green for code
        }));
        i = endIndex + 1;
        continue;
      }
    }
    
    // Regular character
    currentText += text[i];
    i++;
  }
  
  // Flush remaining text
  if (currentText) {
    runs.push(new TextRun({
      text: currentText,
      size: defaultFontSize * 2,
      font: defaultFont,
    }));
  }
  
  // If no formatting found, return single run with original text
  if (runs.length === 0) {
    runs.push(new TextRun({
      text: text,
      size: defaultFontSize * 2,
      font: defaultFont
    }));
  }
  
  return runs;
}

/**
 * Parse format specification from AI response or user input
 * Properly parses Markdown format and converts to Word format
 */
export function parseFormatSpec(content: string): WordDocumentSpec {
  if (!content || content.trim().length === 0) {
    return {
      paragraphs: [
        { text: '文档内容为空', fontSize: 12, fontFamily: 'Microsoft YaHei' }
      ]
    };
  }

  // Try to parse as JSON first
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.paragraphs && Array.isArray(parsed.paragraphs) && parsed.paragraphs.length > 0) {
        return parsed as WordDocumentSpec;
      }
    }
  } catch (e) {
    console.log('[parseFormatSpec] JSON parsing failed, using Markdown parsing:', e);
  }

  // Parse Markdown content
  const paragraphs: ParagraphFormat[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockLanguage = '';
  let codeBlockContent: string[] = [];
  let inList = false;
  let listType: 'bullet' | 'numbered' | null = null;
  let listItems: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Handle code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        if (codeBlockContent.length > 0) {
          paragraphs.push({
            text: codeBlockContent.join('\n'),
            fontSize: 11,
            fontFamily: 'Consolas',
            color: '2E7D32', // Green for code
          });
        }
        codeBlockContent = [];
        inCodeBlock = false;
        codeBlockLanguage = '';
      } else {
        // Start of code block
        inCodeBlock = true;
        codeBlockLanguage = trimmed.substring(3).trim();
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }
    
    // Handle empty lines (end lists, add spacing)
    if (trimmed === '') {
      if (inList && listItems.length > 0) {
        listItems.forEach(item => {
          paragraphs.push({
            text: item,
            [listType === 'bullet' ? 'bullet' : 'numbered']: true,
            fontSize: 12,
            fontFamily: 'Microsoft YaHei'
          });
        });
        listItems = [];
        inList = false;
        listType = null;
      }
      // Skip empty lines (or add spacing paragraph if needed)
      continue;
    }
    
    // Handle headings
    if (trimmed.startsWith('# ')) {
      if (inList) {
        // Flush list before heading
        listItems.forEach(item => {
          paragraphs.push({
            text: item,
            [listType === 'bullet' ? 'bullet' : 'numbered']: true,
            fontSize: 12,
            fontFamily: 'Microsoft YaHei'
          });
        });
        listItems = [];
        inList = false;
        listType = null;
      }
      paragraphs.push({
        text: trimmed.substring(2).trim(),
        heading: 1,
        fontSize: 24,
        fontFamily: 'Microsoft YaHei',
        bold: true
      });
      continue;
    } else if (trimmed.startsWith('## ')) {
      if (inList) {
        listItems.forEach(item => {
          paragraphs.push({
            text: item,
            [listType === 'bullet' ? 'bullet' : 'numbered']: true,
            fontSize: 12,
            fontFamily: 'Microsoft YaHei'
          });
        });
        listItems = [];
        inList = false;
        listType = null;
      }
      paragraphs.push({
        text: trimmed.substring(3).trim(),
        heading: 2,
        fontSize: 20,
        fontFamily: 'Microsoft YaHei',
        bold: true
      });
      continue;
    } else if (trimmed.startsWith('### ')) {
      if (inList) {
        listItems.forEach(item => {
          paragraphs.push({
            text: item,
            [listType === 'bullet' ? 'bullet' : 'numbered']: true,
            fontSize: 12,
            fontFamily: 'Microsoft YaHei'
          });
        });
        listItems = [];
        inList = false;
        listType = null;
      }
      paragraphs.push({
        text: trimmed.substring(4).trim(),
        heading: 3,
        fontSize: 18,
        fontFamily: 'Microsoft YaHei',
        bold: true
      });
      continue;
    } else if (trimmed.startsWith('#### ')) {
      if (inList) {
        listItems.forEach(item => {
          paragraphs.push({
            text: item,
            [listType === 'bullet' ? 'bullet' : 'numbered']: true,
            fontSize: 12,
            fontFamily: 'Microsoft YaHei'
          });
        });
        listItems = [];
        inList = false;
        listType = null;
      }
      paragraphs.push({
        text: trimmed.substring(5).trim(),
        heading: 4,
        fontSize: 16,
        fontFamily: 'Microsoft YaHei',
        bold: true
      });
      continue;
    }
    
    // Handle lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList || listType !== 'bullet') {
        if (inList && listType === 'numbered') {
          // Flush numbered list
          listItems.forEach(item => {
            paragraphs.push({
              text: item,
              numbered: true,
              fontSize: 12,
              fontFamily: 'Microsoft YaHei'
            });
          });
          listItems = [];
        }
        inList = true;
        listType = 'bullet';
      }
      listItems.push(trimmed.substring(2).trim());
      continue;
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (!inList || listType !== 'numbered') {
        if (inList && listType === 'bullet') {
          // Flush bullet list
          listItems.forEach(item => {
            paragraphs.push({
              text: item,
              bullet: true,
              fontSize: 12,
              fontFamily: 'Microsoft YaHei'
            });
          });
          listItems = [];
        }
        inList = true;
        listType = 'numbered';
      }
      listItems.push(trimmed.replace(/^\d+\.\s/, '').trim());
      continue;
    }
    
    // Regular paragraph
    if (inList) {
      // Flush list before regular paragraph
      listItems.forEach(item => {
        paragraphs.push({
          text: item,
          [listType === 'bullet' ? 'bullet' : 'numbered']: true,
          fontSize: 12,
          fontFamily: 'Microsoft YaHei'
        });
      });
      listItems = [];
      inList = false;
      listType = null;
    }
    
    paragraphs.push({
      text: trimmed,
      fontSize: 12,
      fontFamily: 'Microsoft YaHei'
    });
  }
  
  // Flush any remaining list items
  if (inList && listItems.length > 0) {
    listItems.forEach(item => {
      paragraphs.push({
        text: item,
        [listType === 'bullet' ? 'bullet' : 'numbered']: true,
        fontSize: 12,
        fontFamily: 'Microsoft YaHei'
      });
    });
  }
  
  // If no paragraphs were created, create one with the original content
  if (paragraphs.length === 0) {
    paragraphs.push({
      text: content.trim(),
      fontSize: 12,
      fontFamily: 'Microsoft YaHei'
    });
  }
  
  return { paragraphs };
}

/**
 * Convert alignment string to docx AlignmentType
 */
function getAlignment(alignment?: string): AlignmentType | undefined {
  switch (alignment) {
    case 'left': return AlignmentType.LEFT;
    case 'center': return AlignmentType.CENTER;
    case 'right': return AlignmentType.RIGHT;
    case 'justify': return AlignmentType.JUSTIFIED;
    default: return undefined;
  }
}

/**
 * Convert heading level to docx HeadingLevel
 */
function getHeadingLevel(level?: number): HeadingLevel | undefined {
  switch (level) {
    case 1: return HeadingLevel.HEADING_1;
    case 2: return HeadingLevel.HEADING_2;
    case 3: return HeadingLevel.HEADING_3;
    case 4: return HeadingLevel.HEADING_4;
    case 5: return HeadingLevel.HEADING_5;
    case 6: return HeadingLevel.HEADING_6;
    default: return undefined;
  }
}

/**
 * Generate a Word document from format specification
 */
export async function generateWordDocument(spec: WordDocumentSpec): Promise<Buffer> {
  // Ensure we have at least one paragraph
  if (!spec.paragraphs || spec.paragraphs.length === 0) {
    spec.paragraphs = [
      { text: '文档内容为空', fontSize: 12, fontFamily: 'Microsoft YaHei' }
    ];
  }

  const paragraphs: Paragraph[] = spec.paragraphs.map(para => {
    const fontSize = para.fontSize || 12;
    const fontFamily = para.fontFamily || 'Microsoft YaHei';
    
    // Parse inline formatting (bold, italic, code) from text
    // But only if it's not a heading (headings are already bold)
    let children: TextRun[];
    if (para.heading || para.bold) {
      // For headings or explicitly bold paragraphs, don't parse inline formatting
      // Just create a single run with the formatting
      children = [new TextRun({
        text: para.text,
        size: fontSize * 2, // docx uses half-points
        font: fontFamily,
        color: para.color,
        bold: para.bold !== false, // Default to true for headings
        italics: para.italic,
        underline: para.underline ? { type: UnderlineType.SINGLE } : undefined,
      })];
    } else {
      // For regular paragraphs, parse inline Markdown formatting
      children = parseInlineFormatting(para.text, fontSize, fontFamily);
      
      // Apply paragraph-level formatting to all runs if specified
      if (para.color || para.bold || para.italic) {
        children = children.map(run => {
          const runProps: any = {
            text: run.text,
            size: run.size || fontSize * 2,
            font: run.font || fontFamily,
          };
          if (para.color) runProps.color = para.color;
          if (para.bold !== undefined) runProps.bold = para.bold;
          if (para.italic !== undefined) runProps.italics = para.italic;
          return new TextRun(runProps);
        });
      }
    }

    // Create paragraph with formatting
    return new Paragraph({
      children: children,
      alignment: getAlignment(para.alignment),
      heading: getHeadingLevel(para.heading),
      bullet: para.bullet ? { level: 0 } : undefined,
      numbering: para.numbered ? { reference: 'default-numbering', level: 0 } : undefined,
      indent: para.indent ? { left: para.indent } : undefined,
    });
  });

  // Create document
  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [
          {
            level: 0,
            format: 'decimal',
            text: '%1.',
            alignment: AlignmentType.LEFT,
          },
        ],
      }],
    },
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/**
 * Generate a simple Word document from plain text content
 * This is a convenience method for basic text without complex formatting
 */
export async function generateSimpleWordDocument(content: string): Promise<Buffer> {
  const spec = parseFormatSpec(content);
  return generateWordDocument(spec);
}

