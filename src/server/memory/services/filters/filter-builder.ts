/**
 * Qdrant Filter Builder
 * 
 * A utility for building optimized Qdrant filters from application-specific filter conditions.
 * Designed for performance and type safety.
 */

import { AppError } from '../../../../lib/errors/base';
import {
  FilterCondition,
  FilterConditions,
  FilterOperator,
  CompositeFilter,
  QdrantFilter,
  QdrantCondition,
  QdrantMatchCondition,
  QdrantRangeCondition,
  QdrantIsNullCondition,
  QdrantIsEmptyCondition
} from './types';

/**
 * Error class for filter-related errors
 */
export class FilterError extends AppError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'FILTER_ERROR', context);
    this.name = 'FilterError';
  }
}

/**
 * QdrantFilterBuilder class
 * 
 * Builds optimized filters for Qdrant queries
 */
export class QdrantFilterBuilder {
  /**
   * Build a Qdrant filter from application filter conditions
   * 
   * @param filter The filter conditions to convert
   * @returns A Qdrant-compatible filter
   */
  public build<T>(filter: FilterConditions<T> | CompositeFilter<T>): QdrantFilter {
    // Handle composite filters (with must/should/must_not)
    if (this.isCompositeFilter(filter)) {
      return this.buildCompositeFilter(filter);
    }
    
    // Handle simple filter conditions
    return this.buildConditionsFilter(filter as FilterConditions<T>);
  }
  
  /**
   * Check if a filter is a composite filter
   */
  private isCompositeFilter<T>(filter: FilterConditions<T> | CompositeFilter<T>): filter is CompositeFilter<T> {
    const compositeKeys = ['must', 'should', 'must_not'];
    const filterKeys = Object.keys(filter);
    
    return compositeKeys.some(key => filterKeys.includes(key));
  }
  
  /**
   * Build a filter from composite conditions (must/should/must_not)
   */
  private buildCompositeFilter<T>(filter: CompositeFilter<T>): QdrantFilter {
    const result: QdrantFilter = {};
    
    // Handle 'must' conditions (AND)
    if (filter.must && filter.must.length > 0) {
      result.must = filter.must.map(condition => {
        if (this.isCompositeFilter(condition)) {
          return this.buildCompositeFilter(condition);
        } else {
          return this.buildConditionsToQdrantConditions(condition as FilterConditions<T>);
        }
      }).flat();
    }
    
    // Handle 'should' conditions (OR)
    if (filter.should && filter.should.length > 0) {
      result.should = filter.should.map(condition => {
        if (this.isCompositeFilter(condition)) {
          return this.buildCompositeFilter(condition);
        } else {
          return this.buildConditionsToQdrantConditions(condition as FilterConditions<T>);
        }
      }).flat();
    }
    
    // Handle 'must_not' conditions (NOT)
    if (filter.must_not && filter.must_not.length > 0) {
      result.must_not = filter.must_not.map(condition => {
        if (this.isCompositeFilter(condition)) {
          return this.buildCompositeFilter(condition);
        } else {
          return this.buildConditionsToQdrantConditions(condition as FilterConditions<T>);
        }
      }).flat();
    }
    
    return result;
  }
  
  /**
   * Build a filter from simple conditions
   */
  private buildConditionsFilter<T>(conditions: FilterConditions<T>): QdrantFilter {
    const qdrantConditions = this.buildConditionsToQdrantConditions(conditions);
    
    // If there are conditions, wrap them in a 'must' clause
    if (qdrantConditions.length > 0) {
      return {
        must: qdrantConditions
      };
    }
    
    // Return empty filter if no conditions
    return {};
  }
  
  /**
   * Convert filter conditions to Qdrant conditions
   */
  private buildConditionsToQdrantConditions<T>(conditions: FilterConditions<T>): QdrantCondition[] {
    return Object.entries(conditions).map(([field, condition]) => {
      // Handle nested paths with dots
      const key = this.normalizeFieldPath(field);
      
      return this.buildSingleCondition(key, condition as FilterCondition<unknown>);
    });
  }
  
  /**
   * Build a single Qdrant condition from a filter condition
   */
  private buildSingleCondition(
    key: string,
    condition: FilterCondition<unknown>
  ): QdrantCondition {
    const { operator, value } = condition;
    
    switch (operator) {
      case FilterOperator.EQUALS:
        return this.buildEqualsCondition(key, value);
        
      case FilterOperator.NOT_EQUALS:
        return {
          must_not: [this.buildEqualsCondition(key, value)]
        };
        
      case FilterOperator.CONTAINS:
        if (typeof value !== 'string') {
          throw new FilterError('CONTAINS operator requires string value', { key, value });
        }
        // For string contains, use a match with the text field
        return {
          key: `${key}`,
          match: { value: { $contains: value } }
        };
        
      case FilterOperator.GREATER_THAN:
        return {
          key,
          range: { gt: value as number | string }
        };
        
      case FilterOperator.GREATER_THAN_OR_EQUAL:
        return {
          key,
          range: { gte: value as number | string }
        };
        
      case FilterOperator.LESS_THAN:
        return {
          key,
          range: { lt: value as number | string }
        };
        
      case FilterOperator.LESS_THAN_OR_EQUAL:
        return {
          key,
          range: { lte: value as number | string }
        };
        
      case FilterOperator.IN:
        if (!Array.isArray(value)) {
          throw new FilterError('IN operator requires array value', { key, value });
        }
        return {
          key,
          match: { any: value }
        };
        
      case FilterOperator.NOT_IN:
        if (!Array.isArray(value)) {
          throw new FilterError('NOT_IN operator requires array value', { key, value });
        }
        return {
          must_not: [{
            key,
            match: { any: value }
          }]
        };
        
      case FilterOperator.EXISTS:
        return {
          must_not: [{
            is_null: { key }
          }]
        };
        
      case FilterOperator.NOT_EXISTS:
        return {
          is_null: { key }
        };
        
      default:
        throw new FilterError(`Unsupported filter operator: ${operator}`, { key, value });
    }
  }
  
  /**
   * Build an equals condition
   */
  private buildEqualsCondition(key: string, value: unknown): QdrantMatchCondition {
    return {
      key,
      match: { value }
    };
  }
  
  /**
   * Normalize field path for Qdrant
   * Prefixes fields with metadata. if they don't already have a prefix
   */
  private normalizeFieldPath(field: string): string {
    // Special fields that don't need metadata prefix
    const specialFields = ['id', 'type', 'vector'];
    
    // Don't modify fields that already have a prefix or are special
    if (field.includes('.') || specialFields.includes(field)) {
      return field;
    }
    
    // Prefix with metadata. by default
    return `metadata.${field}`;
  }
  
  /**
   * Create a filter that only returns non-deleted items
   */
  public static createNonDeletedFilter(): QdrantFilter {
    return {
      must_not: [{
        key: 'is_deleted',
        match: { value: true }
      }]
    };
  }
  
  /**
   * Merge multiple Qdrant filters with AND logic
   */
  public static mergeFilters(...filters: QdrantFilter[]): QdrantFilter {
    const result: QdrantFilter = {};
    
    // Collect all conditions
    const mustConditions: QdrantCondition[] = [];
    const shouldConditions: QdrantCondition[] = [];
    const mustNotConditions: QdrantCondition[] = [];
    
    // Merge all filters
    for (const filter of filters) {
      if (filter.must) mustConditions.push(...filter.must);
      if (filter.should) shouldConditions.push(...filter.should);
      if (filter.must_not) mustNotConditions.push(...filter.must_not);
    }
    
    // Add non-empty condition arrays to result
    if (mustConditions.length > 0) result.must = mustConditions;
    if (shouldConditions.length > 0) result.should = shouldConditions;
    if (mustNotConditions.length > 0) result.must_not = mustNotConditions;
    
    return result;
  }
} 