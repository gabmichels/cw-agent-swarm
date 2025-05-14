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
exports.SearchService = void 0;
/**
 * Search service implementation
 */
var config_1 = require("../../config");
var utils_1 = require("../../utils");
var types_1 = require("../query/types");
/**
 * Service for searching across memory collections
 */
var SearchService = /** @class */ (function () {
    /**
     * Create a new search service
     */
    function SearchService(client, embeddingService, memoryService, options) {
        this.queryOptimizer = null;
        this.client = client;
        this.embeddingService = embeddingService;
        this.memoryService = memoryService;
        if (options === null || options === void 0 ? void 0 : options.queryOptimizer) {
            this.queryOptimizer = options.queryOptimizer;
        }
    }
    /**
     * Helper method to safely get collection name from memory type
     */
    SearchService.prototype.getCollectionNameForType = function (type) {
        // Use indexing with type assertion to avoid the "Property 'message' does not exist" error
        return config_1.COLLECTION_NAMES[type] || '';
    };
    /**
     * Set the query optimizer for optimized searches
     *
     * @param optimizer Query optimizer instance
     */
    SearchService.prototype.setQueryOptimizer = function (optimizer) {
        this.queryOptimizer = optimizer;
    };
    /**
     * Search across all or specified memory types
     */
    SearchService.prototype.search = function (query_1) {
        return __awaiter(this, arguments, void 0, function (query, options) {
            var _a, types, _b, limit, filter, collectionsToSearch, validCollections, type, collectionName_1, strategy, queryResponse, error_1, embeddingResult, vector, results, missingCollections, _loop_1, this_1, _i, validCollections_1, collectionName, error_2;
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 11, , 12]);
                        _a = options.types, types = _a === void 0 ? [] : _a, _b = options.limit, limit = _b === void 0 ? 10 : _b, filter = options.filter;
                        // Check if this is a causal chain search request
                        if (options.maxDepth !== undefined || options.direction || options.analyze) {
                            // Handle causal chain search as a special case
                            // For now, return regular search results since actual causal chain 
                            // functionality will be implemented in a future update
                            console.log('Causal chain search requested - using standard search as fallback');
                        }
                        collectionsToSearch = types.length > 0
                            ? types.map(function (type) { return _this.getCollectionNameForType(type); })
                            : Object.values(config_1.COLLECTION_NAMES);
                        validCollections = collectionsToSearch.filter(function (name) { return !!name; });
                        if (validCollections.length === 0) {
                            console.warn('No valid collections to search');
                            return [2 /*return*/, []];
                        }
                        if (!(this.queryOptimizer && types.length === 1)) return [3 /*break*/, 5];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 4, , 5]);
                        type = types[0];
                        collectionName_1 = this.getCollectionNameForType(type);
                        if (!collectionName_1) return [3 /*break*/, 3];
                        console.log("Using query optimizer for ".concat(collectionName_1));
                        strategy = options.highQuality
                            ? types_1.QueryOptimizationStrategy.HIGH_QUALITY
                            : options.highSpeed
                                ? types_1.QueryOptimizationStrategy.HIGH_SPEED
                                : undefined;
                        return [4 /*yield*/, this.queryOptimizer.query({
                                query: query,
                                collection: collectionName_1,
                                limit: limit,
                                minScore: options.minScore
                            }, strategy)];
                    case 2:
                        queryResponse = _c.sent();
                        // Map query results to search results
                        return [2 /*return*/, queryResponse.results.map(function (item) {
                                var type = _this.getTypeFromCollectionName(collectionName_1);
                                return {
                                    point: {
                                        id: item.id,
                                        vector: [],
                                        payload: item.metadata
                                    },
                                    score: item.score,
                                    type: type,
                                    collection: collectionName_1
                                };
                            })];
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_1 = _c.sent();
                        console.warn('Query optimizer failed, falling back to standard search:', error_1);
                        return [3 /*break*/, 5];
                    case 5: return [4 /*yield*/, this.embeddingService.getEmbedding(query)];
                    case 6:
                        embeddingResult = _c.sent();
                        vector = embeddingResult.embedding;
                        results = [];
                        missingCollections = [];
                        _loop_1 = function (collectionName) {
                            var collectionExists, collectionResults, type_1, mappedResults, error_3, errorMessage, isNotFoundError;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        if (!collectionName)
                                            return [2 /*return*/, "continue"];
                                        _d.label = 1;
                                    case 1:
                                        _d.trys.push([1, 4, , 5]);
                                        return [4 /*yield*/, this_1.client.collectionExists(collectionName)];
                                    case 2:
                                        collectionExists = _d.sent();
                                        if (!collectionExists) {
                                            missingCollections.push(collectionName);
                                            console.warn("Collection ".concat(collectionName, " does not exist, skipping search"));
                                            return [2 /*return*/, "continue"];
                                        }
                                        return [4 /*yield*/, this_1.client.searchPoints(collectionName, {
                                                vector: vector,
                                                limit: limit,
                                                filter: filter ? this_1.buildQdrantFilter(filter) : undefined
                                            })];
                                    case 3:
                                        collectionResults = _d.sent();
                                        type_1 = this_1.getTypeFromCollectionName(collectionName);
                                        if (collectionResults.length > 0 && type_1) {
                                            mappedResults = collectionResults.map(function (result) { return ({
                                                point: {
                                                    id: result.id,
                                                    vector: [],
                                                    payload: result.payload
                                                },
                                                score: result.score,
                                                type: type_1,
                                                collection: collectionName
                                            }); });
                                            results.push.apply(results, mappedResults);
                                        }
                                        return [3 /*break*/, 5];
                                    case 4:
                                        error_3 = _d.sent();
                                        errorMessage = error_3 instanceof Error ? error_3.message : String(error_3);
                                        isNotFoundError = errorMessage.includes('not found') ||
                                            errorMessage.includes('404') ||
                                            errorMessage.includes('does not exist');
                                        if (isNotFoundError) {
                                            missingCollections.push(collectionName);
                                            console.warn("Collection ".concat(collectionName, " not found or inaccessible, skipping search"));
                                        }
                                        else {
                                            console.error("Error searching collection ".concat(collectionName, ":"), error_3);
                                        }
                                        return [2 /*return*/, "continue"];
                                    case 5: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _i = 0, validCollections_1 = validCollections;
                        _c.label = 7;
                    case 7:
                        if (!(_i < validCollections_1.length)) return [3 /*break*/, 10];
                        collectionName = validCollections_1[_i];
                        return [5 /*yield**/, _loop_1(collectionName)];
                    case 8:
                        _c.sent();
                        _c.label = 9;
                    case 9:
                        _i++;
                        return [3 /*break*/, 7];
                    case 10:
                        // If there were missing collections, log a warning but don't fail the search
                        if (missingCollections.length > 0) {
                            console.warn("Skipped ".concat(missingCollections.length, " missing collections during search: ").concat(missingCollections.join(', ')));
                        }
                        // Sort by score descending
                        return [2 /*return*/, results.sort(function (a, b) { return b.score - a.score; })];
                    case 11:
                        error_2 = _c.sent();
                        console.error('Search error:', error_2);
                        throw error_2;
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Map from collection name back to memory type
     */
    SearchService.prototype.getTypeFromCollectionName = function (collectionName) {
        for (var _i = 0, _a = Object.entries(config_1.COLLECTION_NAMES); _i < _a.length; _i++) {
            var _b = _a[_i], type = _b[0], name_1 = _b[1];
            if (name_1 === collectionName) {
                return type;
            }
        }
        return null;
    };
    /**
     * Build a Qdrant-compatible filter from our memory filter
     */
    SearchService.prototype.buildQdrantFilter = function (filter) {
        // If filter is already in Qdrant format, return as is
        if (typeof filter === 'object' && (filter.must || filter.should || filter.must_not)) {
            return filter;
        }
        // Simple direct mapping for basic filters
        if (typeof filter === 'object') {
            var qdrantFilter_1 = {};
            // Convert filter fields to Qdrant format
            Object.entries(filter).forEach(function (_a) {
                var key = _a[0], value = _a[1];
                // Handle object values that might be complex conditions
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // Handle range conditions
                    if ('$gt' in value || '$gte' in value || '$lt' in value || '$lte' in value) {
                        qdrantFilter_1[key] = { range: value };
                    }
                    // Handle match conditions
                    else if ('$in' in value || '$nin' in value || '$eq' in value || '$ne' in value) {
                        qdrantFilter_1[key] = { match: value };
                    }
                    // Handle text conditions
                    else if ('$contains' in value || '$startsWith' in value || '$endsWith' in value) {
                        qdrantFilter_1[key] = { match: { text: value } };
                    }
                    // Default to passing through the object
                    else {
                        qdrantFilter_1[key] = value;
                    }
                }
                // Simple value becomes a match condition
                else {
                    qdrantFilter_1[key] = { match: { value: value } };
                }
            });
            // Wrap in must clause if there are conditions
            if (Object.keys(qdrantFilter_1).length > 0) {
                return { must: Object.entries(qdrantFilter_1).map(function (_a) {
                        var _b;
                        var key = _a[0], value = _a[1];
                        return (_b = {}, _b[key] = value, _b);
                    }) };
            }
        }
        // Return original filter if we couldn't transform it
        return filter;
    };
    /**
     * Search within a single memory type
     */
    SearchService.prototype.searchSingleType = function (type, vector, originalQuery, options) {
        return __awaiter(this, void 0, void 0, function () {
            var collectionName_2, results, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        collectionName_2 = this.getCollectionNameForType(type);
                        if (!collectionName_2) {
                            return [2 /*return*/, []]; // Skip invalid collections
                        }
                        return [4 /*yield*/, this.client.searchPoints(collectionName_2, {
                                vector: vector,
                                filter: options.filter,
                                limit: options.limit || config_1.DEFAULTS.DEFAULT_LIMIT,
                                offset: options.offset,
                                includeVectors: options.includeVectors,
                                scoreThreshold: options.minScore
                            })];
                    case 1:
                        results = _a.sent();
                        // Transform to standardized search results
                        return [2 /*return*/, results.map(function (result) {
                                // Create memory point from search result
                                var point = {
                                    id: result.id,
                                    vector: options.includeVectors ? [] : [], // Vector data is typically not included
                                    payload: result.payload
                                };
                                return {
                                    point: point,
                                    score: result.score,
                                    type: type,
                                    collection: collectionName_2
                                };
                            })];
                    case 2:
                        error_4 = _a.sent();
                        console.error("Error searching in ".concat(type, ":"), error_4);
                        return [2 /*return*/, []]; // Return empty array for this type instead of failing the entire search
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Perform hybrid search (combining vector search and text search)
     */
    SearchService.prototype.hybridSearch = function (query_1) {
        return __awaiter(this, arguments, void 0, function (query, options) {
            var textWeight_1, vectorWeight_1, embeddingResult, vector, vectorResults, textSearchPromises, textResultsArrays, textPoints, vectorResultsMap_1, hybridResults_1, maxScore_1, limit, error_5;
            var _this = this;
            var _a, _b;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 4, , 5]);
                        textWeight_1 = (_a = options.textWeight) !== null && _a !== void 0 ? _a : 0.3;
                        vectorWeight_1 = (_b = options.vectorWeight) !== null && _b !== void 0 ? _b : 0.7;
                        return [4 /*yield*/, this.embeddingService.getEmbedding(query)];
                    case 1:
                        embeddingResult = _c.sent();
                        vector = embeddingResult.embedding;
                        return [4 /*yield*/, this.search(query, __assign(__assign({}, options), { limit: options.limit ? options.limit * 2 : config_1.DEFAULTS.DEFAULT_LIMIT * 2 // Get more results to rerank
                             }))];
                    case 2:
                        vectorResults = _c.sent();
                        textSearchPromises = (options.types || Object.values(config_1.MemoryType)).map(function (type) {
                            var memType = type;
                            var collectionName = _this.getCollectionNameForType(memType);
                            if (!collectionName)
                                return Promise.resolve([]);
                            return _this.client.scrollPoints(collectionName, __assign(__assign({}, options.filter), { $text: { $contains: query } }), options.limit ? options.limit * 2 : config_1.DEFAULTS.DEFAULT_LIMIT * 2);
                        });
                        return [4 /*yield*/, Promise.all(textSearchPromises)];
                    case 3:
                        textResultsArrays = _c.sent();
                        textPoints = textResultsArrays.flat();
                        vectorResultsMap_1 = new Map();
                        vectorResults.forEach(function (result) {
                            vectorResultsMap_1.set(result.point.id, result);
                        });
                        hybridResults_1 = [];
                        // Process vector results first
                        vectorResults.forEach(function (result) {
                            hybridResults_1.push(__assign(__assign({}, result), { score: result.score * vectorWeight_1 // Apply vector weight
                             }));
                        });
                        // Process text results
                        textPoints.forEach(function (point) {
                            var id = point.id;
                            // If already in vector results, blend scores
                            if (vectorResultsMap_1.has(id)) {
                                var existingResult = vectorResultsMap_1.get(id);
                                var idx = hybridResults_1.findIndex(function (r) { return r.point.id === id; });
                                // Blend scores: existing vector score + text match score
                                hybridResults_1[idx].score = (existingResult.score * vectorWeight_1) + textWeight_1;
                            }
                            else {
                                // Add as new result with text match score only
                                var type = point.payload.type;
                                if (type) {
                                    var collectionName = _this.getCollectionNameForType(type);
                                    if (collectionName) {
                                        var newResult = {
                                            point: point,
                                            score: textWeight_1,
                                            type: type,
                                            collection: collectionName
                                        };
                                        hybridResults_1.push(newResult);
                                    }
                                }
                            }
                        });
                        // Normalize scores if requested
                        if (options.normalizeScores) {
                            maxScore_1 = Math.max.apply(Math, hybridResults_1.map(function (r) { return r.score; }));
                            hybridResults_1.forEach(function (result) {
                                result.score = result.score / maxScore_1;
                            });
                        }
                        // Sort by score and apply limit
                        hybridResults_1.sort(function (a, b) { return b.score - a.score; });
                        limit = options.limit || config_1.DEFAULTS.DEFAULT_LIMIT;
                        return [2 /*return*/, hybridResults_1.slice(0, limit)];
                    case 4:
                        error_5 = _c.sent();
                        console.error('Error performing hybrid search:', error_5);
                        throw (0, utils_1.handleMemoryError)(error_5, 'hybridSearch');
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Build a structured filter from options
     */
    SearchService.prototype.buildFilter = function (options) {
        var filter = {};
        // Date range filter
        if (options.startDate || options.endDate) {
            var timeRange = {};
            if (options.startDate) {
                var startTime = options.startDate instanceof Date
                    ? options.startDate.getTime()
                    : options.startDate;
                timeRange.$gte = startTime;
            }
            if (options.endDate) {
                var endTime = options.endDate instanceof Date
                    ? options.endDate.getTime()
                    : options.endDate;
                timeRange.$lte = endTime;
            }
            filter.timestamp = timeRange;
        }
        // Types filter
        if (options.types && options.types.length > 0) {
            filter.type = options.types.length === 1
                ? options.types[0]
                : { $in: options.types };
        }
        // Metadata filters
        if (options.metadata && Object.keys(options.metadata).length > 0) {
            Object.entries(options.metadata).forEach(function (_a) {
                var key = _a[0], value = _a[1];
                filter["metadata.".concat(key)] = value;
            });
        }
        // Text contains filter
        if (options.textContains) {
            if (options.exactMatch) {
                filter.$text = options.caseSensitive
                    ? { $eq: options.textContains }
                    : { $eq_ignore_case: options.textContains };
            }
            else {
                filter.$text = options.caseSensitive
                    ? { $contains: options.textContains }
                    : { $contains_ignore_case: options.textContains };
            }
        }
        return filter;
    };
    /**
     * Search for causal chain (causes and effects) related to a memory
     *
     * This is a placeholder implementation that will be replaced with actual
     * causal chain functionality in a future update. For now, it simulates
     * the causal chain API to enable existing code to work.
     *
     * @param memoryId ID of the memory to trace causal relations from
     * @param options Search options including direction and depth
     * @returns Structure with causes and effects (simulated for now)
     */
    SearchService.prototype.searchCausalChain = function (memoryId_1) {
        return __awaiter(this, arguments, void 0, function (memoryId, options) {
            var originMemory, originContent, relatedMemories, result, midPoint, i, memory, content, i, memory, content, error_6;
            var _a, _b, _c, _d;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.memoryService.getMemory({
                                id: memoryId,
                                type: config_1.MemoryType.MESSAGE // Default to message type, but will work with any type
                            })];
                    case 1:
                        originMemory = _e.sent();
                        if (!originMemory) {
                            throw new Error("Memory with ID ".concat(memoryId, " not found"));
                        }
                        originContent = originMemory.content || 'No content available';
                        return [4 /*yield*/, this.search(originContent, {
                                limit: 10,
                                types: [config_1.MemoryType.THOUGHT, config_1.MemoryType.MESSAGE]
                            })];
                    case 2:
                        relatedMemories = _e.sent();
                        result = {
                            origin: {
                                id: originMemory.id,
                                text: originContent
                            },
                            causes: [],
                            effects: []
                        };
                        midPoint = Math.floor(relatedMemories.length / 2);
                        // Create simulated causes
                        for (i = 0; i < midPoint && i < relatedMemories.length; i++) {
                            memory = relatedMemories[i];
                            content = ((_a = memory.point.payload) === null || _a === void 0 ? void 0 : _a.text) ||
                                ((_b = memory.point.payload) === null || _b === void 0 ? void 0 : _b.content) ||
                                'No content available';
                            result.causes.push({
                                memory: {
                                    id: memory.point.id,
                                    text: content
                                },
                                relationship: {
                                    description: "Potential cause related to ".concat(originContent.substring(0, 20), "..."),
                                    confidence: 0.5 + (Math.random() * 0.3), // Random confidence between 0.5-0.8
                                    relationshipType: 'CORRELATED'
                                },
                                depth: 1
                            });
                        }
                        // Create simulated effects
                        for (i = midPoint; i < relatedMemories.length; i++) {
                            memory = relatedMemories[i];
                            content = ((_c = memory.point.payload) === null || _c === void 0 ? void 0 : _c.text) ||
                                ((_d = memory.point.payload) === null || _d === void 0 ? void 0 : _d.content) ||
                                'No content available';
                            result.effects.push({
                                memory: {
                                    id: memory.point.id,
                                    text: content
                                },
                                relationship: {
                                    description: "Potential effect following ".concat(originContent.substring(0, 20), "..."),
                                    confidence: 0.5 + (Math.random() * 0.3), // Random confidence between 0.5-0.8
                                    relationshipType: 'CORRELATED'
                                },
                                depth: 1
                            });
                        }
                        return [2 /*return*/, result];
                    case 3:
                        error_6 = _e.sent();
                        console.error('Error in causal chain search:', error_6);
                        // Return empty result on error
                        return [2 /*return*/, {
                                origin: {
                                    id: memoryId,
                                    text: 'Memory not found or error retrieving content'
                                },
                                causes: [],
                                effects: []
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Filter memories without semantic search
     * Retrieves memories based on exact filtering criteria without embedding comparison
     */
    SearchService.prototype.filter = function () {
        return __awaiter(this, arguments, void 0, function (options) {
            var _a, types, _b, limit, _c, offset, _d, filter, _e, sortBy_1, _f, sortOrder_1, collectionsToSearch, validCollections, results, missingCollections, _loop_2, this_2, _i, validCollections_2, collectionName, errorMessage, error_7;
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _g.trys.push([0, 5, , 6]);
                        _a = options.types, types = _a === void 0 ? [] : _a, _b = options.limit, limit = _b === void 0 ? 50 : _b, _c = options.offset, offset = _c === void 0 ? 0 : _c, _d = options.filter, filter = _d === void 0 ? {} : _d, _e = options.sortBy, sortBy_1 = _e === void 0 ? 'timestamp' : _e, _f = options.sortOrder, sortOrder_1 = _f === void 0 ? 'desc' : _f;
                        collectionsToSearch = types.length > 0
                            ? types.map(function (type) { return _this.getCollectionNameForType(type); })
                            : Object.values(config_1.COLLECTION_NAMES);
                        validCollections = collectionsToSearch.filter(Boolean);
                        if (validCollections.length === 0) {
                            console.warn('No valid collections to filter');
                            return [2 /*return*/, []];
                        }
                        results = [];
                        missingCollections = [];
                        _loop_2 = function (collectionName) {
                            var collectionExists, qdrantFilter, scrollParams, scrolledPoints, type_2, collectionResults, error_8;
                            return __generator(this, function (_h) {
                                switch (_h.label) {
                                    case 0:
                                        if (!collectionName)
                                            return [2 /*return*/, "continue"];
                                        _h.label = 1;
                                    case 1:
                                        _h.trys.push([1, 4, , 5]);
                                        return [4 /*yield*/, this_2.client.collectionExists(collectionName)];
                                    case 2:
                                        collectionExists = _h.sent();
                                        if (!collectionExists) {
                                            missingCollections.push(collectionName);
                                            console.warn("Collection ".concat(collectionName, " does not exist, skipping filter"));
                                            return [2 /*return*/, "continue"];
                                        }
                                        qdrantFilter = filter ? this_2.buildQdrantFilter(filter) : undefined;
                                        scrollParams = {
                                            filter: qdrantFilter,
                                            limit: limit,
                                            offset: offset,
                                            with_payload: true,
                                            with_vector: false
                                        };
                                        // Add sorting if specified
                                        if (sortBy_1) {
                                            scrollParams.order_by = {
                                                key: sortBy_1,
                                                direction: sortOrder_1
                                            };
                                        }
                                        return [4 /*yield*/, this_2.client.scrollPoints(collectionName, scrollParams)];
                                    case 3:
                                        scrolledPoints = _h.sent();
                                        if (scrolledPoints && scrolledPoints.length > 0) {
                                            type_2 = this_2.getTypeFromCollectionName(collectionName);
                                            if (type_2) {
                                                collectionResults = scrolledPoints.map(function (point) { return ({
                                                    point: point,
                                                    score: 1.0, // No relevance score for pure filtering
                                                    type: type_2,
                                                    collection: collectionName
                                                }); });
                                                results.push.apply(results, collectionResults);
                                            }
                                        }
                                        return [3 /*break*/, 5];
                                    case 4:
                                        error_8 = _h.sent();
                                        console.error("Error filtering collection ".concat(collectionName, ":"), error_8);
                                        return [3 /*break*/, 5];
                                    case 5: return [2 /*return*/];
                                }
                            });
                        };
                        this_2 = this;
                        _i = 0, validCollections_2 = validCollections;
                        _g.label = 1;
                    case 1:
                        if (!(_i < validCollections_2.length)) return [3 /*break*/, 4];
                        collectionName = validCollections_2[_i];
                        return [5 /*yield**/, _loop_2(collectionName)];
                    case 2:
                        _g.sent();
                        _g.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        // If we have missing collections and no results, throw error
                        if (missingCollections.length > 0 && results.length === 0) {
                            errorMessage = "Collections not found: ".concat(missingCollections.join(', '));
                            throw (0, utils_1.handleMemoryError)(errorMessage, 'NOT_FOUND');
                        }
                        // Sort combined results if we searched multiple collections
                        if (validCollections.length > 1 && sortBy_1) {
                            results.sort(function (a, b) {
                                var aValue = a.point.payload[sortBy_1];
                                var bValue = b.point.payload[sortBy_1];
                                // Handle string comparisons
                                if (typeof aValue === 'string' && typeof bValue === 'string') {
                                    return sortOrder_1 === 'asc'
                                        ? aValue.localeCompare(bValue)
                                        : bValue.localeCompare(aValue);
                                }
                                // Handle numeric comparisons
                                if (typeof aValue === 'number' && typeof bValue === 'number') {
                                    return sortOrder_1 === 'asc' ? aValue - bValue : bValue - aValue;
                                }
                                // Handle date comparisons (stored as strings)
                                if (sortBy_1 === 'timestamp') {
                                    var aTime = parseInt(String(aValue), 10);
                                    var bTime = parseInt(String(bValue), 10);
                                    if (!isNaN(aTime) && !isNaN(bTime)) {
                                        return sortOrder_1 === 'asc' ? aTime - bTime : bTime - aTime;
                                    }
                                }
                                return 0;
                            });
                        }
                        // Apply the pagination at the combined results level if we had multiple collections
                        if (validCollections.length > 1) {
                            return [2 /*return*/, results.slice(0, limit)];
                        }
                        return [2 /*return*/, results];
                    case 5:
                        error_7 = _g.sent();
                        throw (0, utils_1.handleMemoryError)(error_7, 'SEARCH_ERROR');
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Retrieves a memory context with grouped related memories
     *
     * @param options Memory context options
     * @returns Memory context with grouped memories
     * @throws Memory error if context retrieval fails
     */
    SearchService.prototype.getMemoryContext = function () {
        return __awaiter(this, arguments, void 0, function (options) {
            var _a, query, _b, filter, _c, types, _d, maxMemoriesPerGroup_1, _e, maxTotalMemories, _f, includeSummary, _g, minScore, _h, timeWeighted, _j, numGroups, _k, includedGroups, _l, groupingStrategy, contextId, memories, groups, _m, typedGroups, summary, error_9;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_o) {
                switch (_o.label) {
                    case 0:
                        _o.trys.push([0, 13, , 14]);
                        _a = options.query, query = _a === void 0 ? '' : _a, _b = options.filter, filter = _b === void 0 ? {} : _b, _c = options.types, types = _c === void 0 ? [] : _c, _d = options.maxMemoriesPerGroup, maxMemoriesPerGroup_1 = _d === void 0 ? 5 : _d, _e = options.maxTotalMemories, maxTotalMemories = _e === void 0 ? 20 : _e, _f = options.includeSummary, includeSummary = _f === void 0 ? false : _f, _g = options.minScore, minScore = _g === void 0 ? 0.6 : _g, _h = options.timeWeighted, timeWeighted = _h === void 0 ? false : _h, _j = options.numGroups, numGroups = _j === void 0 ? 3 : _j, _k = options.includedGroups, includedGroups = _k === void 0 ? [] : _k, _l = options.groupingStrategy, groupingStrategy = _l === void 0 ? 'topic' : _l;
                        if (!query && Object.keys(filter).length === 0) {
                            throw (0, utils_1.handleMemoryError)('Either query or filter must be provided for memory context retrieval', 'VALIDATION_ERROR');
                        }
                        contextId = "ctx_".concat(Date.now(), "_").concat(Math.random().toString(36).substring(2, 9));
                        memories = [];
                        if (!query) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.search(query, {
                                types: types,
                                filter: filter,
                                limit: maxTotalMemories,
                                minScore: minScore
                            })];
                    case 1:
                        // Get memories via semantic search if query provided
                        memories = _o.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.filter({
                            types: types,
                            filter: filter,
                            limit: maxTotalMemories
                        })];
                    case 3:
                        // Otherwise use direct filtering
                        memories = _o.sent();
                        _o.label = 4;
                    case 4:
                        if (memories.length === 0) {
                            // Return empty context if no memories found
                            return [2 /*return*/, {
                                    contextId: contextId,
                                    timestamp: Date.now(),
                                    groups: [],
                                    summary: includeSummary ? 'No relevant memories found.' : undefined
                                }];
                        }
                        // Apply time weighting if requested
                        if (timeWeighted) {
                            memories = this.applyTimeWeighting(memories);
                        }
                        groups = [];
                        _m = groupingStrategy;
                        switch (_m) {
                            case 'time': return [3 /*break*/, 5];
                            case 'type': return [3 /*break*/, 6];
                            case 'custom': return [3 /*break*/, 7];
                            case 'topic': return [3 /*break*/, 8];
                        }
                        return [3 /*break*/, 8];
                    case 5:
                        groups = this.groupMemoriesByTime(memories, numGroups);
                        return [3 /*break*/, 10];
                    case 6:
                        {
                            typedGroups = this.groupMemoriesByType(memories);
                            groups = typedGroups;
                            return [3 /*break*/, 10];
                        }
                        _o.label = 7;
                    case 7:
                        // Custom grouping would use includedGroups parameter
                        groups = this.groupMemoriesByCustomCategories(memories, includedGroups);
                        return [3 /*break*/, 10];
                    case 8: return [4 /*yield*/, this.groupMemoriesByTopic(memories, numGroups)];
                    case 9:
                        // Default to topic-based grouping
                        groups = _o.sent();
                        return [3 /*break*/, 10];
                    case 10:
                        // Step 3: Limit memories per group
                        groups = groups.map(function (group) { return (__assign(__assign({}, group), { memories: group.memories.slice(0, maxMemoriesPerGroup_1) })); });
                        // Order groups by relevance
                        groups.sort(function (a, b) { return b.relevance - a.relevance; });
                        summary = void 0;
                        if (!includeSummary) return [3 /*break*/, 12];
                        return [4 /*yield*/, this.generateContextSummary(memories, query)];
                    case 11:
                        summary = _o.sent();
                        _o.label = 12;
                    case 12: 
                    // Return the complete memory context
                    return [2 /*return*/, {
                            contextId: contextId,
                            timestamp: Date.now(),
                            groups: groups,
                            summary: summary,
                            metadata: {
                                query: query,
                                totalMemoriesFound: memories.length,
                                strategy: groupingStrategy
                            }
                        }];
                    case 13:
                        error_9 = _o.sent();
                        throw (0, utils_1.handleMemoryError)(error_9, 'CONTEXT_ERROR');
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Apply time-based weighting to memory relevance scores
     * Recent memories get boosted scores
     */
    SearchService.prototype.applyTimeWeighting = function (memories) {
        var now = Date.now();
        var DAY_MS = 86400000; // 24 hours in milliseconds
        var MAX_DAYS = 30; // Maximum days to consider for time weighting
        var TIME_WEIGHT = 0.3; // Weight of time factor (0-1)
        return memories.map(function (memory) {
            // Get memory timestamp
            var timestampStr = memory.point.payload.timestamp;
            var timestamp = parseInt(timestampStr, 10);
            if (isNaN(timestamp)) {
                return memory; // Return unchanged if timestamp invalid
            }
            // Calculate days difference
            var daysDiff = Math.min(MAX_DAYS, Math.max(0, (now - timestamp) / DAY_MS));
            // Calculate time decay factor (1.0 for newest, decreasing with age)
            var timeFactor = 1 - (daysDiff / MAX_DAYS);
            // Calculate weighted score
            var originalScore = memory.score;
            var timeWeightedScore = (originalScore * (1 - TIME_WEIGHT)) + (timeFactor * TIME_WEIGHT);
            // Return memory with adjusted score
            return __assign(__assign({}, memory), { score: timeWeightedScore });
        }).sort(function (a, b) { return b.score - a.score; }); // Resort by new scores
    };
    /**
     * Group memories by time periods
     */
    SearchService.prototype.groupMemoriesByTime = function (memories, numGroups) {
        // Sort memories by timestamp
        var sortedMemories = __spreadArray([], memories, true).sort(function (a, b) {
            var aTime = parseInt(a.point.payload.timestamp, 10);
            var bTime = parseInt(b.point.payload.timestamp, 10);
            return bTime - aTime; // Descending order (newest first)
        });
        // Define time periods
        var now = Date.now();
        var DAY_MS = 86400000; // 24 hours in milliseconds
        var timeGroups = [
            {
                name: 'Recent',
                description: 'Memories from the past 24 hours',
                memories: [],
                relevance: 1.0
            },
            {
                name: 'Past Week',
                description: 'Memories from the past week',
                memories: [],
                relevance: 0.8
            },
            {
                name: 'Past Month',
                description: 'Memories from the past month',
                memories: [],
                relevance: 0.6
            },
            {
                name: 'Older',
                description: 'Older memories',
                memories: [],
                relevance: 0.4
            }
        ];
        // Assign memories to time groups
        for (var _i = 0, sortedMemories_1 = sortedMemories; _i < sortedMemories_1.length; _i++) {
            var memory = sortedMemories_1[_i];
            var timestamp = parseInt(memory.point.payload.timestamp, 10);
            if (isNaN(timestamp)) {
                continue; // Skip if timestamp invalid
            }
            var daysDiff = (now - timestamp) / DAY_MS;
            if (daysDiff < 1) {
                timeGroups[0].memories.push(memory);
            }
            else if (daysDiff < 7) {
                timeGroups[1].memories.push(memory);
            }
            else if (daysDiff < 30) {
                timeGroups[2].memories.push(memory);
            }
            else {
                timeGroups[3].memories.push(memory);
            }
        }
        // Filter out empty groups and limit to requested number
        return timeGroups
            .filter(function (group) { return group.memories.length > 0; })
            .slice(0, numGroups);
    };
    /**
     * Group memories by their memory type
     */
    SearchService.prototype.groupMemoriesByType = function (memories) {
        var _a;
        // Group by memory type
        var typeGroups = new Map();
        for (var _i = 0, memories_1 = memories; _i < memories_1.length; _i++) {
            var memory = memories_1[_i];
            if (!typeGroups.has(memory.type)) {
                typeGroups.set(memory.type, []);
            }
            typeGroups.get(memory.type).push(memory);
        }
        // Create groups with descriptions
        var typeDescriptions = (_a = {},
            _a[config_1.MemoryType.MESSAGE] = 'Chat messages and conversations',
            _a[config_1.MemoryType.THOUGHT] = 'Internal thoughts and reflections',
            _a[config_1.MemoryType.DOCUMENT] = 'Documents and external content',
            _a[config_1.MemoryType.REFLECTION] = 'Deep reflections and analyses',
            _a[config_1.MemoryType.TASK] = 'Tasks and actions',
            _a[config_1.MemoryType.INSIGHT] = 'Insights and realizations',
            _a[config_1.MemoryType.MEMORY_EDIT] = 'Memory modifications',
            _a[config_1.MemoryType.ANALYSIS] = 'Detailed analysis records',
            _a);
        // Convert to array of groups
        return Array.from(typeGroups.entries())
            .map(function (_a) {
            var type = _a[0], typeMemories = _a[1];
            return ({
                name: type.toString(),
                description: typeDescriptions[type] || "Memories of type ".concat(type),
                memories: typeMemories,
                relevance: 0.9, // All types have equal relevance
                type: type // Add the type property explicitly
            });
        })
            .sort(function (a, b) { return b.memories.length - a.memories.length; }); // Sort by number of memories
    };
    /**
     * Group memories by custom categories
     */
    SearchService.prototype.groupMemoriesByCustomCategories = function (memories, categories) {
        var _a;
        if (categories.length === 0) {
            // Default to a single group if no categories provided
            return [{
                    name: 'All Memories',
                    description: 'All retrieved memories',
                    memories: memories,
                    relevance: 1.0
                }];
        }
        // Create a group for each category
        var groups = categories.map(function (category) { return ({
            name: category,
            description: "Memories related to ".concat(category),
            memories: [],
            relevance: 0.9
        }); });
        // Assign memories to categories based on content and metadata
        // This is a simple implementation; in practice, would use more sophisticated matching
        for (var _i = 0, memories_2 = memories; _i < memories_2.length; _i++) {
            var memory = memories_2[_i];
            var text = memory.point.payload.text || '';
            var tags = (((_a = memory.point.payload.metadata) === null || _a === void 0 ? void 0 : _a.tags) || []);
            var _loop_3 = function (i) {
                var category = categories[i].toLowerCase();
                // Check if category matches text or tags
                if (text.toLowerCase().includes(category) ||
                    tags.some(function (tag) { return tag.toLowerCase().includes(category); })) {
                    groups[i].memories.push(memory);
                }
            };
            // Check each category
            for (var i = 0; i < categories.length; i++) {
                _loop_3(i);
            }
        }
        // Add an "Other" category for unmatched memories
        var categorizedMemoryIds = new Set(groups.flatMap(function (g) { return g.memories.map(function (m) { return m.point.id; }); }));
        var uncategorizedMemories = memories.filter(function (m) { return !categorizedMemoryIds.has(m.point.id); });
        if (uncategorizedMemories.length > 0) {
            groups.push({
                name: 'Other',
                description: 'Memories not matching specific categories',
                memories: uncategorizedMemories,
                relevance: 0.5
            });
        }
        // Remove empty groups and return
        return groups.filter(function (group) { return group.memories.length > 0; });
    };
    /**
     * Group memories by topic using embeddings similarity
     * This is more sophisticated than the other grouping methods and uses
     * clustering based on embedding vectors
     */
    SearchService.prototype.groupMemoriesByTopic = function (memories, numGroups) {
        return __awaiter(this, void 0, void 0, function () {
            var topMemories, groups, remainingMemories, _i, remainingMemories_1, memory, bestGroupIndex, bestSimilarity, i, centroid, similarity;
            var _this = this;
            return __generator(this, function (_a) {
                topMemories = memories.slice(0, Math.min(numGroups, memories.length));
                if (topMemories.length === 0) {
                    return [2 /*return*/, []];
                }
                // If only one group, return all memories
                if (topMemories.length === 1 || numGroups === 1) {
                    return [2 /*return*/, [{
                                name: 'Relevant Memories',
                                description: 'All memories related to the query',
                                memories: memories,
                                relevance: 1.0
                            }]];
                }
                groups = topMemories.map(function (memory, index) {
                    // Extract a topic name from the memory text
                    var text = memory.point.payload.text || '';
                    var topicName = _this.extractTopicName(text, "Topic ".concat(index + 1));
                    return {
                        name: topicName,
                        description: _this.generateTopicDescription(text),
                        memories: [memory],
                        relevance: 1.0 - (index * 0.1) // Decreasing relevance
                    };
                });
                remainingMemories = memories.slice(numGroups);
                for (_i = 0, remainingMemories_1 = remainingMemories; _i < remainingMemories_1.length; _i++) {
                    memory = remainingMemories_1[_i];
                    bestGroupIndex = 0;
                    bestSimilarity = -1;
                    // Find the group with the most similar centroid
                    for (i = 0; i < groups.length; i++) {
                        centroid = groups[i].memories[0];
                        similarity = this.calculateTextSimilarity(memory.point.payload.text || '', centroid.point.payload.text || '');
                        if (similarity > bestSimilarity) {
                            bestSimilarity = similarity;
                            bestGroupIndex = i;
                        }
                    }
                    // Add to best matching group
                    groups[bestGroupIndex].memories.push(memory);
                }
                // Remove empty groups
                return [2 /*return*/, groups.filter(function (group) { return group.memories.length > 0; })];
            });
        });
    };
    /**
     * Simple text similarity calculation based on word overlap
     * In a real implementation, this would use vector similarity
     */
    SearchService.prototype.calculateTextSimilarity = function (text1, text2) {
        var words1 = new Set(text1.toLowerCase().split(/\W+/).filter(function (w) { return w.length > 0; }));
        var words2 = new Set(text2.toLowerCase().split(/\W+/).filter(function (w) { return w.length > 0; }));
        if (words1.size === 0 || words2.size === 0) {
            return 0;
        }
        // Count common words
        var commonCount = 0;
        var words1Array = Array.from(words1);
        for (var _i = 0, words1Array_1 = words1Array; _i < words1Array_1.length; _i++) {
            var word = words1Array_1[_i];
            if (words2.has(word)) {
                commonCount++;
            }
        }
        // Jaccard similarity: intersection / union
        return commonCount / (words1.size + words2.size - commonCount);
    };
    /**
     * Extract a topic name from text
     */
    SearchService.prototype.extractTopicName = function (text, fallback) {
        // Simple heuristic: get first few words of text
        var words = text.split(/\W+/).filter(function (w) { return w.length > 0; });
        if (words.length >= 2) {
            // Use first few words (capitalized)
            return words.slice(0, Math.min(3, words.length))
                .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); })
                .join(' ');
        }
        return fallback;
    };
    /**
     * Generate a description for a topic based on sample text
     */
    SearchService.prototype.generateTopicDescription = function (text) {
        if (!text || text.length === 0) {
            return 'Group of related memories';
        }
        // Use first sentence or truncate
        var firstSentence = text.split(/[.!?]/, 1)[0].trim();
        if (firstSentence.length < 100) {
            return "Memories related to: \"".concat(firstSentence, "\"");
        }
        return "Memories related to: \"".concat(firstSentence.substring(0, 97), "...\"");
    };
    /**
     * Generate a summary for the entire memory context
     */
    SearchService.prototype.generateContextSummary = function (memories, query) {
        return __awaiter(this, void 0, void 0, function () {
            var count, summary, typeCount, _i, memories_3, memory, timestamps, oldest, newest;
            return __generator(this, function (_a) {
                count = memories.length;
                summary = "Found ".concat(count, " relevant ").concat(count === 1 ? 'memory' : 'memories');
                if (query) {
                    summary += " related to \"".concat(query, "\"");
                }
                typeCount = new Map();
                for (_i = 0, memories_3 = memories; _i < memories_3.length; _i++) {
                    memory = memories_3[_i];
                    typeCount.set(memory.type, (typeCount.get(memory.type) || 0) + 1);
                }
                if (typeCount.size > 1) {
                    summary += ', including ';
                    summary += Array.from(typeCount.entries())
                        .map(function (_a) {
                        var type = _a[0], count = _a[1];
                        return "".concat(count, " ").concat(type).concat(count !== 1 ? 's' : '');
                    })
                        .join(', ');
                }
                // Add time range if available
                try {
                    timestamps = memories
                        .map(function (m) { return parseInt(m.point.payload.timestamp, 10); })
                        .filter(function (t) { return !isNaN(t); });
                    if (timestamps.length > 0) {
                        oldest = new Date(Math.min.apply(Math, timestamps));
                        newest = new Date(Math.max.apply(Math, timestamps));
                        summary += ", spanning from ".concat(oldest.toLocaleDateString(), " to ").concat(newest.toLocaleDateString());
                    }
                }
                catch (e) {
                    // Ignore timestamp errors
                }
                return [2 /*return*/, summary];
            });
        });
    };
    return SearchService;
}());
exports.SearchService = SearchService;
