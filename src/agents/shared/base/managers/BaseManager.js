"use strict";
/**
 * Base Manager Interface
 *
 * This file defines the base manager interface that all specialized
 * agent managers extend from. It provides core functionality common
 * to all manager types.
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
exports.AbstractBaseManager = exports.BaseManager = void 0;
/**
 * BaseManager.ts - Base manager implementation
 *
 * This file provides the base manager implementation that all managers should extend.
 */
var BaseManager = /** @class */ (function () {
    function BaseManager(agent, type) {
        this.initialized = false;
        this.agent = agent;
        this._managerType = type;
    }
    BaseManager.prototype.getType = function () {
        return this._managerType;
    };
    BaseManager.prototype.isInitialized = function () {
        return this.initialized;
    };
    BaseManager.prototype.getAgent = function () {
        return this.agent;
    };
    return BaseManager;
}());
exports.BaseManager = BaseManager;
/**
 * Abstract implementation of the BaseManager interface
 * Provides common functionality for concrete manager implementations
 */
var AbstractBaseManager = /** @class */ (function (_super) {
    __extends(AbstractBaseManager, _super);
    /**
     * Create a new manager instance
     * @param managerId Unique ID for this manager
     * @param managerType Type of manager
     * @param agent The agent this manager belongs to
     * @param config Manager configuration
     */
    function AbstractBaseManager(managerId, managerType, agent, config) {
        var _a;
        var _this = _super.call(this, agent, managerType) || this;
        /** Whether the manager is initialized */
        _this.initialized = false;
        _this.managerId = managerId;
        _this.managerType = managerType;
        _this.config = __assign(__assign({}, config), { enabled: (_a = config.enabled) !== null && _a !== void 0 ? _a : true });
        return _this;
    }
    /**
     * Get the manager's unique identifier
     */
    AbstractBaseManager.prototype.getId = function () {
        return this.managerId;
    };
    /**
     * Get the manager's type
     */
    AbstractBaseManager.prototype.getType = function () {
        return this.managerType;
    };
    /**
     * Get the manager's configuration
     */
    AbstractBaseManager.prototype.getConfig = function () {
        return this.config;
    };
    /**
     * Update the manager configuration
     */
    AbstractBaseManager.prototype.updateConfig = function (config) {
        this.config = __assign(__assign({}, this.config), config);
        return this.config;
    };
    /**
     * Check if the manager is initialized
     */
    AbstractBaseManager.prototype.isInitialized = function () {
        return this.initialized;
    };
    /**
     * Check if the manager is enabled
     */
    AbstractBaseManager.prototype.isEnabled = function () {
        return this.config.enabled;
    };
    /**
     * Enable or disable the manager
     */
    AbstractBaseManager.prototype.setEnabled = function (enabled) {
        var wasEnabled = this.config.enabled;
        this.config.enabled = enabled;
        return wasEnabled !== enabled; // Return true if state changed
    };
    /**
     * Reset the manager to its initial state
     */
    AbstractBaseManager.prototype.reset = function () {
        return __awaiter(this, void 0, void 0, function () {
            var success;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.shutdown()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.initialize()];
                    case 2:
                        success = _a.sent();
                        return [2 /*return*/, success];
                }
            });
        });
    };
    /**
     * Get manager status information
     */
    AbstractBaseManager.prototype.getStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        id: this.managerId,
                        type: this.managerType,
                        enabled: this.isEnabled(),
                        initialized: this.isInitialized()
                    }];
            });
        });
    };
    /**
     * Get manager health status
     * @returns The current health status
     */
    AbstractBaseManager.prototype.getHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        status: 'healthy',
                        message: "".concat(this.managerType, " manager is healthy")
                    }];
            });
        });
    };
    return AbstractBaseManager;
}(BaseManager));
exports.AbstractBaseManager = AbstractBaseManager;
