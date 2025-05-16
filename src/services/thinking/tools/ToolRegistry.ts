import { IdGenerator } from '@/utils/ulid';
import { Tool } from './IToolService';

/**
 * Tool capability information
 */
export interface ToolCapability {
  /**
   * Unique ID for the capability
   */
  id: string;
  
  /**
   * Name of the capability
   */
  name: string;
  
  /**
   * Description of what this capability provides
   */
  description: string;
  
  /**
   * Category of the capability
   */
  category: string;
  
  /**
   * Required permissions to use this capability
   */
  requiredPermissions: string[];
  
  /**
   * Metadata for the capability
   */
  metadata?: Record<string, any>;
}

/**
 * Tool version information
 */
export interface ToolVersion {
  /**
   * Version number (semver)
   */
  version: string;
  
  /**
   * When this version was released
   */
  releasedAt: Date;
  
  /**
   * Whether this version is still supported
   */
  isSupported: boolean;
  
  /**
   * Changes in this version
   */
  changes: Array<{
    /**
     * Type of change
     */
    type: 'feature' | 'bugfix' | 'improvement' | 'breaking';
    
    /**
     * Description of the change
     */
    description: string;
  }>;
  
  /**
   * Deprecation notice (if applicable)
   */
  deprecationNotice?: string;
}

/**
 * Registry of available tools with versioning and capability tracking
 */
export class ToolRegistry {
  /**
   * Registry of tools
   */
  private tools: Map<string, Tool> = new Map();
  
  /**
   * Registry of tool versions
   */
  private toolVersions: Map<string, ToolVersion[]> = new Map();
  
  /**
   * Registry of capabilities
   */
  private capabilities: Map<string, ToolCapability> = new Map();
  
  /**
   * Index of capabilities by category
   */
  private capabilityCategories: Map<string, Set<string>> = new Map();
  
  /**
   * Index of tools by capability
   */
  private toolsByCapability: Map<string, Set<string>> = new Map();
  
  /**
   * Index of tools by category
   */
  private toolsByCategory: Map<string, Set<string>> = new Map();
  
  /**
   * Register a tool in the registry
   * @param tool Tool to register
   * @param version Tool version information
   * @returns ID of the registered tool
   */
  registerTool(
    tool: Omit<Tool, 'id'>,
    version?: Omit<ToolVersion, 'version'>
  ): string {
    try {
      // Generate ID if not provided
      const toolId = IdGenerator.generate('tool').toString();
      
      // Create complete tool object
      const completeTool: Tool = {
        ...tool,
        id: toolId
      };
      
      // Add to registry
      this.tools.set(toolId, completeTool);
      
      // Update indices
      this.updateToolIndices(completeTool);
      
      // Add version information if provided
      if (version) {
        this.addToolVersion(toolId, {
          ...version,
          version: tool.version
        });
      } else {
        // Add basic version info
        this.addToolVersion(toolId, {
          version: tool.version,
          releasedAt: new Date(),
          isSupported: true,
          changes: [{
            type: 'feature',
            description: 'Initial version'
          }]
        });
      }
      
      console.log(`Registered tool ${tool.name} (${toolId}) version ${tool.version}`);
      
      return toolId;
    } catch (error) {
      console.error('Error registering tool:', error);
      throw error;
    }
  }
  
  /**
   * Update tool in the registry
   * @param toolId Tool ID to update
   * @param updates Updates to apply
   * @param newVersion New version information if this is a version change
   * @returns The updated tool
   */
  updateTool(
    toolId: string,
    updates: Partial<Omit<Tool, 'id'>>,
    newVersion?: Omit<ToolVersion, 'version'>
  ): Tool {
    try {
      // Check if tool exists
      if (!this.tools.has(toolId)) {
        throw new Error(`Tool ${toolId} not found`);
      }
      
      // Get current tool
      const currentTool = this.tools.get(toolId)!;
      
      // Check if version is changing
      const isVersionChange = updates.version && updates.version !== currentTool.version;
      
      // Apply updates
      const updatedTool: Tool = {
        ...currentTool,
        ...updates
      };
      
      // Update registry
      this.tools.set(toolId, updatedTool);
      
      // Add new version information if this is a version change
      if (isVersionChange && newVersion) {
        this.addToolVersion(toolId, {
          ...newVersion,
          version: updatedTool.version
        });
      }
      
      // Update indices if certain fields changed
      if (
        updates.categories !== undefined ||
        updates.requiredCapabilities !== undefined
      ) {
        this.updateToolIndices(updatedTool);
      }
      
      console.log(`Updated tool ${updatedTool.name} (${toolId}) to version ${updatedTool.version}`);
      
      return updatedTool;
    } catch (error) {
      console.error(`Error updating tool ${toolId}:`, error);
      throw error;
    }
  }
  
  /**
   * Add a new version for a tool
   * @param toolId Tool ID
   * @param version Version information
   */
  private addToolVersion(toolId: string, version: ToolVersion): void {
    // Initialize versions array if needed
    if (!this.toolVersions.has(toolId)) {
      this.toolVersions.set(toolId, []);
    }
    
    // Add version
    this.toolVersions.get(toolId)!.push(version);
    
    // Sort versions by release date (newest first)
    this.toolVersions.get(toolId)!.sort((a, b) => 
      b.releasedAt.getTime() - a.releasedAt.getTime()
    );
  }
  
  /**
   * Update indices for a tool
   * @param tool Tool to index
   */
  private updateToolIndices(tool: Tool): void {
    // Update category indices
    for (const category of tool.categories) {
      // Initialize category set if needed
      if (!this.toolsByCategory.has(category)) {
        this.toolsByCategory.set(category, new Set());
      }
      
      // Add tool to category
      this.toolsByCategory.get(category)!.add(tool.id);
    }
    
    // Update capability indices
    for (const capability of tool.requiredCapabilities) {
      // Initialize capability set if needed
      if (!this.toolsByCapability.has(capability)) {
        this.toolsByCapability.set(capability, new Set());
      }
      
      // Add tool to capability
      this.toolsByCapability.get(capability)!.add(tool.id);
    }
  }
  
  /**
   * Get a tool by ID
   * @param toolId Tool ID
   * @param version Specific version to get (default is latest)
   * @returns The tool if found
   */
  getTool(toolId: string, version?: string): Tool | null {
    try {
      // Check if tool exists
      if (!this.tools.has(toolId)) {
        return null;
      }
      
      // Get tool
      const tool = this.tools.get(toolId)!;
      
      // If no specific version requested or matches current version, return current tool
      if (!version || version === tool.version) {
        return tool;
      }
      
      // Check if we have version history
      if (!this.toolVersions.has(toolId)) {
        return null;
      }
      
      // Try to find the requested version
      const versionInfo = this.toolVersions.get(toolId)!.find(v => v.version === version);
      
      if (!versionInfo) {
        return null;
      }
      
      // Check if version is still supported
      if (!versionInfo.isSupported) {
        console.warn(`Requested deprecated version ${version} of tool ${toolId}`);
      }
      
      // Return current tool with version warning
      return {
        ...tool,
        version: version,
        description: `[Version ${version}] ${tool.description}${versionInfo.deprecationNotice ? ` (DEPRECATED: ${versionInfo.deprecationNotice})` : ''}`
      };
    } catch (error) {
      console.error(`Error getting tool ${toolId}:`, error);
      return null;
    }
  }
  
  /**
   * Get all tools
   * @param includeDisabled Whether to include disabled tools
   * @returns All tools in the registry
   */
  getAllTools(includeDisabled: boolean = false): Tool[] {
    try {
      // Get all tools
      const allTools = Array.from(this.tools.values());
      
      // Filter disabled tools if requested
      return includeDisabled ? allTools : allTools.filter(tool => tool.isEnabled);
    } catch (error) {
      console.error('Error getting all tools:', error);
      return [];
    }
  }
  
  /**
   * Register a new capability
   * @param capability Capability information
   * @returns ID of the registered capability
   */
  registerCapability(
    capability: Omit<ToolCapability, 'id'>
  ): string {
    try {
      // Generate ID
      const capabilityId = IdGenerator.generate('capability').toString();
      
      // Create complete capability object
      const completeCapability: ToolCapability = {
        ...capability,
        id: capabilityId
      };
      
      // Add to registry
      this.capabilities.set(capabilityId, completeCapability);
      
      // Update category index
      if (!this.capabilityCategories.has(capability.category)) {
        this.capabilityCategories.set(capability.category, new Set());
      }
      
      this.capabilityCategories.get(capability.category)!.add(capabilityId);
      
      console.log(`Registered capability ${capability.name} (${capabilityId})`);
      
      return capabilityId;
    } catch (error) {
      console.error('Error registering capability:', error);
      throw error;
    }
  }
  
  /**
   * Get a capability by ID
   * @param capabilityId Capability ID
   * @returns The capability if found
   */
  getCapability(capabilityId: string): ToolCapability | null {
    try {
      return this.capabilities.get(capabilityId) || null;
    } catch (error) {
      console.error(`Error getting capability ${capabilityId}:`, error);
      return null;
    }
  }
  
  /**
   * Get all capabilities
   * @param category Filter by category
   * @returns All capabilities
   */
  getAllCapabilities(category?: string): ToolCapability[] {
    try {
      if (category) {
        // Get capabilities for category
        if (!this.capabilityCategories.has(category)) {
          return [];
        }
        
        const categoryCapabilityIds = Array.from(this.capabilityCategories.get(category)!);
        return categoryCapabilityIds.map(id => this.capabilities.get(id)!);
      }
      
      // Get all capabilities
      return Array.from(this.capabilities.values());
    } catch (error) {
      console.error('Error getting all capabilities:', error);
      return [];
    }
  }
  
  /**
   * Get tools by capability
   * @param capabilityId Capability ID
   * @param includeDisabled Whether to include disabled tools
   * @returns Tools with the capability
   */
  getToolsByCapability(
    capabilityId: string,
    includeDisabled: boolean = false
  ): Tool[] {
    try {
      // Check if capability exists
      if (!this.capabilities.has(capabilityId)) {
        return [];
      }
      
      // Get tools with capability
      if (!this.toolsByCapability.has(capabilityId)) {
        return [];
      }
      
      const toolIds = Array.from(this.toolsByCapability.get(capabilityId)!);
      const tools = toolIds.map(id => this.tools.get(id)!);
      
      // Filter disabled tools if requested
      return includeDisabled ? tools : tools.filter(tool => tool.isEnabled);
    } catch (error) {
      console.error(`Error getting tools for capability ${capabilityId}:`, error);
      return [];
    }
  }
  
  /**
   * Get tools by category
   * @param category Category to filter by
   * @param includeDisabled Whether to include disabled tools
   * @returns Tools in the category
   */
  getToolsByCategory(
    category: string,
    includeDisabled: boolean = false
  ): Tool[] {
    try {
      // Get tools in category
      if (!this.toolsByCategory.has(category)) {
        return [];
      }
      
      const toolIds = Array.from(this.toolsByCategory.get(category)!);
      const tools = toolIds.map(id => this.tools.get(id)!);
      
      // Filter disabled tools if requested
      return includeDisabled ? tools : tools.filter(tool => tool.isEnabled);
    } catch (error) {
      console.error(`Error getting tools for category ${category}:`, error);
      return [];
    }
  }
  
  /**
   * Get version history for a tool
   * @param toolId Tool ID
   * @returns Version history
   */
  getToolVersionHistory(toolId: string): ToolVersion[] {
    try {
      if (!this.toolVersions.has(toolId)) {
        return [];
      }
      
      return this.toolVersions.get(toolId)!;
    } catch (error) {
      console.error(`Error getting version history for tool ${toolId}:`, error);
      return [];
    }
  }
  
  /**
   * Mark a tool version as deprecated
   * @param toolId Tool ID
   * @param version Version to deprecate
   * @param notice Deprecation notice
   * @returns Whether the operation was successful
   */
  deprecateToolVersion(
    toolId: string,
    version: string,
    notice: string
  ): boolean {
    try {
      // Check if tool exists
      if (!this.tools.has(toolId)) {
        return false;
      }
      
      // Check if we have version history
      if (!this.toolVersions.has(toolId)) {
        return false;
      }
      
      // Find version
      const versionIndex = this.toolVersions.get(toolId)!.findIndex(v => v.version === version);
      
      if (versionIndex === -1) {
        return false;
      }
      
      // Update version
      const versionInfo = this.toolVersions.get(toolId)![versionIndex];
      versionInfo.isSupported = false;
      versionInfo.deprecationNotice = notice;
      
      // Update in registry
      this.toolVersions.get(toolId)![versionIndex] = versionInfo;
      
      console.log(`Deprecated tool ${toolId} version ${version}`);
      
      return true;
    } catch (error) {
      console.error(`Error deprecating tool ${toolId} version ${version}:`, error);
      return false;
    }
  }
  
  /**
   * Disable a tool
   * @param toolId Tool ID
   * @returns Whether the operation was successful
   */
  disableTool(toolId: string): boolean {
    try {
      // Check if tool exists
      if (!this.tools.has(toolId)) {
        return false;
      }
      
      // Update tool
      const tool = this.tools.get(toolId)!;
      tool.isEnabled = false;
      this.tools.set(toolId, tool);
      
      console.log(`Disabled tool ${toolId}`);
      
      return true;
    } catch (error) {
      console.error(`Error disabling tool ${toolId}:`, error);
      return false;
    }
  }
  
  /**
   * Enable a tool
   * @param toolId Tool ID
   * @returns Whether the operation was successful
   */
  enableTool(toolId: string): boolean {
    try {
      // Check if tool exists
      if (!this.tools.has(toolId)) {
        return false;
      }
      
      // Update tool
      const tool = this.tools.get(toolId)!;
      tool.isEnabled = true;
      this.tools.set(toolId, tool);
      
      console.log(`Enabled tool ${toolId}`);
      
      return true;
    } catch (error) {
      console.error(`Error enabling tool ${toolId}:`, error);
      return false;
    }
  }
} 