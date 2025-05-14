"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryCache = void 0;
/**
 * Enhanced query caching implementation
 */
var types_1 = require("../cache/types");
/**
 * Default configuration values
 */
var DEFAULT_CONFIG = {
    defaultTtl: 300000, // 5 minutes
    typeTtl: {},
    maxQueriesPerCollection: 1000,
    enablePartialResults: true,
    partialResultThreshold: 0.7,
    enableLogging: false
};
/**
 * Enhanced query cache implementation
 */
var QueryCache = /** @class */ (function () {
    /**
     * Create a new query cache
     * @param cache The cache manager to use
     * @param config Configuration options
     */
    function QueryCache(cache, config) {
        this.queryEntries = new Map();
        this.cache = cache;
        this.config = __assign(__assign({}, DEFAULT_CONFIG), config);
    }
    /**
     * Get cached query results
     * @param key Cache key
     * @returns Cached results or undefined if not found
     */
    QueryCache.prototype.get = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var entry, fullResults;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.cache.get(key)];
                    case 1:
                        entry = _a.sent();
                        if (!entry) {
                            return [2 /*return*/, undefined];
                        }
                        if (!(Date.now() > entry.expiresAt)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.cache.delete(key)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, undefined];
                    case 3:
                        if (!(this.config.enablePartialResults && entry.isPartial)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.getFullResults(entry.params)];
                    case 4:
                        fullResults = _a.sent();
                        if (!fullResults) return [3 /*break*/, 6];
                        // Update cache with full results
                        return [4 /*yield*/, this.set(key, fullResults, entry.params)];
                    case 5:
                        // Update cache with full results
                        _a.sent();
                        return [2 /*return*/, fullResults];
                    case 6: 
                    // Always return the full QueryResponse object
                    return [2 /*return*/, entry.results];
                }
            });
        });
    };
    /**
     * Set cached query results
     * @param key Cache key
     * @param results Query results to cache
     * @param params Original query parameters
     * @param ttl Optional TTL in seconds
     */
    QueryCache.prototype.set = function (key, results, params, ttl) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheTtl, entry, collectionCache, oldestKey;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheTtl = ttl || this.getTtlForQuery(params);
                        entry = {
                            results: results,
                            createdAt: Date.now(),
                            expiresAt: Date.now() + (cacheTtl * 1000),
                            tags: this.getTagsForQuery(params),
                            params: params,
                            isPartial: false
                        };
                        collectionCache = this.queryEntries.get(params.collection);
                        if (!collectionCache) {
                            collectionCache = new Map();
                            this.queryEntries.set(params.collection, collectionCache);
                        }
                        // Store in collection cache
                        collectionCache.set(key, entry);
                        // Store in main cache
                        return [4 /*yield*/, this.cache.set(key, entry, {
                                ttl: cacheTtl * 1000,
                                priority: types_1.CachePriority.MEDIUM,
                                tags: Array.from(entry.tags)
                            })];
                    case 1:
                        // Store in main cache
                        _a.sent();
                        // Enforce collection cache size limit
                        if (collectionCache.size > this.config.maxQueriesPerCollection) {
                            oldestKey = Array.from(collectionCache.entries())
                                .sort(function (a, b) { return a[1].createdAt - b[1].createdAt; })[0][0];
                            collectionCache.delete(oldestKey);
                        }
                        this.log("Cached results for query: ".concat(params.query));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Invalidate cache entries
     * @param tags Tags to invalidate
     * @param collection Optional collection to limit invalidation to
     */
    QueryCache.prototype.invalidateCache = function (tags, collection) {
        return __awaiter(this, void 0, void 0, function () {
            var collections, _i, collections_1, coll, collectionCache, entriesToDelete, _a, entriesToDelete_1, key, _b, tags_1, tag;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        collections = collection
                            ? [collection]
                            : Array.from(this.queryEntries.keys());
                        _i = 0, collections_1 = collections;
                        _c.label = 1;
                    case 1:
                        if (!(_i < collections_1.length)) return [3 /*break*/, 6];
                        coll = collections_1[_i];
                        collectionCache = this.queryEntries.get(coll);
                        if (!collectionCache)
                            return [3 /*break*/, 5];
                        entriesToDelete = Array.from(collectionCache.entries())
                            .filter(function (_a) {
                            var _ = _a[0], entry = _a[1];
                            return tags.some(function (tag) { return entry.tags.has(tag); });
                        })
                            .map(function (_a) {
                            var key = _a[0];
                            return key;
                        });
                        // Delete from collection cache
                        for (_a = 0, entriesToDelete_1 = entriesToDelete; _a < entriesToDelete_1.length; _a++) {
                            key = entriesToDelete_1[_a];
                            collectionCache.delete(key);
                        }
                        _b = 0, tags_1 = tags;
                        _c.label = 2;
                    case 2:
                        if (!(_b < tags_1.length)) return [3 /*break*/, 5];
                        tag = tags_1[_b];
                        return [4 /*yield*/, this.cache.invalidateByTag(tag)];
                    case 3:
                        _c.sent();
                        _c.label = 4;
                    case 4:
                        _b++;
                        return [3 /*break*/, 2];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6:
                        this.log("Invalidated cache entries for tags: ".concat(tags.join(', ')));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Clear the query cache
     * @param collection Optional collection to clear cache for
     */
    QueryCache.prototype.clearCache = function (collection) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!collection) return [3 /*break*/, 2];
                        this.queryEntries.delete(collection);
                        return [4 /*yield*/, this.cache.invalidateByTag("collection:".concat(collection))];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2:
                        this.queryEntries.clear();
                        return [4 /*yield*/, this.cache.clear()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        this.log("Cleared query cache".concat(collection ? " for ".concat(collection) : ''));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get cache key for a query
     * @param params Query parameters
     * @returns Cache key
     */
    QueryCache.prototype.getCacheKey = function (params) {
        var _a, _b;
        var queryStr = params.query.toLowerCase().trim();
        var filtersStr = params.filters
            ? JSON.stringify(params.filters)
            : '';
        var limitStr = ((_a = params.limit) === null || _a === void 0 ? void 0 : _a.toString()) || '';
        var minScoreStr = ((_b = params.minScore) === null || _b === void 0 ? void 0 : _b.toString()) || '';
        return "query:".concat(params.collection, ":").concat(queryStr, "|").concat(filtersStr, "|").concat(limitStr, "|").concat(minScoreStr);
    };
    /**
     * Get tags for a query
     * @param params Query parameters
     * @returns Set of tags
     */
    QueryCache.prototype.getTagsForQuery = function (params) {
        var tags = new Set([
            "collection:".concat(params.collection),
            'query'
        ]);
        // Add type-specific tags
        if (params.type) {
            tags.add("type:".concat(params.type));
        }
        // Add filter-specific tags
        if (params.filters) {
            Object.entries(params.filters).forEach(function (_a) {
                var key = _a[0], value = _a[1];
                if (typeof value === 'string' || typeof value === 'number') {
                    tags.add("filter:".concat(key, ":").concat(value));
                }
            });
        }
        return tags;
    };
    /**
     * Get TTL for a query
     * @param params Query parameters
     * @returns TTL in milliseconds
     */
    QueryCache.prototype.getTtlForQuery = function (params) {
        if (params.type && this.config.typeTtl[params.type]) {
            return this.config.typeTtl[params.type];
        }
        return this.config.defaultTtl;
    };
    /**
     * Get full results for a query
     * This is a placeholder for the actual implementation
     * @param params Query parameters
     * @returns Full query results or undefined
     */
    QueryCache.prototype.getFullResults = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // TODO: Implement actual query execution
                // This would typically call the query optimizer or memory service
                return [2 /*return*/, undefined];
            });
        });
    };
    /**
     * Log a message if logging is enabled
     * @param message Message to log
     */
    QueryCache.prototype.log = function (message) {
        if (this.config.enableLogging) {
            console.log("[QueryCache] ".concat(message));
        }
    };
    /**
     * Generate a cache key for query parameters
     * @param params Query parameters
     * @returns Cache key
     */
    QueryCache.prototype.generateKey = function (params) {
        return this.getCacheKey(params);
    };
    return QueryCache;
}());
exports.QueryCache = QueryCache;
