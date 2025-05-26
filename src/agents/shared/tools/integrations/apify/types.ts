/**
 * Common types for Apify tools
 */

import { z } from 'zod';

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType<any, any>;
  func: (args: any) => Promise<any>;
  costEstimate?: 'low' | 'medium' | 'high';
  usageLimit?: number;
} 