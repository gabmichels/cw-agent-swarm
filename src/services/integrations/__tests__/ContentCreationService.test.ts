/**
 * Content Creation Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentCreationService } from '../content/ContentCreationService';

describe('ContentCreationService', () => {
  let service: ContentCreationService;
  
  beforeEach(() => {
    service = new ContentCreationService(
      'mock_canva_key',
      'mock_youtube_key', 
      'mock_youtube_client_id',
      'mock_youtube_client_secret'
    );
  });

  it('should initialize successfully', () => {
    expect(service).toBeDefined();
  });

  it('should have createCanvaDesign method', () => {
    expect(typeof service.createCanvaDesign).toBe('function');
  });

  it('should have uploadYouTubeVideo method', () => {
    expect(typeof service.uploadYouTubeVideo).toBe('function');
  });

  it('should have generateDesignVariations method', () => {
    expect(typeof service.generateDesignVariations).toBe('function');
  });

  it('should have optimizeContent method', () => {
    expect(typeof service.optimizeContent).toBe('function');
  });

  it('should have getHealthStatus method', () => {
    expect(typeof service.getHealthStatus).toBe('function');
  });

  describe('createCanvaDesign', () => {
    it('should create design with basic parameters', async () => {
      const params = {
        designType: 'social-media-post' as const,
        title: 'Test Design',
        dimensions: { width: 1080, height: 1080 }
      };

      const result = await service.createCanvaDesign(params);
      expect(result.id).toBeDefined();
      expect(result.title).toBe('Test Design');
      expect(result.type).toBe('social-media-post');
    });
  });

  describe('uploadYouTubeVideo', () => {
    it('should upload video with basic parameters', async () => {
      const params = {
        videoFile: Buffer.from('mock video data'),
        title: 'Test Video',
        description: 'Test Description',
        privacy: 'public' as const
      };

      const result = await service.uploadYouTubeVideo(params);
      expect(result.id).toBeDefined();
      expect(result.title).toBe('Test Video');
      expect(result.privacy).toBe('public');
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', async () => {
      const status = await service.getHealthStatus();
      expect(status.status).toBeDefined();
      expect(status.services).toBeDefined();
      expect(status.apiLimits).toBeDefined();
    });
  });
});