import { FileAttachmentHandler, FileAttachmentResult } from './FileAttachmentHandler';

/**
 * Types of content that can be handled from clipboard
 */
export enum ClipboardContentType {
  IMAGE = 'image',
  TEXT = 'text',
  FILES = 'files',
  UNKNOWN = 'unknown'
}

/**
 * Result of clipboard content processing
 */
export interface ClipboardProcessingResult {
  /**
   * Type of content found in clipboard
   */
  type: ClipboardContentType;

  /**
   * Processed file attachments (if any)
   */
  attachments?: FileAttachmentResult[];

  /**
   * Text content (if any)
   */
  text?: string;

  /**
   * Any error that occurred during processing
   */
  error?: Error;
}

/**
 * Options for clipboard handling
 */
export interface ClipboardHandlerOptions {
  /**
   * Whether to handle text content
   */
  handleText: boolean;

  /**
   * Whether to handle image content
   */
  handleImages: boolean;

  /**
   * Whether to handle file content
   */
  handleFiles: boolean;

  /**
   * Maximum text length to process
   */
  maxTextLength?: number;
}

/**
 * Default clipboard handling options
 */
const DEFAULT_OPTIONS: ClipboardHandlerOptions = {
  handleText: true,
  handleImages: true,
  handleFiles: true,
  maxTextLength: 10000
};

/**
 * Handler for clipboard events and content extraction
 */
export class ClipboardHandler {
  private readonly fileHandler: FileAttachmentHandler;
  private readonly options: ClipboardHandlerOptions;

  constructor(
    fileHandler: FileAttachmentHandler,
    options: Partial<ClipboardHandlerOptions> = {}
  ) {
    this.fileHandler = fileHandler;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Process clipboard content from a paste event
   */
  public async processClipboardContent(event: ClipboardEvent): Promise<ClipboardProcessingResult> {
    try {
      // Check for files first
      if (this.options.handleFiles && event.clipboardData?.files.length) {
        const files = Array.from(event.clipboardData.files);
        const attachments = await this.fileHandler.processFiles(files);
        return {
          type: ClipboardContentType.FILES,
          attachments
        };
      }

      // Check for images in clipboard items
      if (this.options.handleImages) {
        const imageFile = await this.extractImageFromClipboard(event);
        if (imageFile) {
          const attachment = await this.fileHandler.processFile(imageFile);
          return {
            type: ClipboardContentType.IMAGE,
            attachments: [attachment]
          };
        }
      }

      // Check for text content
      if (this.options.handleText) {
        const text = event.clipboardData?.getData('text');
        if (text) {
          if (this.options.maxTextLength && text.length > this.options.maxTextLength) {
            throw new Error(`Text content exceeds maximum length of ${this.options.maxTextLength} characters`);
          }
          return {
            type: ClipboardContentType.TEXT,
            text
          };
        }
      }

      return {
        type: ClipboardContentType.UNKNOWN
      };
    } catch (error) {
      return {
        type: ClipboardContentType.UNKNOWN,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Extract image from clipboard items
   */
  private async extractImageFromClipboard(event: ClipboardEvent): Promise<File | null> {
    const items = Array.from(event.clipboardData?.items || []);

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          return new File([blob], `pasted_image_${Date.now()}.png`, {
            type: item.type
          });
        }
      }
    }

    // Check for image in HTML content
    const htmlContent = event.clipboardData?.getData('text/html');
    if (htmlContent) {
      const imageUrl = this.extractImageUrlFromHtml(htmlContent);
      if (imageUrl) {
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          return new File([blob], `pasted_image_${Date.now()}.png`, {
            type: blob.type
          });
        } catch (error) {
          console.error('Failed to fetch image from HTML content:', error);
        }
      }
    }

    return null;
  }

  /**
   * Extract image URL from HTML content
   */
  private extractImageUrlFromHtml(html: string): string | null {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const img = doc.querySelector('img');
    return img?.src || null;
  }

  /**
   * Attach event listeners to an element
   */
  public attachTo(element: HTMLElement): void {
    element.addEventListener('paste', async (event) => {
      event.preventDefault();
      const result = await this.processClipboardContent(event as ClipboardEvent);
      
      // Dispatch custom event with the result
      element.dispatchEvent(new CustomEvent('clipboardProcessed', {
        detail: result,
        bubbles: true
      }));
    });
  }

  /**
   * Remove event listeners from an element
   */
  public detachFrom(element: HTMLElement): void {
    element.removeEventListener('paste', this.processClipboardContent);
  }
} 