import { describe, expect, it } from 'vitest';
import { migrateTimestampId, batchMigrateIds, extractDateFromLegacyId } from '../ulid-migration';
import { IdGenerator, IdPrefix } from '../ulid';

describe('ULID Migration Utilities', () => {
  describe('migrateTimestampId', () => {
    it('should convert a timestamp-based ID to a ULID with preserved timestamp', () => {
      // Test with a millisecond timestamp
      const legacyId = '1622505600000-some-suffix';
      const newId = migrateTimestampId(legacyId, IdPrefix.USER, { preserveTimestamp: true });
      
      expect(newId.prefix).toBe(IdPrefix.USER);
      expect(newId.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      
      // June 1, 2021 UTC - the timestamp in the ID
      const expectedDate = new Date('2021-06-01T00:00:00Z');
      expect(newId.timestamp.getTime()).toBe(expectedDate.getTime());
    });
    
    it('should handle second-based timestamps correctly', () => {
      // Test with a seconds-based timestamp (June 1, 2021 UTC)
      const legacyId = '1622505600-another-suffix';
      const newId = migrateTimestampId(legacyId, IdPrefix.MESSAGE, { preserveTimestamp: true });
      
      expect(newId.prefix).toBe(IdPrefix.MESSAGE);
      
      // June 1, 2021 UTC - the timestamp in the ID
      const expectedDate = new Date('2021-06-01T00:00:00Z');
      expect(newId.timestamp.getTime()).toBe(expectedDate.getTime());
    });
    
    it('should use current timestamp if preservation is not requested', () => {
      const before = new Date();
      const legacyId = '1622505600000-some-suffix';
      const newId = migrateTimestampId(legacyId, IdPrefix.USER);
      const after = new Date();
      
      expect(newId.prefix).toBe(IdPrefix.USER);
      
      // Should use current timestamp, not the one from the legacy ID
      expect(newId.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(newId.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
    
    it('should handle non-timestamp IDs gracefully', () => {
      const legacyId = 'not-a-timestamp-id';
      const newId = migrateTimestampId(legacyId, IdPrefix.MEMORY, { preserveTimestamp: true });
      
      expect(newId.prefix).toBe(IdPrefix.MEMORY);
      expect(newId.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      
      // Should use current timestamp since the ID doesn't contain a timestamp
      const now = Date.now();
      expect(newId.timestamp.getTime()).toBeCloseTo(now, -2); // Within 100ms
    });
  });
  
  describe('batchMigrateIds', () => {
    it('should migrate a batch of objects with timestamp IDs', () => {
      const items = [
        { id: '1622505600000-item1', name: 'Item 1' },
        { id: '1622592000000-item2', name: 'Item 2' },
        { id: '1622678400000-item3', name: 'Item 3' }
      ];
      
      const migratedItems = batchMigrateIds(items, 'id', IdPrefix.DOCUMENT, { preserveTimestamp: true });
      
      // Should have the same number of items
      expect(migratedItems.length).toBe(items.length);
      
      // Each item should have a properly formatted ULID
      migratedItems.forEach((item, index) => {
        expect(item.name).toBe(items[index].name);
        expect(typeof item.id).toBe('string');
        
        // Should start with the correct prefix
        expect(item.id.startsWith(`${IdPrefix.DOCUMENT}_`)).toBe(true);
        
        // Should be parseable back to a StructuredId
        const parsedId = IdGenerator.parse(item.id);
        expect(parsedId).not.toBeNull();
        expect(parsedId?.prefix).toBe(IdPrefix.DOCUMENT);
      });
    });
    
    it('should preserve other properties in the objects', () => {
      const items = [
        { id: '1622505600000-item1', name: 'Item 1', data: { value: 10 } },
        { id: '1622592000000-item2', name: 'Item 2', data: { value: 20 } }
      ];
      
      const migratedItems = batchMigrateIds(items, 'id', IdPrefix.USER);
      
      // Should preserve all other properties
      expect(migratedItems[0].name).toBe('Item 1');
      expect(migratedItems[0].data.value).toBe(10);
      expect(migratedItems[1].name).toBe('Item 2');
      expect(migratedItems[1].data.value).toBe(20);
    });
  });
  
  describe('extractDateFromLegacyId', () => {
    it('should extract date from millisecond timestamp IDs', () => {
      const legacyId = '1622505600000-some-suffix';
      const date = extractDateFromLegacyId(legacyId);
      
      expect(date).not.toBeNull();
      expect(date?.toISOString()).toBe('2021-06-01T00:00:00.000Z');
    });
    
    it('should extract date from second timestamp IDs', () => {
      const legacyId = '1622505600-some-suffix';
      const date = extractDateFromLegacyId(legacyId);
      
      expect(date).not.toBeNull();
      expect(date?.toISOString()).toBe('2021-06-01T00:00:00.000Z');
    });
    
    it('should return null for non-timestamp IDs', () => {
      const legacyId = 'not-a-timestamp';
      const date = extractDateFromLegacyId(legacyId);
      
      expect(date).toBeNull();
    });
  });
}); 