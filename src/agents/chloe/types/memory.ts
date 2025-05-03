import { ImportanceLevel, ChloeMemoryType, MemorySource } from '../../../constants/memory';

// First, create an extended enum for MemorySource that includes 'chloe', 'tool', and 'web'
export enum ExtendedMemorySource {
  USER = 'user',
  CHLOE = 'chloe',
  SYSTEM = 'system', 
  TOOL = 'tool',
  WEB = 'web',
  EXTERNAL = 'external',
  FILE = 'file'
}

export interface Memory {
  id: string;
  content: string;
  type: ChloeMemoryType;
  importance: ImportanceLevel;
  source: ExtendedMemorySource;
  context?: string;
  created: Date;
  lastAccessed?: Date;
  accessCount?: number;
  tags?: string[];
  metadata?: Record<string, any>;
} 