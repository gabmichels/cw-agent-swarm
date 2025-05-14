"use strict";
/**
 * AgentBase.ts - Bridge export for the AgentBase interface
 *
 * This file provides a bridge to the shared AgentBase interface to maintain
 * compatibility across the codebase after removing Chloe-specific code.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractAgentBase = void 0;
// Re-export all types
__exportStar(require("../../../agents/shared/base/types"), exports);
// Re-export all manager-related types
__exportStar(require("../../../agents/shared/base/managers/BaseManager"), exports);
// Re-export the AbstractAgentBase implementation
var AbstractAgentBase_1 = require("../../../agents/shared/base/AbstractAgentBase");
Object.defineProperty(exports, "AbstractAgentBase", { enumerable: true, get: function () { return AbstractAgentBase_1.AbstractAgentBase; } });
