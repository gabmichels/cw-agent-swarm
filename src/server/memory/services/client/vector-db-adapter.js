"use strict";
/**
 * Vector Database Adapter
 *
 * Adapts the QdrantMemoryClient to implement the IVectorDatabaseClient interface
 * required by the QueryOptimizer.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorDatabaseAdapter = void 0;
/**
 * Adapter for QdrantMemoryClient to implement IVectorDatabaseClient
 */
var VectorDatabaseAdapter = /** @class */ (function () {
    /**
     * Constructor
     *
     * @param client The memory client to adapt
     */
    function VectorDatabaseAdapter(client) {
        this.client = client;
    }
    /**
     * Add a point to the vector database
     *
     * @param collectionName Collection name
     * @param point Point data
     * @returns ID of the added point
     */
    VectorDatabaseAdapter.prototype.addPoint = function (collectionName, point) {
        return __awaiter(this, void 0, void 0, function () {
            var adaptedPoint;
            return __generator(this, function (_a) {
                adaptedPoint = {
                    id: point.id,
                    vector: point.vector,
                    payload: {
                        id: point.id,
                        text: point.payload.text || '',
                        timestamp: point.payload.timestamp || new Date().toISOString(),
                        type: point.payload.type || 'unknown',
                        metadata: point.payload.metadata || {}
                    }
                };
                // Call the underlying client
                return [2 /*return*/, this.client.addPoint(collectionName, adaptedPoint)];
            });
        });
    };
    /**
     * Search for similar points in the vector database
     *
     * @param collectionName Collection to search in
     * @param vector Embedding vector to search for
     * @param limit Maximum number of results
     * @param filter Optional filter conditions
     * @param scoreThreshold Minimum similarity score
     * @returns Search results
     */
    VectorDatabaseAdapter.prototype.search = function (collectionName_1, vector_1) {
        return __awaiter(this, arguments, void 0, function (collectionName, vector, limit, filter, scoreThreshold) {
            var results;
            if (limit === void 0) { limit = 10; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.client.searchPoints(collectionName, {
                            vector: vector,
                            filter: filter,
                            limit: limit,
                            scoreThreshold: scoreThreshold
                        })];
                    case 1:
                        results = _a.sent();
                        // Adapt the search results to the format expected by QueryOptimizer
                        return [2 /*return*/, {
                                matches: results.map(function (result) { return ({
                                    id: result.id,
                                    score: result.score,
                                    payload: result.payload
                                }); }),
                                totalCount: results.length
                            }];
                }
            });
        });
    };
    /**
     * Search points by vector similarity (required by IVectorDatabaseClient)
     *
     * @param collectionName Collection to search in
     * @param vector Embedding vector to search for
     * @param options Search options
     * @returns Array of database records
     */
    VectorDatabaseAdapter.prototype.searchPoints = function (collectionName, vector, options) {
        return __awaiter(this, void 0, void 0, function () {
            var results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.client.searchPoints(collectionName, {
                            vector: vector,
                            limit: options === null || options === void 0 ? void 0 : options.limit,
                            scoreThreshold: options === null || options === void 0 ? void 0 : options.scoreThreshold
                        })];
                    case 1:
                        results = _a.sent();
                        // Convert to DatabaseRecord format
                        return [2 /*return*/, results.map(function (result) { return ({
                                id: result.id,
                                vector: [], // Client doesn't return vectors by default
                                payload: result.payload
                            }); })];
                }
            });
        });
    };
    /**
     * Get points by IDs
     *
     * @param collectionName Collection name
     * @param ids IDs of points to retrieve
     * @returns Array of database records
     */
    VectorDatabaseAdapter.prototype.getPoints = function (collectionName, ids) {
        return __awaiter(this, void 0, void 0, function () {
            var points;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.client.getPoints(collectionName, ids)];
                    case 1:
                        points = _a.sent();
                        // Convert to DatabaseRecord format
                        return [2 /*return*/, points.map(function (point) { return ({
                                id: point.id,
                                vector: point.vector,
                                payload: point.payload
                            }); })];
                }
            });
        });
    };
    /**
     * Delete point from the vector database
     *
     * @param collectionName Collection name
     * @param id ID of point to delete
     * @param options Delete options
     * @returns Whether deletion was successful
     */
    VectorDatabaseAdapter.prototype.deletePoint = function (collectionName, id, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.client.deletePoint(collectionName, id, options)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    /**
     * Update a point in the vector database
     *
     * @param collectionName Collection name
     * @param id ID of the point to update
     * @param updates Partial updates
     * @returns Boolean indicating success
     */
    VectorDatabaseAdapter.prototype.updatePoint = function (collectionName, id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var adaptedUpdates;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        adaptedUpdates = {};
                        if (updates.vector) {
                            adaptedUpdates.vector = updates.vector;
                        }
                        if (updates.payload) {
                            adaptedUpdates.payload = __assign({}, updates.payload);
                        }
                        // Call the underlying client
                        return [4 /*yield*/, this.client.updatePoint(collectionName, id, adaptedUpdates)];
                    case 1:
                        // Call the underlying client
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    return VectorDatabaseAdapter;
}());
exports.VectorDatabaseAdapter = VectorDatabaseAdapter;
