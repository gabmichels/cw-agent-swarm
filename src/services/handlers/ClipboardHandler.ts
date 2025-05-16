import { FileAttachmentHandler } from './FileAttachmentHandler';

export class ClipboardHandler {
  constructor(private fileAttachmentHandler: FileAttachmentHandler) {}

  initialize(): void {
    document.addEventListener('paste', this.handlePaste);
  }

  cleanup(): void {
    document.removeEventListener('paste', this.handlePaste);
  }

  private handlePaste = async (event: ClipboardEvent): Promise<void> => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          await this.fileAttachmentHandler.handleFile(file, {
            onProgress: (progress) => {
              console.log(`Paste upload progress: ${progress}%`);
            },
            onError: (error) => {
              console.error('Error handling pasted file:', error);
            }
          });
        }
      }
    }
  };
} 