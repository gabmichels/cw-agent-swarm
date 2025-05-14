/**
 * Apify integration module - Exports for ApifyManager interface
 */

export * from './ApifyManager.interface';
export { DefaultApifyManager, ApifyError } from './DefaultApifyManager';
export { createApifyTools, createDynamicApifyTool } from './ApifyToolFactory';

// Create a singleton instance for backwards compatibility
import { DefaultApifyManager } from './DefaultApifyManager';
const defaultApifyManager = new DefaultApifyManager();
export default defaultApifyManager;

// Tool factory will be implemented in a future PR
// export { createApifyTools } from './ApifyToolFactory'; 