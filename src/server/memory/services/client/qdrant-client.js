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
exports.QdrantMemoryClient = void 0;
/**
 * Qdrant memory client implementation
 */
var js_client_rest_1 = require("@qdrant/js-client-rest");
var uuid_1 = require("uuid");
var config_1 = require("../../config");
var utils_1 = require("../../utils");
var embedding_service_1 = require("./embedding-service");
/**
 * In-memory fallback storage
 */
var InMemoryStorage = /** @class */ (function () {
    function InMemoryStorage() {
        this.collections = new Map();
    }
    /**
     * Add a point to a collection
     */
    InMemoryStorage.prototype.addPoint = function (collectionName, id, point) {
        if (!this.collections.has(collectionName)) {
            this.collections.set(collectionName, new Map());
        }
        var collection = this.collections.get(collectionName);
        collection.set(id, point);
        return id;
    };
    /**
     * Get points by IDs
     */
    InMemoryStorage.prototype.getPoints = function (collectionName, ids) {
        if (!this.collections.has(collectionName)) {
            return [];
        }
        var collection = this.collections.get(collectionName);
        return ids
            .filter(function (id) { return collection.has(id); })
            .map(function (id) { return collection.get(id); });
    };
    /**
     * Search for points (simple text match)
     */
    InMemoryStorage.prototype.searchPoints = function (collectionName, query, limit) {
        if (limit === void 0) { limit = 10; }
        if (!this.collections.has(collectionName)) {
            return [];
        }
        var collection = this.collections.get(collectionName);
        var points = Array.from(collection.values());
        // Simple text search based on payload
        return points
            .filter(function (point) {
            var payload = point.payload || {};
            var text = payload.text || '';
            return query ? text.toLowerCase().includes(query.toLowerCase()) : true;
        })
            .slice(0, limit);
    };
    /**
     * Update a point
     */
    InMemoryStorage.prototype.updatePoint = function (collectionName, id, updates) {
        if (!this.collections.has(collectionName)) {
            return false;
        }
        var collection = this.collections.get(collectionName);
        if (!collection.has(id)) {
            return false;
        }
        var point = collection.get(id);
        collection.set(id, __assign(__assign({}, point), updates));
        return true;
    };
    /**
     * Delete a point
     */
    InMemoryStorage.prototype.deletePoint = function (collectionName, id) {
        if (!this.collections.has(collectionName)) {
            return false;
        }
        var collection = this.collections.get(collectionName);
        return collection.delete(id);
    };
    /**
     * Get point count
     */
    InMemoryStorage.prototype.getPointCount = function (collectionName) {
        if (!this.collections.has(collectionName)) {
            return 0;
        }
        return this.collections.get(collectionName).size;
    };
    /**
     * Reset storage
     */
    InMemoryStorage.prototype.reset = function () {
        this.collections.clear();
    };
    return InMemoryStorage;
}());
/**
 * Qdrant memory client implementation
 */
var QdrantMemoryClient = /** @class */ (function () {
    /**
     * Create a new Qdrant memory client
     */
    function QdrantMemoryClient(options) {
        this.initialized = false;
        this.collections = new Set();
        this.useQdrant = true;
        // Set connection options
        var qdrantUrl = (options === null || options === void 0 ? void 0 : options.qdrantUrl) || process.env.QDRANT_URL || 'http://localhost:6333';
        var qdrantApiKey = (options === null || options === void 0 ? void 0 : options.qdrantApiKey) || process.env.QDRANT_API_KEY;
        this.connectionTimeout = (options === null || options === void 0 ? void 0 : options.connectionTimeout) || config_1.DEFAULTS.CONNECTION_TIMEOUT;
        this.requestTimeout = (options === null || options === void 0 ? void 0 : options.requestTimeout) || config_1.DEFAULTS.FETCH_TIMEOUT;
        // Initialize Qdrant client
        this.client = new js_client_rest_1.QdrantClient({
            url: qdrantUrl,
            apiKey: qdrantApiKey,
            timeout: this.connectionTimeout
        });
        // Initialize embedding service
        this.embeddingService = new embedding_service_1.EmbeddingService({
            openAIApiKey: options === null || options === void 0 ? void 0 : options.openAIApiKey,
            embeddingModel: options === null || options === void 0 ? void 0 : options.embeddingModel,
            useRandomFallback: true
        });
        // Initialize fallback storage
        this.fallbackStorage = new InMemoryStorage();
    }
    /**
     * Initialize the client
     */
    QdrantMemoryClient.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var testConnectionPromise, timeoutPromise, result, error_1, error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        console.log('Initializing Qdrant memory client...');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        testConnectionPromise = this.client.getCollections();
                        timeoutPromise = new Promise(function (_, reject) {
                            return setTimeout(function () { return reject(new Error("Connection timeout after ".concat(_this.connectionTimeout, "ms"))); }, _this.connectionTimeout);
                        });
                        return [4 /*yield*/, Promise.race([testConnectionPromise, timeoutPromise])];
                    case 2:
                        result = _a.sent();
                        this.useQdrant = true;
                        console.log("Qdrant connection successful. Found ".concat(result.collections.length, " collections."));
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Failed to connect to Qdrant:', error_1);
                        this.useQdrant = false;
                        this.initialized = true;
                        return [2 /*return*/];
                    case 4:
                        // Initialize collections
                        this.collections = new Set();
                        this.initialized = true;
                        console.log('Qdrant memory client initialized.');
                        return [3 /*break*/, 6];
                    case 5:
                        error_2 = _a.sent();
                        console.error('Failed to initialize Qdrant memory client:', error_2);
                        this.useQdrant = false;
                        this.initialized = true;
                        throw (0, utils_1.handleMemoryError)(error_2, 'initialize');
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if client is initialized
     */
    QdrantMemoryClient.prototype.isInitialized = function () {
        return this.initialized;
    };
    /**
     * Get client status
     */
    QdrantMemoryClient.prototype.getStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        initialized: this.initialized,
                        connected: this.useQdrant,
                        collectionsReady: Array.from(this.collections),
                        usingFallback: !this.useQdrant
                    }];
            });
        });
    };
    /**
     * Check if a collection exists
     */
    QdrantMemoryClient.prototype.collectionExists = function (collectionName) {
        return __awaiter(this, void 0, void 0, function () {
            var collections, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        if (!this.useQdrant) {
                            return [2 /*return*/, false];
                        }
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.client.getCollections()];
                    case 4:
                        collections = _a.sent();
                        return [2 /*return*/, collections.collections.some(function (collection) { return collection.name === collectionName; })];
                    case 5:
                        error_3 = _a.sent();
                        console.error("Error checking if collection ".concat(collectionName, " exists:"), error_3);
                        this.useQdrant = false;
                        return [2 /*return*/, false];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a collection
     */
    QdrantMemoryClient.prototype.createCollection = function (collectionName, dimensions) {
        return __awaiter(this, void 0, void 0, function () {
            var exists, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        if (!this.useQdrant) {
                            return [2 /*return*/, false];
                        }
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 8, , 9]);
                        return [4 /*yield*/, this.collectionExists(collectionName)];
                    case 4:
                        exists = _a.sent();
                        if (exists) {
                            this.collections.add(collectionName);
                            return [2 /*return*/, true];
                        }
                        // Create collection
                        return [4 /*yield*/, this.client.createCollection(collectionName, {
                                vectors: {
                                    size: dimensions,
                                    distance: "Cosine"
                                }
                            })];
                    case 5:
                        // Create collection
                        _a.sent();
                        // Create indices for timestamp and type
                        return [4 /*yield*/, this.client.createPayloadIndex(collectionName, {
                                field_name: "timestamp",
                                field_schema: "datetime"
                            })];
                    case 6:
                        // Create indices for timestamp and type
                        _a.sent();
                        return [4 /*yield*/, this.client.createPayloadIndex(collectionName, {
                                field_name: "type",
                                field_schema: "keyword"
                            })];
                    case 7:
                        _a.sent();
                        this.collections.add(collectionName);
                        return [2 /*return*/, true];
                    case 8:
                        error_4 = _a.sent();
                        console.error("Error creating collection ".concat(collectionName, ":"), error_4);
                        return [2 /*return*/, false];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Add a point to a collection
     */
    QdrantMemoryClient.prototype.addPoint = function (collectionName, point) {
        return __awaiter(this, void 0, void 0, function () {
            var exists, dimensions, recordPayload, upsertError_1, dimensions, created, error_5;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!!this.initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _c.sent();
                        _c.label = 2;
                    case 2:
                        // Generate ID if not provided
                        if (!point.id) {
                            point.id = (0, uuid_1.v4)();
                        }
                        // Use fallback storage if Qdrant is not available
                        if (!this.useQdrant) {
                            return [2 /*return*/, this.fallbackStorage.addPoint(collectionName, point.id, point)];
                        }
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 17, , 18]);
                        if (!!this.collections.has(collectionName)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.collectionExists(collectionName)];
                    case 4:
                        exists = _c.sent();
                        if (!!exists) return [3 /*break*/, 6];
                        console.log("Collection ".concat(collectionName, " does not exist, creating it now..."));
                        dimensions = ((_a = point.vector) === null || _a === void 0 ? void 0 : _a.length) || config_1.DEFAULTS.DIMENSIONS;
                        return [4 /*yield*/, this.createCollection(collectionName, dimensions)];
                    case 5:
                        _c.sent();
                        _c.label = 6;
                    case 6:
                        recordPayload = __assign({}, point.payload);
                        _c.label = 7;
                    case 7:
                        _c.trys.push([7, 9, , 16]);
                        return [4 /*yield*/, this.client.upsert(collectionName, {
                                wait: true,
                                points: [
                                    {
                                        id: point.id,
                                        vector: point.vector,
                                        payload: recordPayload
                                    }
                                ]
                            })];
                    case 8:
                        _c.sent();
                        return [3 /*break*/, 16];
                    case 9:
                        upsertError_1 = _c.sent();
                        if (!(upsertError_1 instanceof Error &&
                            (upsertError_1.message.includes('404') || upsertError_1.message.includes('Not Found')))) return [3 /*break*/, 14];
                        console.log("Collection ".concat(collectionName, " not found during upsert, creating it now..."));
                        dimensions = ((_b = point.vector) === null || _b === void 0 ? void 0 : _b.length) || config_1.DEFAULTS.DIMENSIONS;
                        return [4 /*yield*/, this.createCollection(collectionName, dimensions)];
                    case 10:
                        created = _c.sent();
                        if (!created) return [3 /*break*/, 12];
                        // Retry the upsert now that we've created the collection
                        return [4 /*yield*/, this.client.upsert(collectionName, {
                                wait: true,
                                points: [
                                    {
                                        id: point.id,
                                        vector: point.vector,
                                        payload: recordPayload
                                    }
                                ]
                            })];
                    case 11:
                        // Retry the upsert now that we've created the collection
                        _c.sent();
                        return [3 /*break*/, 13];
                    case 12: throw new Error("Failed to create collection ".concat(collectionName));
                    case 13: return [3 /*break*/, 15];
                    case 14: 
                    // Rethrow other errors
                    throw upsertError_1;
                    case 15: return [3 /*break*/, 16];
                    case 16: return [2 /*return*/, point.id];
                    case 17:
                        error_5 = _c.sent();
                        console.error("Error adding point to ".concat(collectionName, ":"), error_5);
                        // Fallback to in-memory storage
                        return [2 /*return*/, this.fallbackStorage.addPoint(collectionName, point.id, point)];
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get points by IDs
     */
    QdrantMemoryClient.prototype.getPoints = function (collectionName, ids) {
        return __awaiter(this, void 0, void 0, function () {
            var exists, response, retrieveError_1, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        // Use fallback storage if Qdrant is not available
                        if (!this.useQdrant) {
                            return [2 /*return*/, this.fallbackStorage.getPoints(collectionName, ids)];
                        }
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 9, , 10]);
                        if (!!this.collections.has(collectionName)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.collectionExists(collectionName)];
                    case 4:
                        exists = _a.sent();
                        if (!exists) {
                            console.log("Collection ".concat(collectionName, " does not exist during getPoints, returning empty array"));
                            return [2 /*return*/, []];
                        }
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, this.client.retrieve(collectionName, {
                                ids: ids,
                                with_payload: true,
                                with_vector: true
                            })];
                    case 6:
                        response = _a.sent();
                        // Transform response to MemoryPoint objects
                        return [2 /*return*/, response.map(function (point) {
                                // Ensure vector is an array and handle all possible types
                                var vector = [];
                                if (Array.isArray(point.vector)) {
                                    // Flatten if it's a nested array
                                    if (point.vector.length > 0 && Array.isArray(point.vector[0])) {
                                        vector = point.vector.flat();
                                    }
                                    else {
                                        vector = point.vector;
                                    }
                                }
                                return {
                                    id: String(point.id),
                                    vector: vector,
                                    payload: point.payload
                                };
                            })];
                    case 7:
                        retrieveError_1 = _a.sent();
                        // Handle 404 Not Found errors by returning empty array
                        if (retrieveError_1 instanceof Error &&
                            (retrieveError_1.message.includes('404') || retrieveError_1.message.includes('Not Found'))) {
                            console.log("Collection ".concat(collectionName, " not found during retrieve, returning empty array"));
                            return [2 /*return*/, []];
                        }
                        throw retrieveError_1;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_6 = _a.sent();
                        console.error("Error getting points from ".concat(collectionName, ":"), error_6);
                        // Fallback to in-memory storage
                        return [2 /*return*/, this.fallbackStorage.getPoints(collectionName, ids)];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Search for points
     */
    QdrantMemoryClient.prototype.searchPoints = function (collectionName, query) {
        return __awaiter(this, void 0, void 0, function () {
            var collectionExists, checkError_1, points, searchResults, vector, embeddingResult, searchResponse, searchError_1, error_7, errorMessage, searchResults;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.collectionExists(collectionName)];
                    case 3:
                        collectionExists = _a.sent();
                        if (!collectionExists) {
                            console.warn("Collection ".concat(collectionName, " does not exist. Returning empty results."));
                            return [2 /*return*/, []];
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        checkError_1 = _a.sent();
                        console.warn("Error checking if collection ".concat(collectionName, " exists:"), checkError_1);
                        return [3 /*break*/, 5];
                    case 5:
                        if (!(!query.query && !query.vector)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.scrollPoints(collectionName, query.filter, query.limit, query.offset)];
                    case 6:
                        points = _a.sent();
                        // Convert to search results format
                        return [2 /*return*/, points.map(function (point) { return ({
                                id: point.id,
                                score: 1.0, // Default score for non-semantic search
                                payload: point.payload
                            }); })];
                    case 7:
                        // Use fallback storage if Qdrant is not available
                        if (!this.useQdrant) {
                            searchResults = this.fallbackStorage.searchPoints(collectionName, query.query || '', query.limit || config_1.DEFAULTS.DEFAULT_LIMIT);
                            return [2 /*return*/, searchResults.map(function (point) { return ({
                                    id: point.id,
                                    score: 1.0, // Default score for in-memory search
                                    payload: point.payload
                                }); })];
                        }
                        _a.label = 8;
                    case 8:
                        _a.trys.push([8, 15, , 16]);
                        vector = query.vector;
                        if (!(!vector && query.query)) return [3 /*break*/, 10];
                        return [4 /*yield*/, this.embeddingService.getEmbedding(query.query)];
                    case 9:
                        embeddingResult = _a.sent();
                        vector = embeddingResult.embedding;
                        _a.label = 10;
                    case 10:
                        // Search with vector - ensure vector is always defined before calling search
                        if (!vector) {
                            // Create a proper dummy vector with the right dimensionality
                            vector = new Array(config_1.DEFAULTS.DIMENSIONS).fill(0).map(function () { return Math.random() * 0.01; });
                            console.log("Using dummy vector with ".concat(vector.length, " dimensions for search"));
                        }
                        _a.label = 11;
                    case 11:
                        _a.trys.push([11, 13, , 14]);
                        return [4 /*yield*/, this.client.search(collectionName, {
                                vector: vector,
                                limit: query.limit || config_1.DEFAULTS.DEFAULT_LIMIT,
                                offset: query.offset || 0,
                                filter: query.filter ? this.buildQdrantFilter(query.filter) : undefined,
                                with_payload: true,
                                with_vector: true,
                                score_threshold: query.scoreThreshold
                            })];
                    case 12:
                        searchResponse = _a.sent();
                        // Transform results
                        return [2 /*return*/, searchResponse.map(function (result) { return ({
                                id: String(result.id),
                                score: result.score,
                                payload: result.payload
                            }); })];
                    case 13:
                        searchError_1 = _a.sent();
                        // Handle 404 Not Found errors by returning empty array 
                        if (searchError_1 instanceof Error &&
                            (searchError_1.message.includes('404') || searchError_1.message.includes('Not Found'))) {
                            console.warn("Collection ".concat(collectionName, " not found during search. Returning empty results."));
                            return [2 /*return*/, []];
                        }
                        throw searchError_1;
                    case 14: return [3 /*break*/, 16];
                    case 15:
                        error_7 = _a.sent();
                        errorMessage = error_7 instanceof Error ? error_7.message : String(error_7);
                        // Check if this is a "collection not found" error
                        if (errorMessage.includes('not found') ||
                            errorMessage.includes('404') ||
                            errorMessage.includes('does not exist')) {
                            console.warn("Collection ".concat(collectionName, " not found during search. Returning empty results."));
                            return [2 /*return*/, []];
                        }
                        console.error("Error searching in ".concat(collectionName, ":"), error_7);
                        searchResults = this.fallbackStorage.searchPoints(collectionName, query.query || '', query.limit || config_1.DEFAULTS.DEFAULT_LIMIT);
                        return [2 /*return*/, searchResults.map(function (point) { return ({
                                id: point.id,
                                score: 1.0,
                                payload: point.payload
                            }); })];
                    case 16: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Scroll through points
     */
    QdrantMemoryClient.prototype.scrollPoints = function (collectionName, filter, limit, offset) {
        return __awaiter(this, void 0, void 0, function () {
            var collectionExists, checkError_2, points, scrollParams, response, scrollError_1, searchResponse, searchError_2, error_8, errorMessage, points;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.collectionExists(collectionName)];
                    case 3:
                        collectionExists = _a.sent();
                        if (!collectionExists) {
                            console.warn("Collection ".concat(collectionName, " does not exist. Returning empty results for scroll operation."));
                            return [2 /*return*/, []];
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        checkError_2 = _a.sent();
                        console.warn("Error checking if collection ".concat(collectionName, " exists:"), checkError_2);
                        return [3 /*break*/, 5];
                    case 5:
                        // Use fallback storage if Qdrant is not available
                        if (!this.useQdrant) {
                            points = this.fallbackStorage.searchPoints(collectionName, '', limit || config_1.DEFAULTS.DEFAULT_LIMIT);
                            return [2 /*return*/, points];
                        }
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 15, , 16]);
                        scrollParams = {
                            limit: limit || config_1.DEFAULTS.DEFAULT_LIMIT,
                            offset: offset || 0,
                            with_payload: true,
                            with_vector: false
                        };
                        // Add filter if provided
                        if (filter) {
                            scrollParams.filter = this.buildQdrantFilter(filter);
                        }
                        // Add sorting by timestamp if available
                        scrollParams.order_by = {
                            key: 'timestamp',
                            direction: 'desc'
                        };
                        _a.label = 7;
                    case 7:
                        _a.trys.push([7, 9, , 14]);
                        return [4 /*yield*/, this.client.scroll(collectionName, scrollParams)];
                    case 8:
                        response = _a.sent();
                        if (!response || !response.points) {
                            return [2 /*return*/, []];
                        }
                        // Transform to MemoryPoint objects
                        return [2 /*return*/, response.points.map(function (point) {
                                // Ensure vector is an array and handle all possible types
                                var vector = [];
                                if (Array.isArray(point.vector)) {
                                    // Flatten if it's a nested array
                                    if (point.vector.length > 0 && Array.isArray(point.vector[0])) {
                                        vector = point.vector.flat();
                                    }
                                    else {
                                        vector = point.vector;
                                    }
                                }
                                return {
                                    id: String(point.id),
                                    vector: vector,
                                    payload: point.payload
                                };
                            })];
                    case 9:
                        scrollError_1 = _a.sent();
                        if (!(scrollError_1 instanceof Error &&
                            (scrollError_1.message.includes('400') || scrollError_1.message.includes('Bad Request')))) return [3 /*break*/, 13];
                        console.warn("Bad request error during scroll on ".concat(collectionName, ". The collection might be new or missing indices. Trying alternative method..."));
                        _a.label = 10;
                    case 10:
                        _a.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, this.client.search(collectionName, {
                                vector: new Array(config_1.DEFAULTS.DIMENSIONS).fill(0), // Add dummy vector to satisfy type requirements
                                limit: limit || config_1.DEFAULTS.DEFAULT_LIMIT,
                                offset: offset || 0,
                                filter: filter ? this.buildQdrantFilter(filter) : undefined,
                                with_payload: true,
                                with_vector: false
                            })];
                    case 11:
                        searchResponse = _a.sent();
                        return [2 /*return*/, searchResponse.map(function (result) { return ({
                                id: String(result.id),
                                // Empty vector since we didn't request it
                                vector: [],
                                payload: result.payload
                            }); })];
                    case 12:
                        searchError_2 = _a.sent();
                        console.warn("Alternative method also failed for ".concat(collectionName, ":"), searchError_2);
                        return [2 /*return*/, []];
                    case 13:
                        // Handle 404 Not Found errors by returning empty array
                        if (scrollError_1 instanceof Error &&
                            (scrollError_1.message.includes('404') || scrollError_1.message.includes('Not Found'))) {
                            console.warn("Collection ".concat(collectionName, " not found during scroll. Returning empty results."));
                            return [2 /*return*/, []];
                        }
                        // Rethrow other errors
                        throw scrollError_1;
                    case 14: return [3 /*break*/, 16];
                    case 15:
                        error_8 = _a.sent();
                        errorMessage = error_8 instanceof Error ? error_8.message : String(error_8);
                        // Check if this is a "collection not found" error
                        if (errorMessage.includes('not found') ||
                            errorMessage.includes('404') ||
                            errorMessage.includes('does not exist')) {
                            console.warn("Collection ".concat(collectionName, " not found during scroll. Returning empty results."));
                            return [2 /*return*/, []];
                        }
                        console.error("Error scrolling in ".concat(collectionName, ":"), error_8);
                        points = this.fallbackStorage.searchPoints(collectionName, '', limit || config_1.DEFAULTS.DEFAULT_LIMIT);
                        return [2 /*return*/, points];
                    case 16: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update a point
     */
    QdrantMemoryClient.prototype.updatePoint = function (collectionName, id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var points, point, updatedPoint, recordPayload, recordPayload, error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        // Use fallback storage if Qdrant is not available
                        if (!this.useQdrant) {
                            return [2 /*return*/, this.fallbackStorage.updatePoint(collectionName, id, updates)];
                        }
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 9, , 10]);
                        if (!updates.vector) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.getPoints(collectionName, [id])];
                    case 4:
                        points = _a.sent();
                        if (points.length === 0) {
                            return [2 /*return*/, false];
                        }
                        point = points[0];
                        updatedPoint = __assign(__assign(__assign({}, point), updates), { payload: __assign(__assign({}, point.payload), (updates.payload || {})) });
                        recordPayload = __assign({}, updatedPoint.payload);
                        // Replace the point
                        return [4 /*yield*/, this.client.upsert(collectionName, {
                                wait: true,
                                points: [
                                    {
                                        id: id,
                                        vector: updatedPoint.vector,
                                        payload: recordPayload
                                    }
                                ]
                            })];
                    case 5:
                        // Replace the point
                        _a.sent();
                        return [2 /*return*/, true];
                    case 6:
                        if (!updates.payload) return [3 /*break*/, 8];
                        recordPayload = __assign({}, updates.payload);
                        return [4 /*yield*/, this.client.setPayload(collectionName, {
                                points: [id],
                                payload: recordPayload
                            })];
                    case 7:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 8: return [2 /*return*/, false];
                    case 9:
                        error_9 = _a.sent();
                        console.error("Error updating point in ".concat(collectionName, ":"), error_9);
                        // Fallback to in-memory storage
                        return [2 /*return*/, this.fallbackStorage.updatePoint(collectionName, id, updates)];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Delete a point
     */
    QdrantMemoryClient.prototype.deletePoint = function (collectionName, id, options) {
        return __awaiter(this, void 0, void 0, function () {
            var hardDelete, updatePayload, updateResult, error_10;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!this.initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2:
                        hardDelete = (_a = options === null || options === void 0 ? void 0 : options.hardDelete) !== null && _a !== void 0 ? _a : true;
                        if (!!hardDelete) return [3 /*break*/, 4];
                        updatePayload = __assign({ is_deleted: true, deletion_time: new Date().toISOString() }, options === null || options === void 0 ? void 0 : options.metadata);
                        return [4 /*yield*/, this.updatePoint(collectionName, id, {
                                payload: updatePayload
                            })];
                    case 3:
                        updateResult = _b.sent();
                        return [2 /*return*/, updateResult];
                    case 4:
                        // Hard delete
                        // Use fallback storage if Qdrant is not available
                        if (!this.useQdrant) {
                            return [2 /*return*/, this.fallbackStorage.deletePoint(collectionName, id)];
                        }
                        _b.label = 5;
                    case 5:
                        _b.trys.push([5, 7, , 8]);
                        // Delete from Qdrant
                        return [4 /*yield*/, this.client.delete(collectionName, {
                                points: [id],
                                wait: true
                            })];
                    case 6:
                        // Delete from Qdrant
                        _b.sent();
                        return [2 /*return*/, true];
                    case 7:
                        error_10 = _b.sent();
                        console.error("Error deleting point from ".concat(collectionName, ":"), error_10);
                        // Fallback to in-memory storage
                        return [2 /*return*/, this.fallbackStorage.deletePoint(collectionName, id)];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Add multiple points in a batch
     */
    QdrantMemoryClient.prototype.addPoints = function (collectionName, points) {
        return __awaiter(this, void 0, void 0, function () {
            var exists, pointWithVector, dimensions, qdrantPoints, upsertError_2, pointWithVector, dimensions, created, error_11;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!!this.initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _c.sent();
                        _c.label = 2;
                    case 2:
                        // Generate IDs for points that don't have them
                        points = points.map(function (point) {
                            if (!point.id) {
                                point.id = (0, uuid_1.v4)();
                            }
                            return point;
                        });
                        // Use fallback storage if Qdrant is not available
                        if (!this.useQdrant) {
                            return [2 /*return*/, Promise.all(points.map(function (point) { return _this.fallbackStorage.addPoint(collectionName, point.id, point); }))];
                        }
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 17, , 18]);
                        if (!!this.collections.has(collectionName)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.collectionExists(collectionName)];
                    case 4:
                        exists = _c.sent();
                        if (!!exists) return [3 /*break*/, 6];
                        console.log("Collection ".concat(collectionName, " does not exist, creating it now..."));
                        pointWithVector = points.find(function (p) { return p.vector && p.vector.length > 0; });
                        dimensions = ((_a = pointWithVector === null || pointWithVector === void 0 ? void 0 : pointWithVector.vector) === null || _a === void 0 ? void 0 : _a.length) || config_1.DEFAULTS.DIMENSIONS;
                        return [4 /*yield*/, this.createCollection(collectionName, dimensions)];
                    case 5:
                        _c.sent();
                        _c.label = 6;
                    case 6:
                        qdrantPoints = points.map(function (point) { return ({
                            id: point.id,
                            vector: point.vector,
                            payload: __assign({}, point.payload)
                        }); });
                        _c.label = 7;
                    case 7:
                        _c.trys.push([7, 9, , 16]);
                        return [4 /*yield*/, this.client.upsert(collectionName, {
                                wait: true,
                                points: qdrantPoints
                            })];
                    case 8:
                        _c.sent();
                        return [3 /*break*/, 16];
                    case 9:
                        upsertError_2 = _c.sent();
                        if (!(upsertError_2 instanceof Error &&
                            (upsertError_2.message.includes('404') || upsertError_2.message.includes('Not Found')))) return [3 /*break*/, 14];
                        console.log("Collection ".concat(collectionName, " not found during batch upsert, creating it now..."));
                        pointWithVector = points.find(function (p) { return p.vector && p.vector.length > 0; });
                        dimensions = ((_b = pointWithVector === null || pointWithVector === void 0 ? void 0 : pointWithVector.vector) === null || _b === void 0 ? void 0 : _b.length) || config_1.DEFAULTS.DIMENSIONS;
                        return [4 /*yield*/, this.createCollection(collectionName, dimensions)];
                    case 10:
                        created = _c.sent();
                        if (!created) return [3 /*break*/, 12];
                        // Retry the upsert now that we've created the collection
                        return [4 /*yield*/, this.client.upsert(collectionName, {
                                wait: true,
                                points: qdrantPoints
                            })];
                    case 11:
                        // Retry the upsert now that we've created the collection
                        _c.sent();
                        return [3 /*break*/, 13];
                    case 12: throw new Error("Failed to create collection ".concat(collectionName));
                    case 13: return [3 /*break*/, 15];
                    case 14: 
                    // Rethrow other errors
                    throw upsertError_2;
                    case 15: return [3 /*break*/, 16];
                    case 16: 
                    // Return the IDs
                    return [2 /*return*/, points.map(function (point) { return point.id; })];
                    case 17:
                        error_11 = _c.sent();
                        console.error("Error adding points to ".concat(collectionName, ":"), error_11);
                        // Fallback to in-memory storage
                        return [2 /*return*/, Promise.all(points.map(function (point) { return _this.fallbackStorage.addPoint(collectionName, point.id, point); }))];
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get point count
     */
    QdrantMemoryClient.prototype.getPointCount = function (collectionName, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var qdrantFilter, response, error_12;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        // Use fallback storage if Qdrant is not available
                        if (!this.useQdrant) {
                            return [2 /*return*/, this.fallbackStorage.getPointCount(collectionName)];
                        }
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        qdrantFilter = filter ? this.buildQdrantFilter(filter) : undefined;
                        return [4 /*yield*/, this.client.count(collectionName, { exact: true, filter: qdrantFilter })];
                    case 4:
                        response = _a.sent();
                        return [2 /*return*/, response.count];
                    case 5:
                        error_12 = _a.sent();
                        console.error("Error counting points in ".concat(collectionName, ":"), error_12);
                        // Fallback to in-memory storage
                        return [2 /*return*/, this.fallbackStorage.getPointCount(collectionName)];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Convert a filter to Qdrant format
     */
    QdrantMemoryClient.prototype.buildQdrantFilter = function (filter) {
        // Handle complex filters if provided
        if (filter.must || filter.should || filter.must_not) {
            // Already in Qdrant format
            return filter;
        }
        // Convert to Qdrant filter format
        var conditions = Object.entries(filter)
            .filter(function (_a) {
            var _ = _a[0], value = _a[1];
            return value !== undefined;
        })
            .map(function (_a) {
            var key = _a[0], value = _a[1];
            // Special handling for metadata fields
            if (key !== 'id' && key !== 'type' && !key.startsWith('metadata.')) {
                key = "metadata.".concat(key);
            }
            // Handle different value types
            if (Array.isArray(value)) {
                return {
                    key: key,
                    match: { any: value }
                };
            }
            else if (typeof value === 'object' && value !== null) {
                // Range queries or custom operators
                return {
                    key: key,
                    range: value
                };
            }
            else {
                // Simple equality
                return {
                    key: key,
                    match: { value: value }
                };
            }
        });
        return conditions.length > 0 ? { must: conditions } : undefined;
    };
    return QdrantMemoryClient;
}());
exports.QdrantMemoryClient = QdrantMemoryClient;
