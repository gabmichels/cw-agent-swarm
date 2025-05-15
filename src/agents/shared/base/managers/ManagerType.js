"use strict";
/**
 * ManagerType.ts - Manager Type Enum
 *
 * This file defines the enumeration of manager types to ensure consistency
 * across the codebase and prevent string literal usage for manager types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagerType = void 0;
var ManagerType;
(function (ManagerType) {
    ManagerType["MEMORY"] = "memory";
    ManagerType["PLANNING"] = "planning";
    ManagerType["TOOL"] = "tools";
    ManagerType["KNOWLEDGE"] = "knowledge";
    ManagerType["REFLECTION"] = "reflection";
    ManagerType["SCHEDULER"] = "scheduler";
    ManagerType["INPUT"] = "input";
    ManagerType["OUTPUT"] = "output";
    ManagerType["AUTONOMY"] = "autonomy";
    ManagerType["MESSAGING"] = "messaging";
})(ManagerType || (exports.ManagerType = ManagerType = {}));
