"use strict";
/**
 * AgentBase.ts - Core base class for all agents in the system
 *
 * This base class provides common functionality that all agents share:
 * - Memory management with agent-scoped access using standardized memory system
 * - Tool management with permissions
 * - Planning and execution capabilities
 * - Agent coordination for delegation
 * - Inter-agent messaging
 * - Pluggable manager architecture for customizing agent capabilities
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
exports.AbstractAgentBase = void 0;
var types_1 = require("./types");
/**
 * Abstract implementation of the AgentBase interface
 * Provides common functionality for concrete agent implementations
 */
var AbstractAgentBase = /** @class */ (function () {
    /**
     * Create a new agent instance
     * @param config Agent configuration
     */
    function AbstractAgentBase(config) {
        /** Registered managers */
        this.managers = new Map();
        this.config = config;
    }
    /**
     * Get the unique ID of this agent
     */
    AbstractAgentBase.prototype.getAgentId = function () {
        // Use the string id from StructuredId
        return typeof this.config.id === 'object' ? this.config.id.id : String(this.config.id);
    };
    /**
     * Get the agent name
     */
    AbstractAgentBase.prototype.getName = function () {
        return this.config.name;
    };
    /**
     * Get the agent configuration
     */
    AbstractAgentBase.prototype.getConfig = function () {
        return this.config;
    };
    /**
     * Update the agent configuration
     */
    AbstractAgentBase.prototype.updateConfig = function (config) {
        this.config = __assign(__assign({}, this.config), config);
    };
    /**
     * Initialize the agent
     */
    AbstractAgentBase.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // ... existing initialization logic ...
                // ... rest of initialization ...
                return [2 /*return*/, true];
            });
        });
    };
    /**
     * Register a manager with this agent
     */
    AbstractAgentBase.prototype.registerManager = function (manager) {
        this.managers.set(manager.getType(), manager);
        return manager;
    };
    /**
     * Get a registered manager by type
     */
    AbstractAgentBase.prototype.getManager = function (managerType) {
        return this.managers.get(managerType);
    };
    /**
     * Get all registered managers
     */
    AbstractAgentBase.prototype.getManagers = function () {
        return Array.from(this.managers.values());
    };
    /**
     * Check if the agent is currently enabled
     */
    AbstractAgentBase.prototype.isEnabled = function () {
        // Treat status OFFLINE as not enabled
        return this.config.status !== types_1.AgentStatus.OFFLINE;
    };
    /**
     * Enable or disable the agent
     */
    AbstractAgentBase.prototype.setEnabled = function (enabled) {
        // Set status based on enabled flag
        this.config.status = enabled ? types_1.AgentStatus.AVAILABLE : types_1.AgentStatus.OFFLINE;
        return this.isEnabled();
    };
    /**
     * Check if a capability is enabled
     * @param capabilityId The ID of the capability to check
     * @returns Whether the capability is enabled
     */
    AbstractAgentBase.prototype.hasCapability = function (capabilityId) {
        return this.config.capabilities.some(function (cap) { return cap.id === capabilityId; });
    };
    /**
     * Enable a capability
     * @param capability The capability to enable
     */
    AbstractAgentBase.prototype.enableCapability = function (capability) {
        if (!this.hasCapability(capability.id)) {
            this.config.capabilities.push(capability);
        }
    };
    /**
     * Disable a capability
     * @param capabilityId The ID of the capability to disable
     */
    AbstractAgentBase.prototype.disableCapability = function (capabilityId) {
        this.config.capabilities = this.config.capabilities.filter(function (cap) { return cap.id !== capabilityId; });
    };
    /**
     * Get agent health status
     * @returns The current health status
     */
    AbstractAgentBase.prototype.getHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var managerHealthPromises, managerHealthResults, managerHealth, healthStatuses, overallStatus;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        managerHealthPromises = Array.from(this.managers.values()).map(function (manager) { return __awaiter(_this, void 0, void 0, function () {
                            var health, error_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, manager.getHealth()];
                                    case 1:
                                        health = _a.sent();
                                        return [2 /*return*/, [manager.getType(), health]];
                                    case 2:
                                        error_1 = _a.sent();
                                        return [2 /*return*/, [
                                                manager.getType(),
                                                {
                                                    status: 'unhealthy',
                                                    message: "Failed to get health: ".concat(error_1)
                                                }
                                            ]];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(managerHealthPromises)];
                    case 1:
                        managerHealthResults = _a.sent();
                        managerHealth = Object.fromEntries(managerHealthResults);
                        healthStatuses = Object.values(managerHealth).map(function (h) { return h.status; });
                        overallStatus = 'healthy';
                        if (healthStatuses.includes('unhealthy')) {
                            overallStatus = 'unhealthy';
                        }
                        else if (healthStatuses.includes('degraded')) {
                            overallStatus = 'degraded';
                        }
                        return [2 /*return*/, {
                                status: overallStatus,
                                message: "Agent ".concat(this.getAgentId(), " is ").concat(overallStatus),
                                managerHealth: managerHealth
                            }];
                }
            });
        });
    };
    AbstractAgentBase.prototype.getSchedulerManager = function () {
        return this.schedulerManager;
    };
    AbstractAgentBase.prototype.initializeManagers = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, manager;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _i = 0, _a = Array.from(this.managers.values());
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        manager = _a[_i];
                        if (!(typeof manager.initialize === 'function')) return [3 /*break*/, 3];
                        return [4 /*yield*/, manager.initialize()];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    AbstractAgentBase.prototype.shutdownManagers = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, manager;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _i = 0, _a = Array.from(this.managers.values());
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        manager = _a[_i];
                        if (!(typeof manager.shutdown === 'function')) return [3 /*break*/, 3];
                        return [4 /*yield*/, manager.shutdown()];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Add memory content via the registered MemoryManager
     */
    AbstractAgentBase.prototype.addMemory = function (content, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var memoryManager;
            return __generator(this, function (_a) {
                memoryManager = this.getManager('memory');
                if (!memoryManager)
                    throw new Error('MemoryManager not registered');
                if (!memoryManager.isInitialized())
                    throw new Error('MemoryManager not initialized');
                return [2 /*return*/, memoryManager.addMemory(content, metadata)];
            });
        });
    };
    /**
     * Search memories via the registered MemoryManager
     */
    AbstractAgentBase.prototype.searchMemories = function (query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var memoryManager;
            return __generator(this, function (_a) {
                memoryManager = this.getManager('memory');
                if (!memoryManager)
                    throw new Error('MemoryManager not registered');
                if (!memoryManager.isInitialized())
                    throw new Error('MemoryManager not initialized');
                return [2 /*return*/, memoryManager.searchMemories(query, options)];
            });
        });
    };
    /**
     * Get recent memories via the registered MemoryManager
     */
    AbstractAgentBase.prototype.getRecentMemories = function (limit) {
        return __awaiter(this, void 0, void 0, function () {
            var memoryManager;
            return __generator(this, function (_a) {
                memoryManager = this.getManager('memory');
                if (!memoryManager)
                    throw new Error('MemoryManager not registered');
                if (!memoryManager.isInitialized())
                    throw new Error('MemoryManager not initialized');
                return [2 /*return*/, memoryManager.getRecentMemories(limit)];
            });
        });
    };
    /**
     * Consolidate memories via the registered MemoryManager
     */
    AbstractAgentBase.prototype.consolidateMemories = function () {
        return __awaiter(this, void 0, void 0, function () {
            var memoryManager;
            return __generator(this, function (_a) {
                memoryManager = this.getManager('memory');
                if (!memoryManager)
                    throw new Error('MemoryManager not registered');
                if (!memoryManager.isInitialized())
                    throw new Error('MemoryManager not initialized');
                return [2 /*return*/, memoryManager.consolidateMemories()];
            });
        });
    };
    /**
     * Prune memories via the registered MemoryManager
     */
    AbstractAgentBase.prototype.pruneMemories = function () {
        return __awaiter(this, void 0, void 0, function () {
            var memoryManager;
            return __generator(this, function (_a) {
                memoryManager = this.getManager('memory');
                if (!memoryManager)
                    throw new Error('MemoryManager not registered');
                if (!memoryManager.isInitialized())
                    throw new Error('MemoryManager not initialized');
                return [2 /*return*/, memoryManager.pruneMemories()];
            });
        });
    };
    /**
     * Create a new plan via the registered PlanningManager
     */
    AbstractAgentBase.prototype.createPlan = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var planningManager;
            return __generator(this, function (_a) {
                planningManager = this.getManager('planning');
                if (!planningManager)
                    throw new Error('PlanningManager not registered');
                if (!planningManager.isInitialized())
                    throw new Error('PlanningManager not initialized');
                return [2 /*return*/, planningManager.createPlan(options)];
            });
        });
    };
    /**
     * Get a plan by ID via the registered PlanningManager
     */
    AbstractAgentBase.prototype.getPlan = function (planId) {
        return __awaiter(this, void 0, void 0, function () {
            var planningManager;
            return __generator(this, function (_a) {
                planningManager = this.getManager('planning');
                if (!planningManager)
                    throw new Error('PlanningManager not registered');
                if (!planningManager.isInitialized())
                    throw new Error('PlanningManager not initialized');
                return [2 /*return*/, planningManager.getPlan(planId)];
            });
        });
    };
    /**
     * Get all plans via the registered PlanningManager
     */
    AbstractAgentBase.prototype.getAllPlans = function () {
        return __awaiter(this, void 0, void 0, function () {
            var planningManager;
            return __generator(this, function (_a) {
                planningManager = this.getManager('planning');
                if (!planningManager)
                    throw new Error('PlanningManager not registered');
                if (!planningManager.isInitialized())
                    throw new Error('PlanningManager not initialized');
                return [2 /*return*/, planningManager.getAllPlans()];
            });
        });
    };
    /**
     * Update a plan via the registered PlanningManager
     */
    AbstractAgentBase.prototype.updatePlan = function (planId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var planningManager;
            return __generator(this, function (_a) {
                planningManager = this.getManager('planning');
                if (!planningManager)
                    throw new Error('PlanningManager not registered');
                if (!planningManager.isInitialized())
                    throw new Error('PlanningManager not initialized');
                return [2 /*return*/, planningManager.updatePlan(planId, updates)];
            });
        });
    };
    /**
     * Delete a plan via the registered PlanningManager
     */
    AbstractAgentBase.prototype.deletePlan = function (planId) {
        return __awaiter(this, void 0, void 0, function () {
            var planningManager;
            return __generator(this, function (_a) {
                planningManager = this.getManager('planning');
                if (!planningManager)
                    throw new Error('PlanningManager not registered');
                if (!planningManager.isInitialized())
                    throw new Error('PlanningManager not initialized');
                return [2 /*return*/, planningManager.deletePlan(planId)];
            });
        });
    };
    /**
     * Execute a plan via the registered PlanningManager
     */
    AbstractAgentBase.prototype.executePlan = function (planId) {
        return __awaiter(this, void 0, void 0, function () {
            var planningManager;
            return __generator(this, function (_a) {
                planningManager = this.getManager('planning');
                if (!planningManager)
                    throw new Error('PlanningManager not registered');
                if (!planningManager.isInitialized())
                    throw new Error('PlanningManager not initialized');
                return [2 /*return*/, planningManager.executePlan(planId)];
            });
        });
    };
    /**
     * Adapt a plan via the registered PlanningManager
     */
    AbstractAgentBase.prototype.adaptPlan = function (planId, reason) {
        return __awaiter(this, void 0, void 0, function () {
            var planningManager;
            return __generator(this, function (_a) {
                planningManager = this.getManager('planning');
                if (!planningManager)
                    throw new Error('PlanningManager not registered');
                if (!planningManager.isInitialized())
                    throw new Error('PlanningManager not initialized');
                return [2 /*return*/, planningManager.adaptPlan(planId, reason)];
            });
        });
    };
    /**
     * Validate a plan via the registered PlanningManager
     */
    AbstractAgentBase.prototype.validatePlan = function (planId) {
        return __awaiter(this, void 0, void 0, function () {
            var planningManager;
            return __generator(this, function (_a) {
                planningManager = this.getManager('planning');
                if (!planningManager)
                    throw new Error('PlanningManager not registered');
                if (!planningManager.isInitialized())
                    throw new Error('PlanningManager not initialized');
                return [2 /*return*/, planningManager.validatePlan(planId)];
            });
        });
    };
    /**
     * Optimize a plan via the registered PlanningManager
     */
    AbstractAgentBase.prototype.optimizePlan = function (planId) {
        return __awaiter(this, void 0, void 0, function () {
            var planningManager;
            return __generator(this, function (_a) {
                planningManager = this.getManager('planning');
                if (!planningManager)
                    throw new Error('PlanningManager not registered');
                if (!planningManager.isInitialized())
                    throw new Error('PlanningManager not initialized');
                return [2 /*return*/, planningManager.optimizePlan(planId)];
            });
        });
    };
    /**
     * Register a new tool via the registered ToolManager
     */
    AbstractAgentBase.prototype.registerTool = function (tool) {
        return __awaiter(this, void 0, void 0, function () {
            var toolManager;
            return __generator(this, function (_a) {
                toolManager = this.getManager('tools');
                if (!toolManager)
                    throw new Error('ToolManager not registered');
                if (!toolManager.isInitialized())
                    throw new Error('ToolManager not initialized');
                return [2 /*return*/, toolManager.registerTool(tool)];
            });
        });
    };
    /**
     * Unregister a tool via the registered ToolManager
     */
    AbstractAgentBase.prototype.unregisterTool = function (toolId) {
        return __awaiter(this, void 0, void 0, function () {
            var toolManager;
            return __generator(this, function (_a) {
                toolManager = this.getManager('tools');
                if (!toolManager)
                    throw new Error('ToolManager not registered');
                if (!toolManager.isInitialized())
                    throw new Error('ToolManager not initialized');
                return [2 /*return*/, toolManager.unregisterTool(toolId)];
            });
        });
    };
    /**
     * Get a tool by ID via the registered ToolManager
     */
    AbstractAgentBase.prototype.getTool = function (toolId) {
        return __awaiter(this, void 0, void 0, function () {
            var toolManager;
            return __generator(this, function (_a) {
                toolManager = this.getManager('tools');
                if (!toolManager)
                    throw new Error('ToolManager not registered');
                if (!toolManager.isInitialized())
                    throw new Error('ToolManager not initialized');
                return [2 /*return*/, toolManager.getTool(toolId)];
            });
        });
    };
    /**
     * Get tools via the registered ToolManager
     */
    AbstractAgentBase.prototype.getTools = function (filter) {
        return __awaiter(this, void 0, void 0, function () {
            var toolManager;
            return __generator(this, function (_a) {
                toolManager = this.getManager('tools');
                if (!toolManager)
                    throw new Error('ToolManager not registered');
                if (!toolManager.isInitialized())
                    throw new Error('ToolManager not initialized');
                return [2 /*return*/, toolManager.getTools(filter)];
            });
        });
    };
    /**
     * Enable or disable a tool via the registered ToolManager
     */
    AbstractAgentBase.prototype.setToolEnabled = function (toolId, enabled) {
        return __awaiter(this, void 0, void 0, function () {
            var toolManager;
            return __generator(this, function (_a) {
                toolManager = this.getManager('tools');
                if (!toolManager)
                    throw new Error('ToolManager not registered');
                if (!toolManager.isInitialized())
                    throw new Error('ToolManager not initialized');
                return [2 /*return*/, toolManager.setToolEnabled(toolId, enabled)];
            });
        });
    };
    /**
     * Execute a tool via the registered ToolManager
     */
    AbstractAgentBase.prototype.executeTool = function (toolId, params, options) {
        return __awaiter(this, void 0, void 0, function () {
            var toolManager;
            return __generator(this, function (_a) {
                toolManager = this.getManager('tools');
                if (!toolManager)
                    throw new Error('ToolManager not registered');
                if (!toolManager.isInitialized())
                    throw new Error('ToolManager not initialized');
                return [2 /*return*/, toolManager.executeTool(toolId, params, options)];
            });
        });
    };
    /**
     * Get tool metrics via the registered ToolManager
     */
    AbstractAgentBase.prototype.getToolMetrics = function (toolId) {
        return __awaiter(this, void 0, void 0, function () {
            var toolManager;
            return __generator(this, function (_a) {
                toolManager = this.getManager('tools');
                if (!toolManager)
                    throw new Error('ToolManager not registered');
                if (!toolManager.isInitialized())
                    throw new Error('ToolManager not initialized');
                return [2 /*return*/, toolManager.getToolMetrics(toolId)];
            });
        });
    };
    /**
     * Find best tool for a task via the registered ToolManager
     */
    AbstractAgentBase.prototype.findBestToolForTask = function (taskDescription, context) {
        return __awaiter(this, void 0, void 0, function () {
            var toolManager;
            return __generator(this, function (_a) {
                toolManager = this.getManager('tools');
                if (!toolManager)
                    throw new Error('ToolManager not registered');
                if (!toolManager.isInitialized())
                    throw new Error('ToolManager not initialized');
                return [2 /*return*/, toolManager.findBestToolForTask(taskDescription, context)];
            });
        });
    };
    /**
     * Load knowledge via the registered KnowledgeManager
     */
    AbstractAgentBase.prototype.loadKnowledge = function () {
        return __awaiter(this, void 0, void 0, function () {
            var knowledgeManager;
            return __generator(this, function (_a) {
                knowledgeManager = this.getManager('knowledge');
                if (!knowledgeManager)
                    throw new Error('KnowledgeManager not registered');
                if (!knowledgeManager.isInitialized())
                    throw new Error('KnowledgeManager not initialized');
                return [2 /*return*/, knowledgeManager.loadKnowledge()];
            });
        });
    };
    /**
     * Search knowledge via the registered KnowledgeManager
     */
    AbstractAgentBase.prototype.searchKnowledge = function (query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var knowledgeManager;
            return __generator(this, function (_a) {
                knowledgeManager = this.getManager('knowledge');
                if (!knowledgeManager)
                    throw new Error('KnowledgeManager not registered');
                if (!knowledgeManager.isInitialized())
                    throw new Error('KnowledgeManager not initialized');
                return [2 /*return*/, knowledgeManager.searchKnowledge(query, options)];
            });
        });
    };
    /**
     * Add a knowledge entry via the registered KnowledgeManager
     */
    AbstractAgentBase.prototype.addKnowledgeEntry = function (entry) {
        return __awaiter(this, void 0, void 0, function () {
            var knowledgeManager;
            return __generator(this, function (_a) {
                knowledgeManager = this.getManager('knowledge');
                if (!knowledgeManager)
                    throw new Error('KnowledgeManager not registered');
                if (!knowledgeManager.isInitialized())
                    throw new Error('KnowledgeManager not initialized');
                return [2 /*return*/, knowledgeManager.addKnowledgeEntry(entry)];
            });
        });
    };
    /**
     * Get a knowledge entry via the registered KnowledgeManager
     */
    AbstractAgentBase.prototype.getKnowledgeEntry = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var knowledgeManager;
            return __generator(this, function (_a) {
                knowledgeManager = this.getManager('knowledge');
                if (!knowledgeManager)
                    throw new Error('KnowledgeManager not registered');
                if (!knowledgeManager.isInitialized())
                    throw new Error('KnowledgeManager not initialized');
                return [2 /*return*/, knowledgeManager.getKnowledgeEntry(id)];
            });
        });
    };
    /**
     * Update a knowledge entry via the registered KnowledgeManager
     */
    AbstractAgentBase.prototype.updateKnowledgeEntry = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var knowledgeManager;
            return __generator(this, function (_a) {
                knowledgeManager = this.getManager('knowledge');
                if (!knowledgeManager)
                    throw new Error('KnowledgeManager not registered');
                if (!knowledgeManager.isInitialized())
                    throw new Error('KnowledgeManager not initialized');
                return [2 /*return*/, knowledgeManager.updateKnowledgeEntry(id, updates)];
            });
        });
    };
    /**
     * Delete a knowledge entry via the registered KnowledgeManager
     */
    AbstractAgentBase.prototype.deleteKnowledgeEntry = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var knowledgeManager;
            return __generator(this, function (_a) {
                knowledgeManager = this.getManager('knowledge');
                if (!knowledgeManager)
                    throw new Error('KnowledgeManager not registered');
                if (!knowledgeManager.isInitialized())
                    throw new Error('KnowledgeManager not initialized');
                return [2 /*return*/, knowledgeManager.deleteKnowledgeEntry(id)];
            });
        });
    };
    /**
     * Get knowledge entries via the registered KnowledgeManager
     */
    AbstractAgentBase.prototype.getKnowledgeEntries = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var knowledgeManager;
            return __generator(this, function (_a) {
                knowledgeManager = this.getManager('knowledge');
                if (!knowledgeManager)
                    throw new Error('KnowledgeManager not registered');
                if (!knowledgeManager.isInitialized())
                    throw new Error('KnowledgeManager not initialized');
                return [2 /*return*/, knowledgeManager.getKnowledgeEntries(options)];
            });
        });
    };
    /**
     * Identify knowledge gaps via the registered KnowledgeManager
     */
    AbstractAgentBase.prototype.identifyKnowledgeGaps = function () {
        return __awaiter(this, void 0, void 0, function () {
            var knowledgeManager;
            return __generator(this, function (_a) {
                knowledgeManager = this.getManager('knowledge');
                if (!knowledgeManager)
                    throw new Error('KnowledgeManager not registered');
                if (!knowledgeManager.isInitialized())
                    throw new Error('KnowledgeManager not initialized');
                return [2 /*return*/, knowledgeManager.identifyKnowledgeGaps()];
            });
        });
    };
    /**
     * Get a knowledge gap via the registered KnowledgeManager
     */
    AbstractAgentBase.prototype.getKnowledgeGap = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var knowledgeManager;
            return __generator(this, function (_a) {
                knowledgeManager = this.getManager('knowledge');
                if (!knowledgeManager)
                    throw new Error('KnowledgeManager not registered');
                if (!knowledgeManager.isInitialized())
                    throw new Error('KnowledgeManager not initialized');
                return [2 /*return*/, knowledgeManager.getKnowledgeGap(id)];
            });
        });
    };
    /**
     * Create a task via the registered SchedulerManager
     */
    AbstractAgentBase.prototype.createTask = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var schedulerManager;
            return __generator(this, function (_a) {
                schedulerManager = this.getManager('scheduler');
                if (!schedulerManager)
                    throw new Error('SchedulerManager not registered');
                if (!schedulerManager.isInitialized())
                    throw new Error('SchedulerManager not initialized');
                return [2 /*return*/, schedulerManager.createTask(options)];
            });
        });
    };
    /**
     * Get a task via the registered SchedulerManager
     */
    AbstractAgentBase.prototype.getTask = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            var schedulerManager;
            return __generator(this, function (_a) {
                schedulerManager = this.getManager('scheduler');
                if (!schedulerManager)
                    throw new Error('SchedulerManager not registered');
                if (!schedulerManager.isInitialized())
                    throw new Error('SchedulerManager not initialized');
                return [2 /*return*/, schedulerManager.getTask(taskId)];
            });
        });
    };
    /**
     * Get all tasks via the registered SchedulerManager
     */
    AbstractAgentBase.prototype.getAllTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            var schedulerManager;
            return __generator(this, function (_a) {
                schedulerManager = this.getManager('scheduler');
                if (!schedulerManager)
                    throw new Error('SchedulerManager not registered');
                if (!schedulerManager.isInitialized())
                    throw new Error('SchedulerManager not initialized');
                return [2 /*return*/, schedulerManager.getAllTasks()];
            });
        });
    };
    /**
     * Update a task via the registered SchedulerManager
     */
    AbstractAgentBase.prototype.updateTask = function (taskId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var schedulerManager;
            return __generator(this, function (_a) {
                schedulerManager = this.getManager('scheduler');
                if (!schedulerManager)
                    throw new Error('SchedulerManager not registered');
                if (!schedulerManager.isInitialized())
                    throw new Error('SchedulerManager not initialized');
                return [2 /*return*/, schedulerManager.updateTask(taskId, updates)];
            });
        });
    };
    /**
     * Delete a task via the registered SchedulerManager
     */
    AbstractAgentBase.prototype.deleteTask = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            var schedulerManager;
            return __generator(this, function (_a) {
                schedulerManager = this.getManager('scheduler');
                if (!schedulerManager)
                    throw new Error('SchedulerManager not registered');
                if (!schedulerManager.isInitialized())
                    throw new Error('SchedulerManager not initialized');
                return [2 /*return*/, schedulerManager.deleteTask(taskId)];
            });
        });
    };
    /**
     * Execute a task via the registered SchedulerManager
     */
    AbstractAgentBase.prototype.executeTask = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            var schedulerManager;
            return __generator(this, function (_a) {
                schedulerManager = this.getManager('scheduler');
                if (!schedulerManager)
                    throw new Error('SchedulerManager not registered');
                if (!schedulerManager.isInitialized())
                    throw new Error('SchedulerManager not initialized');
                return [2 /*return*/, schedulerManager.executeTask(taskId)];
            });
        });
    };
    /**
     * Cancel a task via the registered SchedulerManager
     */
    AbstractAgentBase.prototype.cancelTask = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            var schedulerManager;
            return __generator(this, function (_a) {
                schedulerManager = this.getManager('scheduler');
                if (!schedulerManager)
                    throw new Error('SchedulerManager not registered');
                if (!schedulerManager.isInitialized())
                    throw new Error('SchedulerManager not initialized');
                return [2 /*return*/, schedulerManager.cancelTask(taskId)];
            });
        });
    };
    /**
     * Get due tasks via the registered SchedulerManager
     */
    AbstractAgentBase.prototype.getDueTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            var schedulerManager;
            return __generator(this, function (_a) {
                schedulerManager = this.getManager('scheduler');
                if (!schedulerManager)
                    throw new Error('SchedulerManager not registered');
                if (!schedulerManager.isInitialized())
                    throw new Error('SchedulerManager not initialized');
                return [2 /*return*/, schedulerManager.getDueTasks()];
            });
        });
    };
    /**
     * Get running tasks via the registered SchedulerManager
     */
    AbstractAgentBase.prototype.getRunningTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            var schedulerManager;
            return __generator(this, function (_a) {
                schedulerManager = this.getManager('scheduler');
                if (!schedulerManager)
                    throw new Error('SchedulerManager not registered');
                if (!schedulerManager.isInitialized())
                    throw new Error('SchedulerManager not initialized');
                return [2 /*return*/, schedulerManager.getRunningTasks()];
            });
        });
    };
    /**
     * Get pending tasks via the registered SchedulerManager
     */
    AbstractAgentBase.prototype.getPendingTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            var schedulerManager;
            return __generator(this, function (_a) {
                schedulerManager = this.getManager('scheduler');
                if (!schedulerManager)
                    throw new Error('SchedulerManager not registered');
                if (!schedulerManager.isInitialized())
                    throw new Error('SchedulerManager not initialized');
                return [2 /*return*/, schedulerManager.getPendingTasks()];
            });
        });
    };
    /**
     * Get failed tasks via the registered SchedulerManager
     */
    AbstractAgentBase.prototype.getFailedTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            var schedulerManager;
            return __generator(this, function (_a) {
                schedulerManager = this.getManager('scheduler');
                if (!schedulerManager)
                    throw new Error('SchedulerManager not registered');
                if (!schedulerManager.isInitialized())
                    throw new Error('SchedulerManager not initialized');
                return [2 /*return*/, schedulerManager.getFailedTasks()];
            });
        });
    };
    /**
     * Retry a task via the registered SchedulerManager
     */
    AbstractAgentBase.prototype.retryTask = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            var schedulerManager;
            return __generator(this, function (_a) {
                schedulerManager = this.getManager('scheduler');
                if (!schedulerManager)
                    throw new Error('SchedulerManager not registered');
                if (!schedulerManager.isInitialized())
                    throw new Error('SchedulerManager not initialized');
                return [2 /*return*/, schedulerManager.retryTask(taskId)];
            });
        });
    };
    return AbstractAgentBase;
}());
exports.AbstractAgentBase = AbstractAgentBase;
