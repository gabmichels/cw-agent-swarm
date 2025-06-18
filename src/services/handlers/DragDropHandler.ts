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
    // Skip global handling entirely on agent creation pages
    if (window.location.pathname.includes('/agents/create') || 
        window.location.pathname.includes('/agents/register')) {
      console.log('Global DragDropHandler: Skipping - on agent creation page');
      return;
    }

    // Check if the drop is happening on an element that handles its own drag/drop
    const target = event.target as HTMLElement;
    if (target) {
      // Look for elements with their own drag/drop handling
      // Check the target element and all its parents
      let currentElement: HTMLElement | null = target;
      while (currentElement) {
        // Check for custom drop zone markers
        if (currentElement.hasAttribute('data-custom-drop-zone') ||
            currentElement.classList.contains('knowledge-uploader') ||
            currentElement.hasAttribute('data-handles-own-drop') ||
            currentElement.closest('[data-custom-drop-zone]') ||
            currentElement.closest('.knowledge-uploader')) {
          console.log('Global DragDropHandler: Detected custom drop zone, skipping global handling');
          return;
        }
        currentElement = currentElement.parentElement;
      }
    }

    console.log('Global DragDropHandler: Processing drop event');
    event.preventDefault();
    event.stopPropagation();

    const items = event.dataTransfer?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          console.log('Global DragDropHandler: Processing file:', file.name, 'Type:', file.type);
          await this.fileAttachmentHandler.handleFile(file);
        }
      }
    }
  };
} 