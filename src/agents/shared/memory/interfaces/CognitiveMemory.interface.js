"use strict";
/**
 * Cognitive Memory Interface
 *
 * This file defines interfaces for advanced cognitive memory capabilities
 * that extend the standard memory system with more sophisticated operations
 * such as memory association, synthesis, and reasoning.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssociationStrength = exports.CognitiveReasoningType = exports.CognitivePatternType = void 0;
/**
 * Types of cognitive memory patterns
 */
var CognitivePatternType;
(function (CognitivePatternType) {
    CognitivePatternType["TEMPORAL"] = "temporal";
    CognitivePatternType["CAUSAL"] = "causal";
    CognitivePatternType["CORRELATIONAL"] = "correlational";
    CognitivePatternType["CONCEPTUAL"] = "conceptual";
    CognitivePatternType["PROCEDURAL"] = "procedural";
    CognitivePatternType["ANALOGICAL"] = "analogical";
    CognitivePatternType["CONTRASTIVE"] = "contrastive";
    CognitivePatternType["HIERARCHICAL"] = "hierarchical";
})(CognitivePatternType || (exports.CognitivePatternType = CognitivePatternType = {}));
/**
 * Types of cognitive memory reasoning
 */
var CognitiveReasoningType;
(function (CognitiveReasoningType) {
    CognitiveReasoningType["INDUCTIVE"] = "inductive";
    CognitiveReasoningType["DEDUCTIVE"] = "deductive";
    CognitiveReasoningType["ABDUCTIVE"] = "abductive";
    CognitiveReasoningType["ANALOGICAL"] = "analogical";
    CognitiveReasoningType["COUNTERFACTUAL"] = "counterfactual";
    CognitiveReasoningType["CAUSAL"] = "causal";
    CognitiveReasoningType["PROBABILISTIC"] = "probabilistic";
})(CognitiveReasoningType || (exports.CognitiveReasoningType = CognitiveReasoningType = {}));
/**
 * Cognitive memory association strength
 */
var AssociationStrength;
(function (AssociationStrength) {
    AssociationStrength["WEAK"] = "weak";
    AssociationStrength["MODERATE"] = "moderate";
    AssociationStrength["STRONG"] = "strong";
    AssociationStrength["VERY_STRONG"] = "very_strong";
})(AssociationStrength || (exports.AssociationStrength = AssociationStrength = {}));
