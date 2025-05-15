"use strict";
/**
 * SelfImprovement.interface.ts
 *
 * Defines interfaces and types for self-improvement capabilities
 * used by enhanced reflection managers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningOutcomeType = exports.ImprovementPriority = exports.ImprovementAreaType = void 0;
/**
 * Improvement area types
 */
var ImprovementAreaType;
(function (ImprovementAreaType) {
    ImprovementAreaType["KNOWLEDGE"] = "knowledge";
    ImprovementAreaType["SKILL"] = "skill";
    ImprovementAreaType["STRATEGY"] = "strategy";
    ImprovementAreaType["BEHAVIOR"] = "behavior";
    ImprovementAreaType["TOOL"] = "tool";
    ImprovementAreaType["PROCESS"] = "process";
})(ImprovementAreaType || (exports.ImprovementAreaType = ImprovementAreaType = {}));
/**
 * Improvement priority levels
 */
var ImprovementPriority;
(function (ImprovementPriority) {
    ImprovementPriority["LOW"] = "low";
    ImprovementPriority["MEDIUM"] = "medium";
    ImprovementPriority["HIGH"] = "high";
    ImprovementPriority["CRITICAL"] = "critical";
})(ImprovementPriority || (exports.ImprovementPriority = ImprovementPriority = {}));
/**
 * Learning outcome types
 */
var LearningOutcomeType;
(function (LearningOutcomeType) {
    LearningOutcomeType["KNOWLEDGE"] = "knowledge";
    LearningOutcomeType["SKILL"] = "skill";
    LearningOutcomeType["INSIGHT"] = "insight";
    LearningOutcomeType["PATTERN"] = "pattern";
    LearningOutcomeType["STRATEGY"] = "strategy";
})(LearningOutcomeType || (exports.LearningOutcomeType = LearningOutcomeType = {}));
