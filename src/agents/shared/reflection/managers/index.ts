/**
 * Reflection Managers - Index File
 * 
 * This file exports reflection manager implementations and related types
 */

// Export basic reflection manager
export { DefaultReflectionManager } from './DefaultReflectionManager';

// Export enhanced reflection manager
export { EnhancedReflectionManager } from './EnhancedReflectionManager';

// Export SelfImprovement interface
export * from '../interfaces/SelfImprovement.interface';

// Export config schema
export { ReflectionManagerConfigSchema } from '../config/ReflectionManagerConfigSchema'; 
