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
var ManagerType_1 = require("../../../../agents/shared/base/managers/ManagerType");
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
 * Default Scheduler Manager implementation
 */
var DefaultSchedulerManager = /** @class */ (function (_super) {
    __extends(DefaultSchedulerManager, _super);
    /**
     * Create a new DefaultSchedulerManager instance
     * @param agent - The agent this manager belongs to
     * @param config - Configuration options
     */
    function DefaultSchedulerManager(agent, config) {
        var _this = this;
        var managerId = "scheduler-manager-".concat((0, uuid_1.v4)());
        var validatedConfig = (0, config_1.createConfigFactory)(SchedulerManagerConfigSchema_1.SchedulerManagerConfigSchema).create(__assign({ enabled: true, enableTaskRetries: true, maxRetryAttempts: 3, schedulingIntervalMs: 1000, maxConcurrentTasks: 10, enableTaskPrioritization: true }, config));
        _this = _super.call(this, managerId, ManagerType_1.ManagerType.SCHEDULER, agent, validatedConfig) || this;
        _this.tasks = new Map();
        _this.schedulingTimer = null;
        _this.configFactory = (0, config_1.createConfigFactory)(SchedulerManagerConfigSchema_1.SchedulerManagerConfigSchema);
        return _this;
    }
    /**
     * Update the manager configuration
     */
    DefaultSchedulerManager.prototype.updateConfig = function (config) {
        // Validate and merge configuration
        var validatedConfig = this.configFactory.create(__assign(__assign({}, this._config), config));
        this._config = validatedConfig;
        return validatedConfig;
    };
    /**
     * Initialize the manager
     */
    DefaultSchedulerManager.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var initialized, config;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, _super.prototype.initialize.call(this)];
                    case 1:
                        initialized = _a.sent();
                        if (!initialized) {
                            return [2 /*return*/, false];
                        }
                        config = this.getConfig();
                        this._initialized = true;
                        
                        // Setup autonomous scheduling - enableAutoScheduling defaults to true if not specified
                        if (config.enableAutoScheduling !== false) {
                            this.setupSchedulingTimer();
                            console.log("[".concat(this.managerId, "] Autonomous scheduling initialized with interval ").concat(config.schedulingIntervalMs, "ms"));
                        } else {
                            console.log("[".concat(this.managerId, "] Autonomous scheduling is disabled"));
                        }
                        
                        return [2 /*return*/, true];
                }
            });
        });
    };
    /**
     * Get manager health status
     */
    DefaultSchedulerManager.prototype.getHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var activeTasks, allTasks, metrics;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this._initialized) {
                            return [2 /*return*/, {
                                    status: 'degraded',
                                    details: {
                                        lastCheck: new Date(),
                                        issues: [{
                                                severity: 'high',
                                                message: 'Scheduler manager not initialized',
                                                detectedAt: new Date()
                                            }],
                                        metrics: {}
                                    }
                                }];
                        }
                        return [4 /*yield*/, this.getActiveTasks()];
                    case 1:
                        activeTasks = _a.sent();
                        return [4 /*yield*/, this.getAllTasks()];
                    case 2:
                        allTasks = _a.sent();
                        metrics = {
                            activeTasks: activeTasks.length,
                            totalTasks: allTasks.length,
                            tasksByStatus: allTasks.reduce(function (acc, task) {
                                acc[task.status] = (acc[task.status] || 0) + 1;
                                return acc;
                            }, {})
                        };
                        if (!this.isEnabled()) {
                            return [2 /*return*/, {
                                    status: 'unhealthy',
                                    details: {
                                        lastCheck: new Date(),
                                        issues: [{
                                                severity: 'critical',
                                                message: 'Scheduler manager is disabled',
                                                detectedAt: new Date()
                                            }],
                                        metrics: metrics
                                    }
                                }];
                        }
                        return [2 /*return*/, {
                                status: 'healthy',
                                details: {
                                    lastCheck: new Date(),
                                    issues: [],
                                    metrics: metrics
                                }
                            }];
                }
            });
        });
    };
    /**
     * Get active tasks
     */
    DefaultSchedulerManager.prototype.getActiveTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.tasks.values()).filter(function (task) {
                        return task.status === 'in_progress' || task.status === 'pending';
                    })];
            });
        });
    };
    /**
     * Reset the manager state
     */
    DefaultSchedulerManager.prototype.reset = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.tasks.clear();
                if (this.schedulingTimer) {
                    clearInterval(this.schedulingTimer);
                    this.schedulingTimer = null;
                }
                return [2 /*return*/, _super.prototype.reset.call(this)];
            });
        });
    };
    /**
     * Shutdown the manager and release resources
     */
    DefaultSchedulerManager.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.schedulingTimer) {
                            clearInterval(this.schedulingTimer);
                            this.schedulingTimer = null;
                        }
                        return [4 /*yield*/, _super.prototype.shutdown.call(this)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
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
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                if (!this._initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                try {
                    taskId = (0, uuid_1.v4)();
                    timestamp = new Date();
                    task = {
                        id: taskId,
                        title: options.title,
                        description: options.description,
                        type: options.type,
                        status: 'pending',
                        priority: (_a = options.priority) !== null && _a !== void 0 ? _a : 0.5,
                        scheduledStartTime: options.scheduledStartTime,
                        dueDate: options.dueDate,
                        dependencies: (_b = options.dependencies) !== null && _b !== void 0 ? _b : [],
                        parameters: (_c = options.parameters) !== null && _c !== void 0 ? _c : {},
                        metadata: (_d = options.metadata) !== null && _d !== void 0 ? _d : {},
                        createdAt: timestamp,
                        updatedAt: timestamp,
                        retryAttempts: 0
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
                            error: {
                                message: error instanceof Error ? error.message : 'Unknown error creating task'
                            }
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
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                return [2 /*return*/, this.tasks.get(taskId) || null];
            });
        });
    };
    /**
     * Get all tasks
     */
    DefaultSchedulerManager.prototype.getAllTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this._initialized) {
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
                if (!this._initialized) {
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
                if (!this._initialized) {
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
            var task, dependencies, incompleteDeps, startTime, updatedTask, endTime, durationMs, finalTask, error_1, endTime, durationMs, failedTask, error_2;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this._initialized) {
                            throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                        }
                        task = this.tasks.get(taskId);
                        if (!task) {
                            return [2 /*return*/, {
                                    success: false,
                                    taskId: taskId,
                                    error: {
                                        message: 'Task not found'
                                    },
                                    durationMs: 0
                                }];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 11, , 12]);
                        // Check if task can be executed
                        if (task.status === 'in_progress') {
                            return [2 /*return*/, {
                                    success: false,
                                    taskId: taskId,
                                    error: {
                                        message: 'Task is already running'
                                    },
                                    durationMs: 0
                                }];
                        }
                        if (task.status === 'completed') {
                            return [2 /*return*/, {
                                    success: false,
                                    taskId: taskId,
                                    error: {
                                        message: 'Task is already completed'
                                    },
                                    durationMs: 0
                                }];
                        }
                        if (!((_a = task.dependencies) === null || _a === void 0 ? void 0 : _a.length)) return [3 /*break*/, 3];
                        return [4 /*yield*/, Promise.all(task.dependencies.map(function (depId) { return _this.getTask(depId); }))];
                    case 2:
                        dependencies = _c.sent();
                        incompleteDeps = dependencies.filter(function (dep) { return !dep || dep.status !== 'completed'; });
                        if (incompleteDeps.length) {
                            return [2 /*return*/, {
                                    success: false,
                                    taskId: taskId,
                                    error: {
                                        message: 'Task dependencies not completed'
                                    },
                                    durationMs: 0
                                }];
                        }
                        _c.label = 3;
                    case 3:
                        startTime = Date.now();
                        return [4 /*yield*/, this.updateTask(taskId, {
                                status: 'in_progress',
                                startedAt: new Date()
                            })];
                    case 4:
                        updatedTask = _c.sent();
                        if (!updatedTask) {
                            return [2 /*return*/, {
                                    success: false,
                                    taskId: taskId,
                                    error: {
                                        message: 'Failed to update task status'
                                    },
                                    durationMs: 0
                                }];
                        }
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 8, , 10]);
                        return [4 /*yield*/, this.executeTaskAction(updatedTask)];
                    case 6:
                        _c.sent();
                        endTime = Date.now();
                        durationMs = endTime - startTime;
                        return [4 /*yield*/, this.updateTask(taskId, {
                                status: 'completed',
                                completedAt: new Date()
                            })];
                    case 7:
                        finalTask = _c.sent();
                        return [2 /*return*/, {
                                success: true,
                                taskId: taskId,
                                durationMs: durationMs,
                                task: finalTask !== null && finalTask !== void 0 ? finalTask : undefined
                            }];
                    case 8:
                        error_1 = _c.sent();
                        endTime = Date.now();
                        durationMs = endTime - startTime;
                        return [4 /*yield*/, this.updateTask(taskId, {
                                status: 'failed',
                                retryAttempts: ((_b = task.retryAttempts) !== null && _b !== void 0 ? _b : 0) + 1
                            })];
                    case 9:
                        failedTask = _c.sent();
                        return [2 /*return*/, {
                                success: false,
                                taskId: taskId,
                                error: {
                                    message: error_1 instanceof Error ? error_1.message : 'Unknown error executing task',
                                    code: error_1 instanceof Error ? error_1.code : 'EXECUTION_ERROR'
                                },
                                durationMs: durationMs,
                                task: failedTask !== null && failedTask !== void 0 ? failedTask : undefined
                            }];
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        error_2 = _c.sent();
                        return [2 /*return*/, {
                                success: false,
                                taskId: taskId,
                                error: {
                                    message: error_2 instanceof Error ? error_2.message : 'Unknown error executing task'
                                },
                                durationMs: 0
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
                        if (!this._initialized) {
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
                if (!this._initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                now = new Date();
                return [2 /*return*/, Array.from(this.tasks.values()).filter(function (task) {
                        // Check if task is pending or scheduled
                        if (task.status !== 'pending' && task.status !== 'scheduled') {
                            return false;
                        }
                        
                        // Check if task has a scheduled time
                        const scheduledTime = task.metadata?.scheduledTime;
                        if (!scheduledTime) {
                            return false;
                        }
                        
                        // Parse the scheduled time
                        let taskTime;
                        
                        if (scheduledTime instanceof Date) {
                            taskTime = scheduledTime;
                        } else if (typeof scheduledTime === 'string') {
                            taskTime = new Date(scheduledTime);
                        } else if (typeof scheduledTime === 'number') {
                            taskTime = new Date(scheduledTime);
                        } else {
                            return false; // Invalid scheduledTime format
                        }
                        
                        // Compare with current time
                        return taskTime <= now;
                    })];
            });
        });
    };
    /**
     * Poll for tasks that are due and execute them
     * @returns Number of tasks executed
     */
    DefaultSchedulerManager.prototype.pollForDueTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            var dueTasks, executedCount, _i, dueTasks_1, task, result, error_3, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this._initialized || !this._config.enabled) {
                            return [2 /*return*/, 0];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 10, , 11]);
                        return [4 /*yield*/, this.getDueTasks()];
                    case 2:
                        dueTasks = _a.sent();
                        executedCount = 0;
                        _i = 0, dueTasks_1 = dueTasks;
                        _a.label = 3;
                    case 3:
                        if (!(_i < dueTasks_1.length)) return [3 /*break*/, 9];
                        task = dueTasks_1[_i];
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, this.executeTask(task.id)];
                    case 5:
                        result = _a.sent();
                        if (result.success) {
                            executedCount++;
                            console.log("[".concat(this.managerId, "] Successfully executed task ").concat(task.id, ": ").concat(task.title));
                        } else {
                            console.error("[".concat(this.managerId, "] Failed to execute task ").concat(task.id, ": ").concat(result.error));
                        }
                        return [3 /*break*/, 7];
                    case 6:
                        error_3 = _a.sent();
                        console.error("[".concat(this.managerId, "] Error executing task ").concat(task.id, ":"), error_3);
                        return [3 /*break*/, 7];
                    case 7:
                        _a.label = 8;
                    case 8:
                        _i++;
                        return [3 /*break*/, 3];
                    case 9: return [2 /*return*/, executedCount];
                    case 10:
                        error_4 = _a.sent();
                        console.error("[".concat(this.managerId, "] Error polling for due tasks:"), error_4);
                        return [2 /*return*/, 0];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get tasks that are currently running
     */
    DefaultSchedulerManager.prototype.getRunningTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this._initialized) {
                    throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                }
                return [2 /*return*/, Array.from(this.tasks.values()).filter(function (task) { return task.status === 'in_progress'; })];
            });
        });
    };
    /**
     * Get tasks that are pending execution
     */
    DefaultSchedulerManager.prototype.getPendingTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this._initialized) {
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
                if (!this._initialized) {
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
            var task, config, maxRetryAttempts;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this._initialized) {
                            throw new SchedulingError('Scheduler manager not initialized', 'NOT_INITIALIZED');
                        }
                        task = this.tasks.get(taskId);
                        if (!task) {
                            return [2 /*return*/, {
                                    success: false,
                                    taskId: taskId,
                                    error: {
                                        message: 'Task not found'
                                    },
                                    durationMs: 0
                                }];
                        }
                        if (task.status !== 'failed') {
                            return [2 /*return*/, {
                                    success: false,
                                    taskId: taskId,
                                    error: {
                                        message: 'Task is not in failed state'
                                    },
                                    durationMs: 0
                                }];
                        }
                        config = this.getConfig();
                        if (config.enableTaskRetries) {
                            maxRetryAttempts = (_a = config.maxRetryAttempts) !== null && _a !== void 0 ? _a : 3;
                            if (task.retryAttempts >= maxRetryAttempts) {
                                return [2 /*return*/, {
                                        success: false,
                                        taskId: taskId,
                                        error: {
                                            message: 'Maximum retry attempts exceeded'
                                        },
                                        durationMs: 0
                                    }];
                            }
                        }
                        // Reset task status and execute
                        return [4 /*yield*/, this.updateTask(taskId, {
                                status: 'pending'
                            })];
                    case 1:
                        // Reset task status and execute
                        _b.sent();
                        return [2 /*return*/, this.executeTask(taskId)];
                }
            });
        });
    };
    // Private helper methods
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
     * Setup the scheduling timer
     */
    DefaultSchedulerManager.prototype.setupSchedulingTimer = function () {
        var _this = this;
        var config = this.getConfig();
        // Clear existing timer if any
        if (this.schedulingTimer) {
            clearInterval(this.schedulingTimer);
            this.schedulingTimer = null;
        }
        // Setup new timer
        this.schedulingTimer = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var executedCount, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.pollForDueTasks()];
                    case 1:
                        executedCount = _a.sent();
                        if (executedCount > 0) {
                            console.log("[".concat(this.managerId, "] Scheduling timer executed ").concat(executedCount, " due tasks"));
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _a.sent();
                        console.error("[".concat(this.managerId, "] Error in scheduling timer:"), error_3);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }, config.schedulingIntervalMs);
        
        // Don't keep the Node.js process running just for this timer
        if (this.schedulingTimer.unref) {
            this.schedulingTimer.unref();
        }
        
        console.log("[".concat(this.managerId, "] Scheduling timer set up with interval ").concat(config.schedulingIntervalMs, "ms"));
    };
    return DefaultSchedulerManager;
}(BaseManager_1.AbstractBaseManager));
exports.DefaultSchedulerManager = DefaultSchedulerManager;
