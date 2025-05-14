"use strict";
/**
 * Query Performance Monitoring and Optimization
 *
 * Provides monitoring, analysis, and optimization for query performance.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryPerformanceMonitor = void 0;
var types_1 = require("./types");
/**
 * Default configuration
 */
var DEFAULT_CONFIG = {
    enableDetailedMetrics: true,
    metricsRetentionMs: 86400000, // 24 hours
    alertThresholds: {
        maxExecutionTimeMs: 1000,
        minCacheHitRate: 0.8,
        maxMemoryUsageBytes: 10485760 // 10MB
    },
    enableAutoOptimization: true
};
/**
 * Query performance monitor
 */
var QueryPerformanceMonitor = /** @class */ (function () {
    /**
     * Create a new query performance monitor
     * @param config Configuration options
     */
    function QueryPerformanceMonitor(config) {
        this.metrics = new Map();
        this.config = __assign(__assign({}, DEFAULT_CONFIG), config);
        this.startCleanupInterval();
    }
    /**
     * Record query performance metrics
     * @param params Query parameters
     * @param response Query response
     * @param metrics Performance metrics
     */
    QueryPerformanceMonitor.prototype.recordMetrics = function (params, response, metrics) {
        var key = this.getMetricsKey(params);
        var fullMetrics = __assign(__assign({}, metrics), { complexityScore: this.calculateQueryComplexity(params), filterComplexityScore: this.calculateFilterComplexity(params) });
        var collectionMetrics = this.metrics.get(params.collection) || [];
        collectionMetrics.push(fullMetrics);
        this.metrics.set(params.collection, collectionMetrics);
        this.checkAlerts(params, fullMetrics);
    };
    /**
     * Analyze query performance
     * @param params Query parameters
     * @returns Performance analysis
     */
    QueryPerformanceMonitor.prototype.analyzeQuery = function (params) {
        var metrics = this.getMetricsForQuery(params);
        var pattern = this.classifyQueryPattern(params, metrics);
        var bottlenecks = this.identifyBottlenecks(metrics);
        var suggestions = this.generateOptimizationSuggestions(pattern, bottlenecks);
        return {
            pattern: pattern,
            recommendedStrategy: this.recommendStrategy(pattern, metrics),
            bottlenecks: bottlenecks,
            suggestions: suggestions
        };
    };
    /**
     * Get performance metrics for a query
     * @param params Query parameters
     * @returns Array of metrics
     */
    QueryPerformanceMonitor.prototype.getMetricsForQuery = function (params) {
        var key = this.getMetricsKey(params);
        return this.metrics.get(params.collection) || [];
    };
    /**
     * Get performance statistics for a collection
     * @param collection Collection name
     * @returns Performance statistics
     */
    QueryPerformanceMonitor.prototype.getCollectionStats = function (collection) {
        var metrics = this.metrics.get(collection) || [];
        if (metrics.length === 0) {
            return {
                avgExecutionTimeMs: 0,
                cacheHitRate: 0,
                avgResultCount: 0,
                commonBottlenecks: []
            };
        }
        var cacheHits = metrics.filter(function (m) { return m.cacheStatus === 'hit'; }).length;
        var totalQueries = metrics.length;
        return {
            avgExecutionTimeMs: metrics.reduce(function (sum, m) { return sum + m.executionTimeMs; }, 0) / totalQueries,
            cacheHitRate: cacheHits / totalQueries,
            avgResultCount: metrics.reduce(function (sum, m) { return sum + m.resultCount; }, 0) / totalQueries,
            commonBottlenecks: this.getCommonBottlenecks(metrics)
        };
    };
    /**
     * Clear old metrics
     */
    QueryPerformanceMonitor.prototype.clearOldMetrics = function () {
        var cutoffTime = Date.now() - this.config.metricsRetentionMs;
        for (var _i = 0, _a = Array.from(this.metrics.entries()); _i < _a.length; _i++) {
            var _b = _a[_i], collection = _b[0], metrics = _b[1];
            var filteredMetrics = metrics.filter(function (m) { return m.executionTimeMs > cutoffTime; });
            if (filteredMetrics.length === 0) {
                this.metrics.delete(collection);
            }
            else {
                this.metrics.set(collection, filteredMetrics);
            }
        }
    };
    /**
     * Start metrics cleanup interval
     */
    QueryPerformanceMonitor.prototype.startCleanupInterval = function () {
        var _this = this;
        // Clean up old metrics every hour
        setInterval(function () { return _this.clearOldMetrics(); }, 3600000);
    };
    /**
     * Get metrics key for a query
     */
    QueryPerformanceMonitor.prototype.getMetricsKey = function (params) {
        return "".concat(params.collection, ":").concat(params.query, ":").concat(params.type || 'any');
    };
    /**
     * Calculate query complexity score
     */
    QueryPerformanceMonitor.prototype.calculateQueryComplexity = function (params) {
        var words = params.query.split(/\s+/).length;
        var hasFilters = params.filters && Object.keys(params.filters).length > 0;
        var hasType = !!params.type;
        // Simple scoring based on query characteristics
        var score = 0;
        score += Math.min(words / 10, 1) * 0.4; // Word count contribution
        score += (hasFilters ? 0.3 : 0); // Filter contribution
        score += (hasType ? 0.3 : 0); // Type filter contribution
        return Math.min(score, 1);
    };
    /**
     * Calculate filter complexity score
     */
    QueryPerformanceMonitor.prototype.calculateFilterComplexity = function (params) {
        if (!params.filters)
            return 0;
        var filterCount = Object.keys(params.filters).length;
        var valueComplexity = Object.values(params.filters).reduce(function (sum, value) {
            if (Array.isArray(value))
                return sum + value.length;
            if (typeof value === 'object' && value !== null)
                return sum + 2;
            return sum + 1;
        }, 0);
        return Math.min((filterCount * 0.3 + valueComplexity * 0.7) / 10, 1);
    };
    /**
     * Classify query pattern
     */
    QueryPerformanceMonitor.prototype.classifyQueryPattern = function (params, metrics) {
        var complexityScore = this.calculateQueryComplexity(params);
        var filterScore = this.calculateFilterComplexity(params);
        if (filterScore > 0.7)
            return 'filter-heavy';
        if (complexityScore > 0.7)
            return 'complex';
        if (metrics.some(function (m) { return m.resultCount > 100; }))
            return 'result-heavy';
        return 'simple';
    };
    /**
     * Identify performance bottlenecks
     */
    QueryPerformanceMonitor.prototype.identifyBottlenecks = function (metrics) {
        var bottlenecks = [];
        var thresholds = this.config.alertThresholds;
        // Check execution time
        if (metrics.some(function (m) { return m.executionTimeMs > thresholds.maxExecutionTimeMs; })) {
            bottlenecks.push('high_execution_time');
        }
        // Check memory usage
        if (metrics.some(function (m) { return m.memoryUsageBytes > thresholds.maxMemoryUsageBytes; })) {
            bottlenecks.push('high_memory_usage');
        }
        // Check cache hit rate
        var cacheHits = metrics.filter(function (m) { return m.cacheStatus === 'hit'; }).length;
        var hitRate = cacheHits / metrics.length;
        if (hitRate < thresholds.minCacheHitRate) {
            bottlenecks.push('low_cache_hit_rate');
        }
        return bottlenecks;
    };
    /**
     * Get common bottlenecks from metrics
     */
    QueryPerformanceMonitor.prototype.getCommonBottlenecks = function (metrics) {
        var bottlenecks = new Map();
        for (var _i = 0, metrics_1 = metrics; _i < metrics_1.length; _i++) {
            var metric = metrics_1[_i];
            var metricBottlenecks = this.identifyBottlenecks([metric]);
            for (var _a = 0, metricBottlenecks_1 = metricBottlenecks; _a < metricBottlenecks_1.length; _a++) {
                var bottleneck = metricBottlenecks_1[_a];
                bottlenecks.set(bottleneck, (bottlenecks.get(bottleneck) || 0) + 1);
            }
        }
        return Array.from(bottlenecks.entries())
            .filter(function (_a) {
            var _ = _a[0], count = _a[1];
            return count > metrics.length * 0.2;
        }) // Bottlenecks in >20% of queries
            .map(function (_a) {
            var bottleneck = _a[0];
            return bottleneck;
        });
    };
    /**
     * Recommend optimization strategy
     */
    QueryPerformanceMonitor.prototype.recommendStrategy = function (pattern, metrics) {
        switch (pattern) {
            case 'simple':
                return types_1.QueryOptimizationStrategy.HIGH_SPEED;
            case 'complex':
                return types_1.QueryOptimizationStrategy.HIGH_QUALITY;
            case 'filter-heavy':
                return metrics.some(function (m) { return m.executionTimeMs > 500; })
                    ? types_1.QueryOptimizationStrategy.HIGH_SPEED
                    : types_1.QueryOptimizationStrategy.BALANCED;
            case 'result-heavy':
                return types_1.QueryOptimizationStrategy.BALANCED;
            default:
                return types_1.QueryOptimizationStrategy.BALANCED;
        }
    };
    /**
     * Generate optimization suggestions
     */
    QueryPerformanceMonitor.prototype.generateOptimizationSuggestions = function (pattern, bottlenecks) {
        var suggestions = [];
        // Pattern-based suggestions
        switch (pattern) {
            case 'complex':
                suggestions.push('Consider splitting complex queries into simpler ones');
                suggestions.push('Use more specific filters to reduce result set size');
                break;
            case 'filter-heavy':
                suggestions.push('Optimize filter conditions for better performance');
                suggestions.push('Consider using composite filters');
                break;
            case 'result-heavy':
                suggestions.push('Implement pagination for large result sets');
                suggestions.push('Consider using more specific filters');
                break;
        }
        // Bottleneck-based suggestions
        if (bottlenecks.includes('high_execution_time')) {
            suggestions.push('Consider using HIGH_SPEED optimization strategy');
            suggestions.push('Implement query caching for frequently used queries');
        }
        if (bottlenecks.includes('high_memory_usage')) {
            suggestions.push('Implement result set size limits');
            suggestions.push('Consider using streaming for large result sets');
        }
        if (bottlenecks.includes('low_cache_hit_rate')) {
            suggestions.push('Review cache invalidation strategy');
            suggestions.push('Consider implementing query pattern-based caching');
        }
        return suggestions;
    };
    /**
     * Check and trigger performance alerts
     */
    QueryPerformanceMonitor.prototype.checkAlerts = function (params, metrics) {
        var thresholds = this.config.alertThresholds;
        var alerts = [];
        if (metrics.executionTimeMs > thresholds.maxExecutionTimeMs) {
            alerts.push("Query execution time (".concat(metrics.executionTimeMs, "ms) exceeded threshold (").concat(thresholds.maxExecutionTimeMs, "ms)"));
        }
        if (metrics.memoryUsageBytes > thresholds.maxMemoryUsageBytes) {
            alerts.push("Query memory usage (".concat(metrics.memoryUsageBytes, " bytes) exceeded threshold (").concat(thresholds.maxMemoryUsageBytes, " bytes)"));
        }
        if (alerts.length > 0) {
            // TODO: Implement proper alert handling
            console.warn("[QueryPerformance] Alerts for query ".concat(params.query, ":"), alerts);
        }
    };
    return QueryPerformanceMonitor;
}());
exports.QueryPerformanceMonitor = QueryPerformanceMonitor;
