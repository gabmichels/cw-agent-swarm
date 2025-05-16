import { FileAttachmentHandler } from '../FileAttachmentHandler';
import { FileMetadata, FileAttachmentType, FileProcessingStatus } from '@/types/files';
import { FileUploadImplementation } from '../../upload/FileUploadImplementation';
import { IndexedDBFileStorage } from '../../storage/IndexedDBFileStorage';
import { StoredFileData } from '../../storage/FileStorageService';

// Mock services
jest.mock('../../upload/FileUploadImplementation');
jest.mock('../../storage/IndexedDBFileStorage');

// Mock File API
class MockFile implements File {
  name: string;
  lastModified: number;
  size: number;
  type: string;
  webkitRelativePath: string = '';

  constructor(parts: BlobPart[], name: string, options?: FilePropertyBag) {
    const blob = new Blob(parts, options);
    this.name = name;
    this.lastModified = Date.now();
    this.size = blob.size;
    this.type = options?.type || '';
  }

  slice(start?: number, end?: number, contentType?: string): Blob {
    return new Blob([''], { type: contentType });
  }

  stream(): ReadableStream {
    return new ReadableStream();
  }

  async text(): Promise<string> {
    return Promise.resolve('test content');
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(0));
  }

  async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    const buffer = new ArrayBuffer(0);
    return Promise.resolve(new Uint8Array(buffer));
  }
}

describe('FileAttachmentHandler', () => {
  let handler: FileAttachmentHandler;
  let mockFile: File;
  let mockMetadata: FileMetadata;
  let mockUploadService: jest.Mocked<FileUploadImplementation>;
  let mockStorageService: jest.Mocked<IndexedDBFileStorage>;

  beforeEach(() => {
    mockUploadService = {
      uploadFile: jest.fn(),
    } as unknown as jest.Mocked<FileUploadImplementation>;

    mockStorageService = {
      initialize: jest.fn(),
      saveFile: jest.fn(),
      getFile: jest.fn(),
      deleteFile: jest.fn(),
      fileExists: jest.fn(),
      listFiles: jest.fn(),
      clearStorage: jest.fn(),
    } as unknown as jest.Mocked<IndexedDBFileStorage>;
    
    handler = new FileAttachmentHandler(mockUploadService, mockStorageService);
    mockFile = new MockFile(['test content'], 'test.txt', { type: 'text/plain' });
    mockMetadata = {
      id: 'test-file-id',
      filename: 'test.txt',
      type: 'text/plain',
      size: 12,
      attachmentType: FileAttachmentType.DOCUMENT,
      processingStatus: FileProcessingStatus.COMPLETED,
      timestamp: Date.now()
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('handleFileUpload', () => {
    it('should upload a file successfully', async () => {
      const mockStoredData: StoredFileData = {
        id: mockMetadata.id,
        data: 'test content',
        type: mockFile.type,
        filename: mockFile.name,
        timestamp: Date.now()
      };

      mockStorageService.saveFile.mockResolvedValueOnce(mockMetadata.id);
      mockStorageService.getFile.mockResolvedValueOnce(mockStoredData);
      
      const onProgress = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await handler.handleFileUpload(mockFile, {
        onProgress,
        onComplete,
        onError
      });

      expect(onProgress).toHaveBeenCalledWith(expect.any(Number));
      expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
        filename: mockFile.name,
        type: mockFile.type,
        size: mockFile.size,
        attachmentType: FileAttachmentType.DOCUMENT,
        processingStatus: FileProcessingStatus.COMPLETED
      }));
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle upload errors', async () => {
      const error = new Error('Upload failed');
      mockStorageService.saveFile.mockRejectedValueOnce(error);

      const onProgress = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      await handler.handleFileUpload(mockFile, {
        onProgress,
        onComplete,
        onError
      });

      expect(onError).toHaveBeenCalledWith(error);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('should validate file size', async () => {
      const largeFile = new MockFile(['x'.repeat(1024 * 1024 * 51)], 'large.txt');
      const onError = jest.fn();

      await handler.handleFileUpload(largeFile, {
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('exceeds maximum size')
        })
      );
    });

    it('should validate file type', async () => {
      const invalidFile = new MockFile(['test'], 'test.exe', { type: 'application/x-msdownload' });
      const onError = jest.fn();

      await handler.handleFileUpload(invalidFile, {
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('file type not allowed')
        })
      );
    });
  });

  describe('generateThumbnail', () => {
    beforeEach(() => {
      // Mock canvas API
      const mockCanvas = {
        getContext: jest.fn().mockReturnValue({
          drawImage: jest.fn()
        }),
        toDataURL: jest.fn().mockReturnValue('data:image/png;base64,test'),
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLCanvasElement);
    });

    it('should generate thumbnail for images', async () => {
      const imageFile = new MockFile(['image data'], 'test.jpg', { type: 'image/jpeg' });
      const thumbnail = await handler.generateThumbnail(imageFile);

      expect(thumbnail).toEqual(expect.stringContaining('data:image'));
    });

    it('should return default icon for non-image files', async () => {
      const thumbnail = await handler.generateThumbnail(mockFile);

      expect(thumbnail).toEqual(expect.stringContaining('data:image/svg+xml'));
    });

    it('should handle thumbnail generation errors', async () => {
      const invalidImage = new MockFile(['invalid image data'], 'test.jpg', { type: 'image/jpeg' });
      document.createElement = jest.fn().mockReturnValue({
        getContext: () => null
      });

      await expect(handler.generateThumbnail(invalidImage)).rejects.toThrow();
    });
  });

  describe('storeFile', () => {
    it('should store file in storage service', async () => {
      const mockStoredData: StoredFileData = {
        id: mockMetadata.id,
        data: 'test content',
        type: mockFile.type,
        filename: mockFile.name,
        timestamp: Date.now()
      };

      mockStorageService.saveFile.mockResolvedValueOnce(mockMetadata.id);
      mockStorageService.getFile.mockResolvedValueOnce(mockStoredData);

      const storedMetadata = await handler.storeFile(mockFile);

      expect(storedMetadata).toEqual(expect.objectContaining({
        id: expect.any(String),
        filename: mockFile.name,
        type: mockFile.type,
        size: mockFile.size,
        attachmentType: FileAttachmentType.DOCUMENT,
        processingStatus: FileProcessingStatus.COMPLETED
      }));
      expect(mockStorageService.saveFile).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
        data: 'test content',
        type: mockFile.type,
        filename: mockFile.name
      }));
    });

    it('should handle storage errors', async () => {
      const error = new Error('Storage failed');
      mockStorageService.saveFile.mockRejectedValueOnce(error);

      await expect(handler.storeFile(mockFile)).rejects.toThrow(error);
    });
  });

  describe('retrieveFile', () => {
    it('should retrieve stored file', async () => {
      const mockStoredData: StoredFileData = {
        id: mockMetadata.id,
        data: 'test content',
        type: mockFile.type,
        filename: mockFile.name,
        timestamp: Date.now()
      };

      mockStorageService.getFile.mockResolvedValueOnce(mockStoredData);

      const retrievedFile = await handler.retrieveFile(mockMetadata.id);

      expect(retrievedFile).toBeInstanceOf(Blob);
      expect(retrievedFile.type).toBe(mockFile.type);
      expect(mockStorageService.getFile).toHaveBeenCalledWith(mockMetadata.id);
    });

    it('should handle retrieval errors', async () => {
      mockStorageService.getFile.mockRejectedValueOnce(new Error('Not found'));

      await expect(handler.retrieveFile('non-existent-id')).rejects.toThrow();
    });
  });

  describe('deleteFile', () => {
    it('should delete stored file', async () => {
      mockStorageService.deleteFile.mockResolvedValueOnce(true);

      await handler.deleteFile(mockMetadata.id);

      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(mockMetadata.id);
    });

    it('should handle deletion errors', async () => {
      mockStorageService.deleteFile.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(handler.deleteFile('non-existent-id')).rejects.toThrow();
    });
  });

  describe('cancelUpload', () => {
    it('should cancel ongoing upload', async () => {
      const uploadPromise = handler.handleFileUpload(mockFile, {
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      });

      handler.cancelUpload(mockFile.name);

      await expect(uploadPromise).rejects.toThrow('Upload cancelled');
    });

    it('should handle non-existent upload cancellation', () => {
      expect(() => handler.cancelUpload('non-existent-file')).not.toThrow();
    });
  });
}); 