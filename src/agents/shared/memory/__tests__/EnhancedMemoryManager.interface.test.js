"use strict";
/**
 * Enhanced Memory Manager Interface Tests
 *
 * These tests validate the interface design of the EnhancedMemoryManager.
 * They are type tests rather than implementation tests, focusing on
 * ensuring the interface contract is correctly defined.
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
var vitest_1 = require("vitest");
var MemoryVersionHistory_interface_1 = require("../interfaces/MemoryVersionHistory.interface");
var CognitiveMemory_interface_1 = require("../interfaces/CognitiveMemory.interface");
var BaseManager_1 = require("../../../shared/base/managers/BaseManager");
// Mock agent for testing
var mockAgent = {
    getAgentId: function () { return 'mock-agent'; },
    hasManager: function () { return true; },
    getManager: function () { return null; },
    initialize: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, true];
    }); }); },
    shutdown: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, true];
    }); }); },
    getAgentInfo: function () { return ({ id: 'mock-agent', name: 'Mock Agent' }); },
    handleEvent: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, true];
    }); }); },
    handleCommand: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, ({ success: true })];
    }); }); },
    setReady: function (ready) { }
};
// Create mock for EnhancedMemoryManager with necessary interfaces
var MockEnhancedMemoryManager = /** @class */ (function (_super) {
    __extends(MockEnhancedMemoryManager, _super);
    function MockEnhancedMemoryManager(config) {
        if (config === void 0) { config = { enabled: true }; }
        return _super.call(this, 'mock-enhanced-memory-manager', 'memory', mockAgent, config) || this;
    }
    // Additional methods required by EnhancedMemoryManager interface
    MockEnhancedMemoryManager.prototype.createMemoryVersion = function (memoryId, content, changeType, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        versionId: 'mock-version-id',
                        memoryId: memoryId,
                        content: content,
                        changeType: changeType,
                        timestamp: new Date()
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.getMemoryVersions = function (memoryId, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, [{
                            versionId: 'mock-version-id',
                            memoryId: memoryId,
                            content: 'Mock version content',
                            changeType: MemoryVersionHistory_interface_1.MemoryChangeType.UPDATED,
                            timestamp: new Date()
                        }]];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.getMemoryVersion = function (memoryId, versionId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        versionId: versionId,
                        memoryId: memoryId,
                        content: 'Mock version content',
                        changeType: MemoryVersionHistory_interface_1.MemoryChangeType.UPDATED,
                        timestamp: new Date()
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.rollbackMemoryToVersion = function (memoryId, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        success: true,
                        memoryId: memoryId,
                        newVersionId: 'new-version-id',
                        previousVersionId: options.targetVersionId
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.compareMemoryVersions = function (memoryId, firstVersionId, secondVersionId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        memoryId: memoryId,
                        firstVersionId: firstVersionId,
                        secondVersionId: secondVersionId,
                        changes: [{
                                type: 'changed',
                                content: 'Changed content',
                                lineNumber: 1
                            }],
                        isComplete: true
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.batchMemoryHistoryOperation = function (operation, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        success: true,
                        results: options.memoryIds.map(function (id) { return ({ id: id, success: true }); }),
                        successCount: options.memoryIds.length,
                        failureCount: 0
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.reset = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, true];
            });
        });
    };
    // Memory manager methods
    MockEnhancedMemoryManager.prototype.addMemory = function (content, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        id: 'mock-memory-id',
                        content: content,
                        metadata: metadata || {},
                        createdAt: new Date(),
                        lastAccessedAt: new Date(),
                        accessCount: 0
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.searchMemories = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, [
                        {
                            id: 'mock-memory-id',
                            content: 'Mock memory content',
                            metadata: {},
                            createdAt: new Date(),
                            lastAccessedAt: new Date(),
                            accessCount: 1
                        }
                    ]];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.getRecentMemories = function (limit) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, [
                        {
                            id: 'mock-memory-id',
                            content: 'Mock memory content',
                            metadata: {},
                            createdAt: new Date(),
                            lastAccessedAt: new Date(),
                            accessCount: 1
                        }
                    ]];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.consolidateMemories = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        success: true,
                        consolidatedCount: 1,
                        message: 'Successfully consolidated memories'
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.pruneMemories = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        success: true,
                        prunedCount: 1,
                        message: 'Successfully pruned memories'
                    }];
            });
        });
    };
    // Cognitive memory methods
    MockEnhancedMemoryManager.prototype.createAssociation = function (sourceMemoryId, targetMemoryId, associationType, description) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        id: 'mock-association-id',
                        sourceMemoryId: sourceMemoryId,
                        targetMemoryId: targetMemoryId,
                        associationType: associationType,
                        description: description,
                        strength: CognitiveMemory_interface_1.AssociationStrength.STRONG,
                        createdAt: new Date(),
                        score: 0.85,
                        metadata: {}
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.findAssociations = function (memoryId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, [
                        {
                            id: 'mock-association-id',
                            sourceMemoryId: memoryId,
                            targetMemoryId: 'target-memory-id',
                            associationType: CognitiveMemory_interface_1.CognitivePatternType.CAUSAL,
                            description: 'Mock association',
                            strength: CognitiveMemory_interface_1.AssociationStrength.STRONG,
                            createdAt: new Date(),
                            score: 0.85,
                            metadata: {}
                        }
                    ]];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.discoverAssociations = function (memoryIds) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, [
                        {
                            id: 'mock-association-id',
                            sourceMemoryId: memoryIds[0],
                            targetMemoryId: memoryIds[1],
                            associationType: CognitiveMemory_interface_1.CognitivePatternType.TEMPORAL,
                            description: 'Mock discovered association',
                            strength: CognitiveMemory_interface_1.AssociationStrength.MODERATE,
                            createdAt: new Date(),
                            score: 0.75,
                            metadata: {}
                        }
                    ]];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.synthesizeMemories = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        id: 'mock-synthesis-id',
                        sourceMemoryIds: options.memoryIds,
                        content: 'Mock synthesis content',
                        patternType: CognitiveMemory_interface_1.CognitivePatternType.CONCEPTUAL,
                        confidence: 0.8,
                        createdAt: new Date(),
                        metadata: {}
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.reasonAcrossMemories = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        id: 'mock-reasoning-id',
                        memoryIds: options.memoryIds,
                        prompt: options.prompt,
                        result: 'Mock reasoning result',
                        reasoningType: options.reasoningType,
                        confidence: 0.75,
                        createdAt: new Date(),
                        metadata: {}
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.findSimilarPatterns = function (patternType) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, [
                        {
                            id: 'mock-synthesis-id',
                            sourceMemoryIds: ['memory-1', 'memory-2'],
                            content: 'Mock pattern content',
                            patternType: patternType,
                            confidence: 0.8,
                            createdAt: new Date(),
                            metadata: {}
                        }
                    ]];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.extractInsights = function (memoryIds) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, ['Mock insight 1', 'Mock insight 2']];
            });
        });
    };
    // Conversation summarization methods
    MockEnhancedMemoryManager.prototype.summarizeConversation = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        summary: 'Mock conversation summary',
                        success: true,
                        stats: {
                            messageCount: 10,
                            userMessageCount: 5,
                            agentMessageCount: 5,
                            systemMessageCount: 0
                        }
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.summarizeMultipleConversations = function (conversationIds, options) {
        return __awaiter(this, void 0, void 0, function () {
            var result, _i, conversationIds_1, id;
            return __generator(this, function (_a) {
                result = {};
                for (_i = 0, conversationIds_1 = conversationIds; _i < conversationIds_1.length; _i++) {
                    id = conversationIds_1[_i];
                    result[id] = {
                        summary: "Mock summary for conversation ".concat(id),
                        success: true,
                        stats: {
                            messageCount: 10,
                            userMessageCount: 5,
                            agentMessageCount: 5,
                            systemMessageCount: 0
                        }
                    };
                }
                return [2 /*return*/, result];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.getConversationTopics = function (conversationId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, ['Topic 1', 'Topic 2', 'Topic 3']];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.extractActionItems = function (conversationId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, ['Action item 1', 'Action item 2']];
            });
        });
    };
    // Enhanced memory manager methods
    MockEnhancedMemoryManager.prototype.getEnhancedMemory = function (memoryId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        id: memoryId,
                        content: 'Mock enhanced memory content',
                        metadata: {},
                        createdAt: new Date(),
                        lastAccessedAt: new Date(),
                        accessCount: 1,
                        importance: 0.8,
                        novelty: 0.7,
                        emotionalValence: 0.5,
                        categories: ['category1', 'category2'],
                        cognitivelyProcessed: true,
                        lastCognitiveProcessingTime: new Date()
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.transformMemory = function (memoryId, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        id: memoryId,
                        content: "Transformed memory content (".concat(options.transformationType, ")"),
                        metadata: options.metadata || {},
                        createdAt: new Date(),
                        lastAccessedAt: new Date(),
                        accessCount: 1,
                        importance: 0.8,
                        novelty: 0.7,
                        cognitivelyProcessed: true
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.rateMemoryImportance = function (memoryId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, 0.8];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.rateMemoryNovelty = function (memoryId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, 0.7];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.analyzeMemoryEmotion = function (memoryId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, 0.5]; // Positive emotion
            });
        });
    };
    MockEnhancedMemoryManager.prototype.categorizeMemory = function (memoryId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, ['category1', 'category2']];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.generateMemoryContext = function (memoryId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        mainMemory: {
                            id: memoryId,
                            content: 'Mock memory content',
                            metadata: {},
                            createdAt: new Date(),
                            lastAccessedAt: new Date(),
                            accessCount: 1,
                            importance: 0.8
                        },
                        associatedMemories: [
                            {
                                id: 'associated-1',
                                content: 'Associated memory 1',
                                metadata: {},
                                createdAt: new Date(),
                                lastAccessedAt: new Date(),
                                accessCount: 1,
                                importance: 0.7
                            }
                        ],
                        synthesis: {
                            id: 'synthesis-id',
                            sourceMemoryIds: [memoryId, 'associated-1'],
                            content: 'Synthesis of memories',
                            patternType: CognitiveMemory_interface_1.CognitivePatternType.CONCEPTUAL,
                            confidence: 0.8,
                            createdAt: new Date(),
                            metadata: {}
                        }
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.processMemoryCognitively = function (memoryId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        id: memoryId,
                        content: 'Cognitively processed memory',
                        metadata: {},
                        createdAt: new Date(),
                        lastAccessedAt: new Date(),
                        accessCount: 1,
                        importance: 0.8,
                        novelty: 0.7,
                        emotionalValence: 0.5,
                        categories: ['category1', 'category2'],
                        cognitivelyProcessed: true,
                        lastCognitiveProcessingTime: new Date()
                    }];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.batchProcessMemoriesCognitively = function (memoryIds) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, memoryIds.map(function (id) { return ({
                        id: id,
                        content: 'Batch processed memory',
                        metadata: {},
                        createdAt: new Date(),
                        lastAccessedAt: new Date(),
                        accessCount: 1,
                        importance: 0.8,
                        novelty: 0.7,
                        emotionalValence: 0.5,
                        categories: ['category1', 'category2'],
                        cognitivelyProcessed: true,
                        lastCognitiveProcessingTime: new Date()
                    }); })];
            });
        });
    };
    // Override abstract methods from AbstractBaseManager
    MockEnhancedMemoryManager.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.initialized = true;
                return [2 /*return*/, true];
            });
        });
    };
    MockEnhancedMemoryManager.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.initialized = false;
                return [2 /*return*/];
            });
        });
    };
    return MockEnhancedMemoryManager;
}(BaseManager_1.AbstractBaseManager));
(0, vitest_1.describe)('EnhancedMemoryManager Interface', function () {
    (0, vitest_1.it)('should successfully create an instance of the mock implementation', function () {
        var manager = new MockEnhancedMemoryManager();
        (0, vitest_1.expect)(manager).toBeDefined();
        (0, vitest_1.expect)(manager.getType()).toBe('memory');
    });
    (0, vitest_1.it)('should correctly implement the EnhancedMemoryManager interface', function () { return __awaiter(void 0, void 0, void 0, function () {
        var manager, _a, memory, memories, association, synthesis, summary, enhancedMemory, importance, context, processedMemory;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    manager = new MockEnhancedMemoryManager({
                        enabled: true,
                        enableCognitiveMemory: true,
                        enableConversationSummarization: true
                    });
                    // Basic manager operations
                    _a = vitest_1.expect;
                    return [4 /*yield*/, manager.initialize()];
                case 1:
                    // Basic manager operations
                    _a.apply(void 0, [_b.sent()]).toBe(true);
                    (0, vitest_1.expect)(manager.isInitialized()).toBe(true);
                    (0, vitest_1.expect)(manager.getConfig().enabled).toBe(true);
                    (0, vitest_1.expect)(manager.isEnabled()).toBe(true);
                    (0, vitest_1.expect)(manager.getId()).toBe('mock-enhanced-memory-manager');
                    (0, vitest_1.expect)(manager.getAgent()).toBe(mockAgent);
                    // Test enable/disable
                    (0, vitest_1.expect)(manager.setEnabled(false)).toBe(true); // Returns true because state changed
                    (0, vitest_1.expect)(manager.isEnabled()).toBe(false);
                    return [4 /*yield*/, manager.addMemory('Test memory', { source: 'test' })];
                case 2:
                    memory = _b.sent();
                    (0, vitest_1.expect)(memory.content).toBe('Test memory');
                    return [4 /*yield*/, manager.searchMemories('test')];
                case 3:
                    memories = _b.sent();
                    (0, vitest_1.expect)(memories.length).toBeGreaterThan(0);
                    return [4 /*yield*/, manager.createAssociation('memory-1', 'memory-2', CognitiveMemory_interface_1.CognitivePatternType.CAUSAL, 'Causal relationship')];
                case 4:
                    association = _b.sent();
                    (0, vitest_1.expect)(association.associationType).toBe(CognitiveMemory_interface_1.CognitivePatternType.CAUSAL);
                    return [4 /*yield*/, manager.synthesizeMemories({
                            memoryIds: ['memory-1', 'memory-2']
                        })];
                case 5:
                    synthesis = _b.sent();
                    (0, vitest_1.expect)(synthesis.sourceMemoryIds).toContain('memory-1');
                    return [4 /*yield*/, manager.summarizeConversation()];
                case 6:
                    summary = _b.sent();
                    (0, vitest_1.expect)(summary.success).toBe(true);
                    return [4 /*yield*/, manager.getEnhancedMemory('memory-1')];
                case 7:
                    enhancedMemory = _b.sent();
                    (0, vitest_1.expect)(enhancedMemory === null || enhancedMemory === void 0 ? void 0 : enhancedMemory.cognitivelyProcessed).toBe(true);
                    return [4 /*yield*/, manager.rateMemoryImportance('memory-1')];
                case 8:
                    importance = _b.sent();
                    (0, vitest_1.expect)(importance).toBeGreaterThan(0);
                    return [4 /*yield*/, manager.generateMemoryContext('memory-1')];
                case 9:
                    context = _b.sent();
                    (0, vitest_1.expect)(context.mainMemory.id).toBe('memory-1');
                    return [4 /*yield*/, manager.processMemoryCognitively('memory-1')];
                case 10:
                    processedMemory = _b.sent();
                    (0, vitest_1.expect)(processedMemory.cognitivelyProcessed).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should handle configuration options correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
        var config, manager, updatedConfig;
        return __generator(this, function (_a) {
            config = {
                enabled: true,
                enableCognitiveMemory: true,
                enableConversationSummarization: true,
                maxAssociationsPerMemory: 10,
                enableAutoAssociationDiscovery: true,
                autoAssociationMinScore: 0.7,
                autoAssociationPatternTypes: [CognitiveMemory_interface_1.CognitivePatternType.TEMPORAL, CognitiveMemory_interface_1.CognitivePatternType.CAUSAL],
                enableAutoPruning: true,
                pruningIntervalMs: 3600000,
                enableAutoConsolidation: true
            };
            manager = new MockEnhancedMemoryManager(config);
            (0, vitest_1.expect)(manager.getConfig().enableCognitiveMemory).toBe(true);
            (0, vitest_1.expect)(manager.getConfig().maxAssociationsPerMemory).toBe(10);
            updatedConfig = manager.updateConfig({
                enableCognitiveMemory: false,
                maxAssociationsPerMemory: 5
            });
            (0, vitest_1.expect)(updatedConfig.enableCognitiveMemory).toBe(false);
            (0, vitest_1.expect)(updatedConfig.maxAssociationsPerMemory).toBe(5);
            // Original config values should remain intact
            (0, vitest_1.expect)(updatedConfig.enableConversationSummarization).toBe(true);
            return [2 /*return*/];
        });
    }); });
    (0, vitest_1.it)('should handle different types of memory transformations', function () { return __awaiter(void 0, void 0, void 0, function () {
        var manager, transformations, _i, transformations_1, transformationType, options, transformed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    manager = new MockEnhancedMemoryManager();
                    transformations = [
                        'generalize',
                        'specify',
                        'reframe',
                        'connect',
                        'simplify'
                    ];
                    _i = 0, transformations_1 = transformations;
                    _a.label = 1;
                case 1:
                    if (!(_i < transformations_1.length)) return [3 /*break*/, 4];
                    transformationType = transformations_1[_i];
                    options = {
                        transformationType: transformationType,
                        maxLength: 100,
                        context: 'Test context'
                    };
                    return [4 /*yield*/, manager.transformMemory('memory-1', options)];
                case 2:
                    transformed = _a.sent();
                    (0, vitest_1.expect)(transformed.content).toContain(transformationType);
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    }); });
});
