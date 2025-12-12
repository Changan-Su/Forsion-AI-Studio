// Type declarations for mammoth
// mammoth doesn't have official @types package in npm registry

declare module 'mammoth' {
  export interface ConvertResult {
    value: string;
    messages: Message[];
  }

  export interface Message {
    type: string;
    message: string;
    error?: Error;
  }

  export interface Options {
    styleMap?: string | string[];
    includeDefaultStyleMap?: boolean;
    convertImage?: ImageConverter;
    ignoreEmptyParagraphs?: boolean;
    idPrefix?: string;
  }

  export interface ImageConverter {
    (image: Image): Promise<{ src: string } | null>;
  }

  export interface Image {
    read(encoding: string): Promise<Buffer>;
    contentType: string;
  }

  export function convertToHtml(
    input: { buffer: Buffer } | { path: string } | { arrayBuffer: ArrayBuffer },
    options?: Options
  ): Promise<ConvertResult>;

  export function extractRawText(
    input: { buffer: Buffer } | { path: string } | { arrayBuffer: ArrayBuffer }
  ): Promise<ConvertResult>;

  export function convertToMarkdown(
    input: { buffer: Buffer } | { path: string } | { arrayBuffer: ArrayBuffer },
    options?: Options
  ): Promise<ConvertResult>;
}
