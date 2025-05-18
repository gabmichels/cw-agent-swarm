/**
 * Importance Calculator Service
 * 
 * This module provides utilities for calculating and managing importance scores
 * for different types of memory items in the system.
 */

// Export types
export * from './types';

// Export utility classes
export { ImportanceConverter } from './ImportanceConverter';

// Export calculator implementations
export { RuleBasedImportanceCalculator } from './RuleBasedImportanceCalculator';
export { LLMImportanceCalculator } from './LLMImportanceCalculator';

// Export main service
export { 
  ImportanceCalculatorService,
  ImportanceCalculationMode,
  type ImportanceCalculatorServiceOptions
} from './ImportanceCalculatorService'; 