"use strict";
/**
 * Planning Manager Interface
 *
 * This file defines the planning manager interface that provides planning services
 * for agents. It extends the base manager interface with planning-specific functionality.
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
/**
 * PlanningManager.ts - Bridge export for Planning Manager types
 *
 * This file re-exports the PlanningManager interface and related types
 * to maintain compatibility across the codebase.
 */
// Re-export everything from the shared implementation
__exportStar(require("../../../../agents/shared/base/managers/PlanningManager.interface"), exports);
