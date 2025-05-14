/**
 * Web search tools based on Apify integration
 */

import { ApifyWebSearchTool } from './ApifyWebSearchTool';
import { Tool } from '../../../../lib/tools/types';
import { IToolRegistry } from '../../../../lib/tools/interfaces/tool-registry.interface';
import { logger } from '../../../../lib/logging';

/**
 * Create a new instance of the web search tool
 * 
 * @returns The web search tool instance
 */
export function createWebSearchTool(): ApifyWebSearchTool {
  return new ApifyWebSearchTool();
}

/**
 * Register web search tools with the provided tool registry
 * 
 * @param registry Tool registry to register with
 * @returns The registered tools
 */
export function registerWebSearchTools(registry: IToolRegistry): Tool[] {
  try {
    const webSearchTool = createWebSearchTool();
    registry.registerTool(webSearchTool);
    logger.info(`Registered web search tool: ${webSearchTool.id}`);
    return [webSearchTool];
  } catch (error) {
    logger.error('Error registering web search tools:', error);
    return [];
  }
}

export { ApifyWebSearchTool }; 