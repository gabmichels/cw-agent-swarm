import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  StrategicIntegrationTool,
  StrategicIntegrationConfig,
  createStrategicIntegrationTool
} from '../StrategicIntegrationTool';

vi.mock('../../../../lib/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('StrategicIntegrationTool', () => {
  let tool: StrategicIntegrationTool;
  let mockConfig: StrategicIntegrationConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      enabledPlatforms: ['outlook', 'teams', 'discord'],
      outlook: {
        clientId: 'outlook-client-id',
        clientSecret: 'outlook-secret',
        tenantId: 'tenant-id',
        redirectUri: 'https://example.com/callback',
        scopes: ['https://graph.microsoft.com/Mail.ReadWrite']
      },
      teams: {
        clientId: 'teams-client-id',
        clientSecret: 'teams-secret',
        tenantId: 'tenant-id',
        redirectUri: 'https://example.com/callback',
        scopes: ['https://graph.microsoft.com/Chat.ReadWrite']
      },
      discord: {
        botToken: 'Bot test-token',
        applicationId: 'app-id',
        guildId: 'guild-id'
      }
    };

    tool = new StrategicIntegrationTool(mockConfig);
  });

  it('should create instance with valid configuration', () => {
    expect(tool).toBeInstanceOf(StrategicIntegrationTool);
    expect(tool.name).toBe('strategic_integration');
  });

  it('should create instance using factory function', () => {
    const toolInstance = createStrategicIntegrationTool(mockConfig);
    expect(toolInstance).toBeInstanceOf(StrategicIntegrationTool);
  });

  it('should have correct schema', () => {
    const schema = tool.getSchema();
    
    expect(schema.type).toBe('function');
    expect(schema.function.name).toBe('strategic_integration');
    expect(schema.function.parameters.properties.platform.enum).toEqual([
      'outlook', 'teams', 'discord', 'canva', 'youtube'
    ]);
  });

  it('should get capabilities for enabled platforms', async () => {
    const capabilities = await tool.getCapabilities();
    
    expect(capabilities).toHaveLength(3); // Only enabled platforms
    expect(capabilities.map(c => c.platform)).toEqual(['outlook', 'teams', 'discord']);
    
    capabilities.forEach(cap => {
      expect(cap).toHaveProperty('platform');
      expect(cap).toHaveProperty('actions');
      expect(cap).toHaveProperty('description');
      expect(cap).toHaveProperty('isAuthenticated');
      expect(cap).toHaveProperty('connectionStatus');
    });
  });

  it('should get specific integration instance', () => {
    const outlookIntegration = tool.getIntegration('outlook');
    expect(outlookIntegration).toBeDefined();

    const canvaIntegration = tool.getIntegration('canva');
    expect(canvaIntegration).toBeNull(); // Not enabled
  });

  it('should test all connections', async () => {
    const results = await tool.testAllConnections();
    
    expect(results).toHaveProperty('outlook');
    expect(results).toHaveProperty('teams');
    expect(results).toHaveProperty('discord');
    
    // Should return boolean values
    Object.values(results).forEach(result => {
      expect(typeof result).toBe('boolean');
    });
  });
}); 