import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  YouTubeIntegration,
  YouTubeConfig,
  createYouTubeIntegration
} from '../YouTubeIntegration';

vi.mock('../../../../lib/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('YouTubeIntegration', () => {
  let youtubeIntegration: YouTubeIntegration;
  let mockConfig: YouTubeConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://example.com/callback',
      scopes: ['https://www.googleapis.com/auth/youtube.upload']
    };

    youtubeIntegration = new YouTubeIntegration(mockConfig);
  });

  it('should create instance with valid configuration', () => {
    expect(youtubeIntegration).toBeInstanceOf(YouTubeIntegration);
  });

  it('should create instance using factory function', () => {
    const integration = createYouTubeIntegration(mockConfig);
    expect(integration).toBeInstanceOf(YouTubeIntegration);
  });

  it('should authenticate successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'test-token',
        expires_in: 3600
      })
    } as Response);

    const result = await youtubeIntegration.authenticate('auth-code');
    expect(result).toBe(true);
  });

  it('should test connection successfully', async () => {
    const mockHttpClient = {
      get: vi.fn().mockResolvedValue({
        items: [{
          id: 'channel-123',
          snippet: { title: 'Test Channel' }
        }]
      }),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn()
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'test-token',
        expires_in: 3600
      })
    } as Response);

    const integration = new YouTubeIntegration(mockConfig, mockHttpClient);
    await integration.authenticate('auth-code');

    const result = await integration.testConnection();
    expect(result).toBe(true);
  });

  it('should get video successfully', async () => {
    const mockHttpClient = {
      get: vi.fn().mockResolvedValue({
        items: [{
          id: 'video-123',
          snippet: {
            title: 'Test Video',
            description: 'Test Description',
            publishedAt: new Date().toISOString(),
            channelId: 'channel-123',
            channelTitle: 'Test Channel',
            categoryId: '22',
            tags: ['test'],
            defaultLanguage: 'en',
            defaultAudioLanguage: 'en'
          },
          status: {
            uploadStatus: 'processed',
            privacyStatus: 'public',
            license: 'youtube',
            embeddable: true,
            publicStatsViewable: true
          },
          statistics: {
            viewCount: '100',
            likeCount: '10',
            commentCount: '5'
          }
        }]
      }),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn()
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'test-token',
        expires_in: 3600
      })
    } as Response);

    const integration = new YouTubeIntegration(mockConfig, mockHttpClient);
    await integration.authenticate('auth-code');

    const result = await integration.getVideo('video-123', ['snippet', 'status', 'statistics']);

    expect(result.id).toBe('video-123');
    expect(result.title).toBe('Test Video');
    expect(result.privacyStatus).toBe('public');
  });
}); 