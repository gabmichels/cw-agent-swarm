import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  CanvaIntegration,
  CanvaConfig,
  createCanvaIntegration
} from '../CanvaIntegration';

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

describe('CanvaIntegration', () => {
  let canvaIntegration: CanvaIntegration;
  let mockConfig: CanvaConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://example.com/callback',
      scopes: ['design:read', 'design:write']
    };

    canvaIntegration = new CanvaIntegration(mockConfig);
  });

  it('should create instance with valid configuration', () => {
    expect(canvaIntegration).toBeInstanceOf(CanvaIntegration);
  });

  it('should create instance using factory function', () => {
    const integration = createCanvaIntegration(mockConfig);
    expect(integration).toBeInstanceOf(CanvaIntegration);
  });

  it('should authenticate successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'test-token',
        expires_in: 3600
      })
    } as Response);

    const result = await canvaIntegration.authenticate('auth-code');
    expect(result).toBe(true);
  });

  it('should test connection successfully', async () => {
    const mockHttpClient = {
      get: vi.fn().mockResolvedValue({
        id: 'user-123',
        name: 'Test User'
      }),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn()
    };

    // Mock authentication first
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'test-token',
        expires_in: 3600
      })
    } as Response);

    const integration = new CanvaIntegration(mockConfig, mockHttpClient);
    await integration.authenticate('auth-code');

    const result = await integration.testConnection();
    expect(result).toBe(true);
  });

  it('should create design successfully', async () => {
    const mockHttpClient = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        id: 'design-123',
        title: 'Test Design',
        design_type: 'presentation',
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        owner: { id: 'user-123', name: 'Test User', email: 'test@example.com' },
        collaborators: [],
        size: { width: 1920, height: 1080 },
        page_count: 1,
        edit_url: 'https://canva.com/design/123/edit',
        view_url: 'https://canva.com/design/123/view',
        tags: [],
        is_public: false,
        export_formats: ['pdf', 'png']
      }),
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

    const integration = new CanvaIntegration(mockConfig, mockHttpClient);
    await integration.authenticate('auth-code');

    const result = await integration.createDesign({
      designType: 'presentation',
      title: 'Test Design'
    });

    expect(result.id).toBe('design-123');
    expect(result.title).toBe('Test Design');
  });
}); 