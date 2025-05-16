import { FileAttachmentHandler } from './FileAttachmentHandler';

export class DragDropHandler {
  constructor(private fileAttachmentHandler: FileAttachmentHandler) {}

  initialize(): void {
    document.addEventListener('dragover', this.handleDragOver);
    document.addEventListener('drop', this.handleDrop);
  }

  cleanup(): void {
    document.removeEventListener('dragover', this.handleDragOver);
    document.removeEventListener('drop', this.handleDrop);
  }

  private handleDragOver = (event: DragEvent): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  private handleDrop = async (event: DragEvent): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();

    const items = event.dataTransfer?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          await this.fileAttachmentHandler.handleFile(file);
        }
      }
    }
  };
} 