/**
 * Graph-specific error types
 * Extends the base error handling framework with graph-specific errors
 */

import { AppError } from '../../../lib/errors/base';

/**
 * Base error class for graph-related errors
 */
export class GraphError extends AppError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `GRAPH_${code}`, context);
    this.name = 'GraphError';
  }
}

/**
 * Error for node-related operations
 */
export class GraphNodeError extends GraphError {
  constructor(
    message: string,
    nodeId: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'NODE_ERROR', { nodeId, ...context });
    this.name = 'GraphNodeError';
  }
}

/**
 * Error for relationship-related operations
 */
export class GraphRelationshipError extends GraphError {
  constructor(
    message: string,
    sourceId: string,
    targetId: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'RELATIONSHIP_ERROR', { sourceId, targetId, ...context });
    this.name = 'GraphRelationshipError';
  }
}

/**
 * Error for knowledge extraction operations
 */
export class KnowledgeExtractionError extends GraphError {
  constructor(
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'EXTRACTION_ERROR', context);
    this.name = 'KnowledgeExtractionError';
  }
}

/**
 * Error for path finding operations
 */
export class PathFindingError extends GraphError {
  constructor(
    message: string,
    sourceId: string,
    targetId: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'PATH_ERROR', { sourceId, targetId, ...context });
    this.name = 'PathFindingError';
  }
}

/**
 * Error for subgraph analysis operations
 */
export class SubgraphAnalysisError extends GraphError {
  constructor(
    message: string,
    nodeIds: string[],
    context: Record<string, unknown> = {}
  ) {
    super(message, 'ANALYSIS_ERROR', { nodeIds, ...context });
    this.name = 'SubgraphAnalysisError';
  }
}

/**
 * Error for insight extraction operations
 */
export class InsightExtractionError extends GraphError {
  constructor(
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'INSIGHT_ERROR', context);
    this.name = 'InsightExtractionError';
  }
}

/**
 * Error for node enrichment operations
 */
export class NodeEnrichmentError extends GraphError {
  constructor(
    message: string,
    nodeIds: string[],
    context: Record<string, unknown> = {}
  ) {
    super(message, 'ENRICHMENT_ERROR', { nodeIds, ...context });
    this.name = 'NodeEnrichmentError';
  }
}

/**
 * Error codes for graph operations
 */
export enum GraphErrorCode {
  // General errors
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  OPERATION_FAILED = 'OPERATION_FAILED',
  
  // Node errors
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  NODE_ALREADY_EXISTS = 'NODE_ALREADY_EXISTS',
  INVALID_NODE_TYPE = 'INVALID_NODE_TYPE',
  
  // Relationship errors
  RELATIONSHIP_NOT_FOUND = 'RELATIONSHIP_NOT_FOUND',
  INVALID_RELATIONSHIP_TYPE = 'INVALID_RELATIONSHIP_TYPE',
  SELF_RELATIONSHIP = 'SELF_RELATIONSHIP',
  
  // Algorithm errors
  PATH_NOT_FOUND = 'PATH_NOT_FOUND',
  ALGORITHM_TIMEOUT = 'ALGORITHM_TIMEOUT',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  
  // Knowledge extraction errors
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  UNSUPPORTED_LANGUAGE = 'UNSUPPORTED_LANGUAGE',
  
  // Service errors
  NLP_SERVICE_ERROR = 'NLP_SERVICE_ERROR',
  VECTOR_SERVICE_ERROR = 'VECTOR_SERVICE_ERROR',
  REPOSITORY_ERROR = 'REPOSITORY_ERROR'
} 