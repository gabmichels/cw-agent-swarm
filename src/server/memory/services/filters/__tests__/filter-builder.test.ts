import { describe, it, expect } from 'vitest';
import { 
  QdrantFilterBuilder,
  FilterError
} from '../filter-builder';
import { FilterConditions, CompositeFilter, FilterOperator } from '../types';

// Sample entity type for testing
interface TestEntity {
  id: string;
  name: string;
  age: number;
  isActive: boolean;
  tags: string[];
  createdAt: Date;
  metadata: {
    source: string;
    importance: number;
  };
}

describe('QdrantFilterBuilder', () => {
  const filterBuilder = new QdrantFilterBuilder();
  
  describe('build', () => {
    it('should build a simple equality filter', () => {
      const conditions: FilterConditions<TestEntity> = {
        name: {
          operator: FilterOperator.EQUALS,
          value: 'Test User'
        }
      };
      
      const qdrantFilter = filterBuilder.build(conditions);
      
      expect(qdrantFilter).toEqual({
        must: [
          {
            key: 'metadata.name',
            match: { value: 'Test User' }
          }
        ]
      });
    });
    
    it('should handle special fields without metadata prefix', () => {
      const conditions: FilterConditions<TestEntity> = {
        id: {
          operator: FilterOperator.EQUALS,
          value: '123'
        }
      };
      
      const qdrantFilter = filterBuilder.build(conditions);
      
      expect(qdrantFilter).toEqual({
        must: [
          {
            key: 'id',
            match: { value: '123' }
          }
        ]
      });
    });
    
    it('should build a not equals filter', () => {
      const conditions: FilterConditions<TestEntity> = {
        name: {
          operator: FilterOperator.NOT_EQUALS,
          value: 'Test User'
        }
      };
      
      const qdrantFilter = filterBuilder.build(conditions);
      
      expect(qdrantFilter).toEqual({
        must: [
          {
            must_not: [
              {
                key: 'metadata.name',
                match: { value: 'Test User' }
              }
            ]
          }
        ]
      });
    });
    
    it('should build a contains filter', () => {
      const conditions: FilterConditions<TestEntity> = {
        name: {
          operator: FilterOperator.CONTAINS,
          value: 'Test'
        }
      };
      
      const qdrantFilter = filterBuilder.build(conditions);
      
      expect(qdrantFilter).toEqual({
        must: [
          {
            key: 'metadata.name',
            match: { value: { $contains: 'Test' } }
          }
        ]
      });
    });
    
    it('should throw an error when CONTAINS is used with non-string value', () => {
      const conditions: FilterConditions<TestEntity> = {
        age: {
          operator: FilterOperator.CONTAINS,
          value: 30
        }
      };
      
      expect(() => filterBuilder.build(conditions)).toThrow(FilterError);
    });
    
    it('should build range filters', () => {
      const conditions: FilterConditions<TestEntity> = {
        age: {
          operator: FilterOperator.GREATER_THAN,
          value: 30
        }
      };
      
      const qdrantFilter = filterBuilder.build(conditions);
      
      expect(qdrantFilter).toEqual({
        must: [
          {
            key: 'metadata.age',
            range: { gt: 30 }
          }
        ]
      });
    });
    
    it('should build IN filter', () => {
      const conditions: FilterConditions<TestEntity> = {
        tags: {
          operator: FilterOperator.IN,
          value: ['tag1', 'tag2']
        }
      };
      
      const qdrantFilter = filterBuilder.build(conditions);
      
      expect(qdrantFilter).toEqual({
        must: [
          {
            key: 'metadata.tags',
            match: { any: ['tag1', 'tag2'] }
          }
        ]
      });
    });
    
    it('should throw an error when IN is used with non-array value', () => {
      const conditions: FilterConditions<TestEntity> = {
        tags: {
          operator: FilterOperator.IN,
          value: 'tag1' as unknown as string[]
        }
      };
      
      expect(() => filterBuilder.build(conditions)).toThrow(FilterError);
    });
    
    it('should build NOT_IN filter', () => {
      const conditions: FilterConditions<TestEntity> = {
        tags: {
          operator: FilterOperator.NOT_IN,
          value: ['tag1', 'tag2']
        }
      };
      
      const qdrantFilter = filterBuilder.build(conditions);
      
      expect(qdrantFilter).toEqual({
        must: [
          {
            must_not: [
              {
                key: 'metadata.tags',
                match: { any: ['tag1', 'tag2'] }
              }
            ]
          }
        ]
      });
    });
    
    it('should build EXISTS filter', () => {
      const conditions: FilterConditions<TestEntity> = {
        tags: {
          operator: FilterOperator.EXISTS,
          value: null
        }
      };
      
      const qdrantFilter = filterBuilder.build(conditions);
      
      expect(qdrantFilter).toEqual({
        must: [
          {
            must_not: [
              {
                is_null: { key: 'metadata.tags' }
              }
            ]
          }
        ]
      });
    });
    
    it('should build NOT_EXISTS filter', () => {
      const conditions: FilterConditions<TestEntity> = {
        tags: {
          operator: FilterOperator.NOT_EXISTS,
          value: null
        }
      };
      
      const qdrantFilter = filterBuilder.build(conditions);
      
      expect(qdrantFilter).toEqual({
        must: [
          {
            is_null: { key: 'metadata.tags' }
          }
        ]
      });
    });
    
    it('should throw error for unsupported operator', () => {
      const conditions: FilterConditions<TestEntity> = {
        name: {
          // @ts-expect-error Testing invalid operator
          operator: 'INVALID_OPERATOR',
          value: 'Test'
        }
      };
      
      expect(() => filterBuilder.build(conditions)).toThrow(FilterError);
    });
  });
  
  describe('composite filters', () => {
    it('should build a filter with must conditions', () => {
      const filter: CompositeFilter<TestEntity> = {
        must: [
          {
            name: {
              operator: FilterOperator.EQUALS,
              value: 'Test User'
            }
          },
          {
            age: {
              operator: FilterOperator.GREATER_THAN,
              value: 30
            }
          }
        ]
      };
      
      const qdrantFilter = filterBuilder.build(filter);
      
      expect(qdrantFilter).toEqual({
        must: [
          {
            key: 'metadata.name',
            match: { value: 'Test User' }
          },
          {
            key: 'metadata.age',
            range: { gt: 30 }
          }
        ]
      });
    });
    
    it('should build a filter with should conditions', () => {
      const filter: CompositeFilter<TestEntity> = {
        should: [
          {
            name: {
              operator: FilterOperator.EQUALS,
              value: 'Test User'
            }
          },
          {
            name: {
              operator: FilterOperator.EQUALS,
              value: 'Another User'
            }
          }
        ]
      };
      
      const qdrantFilter = filterBuilder.build(filter);
      
      expect(qdrantFilter).toEqual({
        should: [
          {
            key: 'metadata.name',
            match: { value: 'Test User' }
          },
          {
            key: 'metadata.name',
            match: { value: 'Another User' }
          }
        ]
      });
    });
    
    it('should build a filter with must_not conditions', () => {
      const filter: CompositeFilter<TestEntity> = {
        must_not: [
          {
            isActive: {
              operator: FilterOperator.EQUALS,
              value: false
            }
          }
        ]
      };
      
      const qdrantFilter = filterBuilder.build(filter);
      
      expect(qdrantFilter).toEqual({
        must_not: [
          {
            key: 'metadata.isActive',
            match: { value: false }
          }
        ]
      });
    });
    
    it('should build a complex filter with all condition types', () => {
      const filter: CompositeFilter<TestEntity> = {
        must: [
          {
            age: {
              operator: FilterOperator.GREATER_THAN,
              value: 18
            }
          }
        ],
        should: [
          {
            name: {
              operator: FilterOperator.CONTAINS,
              value: 'John'
            }
          },
          {
            name: {
              operator: FilterOperator.CONTAINS,
              value: 'Jane'
            }
          }
        ],
        must_not: [
          {
            isActive: {
              operator: FilterOperator.EQUALS,
              value: false
            }
          }
        ]
      };
      
      const qdrantFilter = filterBuilder.build(filter);
      
      expect(qdrantFilter).toEqual({
        must: [
          {
            key: 'metadata.age',
            range: { gt: 18 }
          }
        ],
        should: [
          {
            key: 'metadata.name',
            match: { value: { $contains: 'John' } }
          },
          {
            key: 'metadata.name',
            match: { value: { $contains: 'Jane' } }
          }
        ],
        must_not: [
          {
            key: 'metadata.isActive',
            match: { value: false }
          }
        ]
      });
    });
    
    it('should handle nested composite filters', () => {
      const filter: CompositeFilter<TestEntity> = {
        must: [
          {
            age: {
              operator: FilterOperator.GREATER_THAN,
              value: 18
            }
          },
          {
            must: [
              {
                tags: {
                  operator: FilterOperator.IN,
                  value: ['active', 'verified']
                }
              }
            ],
            should: [
              {
                name: {
                  operator: FilterOperator.CONTAINS,
                  value: 'Admin'
                }
              }
            ]
          }
        ]
      };
      
      const qdrantFilter = filterBuilder.build(filter);
      
      expect(qdrantFilter.must).toHaveLength(2);
      expect(qdrantFilter.must?.[0]).toEqual({
        key: 'metadata.age',
        range: { gt: 18 }
      });
      
      expect(qdrantFilter.must?.[1]).toEqual({
        must: [
          {
            key: 'metadata.tags',
            match: { any: ['active', 'verified'] }
          }
        ],
        should: [
          {
            key: 'metadata.name',
            match: { value: { $contains: 'Admin' } }
          }
        ]
      });
    });
  });
  
  describe('utility functions', () => {
    it('should create a non-deleted filter', () => {
      const filter = QdrantFilterBuilder.createNonDeletedFilter();
      
      expect(filter).toEqual({
        must_not: [
          {
            key: 'is_deleted',
            match: { value: true }
          }
        ]
      });
    });
    
    it('should merge multiple filters', () => {
      const filter1 = {
        must: [
          {
            key: 'metadata.age',
            range: { gt: 18 }
          }
        ]
      };
      
      const filter2 = {
        should: [
          {
            key: 'metadata.name',
            match: { value: 'Test User' }
          }
        ]
      };
      
      const filter3 = {
        must_not: [
          {
            key: 'is_deleted',
            match: { value: true }
          }
        ]
      };
      
      const mergedFilter = QdrantFilterBuilder.mergeFilters(filter1, filter2, filter3);
      
      expect(mergedFilter).toEqual({
        must: [
          {
            key: 'metadata.age',
            range: { gt: 18 }
          }
        ],
        should: [
          {
            key: 'metadata.name',
            match: { value: 'Test User' }
          }
        ],
        must_not: [
          {
            key: 'is_deleted',
            match: { value: true }
          }
        ]
      });
    });
  });
}); 