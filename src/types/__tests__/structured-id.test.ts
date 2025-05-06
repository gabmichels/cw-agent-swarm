/**
 * Unit tests for structured-id.ts
 */

import { describe, test, expect } from 'vitest';
import {
  StructuredId,
  EntityNamespace,
  EntityType,
  createStructuredId,
  createEnumStructuredId,
  createUserId,
  createAgentId,
  createChatId,
  createThreadId,
  parseStructuredId,
  structuredIdToString,
  areStructuredIdsEqual,
  createSystemId,
  AgentIdentifier,
  createAgentIdentifier
} from '../structured-id';

describe('StructuredId', () => {
  describe('createStructuredId', () => {
    test('should create a structured ID with the provided values', () => {
      const id = createStructuredId('test-namespace', 'test-type', '12345', 1);
      
      expect(id).toEqual({
        namespace: 'test-namespace',
        type: 'test-type',
        id: '12345',
        version: 1
      });
    });

    test('should create a structured ID without version if not provided', () => {
      const id = createStructuredId('test-namespace', 'test-type', '12345');
      
      expect(id).toEqual({
        namespace: 'test-namespace',
        type: 'test-type',
        id: '12345'
      });
      expect(id.version).toBeUndefined();
    });
  });

  describe('createEnumStructuredId', () => {
    test('should create a structured ID with enum values', () => {
      const id = createEnumStructuredId(
        EntityNamespace.USER,
        EntityType.USER,
        '12345',
        1
      );
      
      expect(id).toEqual({
        namespace: 'user',
        type: 'user',
        id: '12345',
        version: 1
      });
    });

    test('should create a structured ID with enum values without version', () => {
      const id = createEnumStructuredId(
        EntityNamespace.AGENT,
        EntityType.AGENT,
        '12345'
      );
      
      expect(id).toEqual({
        namespace: 'agent',
        type: 'agent',
        id: '12345'
      });
      expect(id.version).toBeUndefined();
    });
  });

  describe('Helper functions', () => {
    test('createUserId should create a user ID', () => {
      const userId = createUserId('12345', 1);
      
      expect(userId).toEqual({
        namespace: EntityNamespace.USER,
        type: EntityType.USER,
        id: '12345',
        version: 1
      });
    });

    test('createAgentId should create an agent ID', () => {
      const agentId = createAgentId('12345');
      
      expect(agentId).toEqual({
        namespace: EntityNamespace.AGENT,
        type: EntityType.AGENT,
        id: '12345'
      });
    });

    test('createChatId should create a chat ID', () => {
      const chatId = createChatId('12345');
      
      expect(chatId).toEqual({
        namespace: EntityNamespace.CHAT,
        type: EntityType.CHAT,
        id: '12345'
      });
    });

    test('createThreadId should create a thread ID', () => {
      const threadId = createThreadId('12345');
      
      expect(threadId).toEqual({
        namespace: EntityNamespace.CHAT,
        type: EntityType.THREAD,
        id: '12345'
      });
    });

    test('createSystemId should create a system entity ID', () => {
      const systemId = createSystemId(EntityType.MESSAGE, '12345');
      
      expect(systemId).toEqual({
        namespace: EntityNamespace.SYSTEM,
        type: EntityType.MESSAGE,
        id: '12345'
      });
    });
  });

  describe('parseStructuredId', () => {
    test('should parse a valid structured ID string', () => {
      const parsedId = parseStructuredId('user:user:12345');
      
      expect(parsedId).toEqual({
        namespace: 'user',
        type: 'user',
        id: '12345'
      });
    });

    test('should parse a valid structured ID string with version', () => {
      const parsedId = parseStructuredId('agent:agent:12345:2');
      
      expect(parsedId).toEqual({
        namespace: 'agent',
        type: 'agent',
        id: '12345',
        version: 2
      });
    });

    test('should return null for invalid structured ID strings', () => {
      expect(parseStructuredId('invalid')).toBeNull();
      expect(parseStructuredId('invalid:string')).toBeNull();
    });
  });

  describe('structuredIdToString', () => {
    test('should convert a structured ID to string without version', () => {
      const id: StructuredId = {
        namespace: 'user',
        type: 'user',
        id: '12345'
      };
      
      expect(structuredIdToString(id)).toBe('user:user:12345');
    });

    test('should convert a structured ID to string with version', () => {
      const id: StructuredId = {
        namespace: 'agent',
        type: 'agent',
        id: '12345',
        version: 2
      };
      
      expect(structuredIdToString(id)).toBe('agent:agent:12345:2');
    });
  });

  describe('areStructuredIdsEqual', () => {
    test('should return true for identical IDs', () => {
      const id1: StructuredId = {
        namespace: 'user',
        type: 'user',
        id: '12345'
      };
      
      const id2: StructuredId = {
        namespace: 'user',
        type: 'user',
        id: '12345'
      };
      
      expect(areStructuredIdsEqual(id1, id2)).toBe(true);
    });

    test('should return false for different IDs', () => {
      const id1: StructuredId = {
        namespace: 'user',
        type: 'user',
        id: '12345'
      };
      
      const id2: StructuredId = {
        namespace: 'user',
        type: 'user',
        id: '67890'
      };
      
      expect(areStructuredIdsEqual(id1, id2)).toBe(false);
    });

    test('should check namespace, type, ID, and version', () => {
      const id1: StructuredId = {
        namespace: 'user',
        type: 'user',
        id: '12345',
        version: 1
      };
      
      const id2: StructuredId = {
        namespace: 'user',
        type: 'user',
        id: '12345',
        version: 2
      };
      
      expect(areStructuredIdsEqual(id1, id2)).toBe(false);
    });
  });

  describe('AgentIdentifier', () => {
    test('createAgentIdentifier should create an agent identifier', () => {
      const ownerUserId = createUserId('owner-123');
      
      const agentIdentifier = createAgentIdentifier(
        '12345',
        ['search', 'analyze'],
        ['finance', 'technology'],
        0.9,
        ownerUserId
      );
      
      expect(agentIdentifier).toEqual({
        id: expect.objectContaining({
          namespace: EntityNamespace.AGENT,
          type: EntityType.AGENT,
          id: '12345'
        }),
        capabilities: ['search', 'analyze'],
        domain: ['finance', 'technology'],
        trustLevel: 0.9,
        ownerUserId
      });
    });

    test('should validate trust level range', () => {
      const ownerUserId = createUserId('owner-123');
      
      // Test values outside the range
      expect(() => createAgentIdentifier(
        '12345',
        ['search'],
        ['general'],
        1.5, // Over 1.0
        ownerUserId
      )).toThrow();
      
      expect(() => createAgentIdentifier(
        '12345',
        ['search'],
        ['general'],
        -0.5, // Under 0.0
        ownerUserId
      )).toThrow();
      
      // Test boundary values
      expect(() => createAgentIdentifier(
        '12345',
        ['search'],
        ['general'],
        0.0,
        ownerUserId
      )).not.toThrow();
      
      expect(() => createAgentIdentifier(
        '12345',
        ['search'],
        ['general'],
        1.0,
        ownerUserId
      )).not.toThrow();
    });
  });
}); 