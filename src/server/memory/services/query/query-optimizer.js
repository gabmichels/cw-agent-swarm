"use strict";
/**
 * Query Optimizer for Memory System
 *
 * Optimizes memory queries for performance and relevance using various strategies.
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryOptimizer = void 0;
var base_1 = require("../../../../lib/errors/base");
var ulid_1 = require("../../../../utils/ulid");
var types_1 = require("./types");
var query_cache_1 = require("./query-cache");
var query_performance_1 = require("./query-performance");
/**
 * Default configuration for the query optimizer
 */
var DEFAULT_CONFIG = {
    defaultStrategy: types_1.QueryOptimizationStrategy.BALANCED,
    defaultLimit: 10,
    defaultMinScore: 0.6,
    timeoutMs: 1000,
    enableCaching: true,
    cacheTtlSeconds: 300 // 5 minutes
};
/**
 * Query optimizer
 */
var QueryOptimizer = /** @class */ (function () {
    /**
     * Create a new query optimizer
     * @param vectorDb Vector database client
     * @param filterBuilder Filter builder for query conditions
     * @param embeddingService Service for creating embeddings
     * @param cacheManager Cache manager instance
     * @param config Configuration options
     */
    function QueryOptimizer(vectorDb, filterBuilder, embeddingService, cacheManager, config) {
        if (config === void 0) { config = DEFAULT_CONFIG; }
        this.vectorDb = vectorDb;
        this.filterBuilder = filterBuilder;
        this.embeddingService = embeddingService;
        this.cacheManager = cacheManager;
        this.config = config;
        /**
         * Query patterns for optimization
         */
        this.queryPatterns = new Map([
            [/^(who|what|when|where|why|how).{3,}/i, types_1.QueryOptimizationStrategy.HIGH_QUALITY],
            [/^(list|find|search|get|show|display).{3,}/i, types_1.QueryOptimizationStrategy.HIGH_SPEED],
            [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, types_1.QueryOptimizationStrategy.HIGH_SPEED]
        ]);
        this.queryCache = new query_cache_1.QueryCache(cacheManager, {
            defaultTtl: config.cacheTtlSeconds * 1000,
            enableLogging: true
        });
        this.performanceMonitor = new query_performance_1.QueryPerformanceMonitor({
            enableDetailedMetrics: true,
            alertThresholds: {
                maxExecutionTimeMs: 2000, // 2 seconds
                minCacheHitRate: 0.7,
                maxMemoryUsageBytes: 52428800 // 50MB
            }
        });
    }
    /**
     * Execute a query with optimization
     * @param params Query parameters
     * @param strategy Optional optimization strategy
     * @returns Query response
     */
    QueryOptimizer.prototype.query = function (params_1) {
        return __awaiter(this, arguments, void 0, function (params, strategy) {
            var startTime, cacheKey, cachedResults, results, error_1;
            if (strategy === void 0) { strategy = this.config.defaultStrategy; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        cacheKey = this.queryCache.generateKey(params);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        if (!this.config.enableCaching) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.queryCache.get(cacheKey)];
                    case 2:
                        cachedResults = _a.sent();
                        if (cachedResults) {
                            // If cachedResults is an array, wrap it in a QueryResponse object
                            if (Array.isArray(cachedResults)) {
                                return [2 /*return*/, {
                                        results: cachedResults,
                                        totalMatches: cachedResults.length,
                                        truncated: false,
                                        executionTimeMs: 0
                                    }];
                            }
                            return [2 /*return*/, cachedResults];
                        }
                        _a.label = 3;
                    case 3: return [4 /*yield*/, this.executeQueryWithStrategy(params, strategy)];
                    case 4:
                        results = _a.sent();
                        if (!this.config.enableCaching) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.queryCache.set(cacheKey, results, params)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [2 /*return*/, results];
                    case 7:
                        error_1 = _a.sent();
                        // Preserve timeout errors
                        if (error_1 instanceof base_1.AppError && error_1.code === types_1.QueryErrorCode.EXECUTION_TIMEOUT) {
                            throw error_1;
                        }
                        // Pass through known AppErrors
                        if (error_1 instanceof base_1.AppError) {
                            if (error_1.code === types_1.QueryErrorCode.FILTER_ERROR) {
                                throw error_1;
                            }
                        }
                        // Handle optimization errors
                        if (error_1 instanceof Error && error_1.message.includes('DB error')) {
                            throw new base_1.AppError(types_1.QueryErrorCode.OPTIMIZATION_FAILED, 'QUERY_OPTIMIZATION_FAILED');
                        }
                        // Wrap other errors
                        throw new base_1.AppError(types_1.QueryErrorCode.OPTIMIZATION_FAILED, "Query execution failed: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)));
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute a query with given parameters and optimization strategy
     * @param params Query parameters
     * @param strategy Optimization strategy
     * @returns Query response
     */
    QueryOptimizer.prototype.executeQueryWithStrategy = function (params, strategy) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, timeoutHandle, timedOut, timeoutPromise, embeddings, vectorDbFilter, qdrantFilter, optimizedParams, searchPromise, searchResults, results, error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        timedOut = false;
                        timeoutPromise = new Promise(function (_, reject) {
                            timeoutHandle = setTimeout(function () {
                                timedOut = true;
                                reject(new base_1.AppError("TIMEOUT_ERROR: Query execution timed out after ".concat(_this.config.timeoutMs, "ms"), types_1.QueryErrorCode.EXECUTION_TIMEOUT));
                            }, _this.config.timeoutMs);
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.embeddingService.embedText(params.query)];
                    case 2:
                        embeddings = _a.sent();
                        vectorDbFilter = void 0;
                        if (params.filters) {
                            qdrantFilter = this.filterBuilder.build(params.filters);
                            // Convert QdrantFilter to Record<string, unknown> safely
                            vectorDbFilter = JSON.parse(JSON.stringify(qdrantFilter));
                        }
                        else {
                            vectorDbFilter = {};
                        }
                        optimizedParams = this.applyOptimizationStrategy(params, embeddings, vectorDbFilter, strategy);
                        searchPromise = this.vectorDb.search(params.collection, embeddings, optimizedParams.limit, optimizedParams.filter || {}, optimizedParams.scoreThreshold);
                        return [4 /*yield*/, Promise.race([searchPromise, timeoutPromise])];
                    case 3:
                        searchResults = _a.sent();
                        results = {
                            results: searchResults.matches.map(function (match) { return ({
                                id: ulid_1.IdGenerator.parse(match.id) || ulid_1.IdGenerator.generate('memory'),
                                text: match.payload.text,
                                score: match.score,
                                metadata: match.payload
                            }); }),
                            totalMatches: searchResults.totalCount,
                            truncated: searchResults.totalCount > optimizedParams.limit,
                            executionTimeMs: Date.now() - startTime
                        };
                        return [2 /*return*/, results];
                    case 4:
                        error_2 = _a.sent();
                        if (error_2 instanceof base_1.AppError && error_2.code === types_1.QueryErrorCode.EXECUTION_TIMEOUT) {
                            throw error_2;
                        }
                        // Wrap other errors
                        throw new base_1.AppError(types_1.QueryErrorCode.OPTIMIZATION_FAILED, "Query execution failed: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)));
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Estimate memory usage of query results
     * @param response Query response
     * @returns Estimated memory usage in bytes
     */
    QueryOptimizer.prototype.estimateMemoryUsage = function (response) {
        return response.results.reduce(function (total, result) {
            var resultSize = JSON.stringify(result).length;
            return total + resultSize;
        }, 0);
    };
    /**
     * Search wrapper for vector database
     */
    QueryOptimizer.prototype.search = function (collectionName, vector, limit, filter, scoreThreshold) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Call adapter's search method
                return [2 /*return*/, this.vectorDb.search(collectionName, vector, limit, filter, scoreThreshold)];
            });
        });
    };
    /**
     * Generate query suggestions based on partial input
     *
     * @param partialQuery Partial query text
     * @param collection Collection to generate suggestions for
     * @param limit Maximum number of suggestions
     * @returns Array of query suggestions
     */
    QueryOptimizer.prototype.suggestQueries = function (partialQuery_1, collection_1) {
        return __awaiter(this, arguments, void 0, function (partialQuery, collection, limit) {
            var embedding, searchResults, suggestions, _i, _a, match, originalQuery, error_3;
            if (limit === void 0) { limit = 5; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!partialQuery || partialQuery.length < 3) {
                            return [2 /*return*/, []];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.embeddingService.embedText(partialQuery)];
                    case 2:
                        embedding = _b.sent();
                        return [4 /*yield*/, this.search(collection, embedding, limit, undefined, 0.5)];
                    case 3:
                        searchResults = _b.sent();
                        suggestions = new Set();
                        for (_i = 0, _a = searchResults.matches; _i < _a.length; _i++) {
                            match = _a[_i];
                            originalQuery = match.payload.originalQuery;
                            if (originalQuery) {
                                suggestions.add(originalQuery);
                            }
                        }
                        return [2 /*return*/, Array.from(suggestions).slice(0, limit)];
                    case 4:
                        error_3 = _b.sent();
                        console.error('Failed to generate query suggestions:', error_3);
                        return [2 /*return*/, []]; // Return empty array rather than failing
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Analyze a query to determine the best optimization strategy
     *
     * @param query Query text to analyze
     * @returns Recommended optimization strategy
     */
    QueryOptimizer.prototype.analyzeQuery = function (query) {
        return this.determineStrategy(query);
    };
    /**
     * Clear the query cache
     *
     * @param collection Optional collection to clear cache for
     * @returns Whether the operation was successful
     */
    QueryOptimizer.prototype.clearCache = function (collection) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.queryCache.clearCache(collection)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    /**
     * Determine the best optimization strategy for a query
     *
     * @param query Query text
     * @returns Optimization strategy
     */
    QueryOptimizer.prototype.determineStrategy = function (query) {
        // Default to the configured default strategy
        var strategy = this.config.defaultStrategy;
        // Check if query matches any known patterns
        var patterns = Array.from(this.queryPatterns.keys());
        for (var _i = 0, patterns_1 = patterns; _i < patterns_1.length; _i++) {
            var pattern = patterns_1[_i];
            if (pattern.test(query)) {
                strategy = this.queryPatterns.get(pattern) || strategy;
                break;
            }
        }
        // Special case: Short queries typically benefit from HIGH_SPEED
        if (query.length < 10 && strategy === types_1.QueryOptimizationStrategy.BALANCED) {
            strategy = types_1.QueryOptimizationStrategy.HIGH_SPEED;
        }
        // Special case: Complex queries typically benefit from HIGH_QUALITY
        if (query.split(' ').length > 15 && strategy === types_1.QueryOptimizationStrategy.BALANCED) {
            strategy = types_1.QueryOptimizationStrategy.HIGH_QUALITY;
        }
        return strategy;
    };
    /**
     * Merge query parameters with defaults
     *
     * @param params Original query parameters
     * @returns Merged parameters with defaults
     */
    QueryOptimizer.prototype.mergeQueryDefaults = function (params) {
        var _a, _b;
        return __assign(__assign({}, params), { limit: (_a = params.limit) !== null && _a !== void 0 ? _a : this.config.defaultLimit, minScore: (_b = params.minScore) !== null && _b !== void 0 ? _b : this.config.defaultMinScore });
    };
    /**
     * Apply optimization strategy to query parameters
     */
    QueryOptimizer.prototype.applyOptimizationStrategy = function (params, embedding, filter, strategy) {
        var _a, _b;
        // Initialize with default values
        var limit = (_a = params.limit) !== null && _a !== void 0 ? _a : this.config.defaultLimit;
        var scoreThreshold = (_b = params.minScore) !== null && _b !== void 0 ? _b : this.config.defaultMinScore;
        // Apply strategy-specific optimizations
        switch (strategy) {
            case types_1.QueryOptimizationStrategy.HIGH_QUALITY:
                // Increase results and threshold for better quality
                limit = Math.min(Math.ceil(limit * 1.5), 50); // Cap at 50 results
                scoreThreshold = Math.max(0.7, scoreThreshold);
                // Add stricter filter conditions if available
                if (filter) {
                    filter = __assign(__assign({}, filter), { must: __spreadArray(__spreadArray([], (filter.must || []), true), [
                            { key: 'score', range: { gte: scoreThreshold } }
                        ], false) });
                }
                break;
            case types_1.QueryOptimizationStrategy.HIGH_SPEED:
                // Optimize for speed with tighter limits
                limit = Math.min(limit, 20);
                scoreThreshold = Math.min(0.5, scoreThreshold);
                // Simplify filter conditions if available
                if (filter && filter.must && filter.must.length > 2) {
                    filter = __assign(__assign({}, filter), { must: filter.must.slice(0, 2) // Keep only the most important conditions
                     });
                }
                break;
            case types_1.QueryOptimizationStrategy.CONTEXT_AWARE:
                // Dynamic adjustment based on embedding characteristics
                var embeddingMagnitude = Math.sqrt(embedding.reduce(function (sum, val) { return sum + val * val; }, 0));
                if (embeddingMagnitude > 1.2) {
                    // More specific query, use higher threshold and smaller limit
                    scoreThreshold = Math.max(0.65, scoreThreshold);
                    limit = Math.min(limit, 15);
                    // Add strict filter conditions
                    if (filter) {
                        filter = __assign(__assign({}, filter), { must: __spreadArray(__spreadArray([], (filter.must || []), true), [
                                { key: 'score', range: { gte: scoreThreshold } }
                            ], false) });
                    }
                }
                else if (embeddingMagnitude < 0.8) {
                    // Less specific query, use lower threshold but more results
                    scoreThreshold = Math.min(0.55, scoreThreshold);
                    limit = Math.min(Math.ceil(limit * 1.2), 30);
                    // Simplify filter conditions
                    if (filter && filter.must && filter.must.length > 1) {
                        filter = __assign(__assign({}, filter), { must: filter.must.slice(0, 1) // Keep only the most important condition
                         });
                    }
                }
                else {
                    // Balanced approach for medium specificity
                    scoreThreshold = Math.max(0.6, Math.min(0.7, scoreThreshold));
                    limit = Math.min(Math.ceil(limit * 1.1), 25);
                }
                break;
            // BALANCED is the default, use the parameters as provided
            default:
                // Ensure reasonable defaults for balanced strategy
                limit = Math.min(Math.max(limit, 5), 30); // Between 5 and 30 results
                scoreThreshold = Math.max(0.6, Math.min(0.8, scoreThreshold)); // Between 0.6 and 0.8
                break;
        }
        return {
            limit: limit,
            filter: filter,
            scoreThreshold: scoreThreshold
        };
    };
    /**
     * Create a timeout promise
     *
     * @returns Promise that rejects after timeout
     */
    QueryOptimizer.prototype.createTimeout = function () {
        var _this = this;
        if (!this.config.timeoutMs || this.config.timeoutMs <= 0) {
            return new Promise(function () { }); // Never timeout
        }
        return new Promise(function (_, reject) {
            setTimeout(function () {
                reject(new base_1.AppError(types_1.QueryErrorCode.EXECUTION_TIMEOUT, "Query execution timed out after ".concat(_this.config.timeoutMs, "ms")));
            }, _this.config.timeoutMs);
        });
    };
    return QueryOptimizer;
}());
exports.QueryOptimizer = QueryOptimizer;
