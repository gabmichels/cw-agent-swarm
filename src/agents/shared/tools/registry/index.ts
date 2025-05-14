/**
 * Tool registry exports
 * 
 * Provides exports for the shared tool registry system
 */

export * from './SharedToolRegistry';

// Create a default singleton instance
import { SharedToolRegistry } from './SharedToolRegistry';
const defaultRegistry = new SharedToolRegistry();
export default defaultRegistry; 