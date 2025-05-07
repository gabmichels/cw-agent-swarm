import { describe, expect, it, test } from 'vitest';
import { 
  IdGenerator, 
  IdPrefix, 
  StructuredId,
  createUserId,
  createAgentId,
  createChatId,
  createMessageId,
  createMemoryId
} from '../ulid';

describe('ULID Implementation', () => {
  describe('IdGenerator', () => {
    it('should generate a valid ULID with the given prefix', () => {
      const prefix = 'test';
      const id = IdGenerator.generate(prefix);
      
      expect(id.prefix).toBe(prefix);
      expect(id.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
      expect(id.timestamp).toBeInstanceOf(Date);
      expect(id.toString()).toBe(`${prefix}_${id.id}`);
    });
    
    it('should generate UIDs that sort chronologically', () => {
      const id1 = IdGenerator.generate('test');
      
      // Ensure at least 1ms has passed
      const waitForNextMillisecond = () => new Promise(resolve => setTimeout(resolve, 1));
      return waitForNextMillisecond().then(() => {
        const id2 = IdGenerator.generate('test');
        expect(id1.id < id2.id).toBe(true);
      });
    });
    
    it('should generate with a specific timestamp', () => {
      const prefix = 'test';
      const timestamp = new Date('2023-01-01T00:00:00Z');
      const id = IdGenerator.generateWithTimestamp(prefix, timestamp);
      
      expect(id.prefix).toBe(prefix);
      expect(id.timestamp.getTime()).toBe(timestamp.getTime());
      expect(id.toString()).toBe(`${prefix}_${id.id}`);
    });
    
    it('should parse a valid structured ID string', () => {
      const original = IdGenerator.generate('test');
      const parsed = IdGenerator.parse(original.toString());
      
      expect(parsed).not.toBeNull();
      expect(parsed?.prefix).toBe(original.prefix);
      expect(parsed?.id).toBe(original.id);
      expect(parsed?.timestamp.getTime()).toBeCloseTo(original.timestamp.getTime(), -2); // Allow small timestamp difference due to parsing
    });
    
    it('should return null for invalid ID strings', () => {
      expect(IdGenerator.parse('invalid')).toBeNull();
      expect(IdGenerator.parse('invalid_also')).toBeNull();
      expect(IdGenerator.parse('invalid_12345')).toBeNull();
    });
    
    it('should validate ULID format correctly', () => {
      const id = IdGenerator.generate('test');
      
      expect(IdGenerator.isValid(id.id)).toBe(true);
      expect(IdGenerator.isValid('invalid')).toBe(false);
      // Invalid character 'I'
      expect(IdGenerator.isValid('01ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe(false);
    });
    
    it('should extract the correct timestamp from a ULID', () => {
      const timestamp = new Date();
      const id = IdGenerator.generateWithTimestamp('test', timestamp);
      
      const extractedTimestamp = IdGenerator.getTimestamp(id.id);
      // Check that the timestamps are within 1 second (allowing for rounding differences)
      expect(Math.abs(extractedTimestamp.getTime() - timestamp.getTime())).toBeLessThan(1000);
    });
  });
  
  describe('Helper Functions', () => {
    it('should create user IDs with the correct prefix', () => {
      const id = createUserId();
      expect(id.prefix).toBe(IdPrefix.USER);
    });
    
    it('should create agent IDs with the correct prefix', () => {
      const id = createAgentId();
      expect(id.prefix).toBe(IdPrefix.AGENT);
    });
    
    it('should create chat IDs with the correct prefix', () => {
      const id = createChatId();
      expect(id.prefix).toBe(IdPrefix.CHAT);
    });
    
    it('should create message IDs with the correct prefix', () => {
      const id = createMessageId();
      expect(id.prefix).toBe(IdPrefix.MESSAGE);
    });
    
    it('should create memory IDs with the correct prefix', () => {
      const id = createMemoryId();
      expect(id.prefix).toBe(IdPrefix.MEMORY);
    });
  });
  
  describe('StructuredId Interface', () => {
    it('should implement toString method correctly', () => {
      const id = createUserId();
      expect(id.toString()).toBe(`${id.prefix}_${id.id}`);
    });
    
    it('should implement toULID method correctly', () => {
      const id = createUserId();
      expect(id.toULID()).toBe(id.id);
    });
    
    it('should implement getTimestamp method correctly', () => {
      const id = createUserId();
      expect(id.getTimestamp()).toEqual(id.timestamp);
    });
  });
  
  describe('Performance', () => {
    it('should generate 1000 IDs in a reasonable time', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        IdGenerator.generate('perf');
      }
      const end = performance.now();
      
      const timePerOperation = (end - start) / 1000;
      // Each generation should take less than 1ms on average
      expect(timePerOperation).toBeLessThan(1);
    });
  });
}); 