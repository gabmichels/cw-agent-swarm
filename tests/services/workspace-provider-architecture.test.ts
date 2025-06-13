import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CapabilityFactory } from '../../src/services/workspace/capabilities/CapabilityFactory';
import { WorkspaceProvider } from '../../src/services/database/types';
import { WorkspaceAgentTools } from '../../src/services/workspace/tools/WorkspaceAgentTools';
import { DatabaseService } from '../../src/services/database/DatabaseService';

// Mock the database service
vi.mock('../../src/services/database/DatabaseService', () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getWorkspaceConnection: vi.fn()
    }))
  }
}));

// Mock the permission service
vi.mock('../../src/services/workspace/AgentWorkspacePermissionService', () => ({
  AgentWorkspacePermissionService: vi.fn(() => ({
    getAgentWorkspaceCapabilities: vi.fn(() => Promise.resolve([
      { capability: 'EMAIL_READ' },
      { capability: 'EMAIL_SEND' },
      { capability: 'CALENDAR_READ' },
      { capability: 'CALENDAR_CREATE' },
      { capability: 'SPREADSHEET_READ' },
      { capability: 'DRIVE_READ' }
    ]))
  }))
}));

describe('Workspace Provider Architecture', () => {
  describe('CapabilityFactory', () => {
    it('should create Google email capabilities', () => {
      const capabilities = CapabilityFactory.createEmailCapabilities(WorkspaceProvider.GOOGLE_WORKSPACE);
      expect(capabilities).toBeDefined();
      expect(capabilities.constructor.name).toBe('GoogleEmailCapabilities');
    });

    it('should create Google calendar capabilities', () => {
      const capabilities = CapabilityFactory.createCalendarCapabilities(WorkspaceProvider.GOOGLE_WORKSPACE);
      expect(capabilities).toBeDefined();
      expect(capabilities.constructor.name).toBe('GoogleCalendarCapabilities');
    });

    it('should create Google sheets capabilities', () => {
      const capabilities = CapabilityFactory.createSheetsCapabilities(WorkspaceProvider.GOOGLE_WORKSPACE);
      expect(capabilities).toBeDefined();
      expect(capabilities.constructor.name).toBe('GoogleSheetsCapabilities');
    });

    it('should create Google drive capabilities', () => {
      const capabilities = CapabilityFactory.createDriveCapabilities(WorkspaceProvider.GOOGLE_WORKSPACE);
      expect(capabilities).toBeDefined();
      expect(capabilities.constructor.name).toBe('GoogleDriveCapabilities');
    });

    it('should throw error for unsupported Microsoft 365 provider', () => {
      expect(() => {
        CapabilityFactory.createEmailCapabilities(WorkspaceProvider.MICROSOFT_365);
      }).toThrow('Microsoft 365 email capabilities not yet implemented');
    });

    it('should throw error for unsupported Zoho provider', () => {
      expect(() => {
        CapabilityFactory.createCalendarCapabilities(WorkspaceProvider.ZOHO);
      }).toThrow('Zoho calendar capabilities not yet implemented');
    });

    it('should return correct supported providers', () => {
      const supported = CapabilityFactory.getSupportedProviders();
      expect(supported).toEqual([WorkspaceProvider.GOOGLE_WORKSPACE]);
    });

    it('should correctly identify supported providers', () => {
      expect(CapabilityFactory.isProviderSupported(WorkspaceProvider.GOOGLE_WORKSPACE)).toBe(true);
      expect(CapabilityFactory.isProviderSupported(WorkspaceProvider.MICROSOFT_365)).toBe(false);
      expect(CapabilityFactory.isProviderSupported(WorkspaceProvider.ZOHO)).toBe(false);
    });

    it('should return correct provider capabilities', () => {
      const googleCaps = CapabilityFactory.getProviderCapabilities(WorkspaceProvider.GOOGLE_WORKSPACE);
      expect(googleCaps).toEqual({
        email: true,
        calendar: true,
        sheets: true,
        drive: true
      });

      const microsoftCaps = CapabilityFactory.getProviderCapabilities(WorkspaceProvider.MICROSOFT_365);
      expect(microsoftCaps).toEqual({
        email: false,
        calendar: false,
        sheets: false,
        drive: false
      });
    });
  });

  describe('WorkspaceAgentTools Provider Integration', () => {
    let agentTools: WorkspaceAgentTools;
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        getWorkspaceConnection: vi.fn()
      };
      (DatabaseService.getInstance as any).mockReturnValue(mockDb);
      agentTools = new WorkspaceAgentTools();
    });

    it('should get email capabilities for Google Workspace connection', async () => {
      mockDb.getWorkspaceConnection.mockResolvedValue({
        id: 'test-connection',
        provider: WorkspaceProvider.GOOGLE_WORKSPACE
      });

      const capabilities = await (agentTools as any).getEmailCapabilities('test-connection');
      expect(capabilities).toBeDefined();
      expect(capabilities.constructor.name).toBe('GoogleEmailCapabilities');
    });

    it('should get calendar capabilities for Google Workspace connection', async () => {
      mockDb.getWorkspaceConnection.mockResolvedValue({
        id: 'test-connection',
        provider: WorkspaceProvider.GOOGLE_WORKSPACE
      });

      const capabilities = await (agentTools as any).getCalendarCapabilities('test-connection');
      expect(capabilities).toBeDefined();
      expect(capabilities.constructor.name).toBe('GoogleCalendarCapabilities');
    });

    it('should get sheets capabilities for Google Workspace connection', async () => {
      mockDb.getWorkspaceConnection.mockResolvedValue({
        id: 'test-connection',
        provider: WorkspaceProvider.GOOGLE_WORKSPACE
      });

      const capabilities = await (agentTools as any).getSheetsCapabilities('test-connection');
      expect(capabilities).toBeDefined();
      expect(capabilities.constructor.name).toBe('GoogleSheetsCapabilities');
    });

    it('should get drive capabilities for Google Workspace connection', async () => {
      mockDb.getWorkspaceConnection.mockResolvedValue({
        id: 'test-connection',
        provider: WorkspaceProvider.GOOGLE_WORKSPACE
      });

      const capabilities = await (agentTools as any).getDriveCapabilities('test-connection');
      expect(capabilities).toBeDefined();
      expect(capabilities.constructor.name).toBe('GoogleDriveCapabilities');
    });

    it('should throw error for non-existent connection', async () => {
      mockDb.getWorkspaceConnection.mockResolvedValue(null);

      await expect((agentTools as any).getEmailCapabilities('non-existent')).rejects.toThrow('Workspace connection not found');
    });

    it('should get available tools for agent with permissions', async () => {
      const tools = await agentTools.getAvailableTools('test-agent');
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('read_specific_email');
      expect(toolNames).toContain('find_important_emails');
      expect(toolNames).toContain('send_email');
      expect(toolNames).toContain('read_calendar');
      expect(toolNames).toContain('schedule_event');
      expect(toolNames).toContain('read_spreadsheet');
      expect(toolNames).toContain('search_files');
    });
  });

  describe('Email Analysis Tools', () => {
    let agentTools: WorkspaceAgentTools;
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        getWorkspaceConnection: vi.fn(() => Promise.resolve({
          id: 'test-connection',
          provider: WorkspaceProvider.GOOGLE_WORKSPACE
        }))
      };
      (DatabaseService.getInstance as any).mockReturnValue(mockDb);
      agentTools = new WorkspaceAgentTools();
    });

    it('should include email analysis tools in available tools', async () => {
      const tools = await agentTools.getAvailableTools('test-agent');
      const toolNames = tools.map(t => t.name);
      
      expect(toolNames).toContain('analyze_emails');
      expect(toolNames).toContain('get_emails_needing_attention');
      expect(toolNames).toContain('get_email_action_items');
      expect(toolNames).toContain('get_email_trends');
    });

    it('should have correct parameters for analyze_emails tool', async () => {
      const tools = await agentTools.getAvailableTools('test-agent');
      const analyzeTool = tools.find(t => t.name === 'analyze_emails');
      
      expect(analyzeTool).toBeDefined();
      expect(analyzeTool!.parameters.properties.analysisType.enum).toEqual([
        'attention', 'sentiment', 'activity', 'action_items', 'trends'
      ]);
      expect(analyzeTool!.parameters.properties.timeframe.enum).toEqual([
        'today', 'yesterday', 'this_week', 'last_week', 'this_month'
      ]);
    });

    it('should have correct parameters for get_email_action_items tool', async () => {
      const tools = await agentTools.getAvailableTools('test-agent');
      const actionItemsTool = tools.find(t => t.name === 'get_email_action_items');
      
      expect(actionItemsTool).toBeDefined();
      expect(actionItemsTool!.parameters.properties.timeframe.enum).toEqual(['today', 'this_week']);
    });

    it('should have correct parameters for get_email_trends tool', async () => {
      const tools = await agentTools.getAvailableTools('test-agent');
      const trendsTool = tools.find(t => t.name === 'get_email_trends');
      
      expect(trendsTool).toBeDefined();
      expect(trendsTool!.parameters.properties.timeframe.enum).toEqual(['this_week', 'this_month']);
    });
  });

  describe('Provider-Aware Tool Execution', () => {
    let agentTools: WorkspaceAgentTools;
    let mockDb: any;
    let mockEmailCapabilities: any;

    beforeEach(() => {
      mockEmailCapabilities = {
        findImportantEmails: vi.fn(() => Promise.resolve({ emails: [] })),
        analyzeEmails: vi.fn(() => Promise.resolve({ analysis: 'test' })),
        getEmailsNeedingAttention: vi.fn(() => Promise.resolve({ urgent: [] })),
        getActionItems: vi.fn(() => Promise.resolve({ items: [] })),
        getEmailTrends: vi.fn(() => Promise.resolve({ trends: {} }))
      };

      mockDb = {
        getWorkspaceConnection: vi.fn(() => Promise.resolve({
          id: 'test-connection',
          provider: WorkspaceProvider.GOOGLE_WORKSPACE
        }))
      };
      (DatabaseService.getInstance as any).mockReturnValue(mockDb);
      
      // Mock the capability factory
      vi.spyOn(CapabilityFactory, 'createEmailCapabilities').mockReturnValue(mockEmailCapabilities);
      
      agentTools = new WorkspaceAgentTools();
    });

    it('should use provider-aware capabilities in tool execution', async () => {
      const tools = await agentTools.getAvailableTools('test-agent');
      const analyzeTool = tools.find(t => t.name === 'analyze_emails');
      
      const result = await analyzeTool!.execute({
        analysisType: 'attention',
        connectionId: 'test-connection'
      }, {
        agentId: 'test-agent',
        userId: 'test-user'
      });

      expect(mockDb.getWorkspaceConnection).toHaveBeenCalledWith('test-connection');
      expect(CapabilityFactory.createEmailCapabilities).toHaveBeenCalledWith(WorkspaceProvider.GOOGLE_WORKSPACE);
      expect(mockEmailCapabilities.analyzeEmails).toHaveBeenCalled();
      expect(result).toEqual({ analysis: 'test' });
    });

    it('should handle default timeframe values correctly', async () => {
      const tools = await agentTools.getAvailableTools('test-agent');
      const actionItemsTool = tools.find(t => t.name === 'get_email_action_items');
      
      await actionItemsTool!.execute({
        connectionId: 'test-connection'
        // No timeframe provided
      }, {
        agentId: 'test-agent',
        userId: 'test-user'
      });

      expect(mockEmailCapabilities.getActionItems).toHaveBeenCalledWith(
        'today', // Default value
        'test-connection',
        'test-agent'
      );
    });
  });
}); 