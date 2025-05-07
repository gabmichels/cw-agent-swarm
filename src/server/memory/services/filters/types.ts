/**
 * Type definitions for Qdrant filter builder
 * This provides the interface for building type-safe, optimized filters for Qdrant queries
 */

/**
 * Base filter condition that represents a single filter expression
 */
export interface FilterCondition<T> {
  /**
   * The filter operation to apply
   */
  operator: FilterOperator;
  
  /**
   * The value to filter on
   */
  value: T | T[] | null;
}

/**
 * Supported filter operations
 */
export enum FilterOperator {
  /**
   * Equals comparison
   */
  EQUALS = 'equals',
  
  /**
   * Not equals comparison
   */
  NOT_EQUALS = 'notEquals',
  
  /**
   * Contains substring (for string fields)
   */
  CONTAINS = 'contains',
  
  /**
   * Greater than comparison (for numeric or date fields)
   */
  GREATER_THAN = 'greaterThan',
  
  /**
   * Greater than or equal comparison (for numeric or date fields)
   */
  GREATER_THAN_OR_EQUAL = 'greaterThanOrEqual',
  
  /**
   * Less than comparison (for numeric or date fields)
   */
  LESS_THAN = 'lessThan',
  
  /**
   * Less than or equal comparison (for numeric or date fields)
   */
  LESS_THAN_OR_EQUAL = 'lessThanOrEqual',
  
  /**
   * In array (value is one of the elements)
   */
  IN = 'in',
  
  /**
   * Not in array (value is not one of the elements)
   */
  NOT_IN = 'notIn',
  
  /**
   * Field exists and is not null
   */
  EXISTS = 'exists',
  
  /**
   * Field does not exist or is null
   */
  NOT_EXISTS = 'notExists',
  
  /**
   * Match a set of conditions with AND logic
   */
  AND = 'and',
  
  /**
   * Match a set of conditions with OR logic
   */
  OR = 'or',
  
  /**
   * Negate a condition
   */
  NOT = 'not'
}

/**
 * Type-safe filter conditions for entity fields
 * This maps property names to their filter conditions
 */
export type FilterConditions<T> = {
  [K in keyof T]?: FilterCondition<T[K]>;
}

/**
 * Combined filter with logical operators
 */
export interface CompositeFilter<T> {
  /**
   * All conditions must match (AND)
   */
  must?: Array<FilterConditions<T> | CompositeFilter<T>>;
  
  /**
   * At least one condition must match (OR)
   */
  should?: Array<FilterConditions<T> | CompositeFilter<T>>;
  
  /**
   * No condition should match (NOT)
   */
  must_not?: Array<FilterConditions<T> | CompositeFilter<T>>;
}

/**
 * Options for filter operations
 */
export interface FilterOptions {
  /**
   * Whether to include deleted items
   * @default false
   */
  includeDeleted?: boolean;
  
  /**
   * Max number of results to return
   * @default 100
   */
  limit?: number;
  
  /**
   * Number of results to skip
   * @default 0
   */
  offset?: number;
  
  /**
   * Score threshold for similarity searches
   * @default 0.0
   */
  scoreThreshold?: number;
}

/**
 * Qdrant-specific filter structure
 * This represents the final output format for Qdrant queries
 */
export interface QdrantFilter {
  must?: QdrantCondition[];
  should?: QdrantCondition[];
  must_not?: QdrantCondition[];
}

/**
 * Qdrant-specific filter condition
 */
export type QdrantCondition = 
  | QdrantMatchCondition 
  | QdrantRangeCondition 
  | QdrantIsNullCondition 
  | QdrantIsEmptyCondition
  | QdrantFilter;

/**
 * Qdrant match condition
 */
export interface QdrantMatchCondition {
  key: string;
  match: {
    value?: unknown;
    any?: unknown[];
    all?: unknown[];
  };
}

/**
 * Qdrant range condition
 */
export interface QdrantRangeCondition {
  key: string;
  range: {
    gt?: number | string;
    gte?: number | string;
    lt?: number | string;
    lte?: number | string;
  };
}

/**
 * Qdrant is_null condition
 */
export interface QdrantIsNullCondition {
  is_null: { key: string };
}

/**
 * Qdrant is_empty condition
 */
export interface QdrantIsEmptyCondition {
  is_empty: { key: string };
} 