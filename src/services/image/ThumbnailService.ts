/**
 * Configuration options for thumbnail generation
 */
export interface ThumbnailOptions {
  /**
   * Maximum width of the thumbnail in pixels
   */
  maxWidth: number;

  /**
   * Maximum height of the thumbnail in pixels
   */
  maxHeight: number;

  /**
   * Quality of the generated thumbnail (0-1)
   */
  quality: number;

  /**
   * Output format of the thumbnail
   */
  format: 'image/jpeg' | 'image/png' | 'image/webp';

  /**
   * Whether to maintain aspect ratio
   */
  maintainAspectRatio: boolean;
}

/**
 * Default thumbnail generation options
 */
const DEFAULT_THUMBNAIL_OPTIONS: ThumbnailOptions = {
  maxWidth: 300,
  maxHeight: 300,
  quality: 0.7,
  format: 'image/webp',
  maintainAspectRatio: true
};

/**
 * Service for generating and managing image thumbnails
 */
export class ThumbnailService {
  private readonly options: ThumbnailOptions;
  private cache: Map<string, string>;
  private static instance: ThumbnailService;

  private constructor(options: Partial<ThumbnailOptions> = {}) {
    this.options = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options };
    this.cache = new Map();
  }

  /**
   * Get singleton instance of ThumbnailService
   */
  public static getInstance(options?: Partial<ThumbnailOptions>): ThumbnailService {
    if (!ThumbnailService.instance) {
      ThumbnailService.instance = new ThumbnailService(options);
    }
    return ThumbnailService.instance;
  }

  /**
   * Generate a thumbnail from an image source
   */
  public async generateThumbnail(
    source: string | File | Blob,
    options: Partial<ThumbnailOptions> = {}
  ): Promise<string> {
    const mergedOptions = { ...this.options, ...options };
    const sourceKey = await this.generateSourceKey(source);

    // Check cache first
    const cached = this.cache.get(sourceKey);
    if (cached) {
      return cached;
    }

    try {
      const imageData = await this.loadImageData(source);
      const thumbnail = await this.createThumbnail(imageData, mergedOptions);
      
      // Cache the result
      this.cache.set(sourceKey, thumbnail);
      
      return thumbnail;
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      throw new Error(`Thumbnail generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear the thumbnail cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Remove a specific thumbnail from cache
   */
  public removeFromCache(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Generate a unique key for caching
   */
  private async generateSourceKey(source: string | File | Blob): Promise<string> {
    if (typeof source === 'string') {
      return source;
    }

    // For File/Blob, use size and last modified (if available) as part of the key
    const lastModified = source instanceof File ? source.lastModified : Date.now();
    return `${source.size}-${lastModified}-${source.type}`;
  }

  /**
   * Load image data from various sources
   */
  private async loadImageData(source: string | File | Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));

      if (typeof source === 'string') {
        img.src = source;
      } else {
        const url = URL.createObjectURL(source);
        img.src = url;
        // Clean up object URL after image loads
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
      }
    });
  }

  /**
   * Create thumbnail from image data
   */
  private async createThumbnail(
    img: HTMLImageElement,
    options: ThumbnailOptions
  ): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    let { width, height } = img;
    const aspectRatio = width / height;

    // Calculate dimensions while maintaining aspect ratio if required
    if (options.maintainAspectRatio) {
      if (width > options.maxWidth) {
        width = options.maxWidth;
        height = width / aspectRatio;
      }
      if (height > options.maxHeight) {
        height = options.maxHeight;
        width = height * aspectRatio;
      }
    } else {
      width = Math.min(width, options.maxWidth);
      height = Math.min(height, options.maxHeight);
    }

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    // Draw image with smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to desired format
    return canvas.toDataURL(options.format, options.quality);
  }
} 