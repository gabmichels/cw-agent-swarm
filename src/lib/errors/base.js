"use strict";
/**
 * Base error classes for the application error handling framework
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.successResult = successResult;
exports.failureResult = failureResult;
/**
 * Base error class for all application errors
 */
var AppError = /** @class */ (function (_super) {
    __extends(AppError, _super);
    function AppError(message, code, context) {
        if (context === void 0) { context = {}; }
        var _this = _super.call(this, message) || this;
        _this.name = 'AppError';
        _this.code = code;
        _this.context = context;
        _this.timestamp = new Date();
        // Ensure proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(_this, _this.constructor);
        }
        return _this;
    }
    /**
     * Convert error to JSON for logging
     */
    AppError.prototype.toJSON = function () {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            context: this.context,
            timestamp: this.timestamp,
            stack: this.stack
        };
    };
    /**
     * Clone error with additional context
     */
    AppError.prototype.withContext = function (additionalContext) {
        return new AppError(this.message, this.code, __assign(__assign({}, this.context), additionalContext));
    };
    return AppError;
}(Error));
exports.AppError = AppError;
/**
 * Creates a successful result
 */
function successResult(data) {
    return {
        success: true,
        data: data
    };
}
/**
 * Creates a failure result
 */
function failureResult(error) {
    return {
        success: false,
        error: error
    };
}
