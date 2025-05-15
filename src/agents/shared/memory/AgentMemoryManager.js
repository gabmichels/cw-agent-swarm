"use strict";
/**
 * AgentMemoryManager.ts - Agent-scoped memory management
 *
 * This module provides an implementation of the MemoryManager interface
 * with agent-scoped memory access using the MemoryIsolationManager.
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
exports.AgentMemoryManager = exports.DEFAULT_AGENT_MEMORY_MANAGER_CONFIG = void 0;
var uuid_1 = require("uuid");
var BaseManager_1 = require("../base/managers/BaseManager");
var MemoryIsolationManager_1 = require("./MemoryIsolationManager");
var MemoryScope_1 = require("./MemoryScope");
var ManagerType_1 = require("../base/managers/ManagerType");
var DefaultConversationSummarizer_1 = require("./summarization/DefaultConversationSummarizer");
/**
 * Default memory manager configuration
 */
exports.DEFAULT_AGENT_MEMORY_MANAGER_CONFIG = {
    enabled: true,
    enableAutoPruning: true,
    pruningIntervalMs: 1000 * 60 * 60, // 1 hour
    maxShortTermEntries: 1000,
    relevanceThreshold: 0.7,
    enableAutoConsolidation: true,
    consolidationIntervalMs: 1000 * 60 * 60 * 24, // 1 day
    minMemoriesForConsolidation: 50,
    forgetSourceMemoriesAfterConsolidation: false,
    enableMemoryInjection: true,
    maxInjectedMemories: 5,
    createPrivateScope: true,
    defaultScopeName: 'private'
};
/**
 * Agent memory manager implementation with isolation capabilities
 */
var AgentMemoryManager = /** @class */ (function (_super) {
    __extends(AgentMemoryManager, _super);
    /**
     * Creates a new agent memory manager
     * @param agent The agent this manager belongs to
     * @param config Configuration options
     */
    function AgentMemoryManager(agent, config) {
        if (config === void 0) { config = { enabled: true }; }
        var _this = _super.call(this, "memory-manager-".concat((0, uuid_1.v4)()), ManagerType_1.ManagerType.MEMORY, agent, __assign({ enabled: true }, config)) || this;
        _this._initialized = false;
        _this.memoryStore = new Map();
        // Merge defaults with provided config
        _this.config = __assign(__assign({}, exports.DEFAULT_AGENT_MEMORY_MANAGER_CONFIG), config);
        // Create isolation manager
        _this.isolationManager = new MemoryIsolationManager_1.MemoryIsolationManager(_this.config.isolation || MemoryIsolationManager_1.DEFAULT_MEMORY_ISOLATION_CONFIG);
        _this.conversationSummarizer = new DefaultConversationSummarizer_1.DefaultConversationSummarizer();
        return _this;
    }
    /**
     * Sets the initialization status
     * @param initialized Whether the manager is initialized
     */
    AgentMemoryManager.prototype.setInitialized = function (initialized) {
        this._initialized = initialized;
    };
    /**
     * Initializes the memory manager
     */
    AgentMemoryManager.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var scopes;
            return __generator(this, function (_a) {
                if (this._initialized) {
                    return [2 /*return*/, true];
                }
                try {
                    console.log("Initializing AgentMemoryManager for agent ".concat(this.getAgent().getAgentId()));
                    // Create private scope for the agent if enabled
                    if (this.config.createPrivateScope) {
                        this.privateScope = this.isolationManager.createScope({
                            name: this.config.defaultScopeName || 'private',
                            description: "Private memory space for agent ".concat(this.getAgent().getAgentId()),
                            accessLevel: MemoryScope_1.MemoryAccessLevel.PRIVATE,
                            ownerAgentId: this.getAgent().getAgentId(),
                            allowedMemoryTypes: this.config.allowedMemoryTypes
                        });
                        console.log("Created private scope for agent ".concat(this.getAgent().getAgentId(), ": ").concat(this.privateScope.scopeId.id));
                    }
                    scopes = this.isolationManager.getScopesForAgent(this.getAgent().getAgentId());
                    this.sharedScope = scopes.find(function (s) { return s.accessPolicy.accessLevel === MemoryScope_1.MemoryAccessLevel.PUBLIC; });
                    if (this.sharedScope) {
                        console.log("Found shared scope: ".concat(this.sharedScope.scopeId.id));
                    }
                    else {
                        console.warn('No shared scope available');
                    }
                    // Initialize memory store
                    this.memoryStore.clear();
                    this._initialized = true;
                    return [2 /*return*/, true];
                }
                catch (error) {
                    this._initialized = false;
                    console.error('Error initializing AgentMemoryManager:', error);
                    return [2 /*return*/, false];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Implements memory operations with agent scoping and isolation
     */
    /**
     * Adds a memory with proper agent scoping
     * @param content Memory content
     * @param metadata Additional metadata
     * @returns The added memory
     */
    AgentMemoryManager.prototype.addMemory = function (content_1) {
        return __awaiter(this, arguments, void 0, function (content, metadata) {
            var scopeId, type, memoryId, memory;
            if (metadata === void 0) { metadata = {}; }
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                if (!this.isEnabled()) {
                    throw new Error('Memory manager is disabled');
                }
                scopeId = this.getScopeId(metadata.scopeId);
                if (!scopeId) {
                    throw new Error('No valid memory scope available');
                }
                type = metadata.type || 'general';
                memoryId = "mem_".concat((0, uuid_1.v4)());
                memory = __assign({ id: memoryId, content: content, type: type, created: new Date(), agentId: this.getAgent().getAgentId(), scopeId: scopeId }, metadata);
                // In a real implementation, this would call isolationManager.addMemory()
                console.log("Added memory ".concat(memoryId, " for agent ").concat(this.getAgent().getAgentId(), " in scope ").concat(scopeId));
                this.memoryStore.set(memory.id, memory);
                return [2 /*return*/, memory];
            });
        });
    };
    /**
     * Searches for memories with proper agent scoping
     * @param query Search query
     * @param options Search options
     * @returns Matching memories
     */
    AgentMemoryManager.prototype.searchMemories = function (query_1) {
        return __awaiter(this, arguments, void 0, function (query, options) {
            var scopeId, searchResults, lowerQuery, memories, _i, memories_1, memory;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                if (!this.isEnabled()) {
                    throw new Error('Memory manager is disabled');
                }
                scopeId = this.getScopeId(options.scopeId);
                if (!scopeId) {
                    return [2 /*return*/, []];
                }
                // For now, since MemoryIsolationManager doesn't have a real implementation yet,
                // we'll return an empty array for demonstration purposes
                // In a real implementation, this would call isolationManager.getRelevantMemories()
                console.log("Searching memories for agent ".concat(this.getAgent().getAgentId(), " in scope ").concat(scopeId, " with query: ").concat(query));
                searchResults = [];
                lowerQuery = query.toLowerCase();
                memories = Array.from(this.memoryStore.values());
                for (_i = 0, memories_1 = memories; _i < memories_1.length; _i++) {
                    memory = memories_1[_i];
                    if (typeof memory.content === 'string' && memory.content.toLowerCase().includes(lowerQuery)) {
                        searchResults.push(memory);
                    }
                }
                return [2 /*return*/, searchResults];
            });
        });
    };
    /**
     * Searches across all accessible scopes
     * @param query Search query
     * @param options Search options
     * @returns Matching memories from all accessible scopes
     */
    AgentMemoryManager.prototype.searchAllScopes = function (query_1) {
        return __awaiter(this, arguments, void 0, function (query, options) {
            var scopes, allResults, _loop_1, this_1, _i, scopes_1, scope;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                if (!this.isEnabled()) {
                    throw new Error('Memory manager is disabled');
                }
                scopes = this.isolationManager.getScopesForAgent(this.getAgent().getAgentId());
                allResults = [];
                _loop_1 = function (scope) {
                    var scopeId = scope.scopeId.id;
                    // For now, we'll just log the search since the implementation is not real
                    console.log("Searching memories for agent ".concat(this_1.getAgent().getAgentId(), " in scope ").concat(scopeId, " with query: ").concat(query));
                    // In a real implementation, this would use actual search results
                    // const scopeResults = await this.isolationManager.getRelevantMemories(...)
                    var scopeResults = [];
                    // Add scope identifier to each result
                    var resultsWithScope = scopeResults.map(function (result) { return (__assign(__assign({}, result), { scopeId: scopeId, scopeName: scope.scopeId.name })); });
                    // Add to all results
                    allResults.push.apply(allResults, resultsWithScope);
                };
                this_1 = this;
                for (_i = 0, scopes_1 = scopes; _i < scopes_1.length; _i++) {
                    scope = scopes_1[_i];
                    _loop_1(scope);
                }
                // Sort results by relevance
                // In a real implementation, we would re-rank results here
                return [2 /*return*/, allResults];
            });
        });
    };
    /**
     * Gets recent memories
     * @param limit Maximum number of memories to return
     * @param options Additional options
     * @returns Recent memories
     */
    AgentMemoryManager.prototype.getRecentMemories = function () {
        return __awaiter(this, arguments, void 0, function (limit, options) {
            var scopeId;
            if (limit === void 0) { limit = 10; }
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                if (!this.isEnabled()) {
                    throw new Error('Memory manager is disabled');
                }
                scopeId = this.getScopeId(options.scopeId);
                if (!scopeId) {
                    return [2 /*return*/, []];
                }
                // For now, since MemoryIsolationManager doesn't have a real implementation yet,
                // we'll return an empty array for demonstration purposes
                console.log("Getting recent memories for agent ".concat(this.getAgent().getAgentId(), " in scope ").concat(scopeId, " with limit: ").concat(limit));
                return [2 /*return*/, []];
            });
        });
    };
    /**
     * Consolidates memories
     */
    AgentMemoryManager.prototype.consolidateMemories = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                if (!this.isEnabled()) {
                    throw new Error('Memory manager is disabled');
                }
                // In a real implementation, this would implement memory consolidation logic
                // For now, this is a placeholder
                console.log("Consolidating memories for agent ".concat(this.getAgent().getAgentId()));
                return [2 /*return*/];
            });
        });
    };
    /**
     * Prunes memories
     */
    AgentMemoryManager.prototype.pruneMemories = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                if (!this.isEnabled()) {
                    throw new Error('Memory manager is disabled');
                }
                // In a real implementation, this would implement memory pruning logic
                // For now, this is a placeholder
                console.log("Pruning memories for agent ".concat(this.getAgent().getAgentId()));
                return [2 /*return*/];
            });
        });
    };
    /**
     * Memory sharing operations
     */
    /**
     * Shares memories with another agent
     * @param targetAgentId Target agent ID
     * @param options Sharing options
     * @returns Whether the sharing request was created
     */
    AgentMemoryManager.prototype.shareMemories = function (targetAgentId_1) {
        return __awaiter(this, arguments, void 0, function (targetAgentId, options) {
            var scopeId, permissionSet, _i, _a, permission, request;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_b) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                if (!this.isEnabled()) {
                    throw new Error('Memory manager is disabled');
                }
                scopeId = this.getScopeId(options.scopeId);
                if (!scopeId) {
                    throw new Error('No valid memory scope available');
                }
                permissionSet = new Set();
                if (options.permissions) {
                    for (_i = 0, _a = options.permissions; _i < _a.length; _i++) {
                        permission = _a[_i];
                        switch (permission) {
                            case 'read':
                                permissionSet.add(MemoryScope_1.MemoryPermission.READ);
                                break;
                            case 'write':
                                permissionSet.add(MemoryScope_1.MemoryPermission.WRITE);
                                break;
                            case 'update':
                                permissionSet.add(MemoryScope_1.MemoryPermission.UPDATE);
                                break;
                            case 'delete':
                                permissionSet.add(MemoryScope_1.MemoryPermission.DELETE);
                                break;
                            case 'share':
                                permissionSet.add(MemoryScope_1.MemoryPermission.SHARE);
                                break;
                        }
                    }
                }
                else {
                    // Default to read-only
                    permissionSet.add(MemoryScope_1.MemoryPermission.READ);
                }
                request = this.isolationManager.createSharingRequest(this.getAgent().getAgentId(), targetAgentId, scopeId, permissionSet, options.memoryIds);
                if (!request) {
                    throw new Error("Failed to create sharing request for scope ".concat(scopeId, " to agent ").concat(targetAgentId));
                }
                // If approval is not required, automatically approve
                if (options.requireApproval === false) {
                    this.isolationManager.respondToSharingRequest(request.requestId, true);
                }
                // Convert to Record<string, unknown> to match the return type
                return [2 /*return*/, {
                        requestId: request.requestId,
                        requestingAgentId: request.requestingAgentId,
                        targetAgentId: request.targetAgentId,
                        scopeId: request.scopeId,
                        memoryIds: request.memoryIds,
                        status: request.status,
                        createdAt: request.createdAt,
                        expiresAt: request.expiresAt
                    }];
            });
        });
    };
    /**
     * Responds to a memory sharing request
     * @param requestId Request ID
     * @param approved Whether to approve the request
     * @param reason Optional reason for the response
     * @returns Whether the response was processed
     */
    AgentMemoryManager.prototype.respondToSharingRequest = function (requestId, approved, reason) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                if (!this.isEnabled()) {
                    throw new Error('Memory manager is disabled');
                }
                return [2 /*return*/, this.isolationManager.respondToSharingRequest(requestId, approved, reason)];
            });
        });
    };
    /**
     * Gets pending sharing requests for this agent
     * @returns Pending sharing requests
     */
    AgentMemoryManager.prototype.getPendingSharingRequests = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                if (!this.isEnabled()) {
                    throw new Error('Memory manager is disabled');
                }
                return [2 /*return*/, this.isolationManager.getPendingSharingRequests(this.getAgent().getAgentId())];
            });
        });
    };
    /**
     * Gets all accessible memory scopes for this agent
     * @returns Accessible memory scopes
     */
    AgentMemoryManager.prototype.getAccessibleScopes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var scopes;
            var _this = this;
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                if (!this.isEnabled()) {
                    throw new Error('Memory manager is disabled');
                }
                scopes = this.isolationManager.getScopesForAgent(this.getAgent().getAgentId());
                // Return simplified scope info
                return [2 /*return*/, scopes.map(function (scope) { return ({
                        id: scope.scopeId.id,
                        name: scope.scopeId.name,
                        description: scope.scopeId.description,
                        accessLevel: scope.accessPolicy.accessLevel,
                        owner: scope.accessPolicy.ownerAgentId,
                        isOwner: scope.accessPolicy.ownerAgentId === _this.getAgent().getAgentId()
                    }); })];
            });
        });
    };
    /**
     * Shutdown the memory manager
     */
    AgentMemoryManager.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    return [2 /*return*/];
                }
                try {
                    console.log("Shutting down memory manager for agent ".concat(this.getAgent().getAgentId()));
                    this.setInitialized(false);
                    // Clear memory store
                    this.memoryStore.clear();
                }
                catch (error) {
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Utility methods
     */
    /**
     * Gets a valid scope ID
     * @param scopeId Requested scope ID
     * @returns A valid scope ID, or undefined if none is available
     */
    AgentMemoryManager.prototype.getScopeId = function (scopeId) {
        // If a specific scope was requested, use it if valid
        if (scopeId) {
            var scope = this.isolationManager.getScope(scopeId);
            if (scope) {
                return scopeId;
            }
        }
        // Otherwise, use the private scope if available
        if (this.privateScope) {
            return this.privateScope.scopeId.id;
        }
        // Or the shared scope if available
        if (this.sharedScope) {
            return this.sharedScope.scopeId.id;
        }
        // No valid scope available
        return undefined;
    };
    /**
     * Returns the agent's health status
     */
    AgentMemoryManager.prototype.getHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var issues, memoryCount;
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    return [2 /*return*/, {
                            status: 'degraded',
                            details: {
                                lastCheck: new Date(),
                                issues: [{
                                        severity: 'high',
                                        message: 'Memory manager not initialized',
                                        detectedAt: new Date()
                                    }]
                            }
                        }];
                }
                issues = [];
                memoryCount = this.memoryStore.size;
                if (memoryCount > 10000) { // Example threshold
                    issues.push({
                        severity: 'high',
                        message: "Memory store size (".concat(memoryCount, ") exceeds recommended limit"),
                        detectedAt: new Date()
                    });
                }
                return [2 /*return*/, {
                        status: issues.some(function (i) { return i.severity === 'critical'; }) ? 'unhealthy' :
                            issues.some(function (i) { return i.severity === 'high'; }) ? 'degraded' : 'healthy',
                        details: {
                            lastCheck: new Date(),
                            issues: issues,
                            metrics: {
                                memoryCount: memoryCount,
                                memoryTypes: this.getMemoryTypeDistribution(),
                                avgMemoryAge: this.calculateAverageMemoryAge()
                            }
                        }
                    }];
            });
        });
    };
    AgentMemoryManager.prototype.getMemoryTypeDistribution = function () {
        var distribution = {};
        this.memoryStore.forEach(function (memory) {
            var type = memory.type;
            distribution[type] = (distribution[type] || 0) + 1;
        });
        return distribution;
    };
    AgentMemoryManager.prototype.calculateAverageMemoryAge = function () {
        if (this.memoryStore.size === 0)
            return 0;
        var now = Date.now();
        var totalAge = 0;
        this.memoryStore.forEach(function (memory) {
            totalAge += now - memory.timestamp.getTime();
        });
        return totalAge / this.memoryStore.size;
    };
    /**
     * Resets the memory manager's state
     */
    AgentMemoryManager.prototype.reset = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        // Reinitialize the manager
                        return [4 /*yield*/, this.shutdown()];
                    case 1:
                        // Reinitialize the manager
                        _a.sent();
                        return [2 /*return*/, this.initialize()];
                    case 2:
                        error_1 = _a.sent();
                        console.error('Error resetting memory manager:', error_1);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    AgentMemoryManager.prototype.summarizeConversation = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                return [2 /*return*/, this.conversationSummarizer.summarizeConversation(options)];
            });
        });
    };
    AgentMemoryManager.prototype.summarizeMultipleConversations = function (conversationIds, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                return [2 /*return*/, this.conversationSummarizer.summarizeMultipleConversations(conversationIds, options)];
            });
        });
    };
    AgentMemoryManager.prototype.getConversationTopics = function (conversationId, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                return [2 /*return*/, this.conversationSummarizer.getConversationTopics(conversationId, options)];
            });
        });
    };
    AgentMemoryManager.prototype.extractActionItems = function (conversationId, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new Error('Memory manager not initialized');
                }
                return [2 /*return*/, this.conversationSummarizer.extractActionItems(conversationId, options)];
            });
        });
    };
    return AgentMemoryManager;
}(BaseManager_1.AbstractBaseManager));
exports.AgentMemoryManager = AgentMemoryManager;
