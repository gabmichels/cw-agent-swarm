/**
 * ErrorContextBuilder Tests
 * 
 * Testing the error context building system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorContextBuilder,
  ToolExecutionContextBuilder,
  WorkspacePermissionContextBuilder,
  ToolExecutionMetadataBuilder,
  WorkspacePermissionMetadataBuilder
} from '../../../src/lib/errors/context/ErrorContextBuilder';

describe('ErrorContextBuilder System', () => {
  describe('ErrorContextBuilder', () => {
    let builder: ErrorContextBuilder;

    beforeEach(() => {
      builder = new ErrorContextBuilder();
    });

    it('should build basic context with required fields', () => {
      const context = builder
        .setAgent('agent-123')
        .setUser('user-456')
        .build();

      expect(context.agentId).toBe('agent-123');
      expect(context.userId).toBe('user-456');
      expect(context.timestamp).toBeInstanceOf(Date);
      expect(context.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should build comprehensive context with all fields', () => {
      const context = builder
        .setAgent('agent-789')
        .setUser('user-abc')
        .setSession('session-def')
        .setConversation('conv-ghi')
        .setRequest('req-jkl')
        .setEnvironment('production')
        .setServer('server-2')
        .setVersion('2.1.0')
        .build();

      expect(context.agentId).toBe('agent-789');
      expect(context.userId).toBe('user-abc');
      expect(context.sessionId).toBe('session-def');
      expect(context.conversationId).toBe('conv-ghi');
      expect(context.requestId).toBe('req-jkl');
      expect(context.environment).toBe('production');
      expect(context.serverInstance).toBe('server-2');
      expect(context.version).toBe('2.1.0');
    });

    it('should validate required fields', () => {
      // Missing agentId should throw
      expect(() => {
        builder.setUser('user-123').build();
      }).toThrow('Agent ID is required');

      // Missing userId should throw
      expect(() => {
        builder.setAgent('agent-123').build();
      }).toThrow('User ID is required');
    });

    it('should create immutable context objects', () => {
      const context = builder
        .setAgent('agent-123')
        .setUser('user-456')
        .build();

      // This should not throw (readonly is compile-time only)
      expect(() => {
        (context as any).agentId = 'modified-agent';
      }).not.toThrow();

      // But original value should be preserved
      expect(context.agentId).toBe('agent-123');
    });

    it('should support method chaining', () => {
      const result = builder
        .setAgent('agent-123')
        .setUser('user-456')
        .setSession('session-789')
        .setEnvironment('test');

      expect(result).toBe(builder); // Same instance for chaining
    });
  });

  describe('ToolExecutionContextBuilder', () => {
    let builder: ToolExecutionContextBuilder;

    beforeEach(() => {
      builder = new ToolExecutionContextBuilder();
    });

    it('should build tool execution context', () => {
      const context = builder
        .setAgent('agent-123')
        .setUser('user-456')
        .setToolId('tool-789')
        .setToolName('email_sender')
        .setWorkspaceId('workspace-abc')
        .build();

      expect(context.agentId).toBe('agent-123');
      expect(context.userId).toBe('user-456');
      expect(context.toolId).toBe('tool-789');
      expect(context.toolName).toBe('email_sender');
      expect(context.workspaceId).toBe('workspace-abc');
    });

    it('should validate tool-specific fields', () => {
      expect(() => {
        builder
          .setAgent('agent-123')
          .setUser('user-456')
          .build(); // Missing toolId
      }).toThrow('Tool ID is required for tool execution context');

      expect(() => {
        builder
          .setAgent('agent-123')
          .setUser('user-456')
          .setToolId('tool-789')
          .build(); // Missing toolName
      }).toThrow('Tool name is required for tool execution context');
    });

    it('should inherit base builder functionality', () => {
      const context = builder
        .setAgent('agent-123')
        .setUser('user-456')
        .setToolId('tool-789')
        .setToolName('calendar_reader')
        .setSession('session-def')
        .setEnvironment('staging')
        .build();

      expect(context.sessionId).toBe('session-def');
      expect(context.environment).toBe('staging');
      expect(context.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('WorkspacePermissionContextBuilder', () => {
    let builder: WorkspacePermissionContextBuilder;

    beforeEach(() => {
      builder = new WorkspacePermissionContextBuilder();
    });

    it('should build workspace permission context', () => {
      const context = builder
        .setAgent('agent-123')
        .setUser('user-456')
        .setWorkspaceId('workspace-789')
        .setPermission('EMAIL_SEND')
        .setResourceType('email')
        .build();

      expect(context.agentId).toBe('agent-123');
      expect(context.userId).toBe('user-456');
      expect(context.workspaceId).toBe('workspace-789');
      expect(context.requiredPermission).toBe('EMAIL_SEND');
      expect(context.resourceType).toBe('email');
    });

    it('should validate permission-specific fields', () => {
      expect(() => {
        builder
          .setAgent('agent-123')
          .setUser('user-456')
          .build(); // Missing workspaceId
      }).toThrow('Workspace ID is required for workspace permission context');

      expect(() => {
        builder
          .setAgent('agent-123')
          .setUser('user-456')
          .setWorkspaceId('workspace-789')
          .build(); // Missing permission
      }).toThrow('Required permission is required for workspace permission context');
    });

    it('should support optional resource fields', () => {
      const context = builder
        .setAgent('agent-123')
        .setUser('user-456')
        .setWorkspaceId('workspace-789')
        .setPermission('CALENDAR_READ')
        .setResourceType('calendar')
        .setResourceId('calendar-abc')
        .build();

      expect(context.resourceType).toBe('calendar');
      expect(context.resourceId).toBe('calendar-abc');
    });
  });

  describe('ToolExecutionMetadataBuilder', () => {
    let builder: ToolExecutionMetadataBuilder;

    beforeEach(() => {
      builder = new ToolExecutionMetadataBuilder();
    });

    it('should build tool execution metadata', () => {
      const metadata = builder
        .setExecutionTime(1500)
        .setParameters({ to: 'test@example.com', subject: 'Test' })
        .setResponse({ success: true, messageId: 'msg-123' })
        .setRetryCount(2)
        .build();

      expect(metadata.executionTime).toBe(1500);
      expect(metadata.parameters).toEqual({ to: 'test@example.com', subject: 'Test' });
      expect(metadata.response).toEqual({ success: true, messageId: 'msg-123' });
      expect(metadata.retryCount).toBe(2);
    });

    it('should support timeout and error information', () => {
      const metadata = builder
        .setTimeout(30000)
        .setErrorCode('NETWORK_TIMEOUT')
        .setStatusCode(504)
        .build();

      expect(metadata.timeout).toBe(30000);
      expect(metadata.errorCode).toBe('NETWORK_TIMEOUT');
      expect(metadata.statusCode).toBe(504);
    });

    it('should validate metadata structure', () => {
      const metadata = builder
        .setParameters({ invalidParam: null })
        .build();

      expect(metadata.parameters).toEqual({ invalidParam: null });
    });
  });

  describe('WorkspacePermissionMetadataBuilder', () => {
    let builder: WorkspacePermissionMetadataBuilder;

    beforeEach(() => {
      builder = new WorkspacePermissionMetadataBuilder();
    });

    it('should build workspace permission metadata', () => {
      const metadata = builder
        .setAttemptedAction('send_email')
        .setAvailablePermissions(['EMAIL_READ', 'CALENDAR_READ'])
        .setAccessLevel('READ')
        .setConnectionId('conn-123')
        .build();

      expect(metadata.attemptedAction).toBe('send_email');
      expect(metadata.availablePermissions).toEqual(['EMAIL_READ', 'CALENDAR_READ']);
      expect(metadata.accessLevel).toBe('read');
      expect(metadata.connectionId).toBe('conn-123');
    });

    it('should support provider and scope information', () => {
      const metadata = builder
        .setProvider('google_workspace')
        .setScope('https://www.googleapis.com/auth/gmail.send')
        .setTokenStatus('valid')
        .build();

      expect(metadata.provider).toBe('google_workspace');
      expect(metadata.scope).toBe('https://www.googleapis.com/auth/gmail.send');
      expect(metadata.tokenStatus).toBe('valid');
    });

    it('should handle empty permission arrays', () => {
      const metadata = builder
        .setAvailablePermissions([])
        .build();

      expect(metadata.availablePermissions).toEqual([]);
    });
  });

  describe('Builder Composition', () => {
    it('should compose tool execution context with metadata', () => {
      const context = new ToolExecutionContextBuilder()
        .setAgent('agent-123')
        .setUser('user-456')
        .setToolId('tool-789')
        .setToolName('email_sender')
        .setWorkspaceId('workspace-abc')
        .build();

      const metadata = new ToolExecutionMetadataBuilder()
        .setExecutionTime(2000)
        .setParameters({ to: 'test@example.com' })
        .setRetryCount(1)
        .build();

      expect(context.agentId).toBe('agent-123');
      expect(context.toolId).toBe('tool-789');
      expect(metadata.executionTime).toBe(2000);
      expect(metadata.retryCount).toBe(1);
    });

    it('should compose workspace permission context with metadata', () => {
      const context = new WorkspacePermissionContextBuilder()
        .setAgent('agent-123')
        .setUser('user-456')
        .setWorkspaceId('workspace-789')
        .setPermission('EMAIL_SEND')
        .setResourceType('email')
        .build();

      const metadata = new WorkspacePermissionMetadataBuilder()
        .setAttemptedAction('send_email')
        .setAvailablePermissions(['EMAIL_READ'])
        .setProvider('google_workspace')
        .build();

      expect(context.workspaceId).toBe('workspace-789');
      expect(context.requiredPermission).toBe('EMAIL_SEND');
      expect(metadata.attemptedAction).toBe('send_email');
      expect(metadata.provider).toBe('google_workspace');
    });
  });
}); 