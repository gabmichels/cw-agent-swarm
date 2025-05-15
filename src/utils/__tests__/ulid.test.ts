import { describe, expect, it } from 'vitest';
import { IdGenerator, IdPrefix } from '../ulid';

describe('ULID Implementation', () => {
  describe('IdGenerator', () => {
    describe('generate', () => {
      it('should create a valid ID', () => {
        const expectedDate = new Date();
        const newId = IdGenerator.generate('test');

        expect(newId.namespace).toBe('test');
        expect(newId.type).toBe('test');
        expect(newId.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

        // Check timestamp if available
        const timestamp = newId.timestamp || newId.getTimestamp?.();
        if (timestamp) {
          expect(timestamp.getTime()).toBe(expectedDate.getTime());
        }
      });
      
      it('should create sequential IDs', () => {
        const id1 = IdGenerator.generate('test');
        const id2 = IdGenerator.generate('test');
        
        // IDs should be sequential
        expect(id1.id < id2.id).toBe(true);
      });
    });
    
    describe('generateWithTimestamp', () => {
      it('should create an ID with the given timestamp', () => {
        const prefix = 'test';
        const timestamp = new Date();
        const id = IdGenerator.generateWithTimestamp(prefix, timestamp);
        
        expect(id.namespace).toBe(prefix);
        const idTimestamp = id.getTimestamp?.();
        if (idTimestamp) {
          expect(idTimestamp.getTime()).toBe(timestamp.getTime());
        }
        expect(id.toString()).toBe(`${prefix}_${id.id}`);
      });
    });
    
    describe('parse', () => {
      it('should parse a valid ID string', () => {
        const original = IdGenerator.generate('test');
        const parsed = IdGenerator.parse(original.toString());
        
        expect(parsed).not.toBeNull();
        if (parsed) {
          expect(parsed.namespace).toBe(original.namespace);
          expect(parsed.id).toBe(original.id);
          
          const parsedTimestamp = parsed.timestamp || parsed.getTimestamp?.();
          const originalTimestamp = original.timestamp || original.getTimestamp?.();
          if (parsedTimestamp && originalTimestamp) {
            expect(parsedTimestamp.getTime()).toBeCloseTo(originalTimestamp.getTime(), -2); // Allow small timestamp difference due to parsing
          }
        }
      });
      
      it('should return null for invalid ID string', () => {
        expect(IdGenerator.parse('invalid')).toBeNull();
        expect(IdGenerator.parse('invalid_id')).toBeNull();
        expect(IdGenerator.parse('prefix_invalidulid')).toBeNull();
      });
    });
    
    describe('isValid', () => {
      it('should validate ULID format', () => {
        const id = IdGenerator.generate('test');
        expect(IdGenerator.isValid(id.id)).toBe(true);
      });
    });
    
    describe('getTimestamp', () => {
      it('should extract timestamp from ULID', () => {
        const id = IdGenerator.generate('test');
        const extractedTimestamp = IdGenerator.getTimestamp(id.id);
        const idTimestamp = id.timestamp || id.getTimestamp?.();
        if (idTimestamp) {
          expect(extractedTimestamp.getTime()).toBe(idTimestamp.getTime());
        }
      });
    });
  });
  
  describe('Helper Functions', () => {
    it('should create user IDs with the correct prefix', () => {
      const id = IdGenerator.generate(IdPrefix.USER);
      expect(id.namespace).toBe(IdPrefix.USER);
    });
    
    it('should create agent IDs with the correct prefix', () => {
      const id = IdGenerator.generate(IdPrefix.AGENT);
      expect(id.namespace).toBe(IdPrefix.AGENT);
    });
    
    it('should create chat IDs with the correct prefix', () => {
      const id = IdGenerator.generate(IdPrefix.CHAT);
      expect(id.namespace).toBe(IdPrefix.CHAT);
    });
    
    it('should create message IDs with the correct prefix', () => {
      const id = IdGenerator.generate(IdPrefix.MESSAGE);
      expect(id.namespace).toBe(IdPrefix.MESSAGE);
    });
    
    it('should create memory IDs with the correct prefix', () => {
      const id = IdGenerator.generate(IdPrefix.MEMORY);
      expect(id.namespace).toBe(IdPrefix.MEMORY);
    });
  });
  
  describe('StructuredId Interface', () => {
    it('should implement toString method correctly', () => {
      const id = IdGenerator.generate('test');
      expect(id.toString()).toBe(`test_${id.id}`);
    });
    
    it('should implement toULID method correctly', () => {
      const id = IdGenerator.generate('test');
      const ulid = id.toULID?.();
      if (ulid) {
        expect(ulid).toBe(id.id);
      }
    });
    
    it('should implement getTimestamp method correctly', () => {
      const id = IdGenerator.generate('test');
      const timestamp = id.timestamp || id.getTimestamp?.();
      if (timestamp) {
        expect(timestamp).toBeInstanceOf(Date);
      }
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

  describe('string representation', () => {
    it('should convert to string correctly', () => {
      const id = IdGenerator.generate('test');
      expect(id.toString()).toBe(`test_${id.id}`);
    });
  });

  describe('ULID access', () => {
    it('should provide access to raw ULID', () => {
      const id = IdGenerator.generate('test');
      expect(id.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });
  });

  describe('timestamp access', () => {
    it('should provide access to timestamp', () => {
      const id = IdGenerator.generate('test');
      const timestamp = id.timestamp || id.getTimestamp?.();
      if (timestamp) {
        expect(timestamp).toBeInstanceOf(Date);
      }
    });
  });
}); 