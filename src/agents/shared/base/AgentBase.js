"use strict";
/**
 * AgentBase.ts - Main export point for the AgentBase interface
 *
 * This file serves as the central export point for the AgentBase interface
 * and related types required across the codebase.
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
// Export all types from the types file
__exportStar(require("./types"), exports);
// Export the BaseManager and related types
__exportStar(require("./managers/BaseManager"), exports);
// Export the AbstractAgentBase implementation
var AbstractAgentBase_1 = require("./AbstractAgentBase");
Object.defineProperty(exports, "AbstractAgentBase", { enumerable: true, get: function () { return AbstractAgentBase_1.AbstractAgentBase; } });
