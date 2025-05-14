"use strict";
/**
 * Query Optimization Layer
 *
 * Provides optimized query capabilities for memory retrieval, focusing on
 * performance and relevance for vector database operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryErrorCode = exports.QueryOptimizationStrategy = void 0;
/**
 * Query optimization strategies
 */
var QueryOptimizationStrategy;
(function (QueryOptimizationStrategy) {
    /**
     * Balance between speed and recall
     */
    QueryOptimizationStrategy["BALANCED"] = "balanced";
    /**
     * Prioritize recall/quality over speed
     */
    QueryOptimizationStrategy["HIGH_QUALITY"] = "high_quality";
    /**
     * Prioritize speed over recall/quality
     */
    QueryOptimizationStrategy["HIGH_SPEED"] = "high_speed";
    /**
     * Context-aware (adapts based on query characteristics)
     */
    QueryOptimizationStrategy["CONTEXT_AWARE"] = "context_aware";
})(QueryOptimizationStrategy || (exports.QueryOptimizationStrategy = QueryOptimizationStrategy = {}));
/**
 * Error codes for query optimization operations
 */
var QueryErrorCode;
(function (QueryErrorCode) {
    QueryErrorCode["INVALID_QUERY"] = "QUERY_INVALID_QUERY";
    QueryErrorCode["COLLECTION_NOT_FOUND"] = "QUERY_COLLECTION_NOT_FOUND";
    QueryErrorCode["EXECUTION_TIMEOUT"] = "QUERY_EXECUTION_TIMEOUT";
    QueryErrorCode["EMBEDDING_FAILED"] = "QUERY_EMBEDDING_FAILED";
    QueryErrorCode["FILTER_ERROR"] = "QUERY_FILTER_ERROR";
    QueryErrorCode["OPTIMIZATION_FAILED"] = "QUERY_OPTIMIZATION_FAILED";
})(QueryErrorCode || (exports.QueryErrorCode = QueryErrorCode = {}));
