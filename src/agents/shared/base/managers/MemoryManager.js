"use strict";
/**
 * Memory Manager Interface
 *
 * This file defines the memory manager interface that provides memory services
 * for agents. It extends the base manager interface with memory-specific functionality.
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
exports.AbstractMemoryManager = void 0;
var BaseManager_1 = require("./BaseManager");
/**
 * Abstract base memory manager class
 */
var AbstractMemoryManager = /** @class */ (function (_super) {
    __extends(AbstractMemoryManager, _super);
    function AbstractMemoryManager(agent, config) {
        var _this = _super.call(this, "".concat(agent.getAgentId(), "-memory-manager"), 'memory', agent, __assign({ 
            // Default memory manager configuration
            enableAutoPruning: true, pruningIntervalMs: 300000, maxShortTermEntries: 100, relevanceThreshold: 0.2, enableAutoConsolidation: true, consolidationIntervalMs: 600000, minMemoriesForConsolidation: 5, forgetSourceMemoriesAfterConsolidation: false, enableMemoryInjection: true, maxInjectedMemories: 5, 
            // Conversation summarization defaults
            enableConversationSummarization: true, defaultSummaryLength: 500, defaultSummaryDetailLevel: 'standard', extractTopicsFromConversations: true, extractActionItemsFromConversations: true, defaultMaxEntriesForSummarization: 20 }, config)) || this;
        _this.memoryService = null;
        _this.searchService = null;
        _this.memoryPruningTimer = null;
        _this.memoryConsolidationTimer = null;
        _this.agent = agent;
        return _this;
    }
    AbstractMemoryManager.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var getMemoryServices, services, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        if (!(typeof window === 'undefined')) return [3 /*break*/, 3];
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../../../../server/memory/services'); })];
                    case 1:
                        getMemoryServices = (_a.sent()).getMemoryServices;
                        return [4 /*yield*/, getMemoryServices()];
                    case 2:
                        services = _a.sent();
                        this.memoryService = services.memoryService;
                        this.searchService = services.searchService;
                        console.log("[".concat(this.managerId, "] Memory services initialized"));
                        // Setup memory pruning if enabled
                        if (this.config.enableAutoPruning) {
                            this.setupMemoryPruning();
                        }
                        // Setup memory consolidation if enabled
                        if (this.config.enableAutoConsolidation) {
                            this.setupMemoryConsolidation();
                        }
                        this.initialized = true;
                        return [2 /*return*/, true];
                    case 3:
                        // Client-side initialization (limited functionality)
                        console.log("[".concat(this.managerId, "] Running in client mode with limited functionality"));
                        this.initialized = true;
                        return [2 /*return*/, true];
                    case 4:
                        error_1 = _a.sent();
                        console.error("[".concat(this.managerId, "] Error initializing memory manager:"), error_1);
                        return [2 /*return*/, false];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    AbstractMemoryManager.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Cancel scheduled memory pruning
                        if (this.memoryPruningTimer) {
                            clearInterval(this.memoryPruningTimer);
                            this.memoryPruningTimer = null;
                        }
                        // Cancel scheduled memory consolidation
                        if (this.memoryConsolidationTimer) {
                            clearInterval(this.memoryConsolidationTimer);
                            this.memoryConsolidationTimer = null;
                        }
                        if (!(this.initialized && this.memoryService)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.pruneMemories()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.consolidateMemories()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        this.initialized = false;
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Set up automatic memory pruning
     */
    AbstractMemoryManager.prototype.setupMemoryPruning = function () {
        var _this = this;
        var interval = this.config.pruningIntervalMs || 3600000; // Default: 1 hour
        // Clear any existing timer
        if (this.memoryPruningTimer) {
            clearInterval(this.memoryPruningTimer);
        }
        // Set up new timer
        this.memoryPruningTimer = setInterval(function () {
            _this.pruneMemories().catch(function (error) {
                console.error("[".concat(_this.managerId, "] Error during automatic memory pruning:"), error);
            });
        }, interval);
        console.log("[".concat(this.managerId, "] Set up memory pruning with interval ").concat(interval, "ms"));
    };
    /**
     * Set up automatic memory consolidation
     */
    AbstractMemoryManager.prototype.setupMemoryConsolidation = function () {
        var _this = this;
        var interval = this.config.consolidationIntervalMs || 7200000; // Default: 2 hours
        // Clear any existing timer
        if (this.memoryConsolidationTimer) {
            clearInterval(this.memoryConsolidationTimer);
        }
        // Set up new timer
        this.memoryConsolidationTimer = setInterval(function () {
            _this.consolidateMemories().catch(function (error) {
                console.error("[".concat(_this.managerId, "] Error during automatic memory consolidation:"), error);
            });
        }, interval);
        console.log("[".concat(this.managerId, "] Set up memory consolidation with interval ").concat(interval, "ms"));
    };
    return AbstractMemoryManager;
}(BaseManager_1.AbstractBaseManager));
exports.AbstractMemoryManager = AbstractMemoryManager;
