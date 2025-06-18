/**
 * Tests for Workspace Permission Error System
 */

import { describe, it, expect } from 'vitest';
import { 
  WorkspacePermissionErrorFactory, 
  WorkspaceErrorType,
  formatWorkspaceErrorForAgent,
  formatWorkspaceErrorForUser,
  isResolvablePermissionError
} from '../WorkspacePermissionErrors';
import { WorkspaceCapabilityType, WorkspaceProvider } from '../../../database/types';

describe('WorkspacePermissionErrorFactory', () => {
  it('should create no permission error with helpful message', () => {
    const error = WorkspacePermissionErrorFactory.createNoPermissionError(
      WorkspaceCapabilityType.EMAIL_SEND,
      'test-agent-123',
      'Gmail - john@company.com'
    );

    expect(error.type).toBe(WorkspaceErrorType.NO_PERMISSION);
    expect(error.userMessage).toContain('email send capabilities');
    expect(error.userMessage).toContain('Gmail - john@company.com');
    expect(error.actionRequired).toContain('grant me email send permissions');
  });

  it('should create expired token error with refresh guidance', () => {
    const error = WorkspacePermissionErrorFactory.createExpiredTokenError(
      'conn-123',
      'Gmail - john@company.com',
      WorkspaceProvider.GOOGLE_WORKSPACE
    );

    expect(error.type).toBe(WorkspaceErrorType.EXPIRED_TOKEN);
    expect(error.userMessage).toContain('access to your Gmail - john@company.com account has expired');
    expect(error.actionRequired).toContain('refresh the connection');
  });

  it('should create insufficient scopes error with reconnect guidance', () => {
    const error = WorkspacePermissionErrorFactory.createInsufficientScopesError(
      WorkspaceCapabilityType.CALENDAR_CREATE,
      'Google Calendar - john@company.com',
      ['https://www.googleapis.com/auth/calendar'],
      ['https://www.googleapis.com/auth/calendar.readonly']
    );

    expect(error.type).toBe(WorkspaceErrorType.INSUFFICIENT_SCOPES);
    expect(error.userMessage).toContain("doesn't have the required permissions");
    expect(error.actionRequired).toContain('reconnect your Google Calendar');
  });

  it('should create rate limit error with wait guidance', () => {
    const resetTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    const error = WorkspacePermissionErrorFactory.createRateLimitError(
      WorkspaceCapabilityType.EMAIL_SEND,
      'Gmail - john@company.com',
      resetTime
    );

    expect(error.type).toBe(WorkspaceErrorType.RATE_LIMIT_EXCEEDED);
    expect(error.userMessage).toContain('reached the rate limit');
    expect(error.userMessage).toContain(resetTime.toLocaleTimeString());
    expect(error.actionRequired).toContain('wait a moment');
  });
});

describe('formatWorkspaceErrorForAgent', () => {
  it('should format no permission error with step-by-step instructions', () => {
    const error = WorkspacePermissionErrorFactory.createNoPermissionError(
      WorkspaceCapabilityType.EMAIL_SEND,
      'test-agent-123'
    );

    const formatted = formatWorkspaceErrorForAgent(error);
    
    expect(formatted).toContain("I don't have permission");
    expect(formatted).toContain('💡 **How to fix this:**');
    expect(formatted).toContain('1. Go to your agent settings');
    expect(formatted).toContain('2. Click "Edit" next to Workspace Permissions');
    expect(formatted).toContain('3. Enable the "email send" capability');
    expect(formatted).toContain('4. Save your changes');
  });

  it('should format no connection error with connection instructions', () => {
    const error = WorkspacePermissionErrorFactory.createNoConnectionError(
      WorkspaceCapabilityType.CALENDAR_CREATE,
      WorkspaceProvider.GOOGLE_WORKSPACE
    );

    const formatted = formatWorkspaceErrorForAgent(error);
    
    expect(formatted).toContain('💡 **How to fix this:**');
    expect(formatted).toContain('1. Go to Workspace Settings');
    expect(formatted).toContain('2. Connect your Google Workspace account');
    expect(formatted).toContain('3. Grant the necessary permissions');
  });

  it('should format expired token error with refresh instructions', () => {
    const error = WorkspacePermissionErrorFactory.createExpiredTokenError(
      'conn-123',
      'Gmail - john@company.com',
      WorkspaceProvider.GOOGLE_WORKSPACE
    );

    const formatted = formatWorkspaceErrorForAgent(error);
    
    expect(formatted).toContain('💡 **How to fix this:**');
    expect(formatted).toContain('1. Go to Workspace Settings');
    expect(formatted).toContain('2. Find your Gmail - john@company.com connection');
    expect(formatted).toContain('3. Click "Try Refresh" or "Reconnect"');
  });
});

describe('formatWorkspaceErrorForUser', () => {
  it('should format simple user message without technical details', () => {
    const error = WorkspacePermissionErrorFactory.createNoPermissionError(
      WorkspaceCapabilityType.EMAIL_READ,
      'test-agent-123'
    );

    const formatted = formatWorkspaceErrorForUser(error);
    
    expect(formatted).not.toContain('💡');
    expect(formatted).not.toContain('1. Go to');
    expect(formatted).toContain("I don't have permission");
    expect(formatted).toContain('grant me email read permissions');
  });
});

describe('isResolvablePermissionError', () => {
  it('should identify resolvable permission errors', () => {
    const resolvableErrors = [
      WorkspacePermissionErrorFactory.createNoPermissionError(WorkspaceCapabilityType.EMAIL_SEND, 'agent'),
      WorkspacePermissionErrorFactory.createNoConnectionError(WorkspaceCapabilityType.EMAIL_SEND),
      WorkspacePermissionErrorFactory.createExpiredTokenError('conn', 'Gmail', WorkspaceProvider.GOOGLE_WORKSPACE),
      WorkspacePermissionErrorFactory.createInsufficientScopesError(WorkspaceCapabilityType.EMAIL_SEND, 'Gmail', [], []),
      WorkspacePermissionErrorFactory.createConnectionInactiveError('conn', 'Gmail', 'EXPIRED')
    ];

    for (const error of resolvableErrors) {
      expect(isResolvablePermissionError(error)).toBe(true);
    }
  });

  it('should identify non-resolvable errors', () => {
    const nonResolvableErrors = [
      WorkspacePermissionErrorFactory.createRateLimitError(WorkspaceCapabilityType.EMAIL_SEND, 'Gmail'),
      WorkspacePermissionErrorFactory.createProviderError(WorkspaceProvider.GOOGLE_WORKSPACE, WorkspaceCapabilityType.EMAIL_SEND, 'Server error'),
      WorkspacePermissionErrorFactory.createNetworkError(WorkspaceCapabilityType.EMAIL_SEND)
    ];

    for (const error of nonResolvableErrors) {
      expect(isResolvablePermissionError(error)).toBe(false);
    }
  });
}); 