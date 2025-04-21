import { z } from 'zod';
import { createTool, createWebSearchTool, createMemorySearchTool } from '@crowd-wisdom/core';
import { generateId } from '@crowd-wisdom/shared';
import { ChloeAgent } from './agent';

// Create a set of tools for the Chloe agent
export function chloeTools(agent: ChloeAgent) {
  const tools = [
    // Web search tool
    createWebSearchTool(),
    
    // Memory search tool
    createMemorySearchTool(),
    
    // Memory save tool
    createTool({
      name: 'save_memory',
      description: 'Save information to long-term memory',
      schema: z.object({
        content: z.string().describe('The text content to save to memory'),
        metadata: z.record(z.any()).optional().describe('Optional metadata for the memory'),
      }),
      func: async ({ content, metadata = {} }) => {
        const memory = agent.getMemory();
        const success = await memory.addMemory(content, metadata);
        return success 
          ? `Successfully saved to memory: "${content.substring(0, 50)}..."`
          : 'Failed to save to memory';
      },
    }),
    
    // Reflection tool
    createTool({
      name: 'reflect',
      description: 'Reflect on a specific question or topic',
      schema: z.object({
        question: z.string().describe('The reflection question or topic'),
      }),
      func: async ({ question }) => {
        const reflection = await agent.reflect(question);
        return reflection;
      },
    }),
    
    // Task creation tool
    createTool({
      name: 'create_task',
      description: 'Create a new task for future execution',
      schema: z.object({
        title: z.string().describe('Short title for the task'),
        description: z.string().describe('Detailed description of what the task involves'),
        priority: z.enum(['low', 'medium', 'high']).default('medium').describe('Task priority'),
        dueDate: z.string().optional().describe('Due date in ISO format (optional)'),
      }),
      func: async ({ title, description, priority, dueDate }) => {
        // This would connect to a task system in a real implementation
        const taskId = generateId('task-');
        
        return `Task created with ID: ${taskId}
Title: ${title}
Priority: ${priority}
Description: ${description}
${dueDate ? `Due date: ${dueDate}` : 'No due date set'}`;
      },
    }),
    
    // Notification tool
    createTool({
      name: 'send_notification',
      description: 'Send a notification message through configured channels',
      schema: z.object({
        message: z.string().describe('The notification message to send'),
      }),
      func: async ({ message }) => {
        agent.notify(message);
        return `Notification sent: "${message}"`;
      },
    }),
  ];
  
  return tools;
} 