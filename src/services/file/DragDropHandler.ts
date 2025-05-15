import { FileAttachmentHandler, FileAttachmentResult } from './FileAttachmentHandler';

/**
 * Status of drag operation
 */
export enum DragStatus {
  NONE = 'none',
  DRAGGING = 'dragging',
  VALID = 'valid',
  INVALID = 'invalid'
}

/**
 * Result of drop operation
 */
export interface DropResult {
  /**
   * Processed file attachments
   */
  attachments: FileAttachmentResult[];

  /**
   * Any errors that occurred during processing
   */
  errors: Error[];

  /**
   * Number of files processed
   */
  processedCount: number;

  /**
   * Number of files that failed processing
   */
  failedCount: number;
}

/**
 * Options for drag and drop handling
 */
export interface DragDropOptions {
  /**
   * Whether to accept folders
   */
  acceptFolders: boolean;

  /**
   * Maximum number of files to process at once
   */
  maxFiles?: number;

  /**
   * CSS class to add to drop zone when dragging
   */
  dragActiveClass?: string;

  /**
   * CSS class to add when drag is valid
   */
  dragValidClass?: string;

  /**
   * CSS class to add when drag is invalid
   */
  dragInvalidClass?: string;
}

/**
 * Default drag and drop options
 */
const DEFAULT_OPTIONS: DragDropOptions = {
  acceptFolders: true,
  maxFiles: 10,
  dragActiveClass: 'drag-active',
  dragValidClass: 'drag-valid',
  dragInvalidClass: 'drag-invalid'
};

/**
 * Handler for file drag and drop operations
 */
export class DragDropHandler {
  private readonly fileHandler: FileAttachmentHandler;
  private readonly options: DragDropOptions;
  private dragCounter: number = 0;
  private status: DragStatus = DragStatus.NONE;

  constructor(
    fileHandler: FileAttachmentHandler,
    options: Partial<DragDropOptions> = {}
  ) {
    this.fileHandler = fileHandler;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Process dropped files
   */
  private async processDroppedItems(items: DataTransferItemList): Promise<DropResult> {
    const result: DropResult = {
      attachments: [],
      errors: [],
      processedCount: 0,
      failedCount: 0
    };

    const filePromises: Promise<void>[] = [];
    const processItem = async (item: DataTransferItem) => {
      try {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            if (entry.isFile) {
              const file = item.getAsFile();
              if (file) {
                const attachment = await this.fileHandler.processFile(file);
                result.attachments.push(attachment);
                result.processedCount++;
              }
            } else if (entry.isDirectory && this.options.acceptFolders) {
              await this.processDirectory(entry as FileSystemDirectoryEntry, result);
            }
          }
        }
      } catch (error) {
        result.errors.push(error instanceof Error ? error : new Error(String(error)));
        result.failedCount++;
      }
    };

    for (const item of Array.from(items)) {
      if (this.options.maxFiles && result.processedCount >= this.options.maxFiles) {
        break;
      }
      filePromises.push(processItem(item));
    }

    await Promise.all(filePromises);
    return result;
  }

  /**
   * Process a directory entry recursively
   */
  private async processDirectory(
    directory: FileSystemDirectoryEntry,
    result: DropResult
  ): Promise<void> {
    const entries = await this.readDirectoryEntries(directory);
    const processEntry = async (entry: FileSystemEntry) => {
      if (entry.isFile) {
        const file = await this.getFileFromEntry(entry as FileSystemFileEntry);
        if (file) {
          try {
            const attachment = await this.fileHandler.processFile(file);
            result.attachments.push(attachment);
            result.processedCount++;
          } catch (error) {
            result.errors.push(error instanceof Error ? error : new Error(String(error)));
            result.failedCount++;
          }
        }
      } else if (entry.isDirectory && this.options.acceptFolders) {
        await this.processDirectory(entry as FileSystemDirectoryEntry, result);
      }
    };

    const entryPromises = entries.map(entry => {
      if (this.options.maxFiles && result.processedCount >= this.options.maxFiles) {
        return Promise.resolve();
      }
      return processEntry(entry);
    });

    await Promise.all(entryPromises);
  }

  /**
   * Read all entries in a directory
   */
  private readDirectoryEntries(directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
    return new Promise((resolve, reject) => {
      const entries: FileSystemEntry[] = [];
      const reader = directory.createReader();

      const readEntries = () => {
        reader.readEntries(
          (results) => {
            if (results.length) {
              entries.push(...results);
              readEntries(); // Continue reading if there are more entries
            } else {
              resolve(entries);
            }
          },
          reject
        );
      };

      readEntries();
    });
  }

  /**
   * Get file from a file entry
   */
  private getFileFromEntry(fileEntry: FileSystemFileEntry): Promise<File> {
    return new Promise((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });
  }

  /**
   * Update drag status and classes
   */
  private updateDragStatus(element: HTMLElement, status: DragStatus): void {
    // Remove all status classes
    element.classList.remove(
      this.options.dragActiveClass!,
      this.options.dragValidClass!,
      this.options.dragInvalidClass!
    );

    // Add appropriate class based on status
    switch (status) {
      case DragStatus.DRAGGING:
        element.classList.add(this.options.dragActiveClass!);
        break;
      case DragStatus.VALID:
        element.classList.add(this.options.dragValidClass!);
        break;
      case DragStatus.INVALID:
        element.classList.add(this.options.dragInvalidClass!);
        break;
    }

    this.status = status;
  }

  /**
   * Validate dragged items
   */
  private validateDraggedItems(items: DataTransferItemList): boolean {
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          if (entry.isFile) {
            return true;
          }
          if (entry.isDirectory && this.options.acceptFolders) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Attach event listeners to an element
   */
  public attachTo(element: HTMLElement): void {
    // Prevent default drag behaviors
    element.addEventListener('dragenter', (event) => {
      event.preventDefault();
      this.dragCounter++;
      
      if (this.dragCounter === 1) {
        this.updateDragStatus(element, DragStatus.DRAGGING);
      }

      const items = event.dataTransfer?.items;
      if (items && this.validateDraggedItems(items)) {
        this.updateDragStatus(element, DragStatus.VALID);
      } else {
        this.updateDragStatus(element, DragStatus.INVALID);
      }
    });

    element.addEventListener('dragover', (event) => {
      event.preventDefault();
    });

    element.addEventListener('dragleave', (event) => {
      event.preventDefault();
      this.dragCounter--;
      
      if (this.dragCounter === 0) {
        this.updateDragStatus(element, DragStatus.NONE);
      }
    });

    element.addEventListener('drop', async (event) => {
      event.preventDefault();
      this.dragCounter = 0;
      this.updateDragStatus(element, DragStatus.NONE);

      const items = event.dataTransfer?.items;
      if (!items) return;

      const result = await this.processDroppedItems(items);
      
      // Dispatch custom event with the result
      element.dispatchEvent(new CustomEvent('filesDropped', {
        detail: result,
        bubbles: true
      }));
    });
  }

  /**
   * Remove event listeners from an element
   */
  public detachFrom(element: HTMLElement): void {
    element.removeEventListener('dragenter', () => {});
    element.removeEventListener('dragover', () => {});
    element.removeEventListener('dragleave', () => {});
    element.removeEventListener('drop', () => {});
    this.updateDragStatus(element, DragStatus.NONE);
  }
} 