"use strict";
/**
 * Type definitions for memory system caching
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheWarmingTrigger = exports.CacheWarmingStrategy = exports.CachePriority = void 0;
/**
 * Priority levels for cache entries
 */
var CachePriority;
(function (CachePriority) {
    CachePriority[CachePriority["LOW"] = 0] = "LOW";
    CachePriority[CachePriority["MEDIUM"] = 1] = "MEDIUM";
    CachePriority[CachePriority["HIGH"] = 2] = "HIGH";
    CachePriority[CachePriority["CRITICAL"] = 3] = "CRITICAL";
})(CachePriority || (exports.CachePriority = CachePriority = {}));
/**
 * Cache warming strategy types
 */
var CacheWarmingStrategy;
(function (CacheWarmingStrategy) {
    CacheWarmingStrategy["FREQUENT_ACCESS"] = "frequent_access";
    CacheWarmingStrategy["RECENT_ACCESS"] = "recent_access";
    CacheWarmingStrategy["GRAPH_RELATED"] = "graph_related";
    CacheWarmingStrategy["TIME_BASED"] = "time_based";
    CacheWarmingStrategy["PATTERN_BASED"] = "pattern_based";
})(CacheWarmingStrategy || (exports.CacheWarmingStrategy = CacheWarmingStrategy = {}));
/**
 * Cache warming trigger types
 */
var CacheWarmingTrigger;
(function (CacheWarmingTrigger) {
    CacheWarmingTrigger["ACCESS_PATTERN"] = "access_pattern";
    CacheWarmingTrigger["SCHEDULED"] = "scheduled";
    CacheWarmingTrigger["STARTUP"] = "startup";
    CacheWarmingTrigger["MANUAL"] = "manual";
})(CacheWarmingTrigger || (exports.CacheWarmingTrigger = CacheWarmingTrigger = {}));
