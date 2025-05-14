"use strict";
/**
 * Enhanced Memory Service
 *
 * This service extends the base memory service with dual-field support
 * for improved query performance in multi-agent systems.
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.EnhancedMemoryService = void 0;
var uuid_1 = require("uuid");
var memory_service_1 = require("../memory/memory-service");
var config_1 = require("../../config");
var collections_1 = require("../../config/collections");
var utils_1 = require("../../utils");
var structured_id_1 = require("../../../../types/structured-id");
/**
 * Field mapping for metadata to top-level fields
 */
var FIELD_MAPPING = {
    'metadata.userId.id': 'userId',
    'metadata.agentId.id': 'agentId',
    'metadata.chatId.id': 'chatId',
    'metadata.thread.id': 'threadId',
    'metadata.messageType': 'messageType',
    'metadata.importance': 'importance',
    'metadata.senderAgentId.id': 'senderAgentId',
    'metadata.receiverAgentId.id': 'receiverAgentId',
    'metadata.communicationType': 'communicationType',
    'metadata.priority': 'priority'
};
/**
 * Enhanced memory service with dual-field support
 */
var EnhancedMemoryService = /** @class */ (function (_super) {
    __extends(EnhancedMemoryService, _super);
    /**
     * Create a new enhanced memory service
     */
    function EnhancedMemoryService(memoryClient, embeddingClient, options) {
        var _this = _super.call(this, memoryClient, embeddingClient, options) || this;
        _this.memoryClient = memoryClient;
        _this.embeddingClient = embeddingClient;
        _this.getTimestampFn = (options === null || options === void 0 ? void 0 : options.getTimestamp) || (function () { return Date.now(); });
        return _this;
    }
    /**
     * Add a memory with top-level indexable fields
     */
    EnhancedMemoryService.prototype.addMemory = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var validation, collectionConfig, id, embedding, _a, point, indexableFields, enhancedPoint, error_1, memoryError;
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
                                        code: config_1.MemoryErrorCode.VALIDATION_ERROR,
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
                        return [4 /*yield*/, this.embeddingClient.getEmbedding(params.content)];
                    case 1:
                        _a = (_e.sent()).embedding;
                        _e.label = 2;
                    case 2:
                        embedding = _a;
                        point = {
                            id: id,
                            vector: embedding,
                            payload: __assign(__assign(__assign({ id: id, text: params.content, type: params.type, timestamp: this.getTimestampFn().toString() }, (collectionConfig.defaults || {})), (params.payload || {})), { metadata: __assign(__assign({}, (((_d = collectionConfig.defaults) === null || _d === void 0 ? void 0 : _d.metadata) || {})), (params.metadata || {})) })
                        };
                        indexableFields = this.extractIndexableFields((params.metadata || {}));
                        enhancedPoint = __assign(__assign(__assign({}, point), indexableFields), { 
                            // Add timestamp as number for better filtering
                            timestamp: this.getTimestampFn() });
                        // Add to collection
                        return [4 /*yield*/, this.memoryClient.addPoint(collectionConfig.name, enhancedPoint)];
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
     * Extract indexable fields from metadata
     */
    EnhancedMemoryService.prototype.extractIndexableFields = function (metadata) {
        var _a;
        if (!metadata)
            return {};
        var fields = {};
        // User and conversation context
        if (metadata.userId && typeof metadata.userId === 'object') {
            fields.userId = this.getIdString(metadata.userId);
        }
        if (metadata.agentId && typeof metadata.agentId === 'object') {
            fields.agentId = this.getIdString(metadata.agentId);
        }
        if (metadata.chatId && typeof metadata.chatId === 'object') {
            fields.chatId = this.getIdString(metadata.chatId);
        }
        // Thread and message info
        if ((_a = metadata.thread) === null || _a === void 0 ? void 0 : _a.id) {
            fields.threadId = this.getIdString(metadata.thread.id);
        }
        if (metadata.messageType) {
            fields.messageType = String(metadata.messageType);
        }
        // Classification and importance
        if (metadata.importance) {
            fields.importance = String(metadata.importance);
        }
        // Agent-to-agent communication fields
        if (metadata.senderAgentId && typeof metadata.senderAgentId === 'object') {
            fields.senderAgentId = this.getIdString(metadata.senderAgentId);
        }
        if (metadata.receiverAgentId && typeof metadata.receiverAgentId === 'object') {
            fields.receiverAgentId = this.getIdString(metadata.receiverAgentId);
        }
        if (metadata.communicationType) {
            fields.communicationType = String(metadata.communicationType);
        }
        if (metadata.priority) {
            fields.priority = String(metadata.priority);
        }
        return fields;
    };
    /**
     * Convert a StructuredId to a string
     */
    EnhancedMemoryService.prototype.getIdString = function (id) {
        if (typeof id === 'string') {
            return id;
        }
        // Handle StructuredId objects using the existing utility function
        if (typeof id === 'object' && id !== null) {
            if ('toString' in id && typeof id.toString === 'function') {
                return id.toString();
            }
            if ('id' in id && typeof id.id === 'string') {
                return id.id;
            }
            if ('namespace' in id && 'type' in id && 'id' in id) {
                return (0, structured_id_1.structuredIdToString)(id);
            }
        }
        return String(id);
    };
    /**
     * Search with optimized field usage
     */
    EnhancedMemoryService.prototype.searchMemories = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var filterConditions, originalParams, results, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        filterConditions = this.createOptimizedFilterConditions(params.filter || {});
                        originalParams = __assign({}, params);
                        if (filterConditions && filterConditions.length > 0) {
                            originalParams.filter = __assign(__assign({}, (originalParams.filter || {})), { $conditions: filterConditions });
                        }
                        return [4 /*yield*/, _super.prototype.searchMemories.call(this, originalParams)];
                    case 1:
                        results = _a.sent();
                        // Return results cast to enhanced type
                        return [2 /*return*/, results];
                    case 2:
                        error_2 = _a.sent();
                        console.error('Error searching memories with optimization:', error_2);
                        throw (0, utils_1.handleMemoryError)(error_2, 'searchMemories');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create optimized filter conditions using top-level fields when possible
     */
    EnhancedMemoryService.prototype.createOptimizedFilterConditions = function (filters) {
        var _this = this;
        var conditions = [];
        // Process each filter
        Object.entries(filters).forEach(function (_a) {
            var key = _a[0], value = _a[1];
            if (value === undefined || value === null)
                return;
            // Skip special keys like $conditions
            if (key.startsWith('$'))
                return;
            // Check if there's a top-level field for this metadata path
            var metadataPath = "metadata.".concat(key);
            var topLevelField = FIELD_MAPPING[metadataPath];
            // Handle structured IDs in filters
            var stringValue = _this.getFilterValueAsString(value);
            if (topLevelField) {
                // Use top-level field for better performance
                conditions.push({
                    key: topLevelField,
                    match: { value: stringValue }
                });
            }
            else {
                // Fall back to metadata field
                conditions.push({
                    key: metadataPath,
                    match: { value: stringValue }
                });
            }
        });
        return conditions;
    };
    /**
     * Convert filter value to string, handling structured IDs
     */
    EnhancedMemoryService.prototype.getFilterValueAsString = function (value) {
        // Handle structured IDs in filters
        if (typeof value === 'object' && value !== null) {
            return this.getIdString(value);
        }
        return String(value);
    };
    return EnhancedMemoryService;
}(memory_service_1.MemoryService));
exports.EnhancedMemoryService = EnhancedMemoryService;
