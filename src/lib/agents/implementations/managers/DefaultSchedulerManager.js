"use strict";
/**
 * DefaultSchedulerManager.ts - Default implementation of the SchedulerManager interface
 *
 * This file provides a concrete implementation of the SchedulerManager interface
 * that can be used by any agent implementation. It includes task scheduling,
 * execution, and management capabilities.
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
exports.DefaultSchedulerManager = void 0;
var uuid_1 = require("uuid");
var BaseManager_1 = require("../../../../agents/shared/base/managers/BaseManager");
var config_1 = require("../../../../agents/shared/config");
var SchedulerManagerConfigSchema_1 = require("../../../../agents/shared/scheduler/config/SchedulerManagerConfigSchema");
/**
 * Error class for scheduling-related errors
 */
var SchedulingError = /** @class */ (function (_super) {
    __extends(SchedulingError, _super);
    function SchedulingError(message, code, context) {
        if (code === void 0) { code = 'SCHEDULING_ERROR'; }
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message) || this;
        _this.name = 'SchedulingError';
        _this.code = code;
        _this.context = context;
        return _this;
    }
    return SchedulingError;
}(Error));
/**
 * Default implementation of the SchedulerManager interface
 */
// @ts-ignore - This class implements SchedulerManager with some method signature differences
var DefaultSchedulerManager = /** @class */ (function (_super) {
    __extends(DefaultSchedulerManager, _super);
    /**
     * Create a new DefaultSchedulerManager instance
     *
     * @param agent - The agent this manager belongs to
     * @param config - Configuration options
     */
    function DefaultSchedulerManager(agent, config) {
        if (config === void 0) { config = {}; }
        var _this = this;
        var managerId = "scheduler-manager-".concat((0, uuid_1.v4)());
        var managerType = 'scheduler';
        _this = _super.call(this, managerId, managerType, agent, { enabled: true }) || this;
        _this.tasks = new Map();
        _this.schedulingTimer = null;
        _this.configFactory = (0, config_1.createConfigFactory)(SchedulerManagerConfigSchema_1.SchedulerManagerConfigSchema);
        // Validate and apply configuration with defaults
        _this.config = _this.configFactory.create(__assign({ enabled: true }, config));
        return _this;
    }
    Object.defineProperty(DefaultSchedulerManager.prototype, "type", {
        /**
         * Type property accessor for compatibility with SchedulerManager
         */
        get: function () {
            return this._managerType;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Get the unique ID of this manager
     */
    DefaultSchedulerManager.prototype.getId = function () {
        return this.managerId;
    };
    /**
     * Get the manager type
     */
    DefaultSchedulerManager.prototype.getType = function () {
        return this.managerType;
    };
    /**
     * Get the manager configuration
     */
    DefaultSchedulerManager.prototype.getConfig = function () {
        return this.config;
    };
    /**
     * Update the manager configuration
     */
    DefaultSchedulerManager.prototype.updateConfig = function (config) {
        // Validate and merge configuration
        this.config = this.configFactory.create(__assign(__assign({}, this.config), config));
        // If auto-scheduling config changed, update the timer
        if (('enableAutoScheduling' in config || 'schedulingIntervalMs' in config) && this.initialized) {
            // Clear existing timer
            if (this.schedulingTimer) {
                clearInterval(this.schedulingTimer);
                this.schedulingTimer = null;
            }
            // Setup timer if enabled
            if (this.config.enableAutoScheduling) {
                this.setupAutoScheduling();
            }
        }
        return this.config;
    };
    /**
     * Get the associated agent instance
     */
    DefaultSchedulerManager.prototype.getAgent = function () {
        return this.agent;
    };
    /**
     * Initialize the manager
     */
    DefaultSchedulerManager.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                console.log("[".concat(this.managerId, "] Initializing ").concat(this.managerType, " manager"));
                // Setup auto-scheduling if enabled
                if (this.config.enableAutoScheduling) {
                    this.setupAutoScheduling();
                }
                this.initialized = true;
                return [2 /*return*/, true];
            });
        });
    };
    /**
     * Shutdown the manager and release resources
     */
    DefaultSchedulerManager.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                console.log("[".concat(this.managerId, "] Shutting down ").concat(this.managerType, " manager"));
                // Clear timers
                if (this.schedulingTimer) {
                    clearInterval(this.schedulingTimer);
                    this.schedulingTimer = null;
                }
                this.initialized = false;
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check if the manager is currently enabled
     */
    DefaultSchedulerManager.prototype.isEnabled = function () {
        return this.config.enabled;
    };
    /**
     * Enable or disable the manager
     */
    DefaultSchedulerManager.prototype.setEnabled = function (enabled) {
        var wasEnabled = this.config.enabled;
        this.config.enabled = enabled;
        return wasEnabled !== enabled; // Return true if state changed
    };
    /**
     * Reset the manager to its initial state
     */
    DefaultSchedulerManager.prototype.reset = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("[".concat(this.managerId, "] Resetting ").concat(this.managerType, " manager"));
                        this.tasks.clear();
                        this.initialized = false;
                        if (this.schedulingTimer) {
                            clearInterval(this.schedulingTimer);
                            this.schedulingTimer = null;
                        }
                        return [4 /*yield*/, this.initialize()];
                    case 1: return [2 /*return*/, _a.sent()]; // Re-initialize after reset
                }
            });
        });
    };
    /**
     * Get manager health status
     */
    DefaultSchedulerManager.prototype.getHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var stats;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.initialized) {
                            return [2 /*return*/, {
                                    status: 'degraded',
                                    message: 'Scheduler manager not initialized'
                                }];
                        }
                        return [4 /*yield*/, this.getStats()];
                    case 1:
                        stats = _b.sent();
                        // Check if there are critical issues
                        if (!this.isEnabled()) {
                            return [2 /*return*/, {
                                    status: 'unhealthy',
                                    message: 'Scheduler manager is disabled',
                                    metrics: stats
                                }];
                        }
                        // Degraded if too many concurrent tasks
                        if (stats.runningTasks > ((_a = this.config.maxConcurrentTasks) !== null && _a !== void 0 ? _a : 10)) {
                            return [2 /*return*/, {
                                    status: 'degraded',
                                    message: 'Too many concurrent tasks',
                                    metrics: stats
                                }];
                        }
                        return [2 /*return*/, {
                                status: 'healthy',
                                message: 'Scheduler manager is healthy',
                                metrics: stats
                            }];
                }
            });
        });
    };
    /**
     * Get manager status information
     */
    DefaultSchedulerManager.prototype.getStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = {
                            id: this.managerId,
                            type: this.managerType,
                            enabled: this.config.enabled,
                            initialized: this.initialized,
                            taskCount: this.tasks.size
                        };
                        return [4 /*yield*/, this.getRunningTasks()];
                    case 1:
                        _a.runningTasks = (_b.sent()).length;
                        return [4 /*yield*/, this.getPendingTasks()];
                    case 2: return [2 /*return*/, (_a.pendingTasks = (_b.sent()).length,
                            _a)];
                }
            });
        });
    };
    /**
     * Create a new scheduled task
     */
    DefaultSchedulerManager.prototype.createTask = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var taskId, timestamp, task;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                try {
                    taskId = (0, uuid_1.v4)();
                    timestamp = new Date();
                    task = {
                        id: taskId,
                        name: options.name,
                        description: options.description,
                        type: options.type,
                        status: 'pending',
                        priority: (_a = options.priority) !== null && _a !== void 0 ? _a : 0.5,
                        schedule: options.schedule,
                        startTime: options.startTime,
                        endTime: options.endTime,
                        dependencies: options.dependencies,
                        parameters: (_b = options.parameters) !== null && _b !== void 0 ? _b : {},
                        metadata: (_c = options.metadata) !== null && _c !== void 0 ? _c : {},
                        createdAt: timestamp,
                        updatedAt: timestamp,
                        executionCount: 0,
                        failureCount: 0
                    };
                    this.tasks.set(taskId, task);
                    return [2 /*return*/, {
                            success: true,
                            task: task
                        }];
                }
                catch (error) {
                    return [2 /*return*/, {
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error creating task'
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get a task by ID
     */
    DefaultSchedulerManager.prototype.getTask = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                return [2 /*return*/, (_a = this.tasks.get(taskId)) !== null && _a !== void 0 ? _a : null];
            });
        });
    };
    /**
     * Get all tasks
     */
    DefaultSchedulerManager.prototype.getAllTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                return [2 /*return*/, Array.from(this.tasks.values())];
            });
        });
    };
    /**
     * Update a task
     */
    DefaultSchedulerManager.prototype.updateTask = function (taskId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var task, updatedTask;
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                task = this.tasks.get(taskId);
                if (!task) {
                    return [2 /*return*/, null];
                }
                updatedTask = __assign(__assign(__assign({}, task), updates), { updatedAt: new Date() });
                this.tasks.set(taskId, updatedTask);
                return [2 /*return*/, updatedTask];
            });
        });
    };
    /**
     * Delete a task
     */
    DefaultSchedulerManager.prototype.deleteTask = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                return [2 /*return*/, this.tasks.delete(taskId)];
            });
        });
    };
    /**
     * Execute a task
     */
    DefaultSchedulerManager.prototype.executeTask = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            var task, dependencies, incompleteDeps, updatedTask, finalTask, error_1, failedTask, error_2;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.initialized) {
                            throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                        }
                        task = this.tasks.get(taskId);
                        if (!task) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'Task not found'
                                }];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 11, , 12]);
                        // Check if task can be executed
                        if (task.status === 'running') {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'Task is already running'
                                }];
                        }
                        if (task.status === 'completed') {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'Task is already completed'
                                }];
                        }
                        if (!(this.config.enableTaskDependencies && ((_a = task.dependencies) === null || _a === void 0 ? void 0 : _a.length))) return [3 /*break*/, 3];
                        return [4 /*yield*/, Promise.all(task.dependencies.map(function (depId) { return _this.getTask(depId); }))];
                    case 2:
                        dependencies = _b.sent();
                        incompleteDeps = dependencies.filter(function (dep) { return !dep || dep.status !== 'completed'; });
                        if (incompleteDeps.length) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'Task dependencies not completed'
                                }];
                        }
                        _b.label = 3;
                    case 3: return [4 /*yield*/, this.updateTask(taskId, {
                            status: 'running',
                            lastExecutedAt: new Date()
                        })];
                    case 4:
                        updatedTask = _b.sent();
                        if (!updatedTask) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'Failed to update task status'
                                }];
                        }
                        _b.label = 5;
                    case 5:
                        _b.trys.push([5, 8, , 10]);
                        return [4 /*yield*/, this.executeTaskAction(updatedTask)];
                    case 6:
                        _b.sent();
                        return [4 /*yield*/, this.updateTask(taskId, {
                                status: 'completed',
                                executionCount: updatedTask.executionCount + 1
                            })];
                    case 7:
                        finalTask = _b.sent();
                        return [2 /*return*/, {
                                success: true,
                                task: finalTask !== null && finalTask !== void 0 ? finalTask : undefined
                            }];
                    case 8:
                        error_1 = _b.sent();
                        return [4 /*yield*/, this.updateTask(taskId, {
                                status: 'failed',
                                failureCount: updatedTask.failureCount + 1
                            })];
                    case 9:
                        failedTask = _b.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: error_1 instanceof Error ? error_1.message : 'Unknown error executing task',
                                task: failedTask !== null && failedTask !== void 0 ? failedTask : undefined
                            }];
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        error_2 = _b.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: error_2 instanceof Error ? error_2.message : 'Unknown error executing task'
                            }];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Cancel a task
     */
    DefaultSchedulerManager.prototype.cancelTask = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            var task, updatedTask;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.initialized) {
                            throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                        }
                        task = this.tasks.get(taskId);
                        if (!task) {
                            return [2 /*return*/, false];
                        }
                        // Only allow cancelling pending or scheduled tasks
                        if (task.status !== 'pending' && task.status !== 'scheduled') {
                            return [2 /*return*/, false];
                        }
                        return [4 /*yield*/, this.updateTask(taskId, {
                                status: 'cancelled'
                            })];
                    case 1:
                        updatedTask = _a.sent();
                        return [2 /*return*/, updatedTask !== null];
                }
            });
        });
    };
    /**
     * Get tasks that are due for execution
     */
    DefaultSchedulerManager.prototype.getDueTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            var now;
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                now = new Date();
                return [2 /*return*/, Array.from(this.tasks.values()).filter(function (task) {
                        // Check if task is pending or scheduled
                        if (task.status !== 'pending' && task.status !== 'scheduled') {
                            return false;
                        }
                        // Check start time
                        if (task.startTime && task.startTime > now) {
                            return false;
                        }
                        // Check end time
                        if (task.endTime && task.endTime < now) {
                            return false;
                        }
                        // Check schedule if present
                        if (task.schedule) {
                            // TODO: Implement cron schedule checking
                            return false;
                        }
                        return true;
                    })];
            });
        });
    };
    /**
     * Get tasks that are currently running
     */
    DefaultSchedulerManager.prototype.getRunningTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                return [2 /*return*/, Array.from(this.tasks.values()).filter(function (task) { return task.status === 'running'; })];
            });
        });
    };
    /**
     * Get tasks that are pending execution
     */
    DefaultSchedulerManager.prototype.getPendingTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                return [2 /*return*/, Array.from(this.tasks.values()).filter(function (task) { return task.status === 'pending'; })];
            });
        });
    };
    /**
     * Get tasks that have failed
     */
    DefaultSchedulerManager.prototype.getFailedTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                return [2 /*return*/, Array.from(this.tasks.values()).filter(function (task) { return task.status === 'failed'; })];
            });
        });
    };
    /**
     * Retry a failed task
     */
    DefaultSchedulerManager.prototype.retryTask = function (taskId) {
        return __awaiter(this, void 0, void 0, function () {
            var task, retryCount;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.initialized) {
                            throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                        }
                        task = this.tasks.get(taskId);
                        if (!task) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'Task not found'
                                }];
                        }
                        if (task.status !== 'failed') {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'Task is not in failed state'
                                }];
                        }
                        if (!this.config.enableTaskRetries) return [3 /*break*/, 2];
                        retryCount = (_a = task.metadata.retryCount) !== null && _a !== void 0 ? _a : 0;
                        if (retryCount >= ((_b = this.config.maxRetryAttempts) !== null && _b !== void 0 ? _b : 3)) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'Maximum retry attempts exceeded'
                                }];
                        }
                        // Update retry count
                        return [4 /*yield*/, this.updateTask(taskId, {
                                metadata: __assign(__assign({}, task.metadata), { retryCount: retryCount + 1 })
                            })];
                    case 1:
                        // Update retry count
                        _c.sent();
                        _c.label = 2;
                    case 2: 
                    // Reset task status and execute
                    return [4 /*yield*/, this.updateTask(taskId, {
                            status: 'pending'
                        })];
                    case 3:
                        // Reset task status and execute
                        _c.sent();
                        return [2 /*return*/, this.executeTask(taskId)];
                }
            });
        });
    };
    // Private helper methods
    /**
     * Setup automatic scheduling
     */
    DefaultSchedulerManager.prototype.setupAutoScheduling = function () {
        var _this = this;
        if (this.schedulingTimer) {
            clearInterval(this.schedulingTimer);
        }
        this.schedulingTimer = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.processDueTasks()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _a.sent();
                        console.error("[".concat(this.managerId, "] Error during auto-scheduling:"), error_3);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }, this.config.schedulingIntervalMs);
    };
    /**
     * Process tasks that are due for execution
     */
    DefaultSchedulerManager.prototype.processDueTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            var dueTasks, runningTasks, availableSlots, tasksToRun, i, task, error_4;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getDueTasks()];
                    case 1:
                        dueTasks = _b.sent();
                        return [4 /*yield*/, this.getRunningTasks()];
                    case 2:
                        runningTasks = _b.sent();
                        availableSlots = ((_a = this.config.maxConcurrentTasks) !== null && _a !== void 0 ? _a : 10) - runningTasks.length;
                        if (availableSlots <= 0) {
                            return [2 /*return*/];
                        }
                        tasksToRun = this.config.enableTaskPrioritization
                            ? dueTasks.sort(function (a, b) { return b.priority - a.priority; })
                            : dueTasks;
                        i = 0;
                        _b.label = 3;
                    case 3:
                        if (!(i < Math.min(availableSlots, tasksToRun.length))) return [3 /*break*/, 8];
                        task = tasksToRun[i];
                        _b.label = 4;
                    case 4:
                        _b.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, this.executeTask(task.id)];
                    case 5:
                        _b.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        error_4 = _b.sent();
                        console.error("[".concat(this.managerId, "] Error executing task ").concat(task.id, ":"), error_4);
                        return [3 /*break*/, 7];
                    case 7:
                        i++;
                        return [3 /*break*/, 3];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute a task's action
     */
    DefaultSchedulerManager.prototype.executeTaskAction = function (task) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get scheduler manager statistics
     */
    DefaultSchedulerManager.prototype.getStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var allTasks, runningTasks, pendingTasks, completedTasks, failedTasks, totalPriority, totalExecutions;
            return __generator(this, function (_a) {
                allTasks = Array.from(this.tasks.values());
                runningTasks = allTasks.filter(function (t) { return t.status === 'running'; });
                pendingTasks = allTasks.filter(function (t) { return t.status === 'pending'; });
                completedTasks = allTasks.filter(function (t) { return t.status === 'completed'; });
                failedTasks = allTasks.filter(function (t) { return t.status === 'failed'; });
                totalPriority = allTasks.reduce(function (sum, t) { return sum + t.priority; }, 0);
                totalExecutions = allTasks.reduce(function (sum, t) { return sum + t.executionCount; }, 0);
                return [2 /*return*/, {
                        totalTasks: allTasks.length,
                        runningTasks: runningTasks.length,
                        pendingTasks: pendingTasks.length,
                        completedTasks: completedTasks.length,
                        failedTasks: failedTasks.length,
                        avgTaskPriority: allTasks.length > 0 ? totalPriority / allTasks.length : 0,
                        avgExecutionTime: totalExecutions > 0 ? totalExecutions / allTasks.length : 0
                    }];
            });
        });
    };
    // Implement missing interface methods
    DefaultSchedulerManager.prototype.listTasks = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var tasks;
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                tasks = Array.from(this.tasks.values());
                // Apply filters
                if (options === null || options === void 0 ? void 0 : options.status) {
                    tasks = tasks.filter(function (t) { return options.status.includes(t.status); });
                }
                if (options === null || options === void 0 ? void 0 : options.type) {
                    tasks = tasks.filter(function (t) { return options.type.includes(t.type); });
                }
                if ((options === null || options === void 0 ? void 0 : options.priority) !== undefined) {
                    tasks = tasks.filter(function (t) { return t.priority === options.priority; });
                }
                if ((options === null || options === void 0 ? void 0 : options.minPriority) !== undefined) {
                    tasks = tasks.filter(function (t) { return t.priority >= options.minPriority; });
                }
                if (options === null || options === void 0 ? void 0 : options.tags) {
                    tasks = tasks.filter(function (t) {
                        return options.tags.every(function (tag) { return (t.metadata.tags || []).includes(tag); });
                    });
                }
                if (options === null || options === void 0 ? void 0 : options.from) {
                    tasks = tasks.filter(function (t) { return t.createdAt >= options.from; });
                }
                if (options === null || options === void 0 ? void 0 : options.to) {
                    tasks = tasks.filter(function (t) { return t.createdAt <= options.to; });
                }
                // Apply sorting
                if (options === null || options === void 0 ? void 0 : options.sortBy) {
                    tasks.sort(function (a, b) {
                        var aValue = a[options.sortBy];
                        var bValue = b[options.sortBy];
                        var direction = options.sortDirection === 'desc' ? -1 : 1;
                        return aValue < bValue ? -direction : aValue > bValue ? direction : 0;
                    });
                }
                // Apply pagination
                if (options === null || options === void 0 ? void 0 : options.offset) {
                    tasks = tasks.slice(options.offset);
                }
                if (options === null || options === void 0 ? void 0 : options.limit) {
                    tasks = tasks.slice(0, options.limit);
                }
                return [2 /*return*/, tasks];
            });
        });
    };
    DefaultSchedulerManager.prototype.createBatch = function (batch) {
        return __awaiter(this, void 0, void 0, function () {
            var now, newBatch;
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                now = new Date();
                newBatch = __assign(__assign({}, batch), { id: (0, uuid_1.v4)(), status: 'pending', createdAt: now, updatedAt: now, successRate: 0 });
                // TODO: Implement batch storage
                return [2 /*return*/, newBatch];
            });
        });
    };
    DefaultSchedulerManager.prototype.getBatch = function (batchId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                // TODO: Implement batch retrieval
                return [2 /*return*/, null];
            });
        });
    };
    DefaultSchedulerManager.prototype.listBatches = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                // TODO: Implement batch listing
                return [2 /*return*/, []];
            });
        });
    };
    DefaultSchedulerManager.prototype.cancelBatch = function (batchId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                // TODO: Implement batch cancellation
                return [2 /*return*/, false];
            });
        });
    };
    DefaultSchedulerManager.prototype.pauseScheduler = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                // TODO: Implement scheduler pausing
                return [2 /*return*/, true];
            });
        });
    };
    DefaultSchedulerManager.prototype.resumeScheduler = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                // TODO: Implement scheduler resuming
                return [2 /*return*/, true];
            });
        });
    };
    DefaultSchedulerManager.prototype.getResourceUtilization = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                // TODO: Implement resource utilization tracking
                return [2 /*return*/, {
                        timestamp: new Date(),
                        cpuUtilization: 0,
                        memoryBytes: 0,
                        tokensPerMinute: 0,
                        apiCallsPerMinute: 0,
                        activeTasks: 0,
                        pendingTasks: 0
                    }];
            });
        });
    };
    DefaultSchedulerManager.prototype.getResourceUtilizationHistory = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                // TODO: Implement resource utilization history
                return [2 /*return*/, []];
            });
        });
    };
    DefaultSchedulerManager.prototype.setResourceLimits = function (limits) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                // TODO: Implement resource limits
                return [2 /*return*/, true];
            });
        });
    };
    DefaultSchedulerManager.prototype.getEvents = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                // TODO: Implement event tracking
                return [2 /*return*/, []];
            });
        });
    };
    DefaultSchedulerManager.prototype.getMetrics = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                // TODO: Implement metrics tracking
                return [2 /*return*/, {
                        period: {
                            start: new Date(),
                            end: new Date()
                        },
                        taskCounts: {
                            pending: 0,
                            scheduled: 0,
                            running: 0,
                            completed: 0,
                            failed: 0,
                            cancelled: 0
                        },
                        taskTypeDistribution: {},
                        avgTaskCompletionTimeMs: 0,
                        successRate: 0,
                        throughput: 0,
                        waitTimeMs: {
                            avg: 0,
                            median: 0,
                            p95: 0,
                            max: 0
                        }
                    }];
            });
        });
    };
    DefaultSchedulerManager.prototype.subscribeToEvents = function (eventTypes, callback) {
        if (!this.initialized) {
            throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
        }
        // TODO: Implement event subscription
        return (0, uuid_1.v4)();
    };
    DefaultSchedulerManager.prototype.unsubscribeFromEvents = function (subscriptionId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this.initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                // TODO: Implement event unsubscription
                return [2 /*return*/, true];
            });
        });
    };
    /**
     * Check if the manager is initialized
     */
    DefaultSchedulerManager.prototype.isInitialized = function () {
        return this.initialized;
    };
    return DefaultSchedulerManager;
}(BaseManager_1.AbstractBaseManager));
exports.DefaultSchedulerManager = DefaultSchedulerManager;
