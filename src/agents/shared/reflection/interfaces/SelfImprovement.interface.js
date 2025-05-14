"use strict";
/**
 * Self-Improvement Interface
 *
 * This file defines interfaces for self-improvement capabilities
 * to be implemented by reflection managers.
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
    ImprovementAreaType["PROCESS"] = "process";
    ImprovementAreaType["PERFORMANCE"] = "performance";
    ImprovementAreaType["STRATEGY"] = "strategy";
    ImprovementAreaType["COMMUNICATION"] = "communication";
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
    LearningOutcomeType["NEW_KNOWLEDGE"] = "new_knowledge";
    LearningOutcomeType["REFINED_SKILL"] = "refined_skill";
    LearningOutcomeType["IMPROVED_PROCESS"] = "improved_process";
    LearningOutcomeType["CORRECTED_MISUNDERSTANDING"] = "corrected_misunderstanding";
    LearningOutcomeType["ENHANCED_CAPABILITY"] = "enhanced_capability";
})(LearningOutcomeType || (exports.LearningOutcomeType = LearningOutcomeType = {}));
