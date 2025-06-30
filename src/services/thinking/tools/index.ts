import { ToolService } from './ToolService';

// Create and export tool service
export const toolService = new ToolService();

// Note: ToolRegistry has been replaced by UnifiedToolRegistry in foundation
// export const toolRegistry = new ToolRegistry(toolService);

// Export service types
export { ToolService } from './ToolService';

// Export interfaces
export * from './IToolService';
export * from './PluginSystem';
export * from './ToolFeedbackService';
