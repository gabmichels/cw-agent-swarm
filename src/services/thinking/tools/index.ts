import { ToolService } from './ToolService';
import { ToolRegistry } from './ToolRegistry';

// Create and export tool service
export const toolService = new ToolService();

// Create and export tool registry with shared tool service
export const toolRegistry = new ToolRegistry(toolService);

// Export service types
export { ToolService } from './ToolService';
export { ToolRegistry } from './ToolRegistry';

// Export interfaces
export * from './IToolService';
export * from './ToolFeedbackService';
export * from './PluginSystem'; 