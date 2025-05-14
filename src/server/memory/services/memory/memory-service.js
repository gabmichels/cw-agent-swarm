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
exports.MemoryService = void 0;
/**
 * Memory service implementation
 */
var uuid_1 = require("uuid");
var config_1 = require("../../config");
var collections_1 = require("../../config/collections");
var utils_1 = require("../../utils");
var types_1 = require("@/lib/errors/types");
/**
 * Core memory service for CRUD operations
 */
var MemoryService = /** @class */ (function () {
    /**
     * Create a new memory service
     */
    function MemoryService(client, embeddingService, options) {
        this.client = client;
        this.embeddingService = embeddingService;
        this.getTimestamp = (options === null || options === void 0 ? void 0 : options.getTimestamp) || (function () { return Date.now(); });
    }
    /**
     * Add a new memory
     */
    MemoryService.prototype.addMemory = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var validation, collectionConfig, id, embedding, _a, point, error_1, memoryError;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 4, , 5]);
                        validation = (0, utils_1.validateAddMemoryParams)(params);
                        if (!validation.valid) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: {
                                        code: types_1.MemoryErrorCode.VALIDATION_FAILED,
                                        message: ((_c = (_b = validation.errors) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) || 'Invalid parameters'
                                    }
                                }];
                        }
                        collectionConfig = collections_1.COLLECTION_CONFIGS[params.type];
                        if (!collectionConfig) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: {
                                        code: 'INVALID_TYPE',
                                        message: "Invalid memory type: ".concat(params.type)
                                    }
                                }];
                        }
                        id = params.id || (0, uuid_1.v4)();
                        _a = params.embedding;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.embeddingService.getEmbedding(params.content)];
                    case 1:
                        _a = (_e.sent()).embedding;
                        _e.label = 2;
                    case 2:
                        embedding = _a;
                        point = {
                            id: id,
                            vector: embedding,
                            payload: __assign(__assign(__assign({ text: params.content, type: params.type, timestamp: this.getTimestamp().toString() }, (collectionConfig.defaults || {})), (params.payload || {})), { metadata: __assign(__assign({}, (((_d = collectionConfig.defaults) === null || _d === void 0 ? void 0 : _d.metadata) || {})), (params.metadata || {})) })
                        };
                        // Add to collection
                        return [4 /*yield*/, this.client.addPoint(collectionConfig.name, point)];
                    case 3:
                        // Add to collection
                        _e.sent();
                        return [2 /*return*/, {
                                success: true,
                                id: id
                            }];
                    case 4:
                        error_1 = _e.sent();
                        console.error('Error adding memory:', error_1);
                        memoryError = (0, utils_1.handleMemoryError)(error_1, 'addMemory');
                        return [2 /*return*/, {
                                success: false,
                                error: {
                                    code: memoryError.code,
                                    message: memoryError.message
                                }
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get a memory by ID
     */
    MemoryService.prototype.getMemory = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var validation, collectionConfig, points, error_2;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        validation = (0, utils_1.validateGetMemoryParams)(params);
                        if (!validation.valid) {
                            throw (0, utils_1.handleMemoryError)(new Error(((_b = (_a = validation.errors) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) || 'Invalid parameters'), 'getMemory');
                        }
                        collectionConfig = collections_1.COLLECTION_CONFIGS[params.type];
                        if (!collectionConfig) {
                            throw new Error("Invalid memory type: ".concat(params.type));
                        }
                        return [4 /*yield*/, this.client.getPoints(collectionConfig.name, [params.id])];
                    case 1:
                        points = _c.sent();
                        // Return first point or null
                        return [2 /*return*/, points.length > 0 ? points[0] : null];
                    case 2:
                        error_2 = _c.sent();
                        console.error('Error getting memory:', error_2);
                        throw (0, utils_1.handleMemoryError)(error_2, 'getMemory');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update a memory by ID
     */
    MemoryService.prototype.updateMemory = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var validation, collectionConfig, updates, _a, error_3;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 5, , 6]);
                        validation = (0, utils_1.validateUpdateMemoryParams)(params);
                        if (!validation.valid) {
                            throw (0, utils_1.handleMemoryError)(new Error(((_c = (_b = validation.errors) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) || 'Invalid parameters'), 'updateMemory');
                        }
                        collectionConfig = collections_1.COLLECTION_CONFIGS[params.type];
                        if (!collectionConfig) {
                            throw new Error("Invalid memory type: ".concat(params.type));
                        }
                        updates = {
                            payload: {}
                        };
                        if (!(params.content && !params.preserveEmbedding)) return [3 /*break*/, 2];
                        _a = updates;
                        return [4 /*yield*/, this.embeddingService.getEmbedding(params.content)];
                    case 1:
                        _a.vector = (_e.sent()).embedding;
                        updates.payload.text = params.content;
                        return [3 /*break*/, 3];
                    case 2:
                        if (params.content) {
                            updates.payload.text = params.content;
                        }
                        _e.label = 3;
                    case 3:
                        // Add payload updates
                        if (params.payload) {
                            updates.payload = __assign(__assign({}, updates.payload), params.payload);
                        }
                        // Add metadata updates
                        if (params.metadata) {
                            updates.payload.metadata = __assign(__assign({}, ((_d = updates.payload) === null || _d === void 0 ? void 0 : _d.metadata) || {}), params.metadata);
                        }
                        return [4 /*yield*/, this.client.updatePoint(collectionConfig.name, params.id, updates)];
                    case 4: 
                    // Update point
                    return [2 /*return*/, _e.sent()];
                    case 5:
                        error_3 = _e.sent();
                        console.error('Error updating memory:', error_3);
                        throw (0, utils_1.handleMemoryError)(error_3, 'updateMemory');
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Delete a memory by ID
     */
    MemoryService.prototype.deleteMemory = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var validation, collectionConfig, error_4;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        validation = (0, utils_1.validateDeleteMemoryParams)(params);
                        if (!validation.valid) {
                            throw (0, utils_1.handleMemoryError)(new Error(((_b = (_a = validation.errors) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) || 'Invalid parameters'), 'deleteMemory');
                        }
                        collectionConfig = collections_1.COLLECTION_CONFIGS[params.type];
                        if (!collectionConfig) {
                            throw new Error("Invalid memory type: ".concat(params.type));
                        }
                        return [4 /*yield*/, this.client.deletePoint(collectionConfig.name, params.id, { hardDelete: params.hardDelete })];
                    case 1: 
                    // Delete from collection
                    return [2 /*return*/, _c.sent()];
                    case 2:
                        error_4 = _c.sent();
                        console.error('Error deleting memory:', error_4);
                        throw (0, utils_1.handleMemoryError)(error_4, 'deleteMemory');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Search for memories
     */
    MemoryService.prototype.searchMemories = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var collectionConfig, searchVector, results, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        collectionConfig = collections_1.COLLECTION_CONFIGS[params.type];
                        if (!collectionConfig) {
                            throw new Error("Invalid memory type: ".concat(params.type));
                        }
                        searchVector = params.vector;
                        if (!(!searchVector && params.query)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.embeddingService.getEmbedding(params.query)];
                    case 1:
                        searchVector = (_a.sent()).embedding;
                        _a.label = 2;
                    case 2: return [4 /*yield*/, this.client.searchPoints(collectionConfig.name, {
                            vector: searchVector,
                            filter: params.filter,
                            limit: params.limit || config_1.DEFAULTS.DEFAULT_LIMIT,
                            offset: params.offset,
                            includeVectors: params.includeVectors,
                            scoreThreshold: params.minScore
                        })];
                    case 3:
                        results = _a.sent();
                        // Return memory points - properly handle MemorySearchResult structure
                        return [2 /*return*/, results.map(function (result) { return ({
                                id: result.id,
                                vector: [], // Default empty vector if not included
                                payload: result.payload
                            }); })];
                    case 4:
                        error_5 = _a.sent();
                        console.error('Error searching memories:', error_5);
                        throw (0, utils_1.handleMemoryError)(error_5, 'searchMemories');
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get version history for a memory
     */
    MemoryService.prototype.getMemoryHistory = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var memoryType_1, _i, _a, type, memory, currentMemory, searchQuery, editRecords, history_1, error_6;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 8, , 9]);
                        memoryType_1 = params.type;
                        if (!!memoryType_1) return [3 /*break*/, 5];
                        _i = 0, _a = Object.values(config_1.MemoryType);
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        type = _a[_i];
                        return [4 /*yield*/, this.getMemory({
                                id: params.id,
                                type: type
                            })];
                    case 2:
                        memory = _b.sent();
                        if (memory) {
                            memoryType_1 = type;
                            return [3 /*break*/, 4];
                        }
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        // If still not found, use default type
                        if (!memoryType_1) {
                            memoryType_1 = config_1.MemoryType.MESSAGE;
                        }
                        _b.label = 5;
                    case 5: return [4 /*yield*/, this.getMemory({
                            id: params.id,
                            type: memoryType_1
                        })];
                    case 6:
                        currentMemory = _b.sent();
                        if (!currentMemory) {
                            return [2 /*return*/, []];
                        }
                        searchQuery = {
                            filter: {
                                'metadata.original_memory_id': params.id
                            },
                            limit: params.limit || 10,
                            sort: {
                                field: 'payload.timestamp',
                                direction: 'desc'
                            }
                        };
                        return [4 /*yield*/, this.client.searchPoints(collections_1.MEMORY_EDIT_COLLECTION.name, searchQuery)];
                    case 7:
                        editRecords = _b.sent();
                        history_1 = editRecords.map(function (edit) {
                            var metadata = edit.payload.metadata;
                            return {
                                id: edit.id,
                                vector: edit.vector || [],
                                payload: __assign(__assign({}, edit.payload), { type: metadata.original_type || memoryType_1, timestamp: edit.payload.timestamp, metadata: __assign(__assign({}, metadata), { isMemoryEdit: true, edit_type: metadata.edit_type || 'update', editor_type: metadata.editor_type || 'system', editor_id: metadata.editor_id, diff_summary: metadata.diff_summary, current: metadata.current || false, previous_version_id: metadata.previous_version_id }) })
                            };
                        });
                        // Add current memory as the latest version if it exists
                        if (currentMemory) {
                            history_1.unshift(__assign(__assign({}, currentMemory), { payload: __assign(__assign({}, currentMemory.payload), { metadata: __assign(__assign({}, currentMemory.payload.metadata), { isMemoryEdit: false, current: true }) }) }));
                        }
                        return [2 /*return*/, history_1];
                    case 8:
                        error_6 = _b.sent();
                        console.error('Error getting memory history:', error_6);
                        throw (0, utils_1.handleMemoryError)(error_6, 'getMemoryHistory');
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Rollback a memory to a specific version
     */
    MemoryService.prototype.rollbackMemory = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var validation, memoryType, currentMemory_1, history_2, targetVersion, currentMemory, editMetadata, editResult, updateResult, error_7, memoryError;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 7, , 8]);
                        validation = (0, utils_1.validateRollbackMemoryParams)(params);
                        if (!validation.valid) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: {
                                        code: types_1.MemoryErrorCode.VALIDATION_FAILED,
                                        message: ((_b = (_a = validation.errors) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) || 'Invalid parameters'
                                    }
                                }];
                        }
                        memoryType = params.type;
                        if (!!memoryType) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getMemory({
                                id: params.id,
                                type: config_1.MemoryType.MESSAGE // Default type for initial lookup
                            })];
                    case 1:
                        currentMemory_1 = _c.sent();
                        if (!currentMemory_1) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: {
                                        code: types_1.MemoryErrorCode.NOT_FOUND,
                                        message: "Memory not found: ".concat(params.id)
                                    }
                                }];
                        }
                        memoryType = currentMemory_1.payload.type;
                        _c.label = 2;
                    case 2: return [4 /*yield*/, this.getMemoryHistory({
                            id: params.id,
                            type: memoryType,
                            limit: 100 // Get enough history to find the version
                        })];
                    case 3:
                        history_2 = _c.sent();
                        targetVersion = history_2.find(function (v) { return v.id === params.versionId; });
                        if (!targetVersion) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: {
                                        code: types_1.MemoryErrorCode.NOT_FOUND,
                                        message: "Version not found: ".concat(params.versionId)
                                    }
                                }];
                        }
                        // Validate that we're not trying to rollback to the current version
                        if (targetVersion.id === params.id) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: {
                                        code: types_1.MemoryErrorCode.INVALID_OPERATION,
                                        message: 'Cannot rollback to current version'
                                    }
                                }];
                        }
                        return [4 /*yield*/, this.getMemory({
                                id: params.id,
                                type: memoryType
                            })];
                    case 4:
                        currentMemory = _c.sent();
                        if (!currentMemory) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: {
                                        code: types_1.MemoryErrorCode.NOT_FOUND,
                                        message: "Current memory not found: ".concat(params.id)
                                    }
                                }];
                        }
                        editMetadata = {
                            schemaVersion: '1.0.0',
                            original_memory_id: params.id,
                            original_type: memoryType,
                            original_timestamp: currentMemory.payload.timestamp,
                            edit_type: 'update',
                            editor_type: params.editorType || 'system',
                            editor_id: params.editorId,
                            diff_summary: "Rolled back to version from ".concat(new Date(targetVersion.payload.timestamp).toLocaleString()),
                            current: true,
                            previous_version_id: currentMemory.id,
                            _skip_logging: false
                        };
                        return [4 /*yield*/, this.addMemory({
                                type: config_1.MemoryType.MEMORY_EDIT,
                                content: targetVersion.payload.text,
                                metadata: editMetadata,
                                payload: __assign(__assign({}, targetVersion.payload), { metadata: editMetadata })
                            })];
                    case 5:
                        editResult = _c.sent();
                        if (!editResult.success) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: {
                                        code: types_1.MemoryErrorCode.TRANSACTION_FAILED,
                                        message: 'Failed to create edit record for rollback'
                                    }
                                }];
                        }
                        return [4 /*yield*/, this.updateMemory({
                                id: params.id,
                                type: memoryType,
                                content: targetVersion.payload.text,
                                metadata: __assign(__assign({}, currentMemory.payload.metadata), { current: true, last_rollback: {
                                        version_id: params.versionId,
                                        timestamp: this.getTimestamp().toString(),
                                        editor_type: params.editorType || 'system',
                                        editor_id: params.editorId
                                    } })
                            })];
                    case 6:
                        updateResult = _c.sent();
                        if (!updateResult) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: {
                                        code: types_1.MemoryErrorCode.TRANSACTION_FAILED,
                                        message: 'Failed to update memory with rolled back content'
                                    }
                                }];
                        }
                        return [2 /*return*/, {
                                success: true,
                                id: params.id
                            }];
                    case 7:
                        error_7 = _c.sent();
                        console.error('Error rolling back memory:', error_7);
                        memoryError = (0, utils_1.handleMemoryError)(error_7, 'rollbackMemory');
                        return [2 /*return*/, {
                                success: false,
                                error: {
                                    code: memoryError.code,
                                    message: memoryError.message
                                }
                            }];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    return MemoryService;
}());
exports.MemoryService = MemoryService;
