import { ChatOpenAI } from '@langchain/openai';
import { ToolRegistry, ToolMetadata } from './registry';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

interface ToolGenerationRequest {
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  inputs: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
  outputs: {
    name: string;
    type: string;
    description: string;
  }[];
  examples: {
    input: Record<string, any>;
    output: any;
  }[];
}

interface ToolUpdateRequest {
  toolName: string;
  updates: Partial<ToolMetadata>;
  codeUpdates?: string;
}

export class ToolSynthesis {
  private registry: ToolRegistry;
  private model: ChatOpenAI;
  private toolsDir: string;
  private metadataDir: string;

  constructor(
    registry: ToolRegistry,
    model: ChatOpenAI,
    options?: {
      toolsDir?: string;
      metadataDir?: string;
    }
  ) {
    this.registry = registry;
    this.model = model;
    this.toolsDir = options?.toolsDir || path.join(process.cwd(), 'src/agents/chloe/tools');
    this.metadataDir = options?.metadataDir || path.join(process.cwd(), 'data/tool-metadata');
  }

  /**
   * Generate a new tool based on requirements
   */
  async generateTool(request: ToolGenerationRequest): Promise<{
    tool: StructuredTool;
    metadata: ToolMetadata;
  }> {
    try {
      // Generate tool code using the model
      const code = await this.generateToolCode(request);

      // Create metadata
      const metadata: ToolMetadata = {
        name: request.name,
        description: request.description,
        category: request.category,
        capabilities: request.capabilities,
        inputs: request.inputs,
        outputs: request.outputs,
        successMetrics: ['completion', 'accuracy'],
        examples: request.examples,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        author: 'ai-generated',
        tags: this.inferTags(request.name, request.description),
        usageCount: 0,
        successRate: 1.0,
        avgExecutionTime: 0,
        status: 'experimental'
      };

      // Create tool instance
      const tool = await this.createToolFromCode(code, metadata);

      // Save tool and metadata
      await this.saveTool(tool, metadata, code);

      return { tool, metadata };
    } catch (error) {
      console.error('Error generating tool:', error);
      throw error;
    }
  }

  /**
   * Update an existing tool
   */
  async updateTool(request: ToolUpdateRequest): Promise<{
    tool: StructuredTool;
    metadata: ToolMetadata;
  }> {
    try {
      const existingTool = this.registry.getTool(request.toolName);
      if (!existingTool) {
        throw new Error(`Tool ${request.toolName} not found`);
      }

      // Update metadata
      const updatedMetadata: ToolMetadata = {
        ...existingTool.metadata,
        ...request.updates,
        updatedAt: new Date().toISOString()
      };

      // Update code if provided
      let tool = existingTool.tool;
      if (request.codeUpdates) {
        tool = await this.createToolFromCode(request.codeUpdates, updatedMetadata);
      }

      // Save updates
      await this.saveTool(tool, updatedMetadata, request.codeUpdates);

      return { tool, metadata: updatedMetadata };
    } catch (error) {
      console.error('Error updating tool:', error);
      throw error;
    }
  }

  /**
   * Generate tool code using the model
   */
  private async generateToolCode(request: ToolGenerationRequest): Promise<string> {
    const prompt = `Generate a TypeScript tool implementation for the following requirements:
Name: ${request.name}
Description: ${request.description}
Category: ${request.category}
Capabilities: ${request.capabilities.join(', ')}
Inputs: ${JSON.stringify(request.inputs, null, 2)}
Outputs: ${JSON.stringify(request.outputs, null, 2)}
Examples: ${JSON.stringify(request.examples, null, 2)}

The tool should:
1. Extend StructuredTool from @langchain/core/tools
2. Implement proper error handling
3. Include input validation
4. Follow best practices for tool implementation
5. Include TypeScript types
6. Be well-documented with comments

Generate only the tool implementation code:`;

    const response = await this.model.invoke(prompt);
    return response.content.toString();
  }

  /**
   * Create a tool instance from code
   */
  private async createToolFromCode(code: string, metadata: ToolMetadata): Promise<StructuredTool> {
    // Create a temporary file with the code
    const tempFile = path.join(this.toolsDir, `${metadata.name}.ts`);
    await fs.writeFile(tempFile, code, 'utf-8');

    try {
      // Import the tool
      const toolModule = await import(tempFile);
      const ToolClass = toolModule.default || Object.values(toolModule)[0];

      // Create instance
      const tool = new ToolClass();

      // Validate the tool
      if (!(tool instanceof StructuredTool)) {
        throw new Error('Generated code did not produce a valid StructuredTool instance');
      }

      return tool;
    } finally {
      // Clean up temporary file
      await fs.unlink(tempFile).catch(console.error);
    }
  }

  /**
   * Save tool and metadata
   */
  private async saveTool(
    tool: StructuredTool,
    metadata: ToolMetadata,
    code?: string
  ): Promise<void> {
    // Save metadata
    const metadataPath = path.join(this.metadataDir, `${metadata.name}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    // Save implementation if code is provided
    if (code) {
      const implementationPath = path.join(this.toolsDir, `${metadata.name}.ts`);
      await fs.writeFile(implementationPath, code, 'utf-8');
    }

    // Register with registry
    this.registry.registerTool(tool, metadata);
  }

  /**
   * Infer tags from name and description
   */
  private inferTags(name: string, description: string): string[] {
    const tags = new Set<string>();
    
    // Add category-based tags
    const categories = ['api', 'data', 'file', 'search', 'transform', 'utility'];
    categories.forEach(category => {
      if (name.toLowerCase().includes(category) || description.toLowerCase().includes(category)) {
        tags.add(category);
      }
    });

    // Add capability-based tags
    const capabilities = ['read', 'write', 'update', 'delete', 'search', 'analyze'];
    capabilities.forEach(capability => {
      if (name.toLowerCase().includes(capability) || description.toLowerCase().includes(capability)) {
        tags.add(capability);
      }
    });

    return Array.from(tags);
  }
} 