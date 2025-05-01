import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import * as memory from '../../../server/qdrant';
import { ImportanceLevel, MemorySource, ChloeMemoryType } from '../../../constants/memory';

// Import the constants for memory types
import { MEMORY_TYPES } from '../../../constants/qdrant';

// Define new memory types for structured markdown content
export enum MarkdownMemoryType {
  STRATEGY = 'strategy',
  PERSONA = 'persona',
  VISION = 'vision',
  PROCESS = 'process',
  KNOWLEDGE = 'knowledge'
}

// Define the memory entry interface for markdown content
export interface ChloeMemoryEntry {
  title: string;
  content: string;
  type: string;
  tags: string[];
  importance: ImportanceLevel;
  source: string;
  filePath: string;
}

interface MarkdownParseResult {
  title: string;
  content: string;
  headers: { [key: string]: string };
  tags: string[];
  importance: ImportanceLevel;
  type: string;
}

/**
 * Parse markdown content and extract structured data
 * @param filePath Path to the markdown file
 * @param content Raw markdown content
 * @returns Array of structured memory entries
 */
export async function markdownToMemoryEntries(filePath: string, content: string): Promise<ChloeMemoryEntry[]> {
  // Parse front matter (YAML at the top of the file)
  const { data, content: markdownContent } = matter(content);
  
  // Extract metadata from frontmatter
  const tags = data.tags || [];
  const importance = data.importance || ImportanceLevel.MEDIUM;
  
  // Determine memory type based on file path - handle the actual folder structure
  let type = MarkdownMemoryType.KNOWLEDGE;
  
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  
  if (normalizedPath.includes('/company/')) {
    // Company information
    if (normalizedPath.includes('/general/') || normalizedPath.includes('/strategy/')) {
      type = MarkdownMemoryType.STRATEGY;
    } else if (normalizedPath.includes('/vision/')) {
      type = MarkdownMemoryType.VISION;
    } else if (normalizedPath.includes('/process/')) {
      type = MarkdownMemoryType.PROCESS;
    }
  } else if (normalizedPath.includes('/domains/')) {
    // Domain knowledge
    type = MarkdownMemoryType.KNOWLEDGE;
  } else if (
    normalizedPath.includes('/agents/') || 
    normalizedPath.includes('/chloe/') || 
    normalizedPath.includes('/agent/')
  ) {
    // Agent persona
    type = MarkdownMemoryType.PERSONA;
  }
  
  // Override based on frontmatter if present
  if (data.type) {
    switch (data.type.toLowerCase()) {
      case 'strategy':
        type = MarkdownMemoryType.STRATEGY;
        break;
      case 'vision':
        type = MarkdownMemoryType.VISION;
        break;
      case 'process':
        type = MarkdownMemoryType.PROCESS;
        break;
      case 'persona':
        type = MarkdownMemoryType.PERSONA;
        break;
      case 'knowledge':
        type = MarkdownMemoryType.KNOWLEDGE;
        break;
    }
  }
  
  // Get file basename as title if not specified in frontmatter
  const title = data.title || path.basename(filePath, '.md');
  
  // If we have sections with headers, split them up
  // This creates multiple memory entries from one file
  const sections = splitMarkdownByHeaders(markdownContent);
  
  if (sections.length > 1) {
    return sections.map((section, index) => {
      const sectionTitle = section.title || (index === 0 ? title : `${title} - ${section.title || 'Section ' + (index + 1)}`);
      
      return {
        title: sectionTitle,
        content: section.content,
        type: type,
        tags: [...tags, ...(section.tags || [])],
        importance: section.importance || importance,
        source: MemorySource.FILE,
        filePath
      };
    });
  }
  
  // If no sections, return the whole document as one memory entry
  return [{
    title,
    content: markdownContent,
    type,
    tags,
    importance,
    source: MemorySource.FILE,
    filePath
  }];
}

/**
 * Split markdown content by headers and return sections
 * @param content Markdown content
 * @returns Array of sections with title and content
 */
function splitMarkdownByHeaders(content: string): Array<{title: string; content: string; tags?: string[]; importance?: ImportanceLevel}> {
  const headerRegex = /^(#{2,3})\s+(.+)$/gm;
  const sections: Array<{title: string; content: string; tags?: string[]; importance?: ImportanceLevel}> = [];
  
  let lastIndex = 0;
  let match;
  let currentTitle = '';
  
  // First, find all the headers
  const matches = Array.from(content.matchAll(headerRegex));
  
  if (matches.length === 0) {
    // No headers found, return the whole content as one section
    return [{ title: '', content }];
  }
  
  // Process each header match
  for (let i = 0; i < matches.length; i++) {
    match = matches[i];
    const headerStart = match.index!;
    const headerEnd = headerStart + match[0].length;
    const title = match[2].trim();
    
    // If this isn't the first header, add the previous section
    if (i > 0) {
      const prevContent = content.substring(lastIndex, headerStart).trim();
      sections.push({
        title: currentTitle,
        content: prevContent,
        tags: extractTags(prevContent),
        importance: extractImportance(prevContent)
      });
    } else if (headerStart > 0) {
      // There's content before the first header
      const introContent = content.substring(0, headerStart).trim();
      if (introContent) {
        sections.push({
          title: 'Introduction',
          content: introContent,
          tags: extractTags(introContent),
          importance: extractImportance(introContent)
        });
      }
    }
    
    currentTitle = title;
    lastIndex = headerEnd;
    
    // Handle the last section
    if (i === matches.length - 1) {
      sections.push({
        title: currentTitle,
        content: content.substring(headerEnd).trim(),
        tags: extractTags(content.substring(headerEnd)),
        importance: extractImportance(content.substring(headerEnd))
      });
    }
  }
  
  return sections;
}

/**
 * Extract hashtags from content
 * @param content Text content
 * @returns Array of tags without the # symbol
 */
function extractTags(content: string): string[] {
  const tagRegex = /#([a-zA-Z0-9]+)/g;
  const tags = [];
  let match;
  
  while ((match = tagRegex.exec(content)) !== null) {
    tags.push(match[1].toLowerCase());
  }
  
  return tags;
}

/**
 * Extract importance level from content based on keywords
 * @param content Text content
 * @returns Importance level
 */
function extractImportance(content: string): ImportanceLevel {
  const lowercaseContent = content.toLowerCase();
  
  if (
    lowercaseContent.includes('critical') || 
    lowercaseContent.includes('urgent') || 
    lowercaseContent.includes('highest priority')
  ) {
    return ImportanceLevel.CRITICAL;
  } else if (
    lowercaseContent.includes('important') || 
    lowercaseContent.includes('high priority') ||
    lowercaseContent.includes('significant')
  ) {
    return ImportanceLevel.HIGH;
  } else if (
    lowercaseContent.includes('low priority') || 
    lowercaseContent.includes('minor') ||
    lowercaseContent.includes('trivial')
  ) {
    return ImportanceLevel.LOW;
  }
  
  return ImportanceLevel.MEDIUM;
}

/**
 * Load all markdown files and convert them to memory entries
 * @param knowledgeDir Base directory for knowledge files
 * @returns Statistics about processed files
 */
export async function loadAllMarkdownAsMemory(knowledgeDir: string = 'data/knowledge'): Promise<{
  filesProcessed: number;
  entriesAdded: number;
  typeStats: Record<string, number>;
}> {
  const stats = {
    filesProcessed: 0,
    entriesAdded: 0,
    typeStats: {} as Record<string, number>
  };
  
  try {
    console.log('Loading markdown files as memory entries...');
    
    // Find all markdown files in knowledge directories using the actual structure
    // Use a broader search to capture files in subdirectories
    const companyFiles = await glob('company/**/*.md', { cwd: knowledgeDir });
    const domainsFiles = await glob('domains/**/*.md', { cwd: knowledgeDir });
    
    // Look for agent-specific files in the chloe directory and other agent directories
    const agentChloeFiles = await glob('../**/*.md', { cwd: knowledgeDir }); // Look in parent folder for chloe files
    const otherAgentFiles = await glob('agents/**/*.md', { cwd: knowledgeDir });
    
    const allFiles = [
      ...companyFiles, 
      ...domainsFiles, 
      ...agentChloeFiles,
      ...otherAgentFiles
    ];
    
    stats.filesProcessed = allFiles.length;
    
    console.log(`Found ${allFiles.length} markdown files to process`);
    console.log('Files by directory:');
    console.log(`- Company: ${companyFiles.length}`);
    console.log(`- Domains: ${domainsFiles.length}`);
    console.log(`- Agent (Chloe): ${agentChloeFiles.length}`);
    console.log(`- Other Agents: ${otherAgentFiles.length}`);
    
    // Process each file
    for (const file of allFiles) {
      const fullPath = path.join(knowledgeDir, file);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const memoryEntries = await markdownToMemoryEntries(file, content);
        
        // Add each section as a separate memory entry
        for (const entry of memoryEntries) {
          const formattedContent = `# ${entry.title}\n\n${entry.content}`;
          
          // Convert to base memory type for storage
          const baseType = convertToBaseMemoryType(entry.type);
          
          // Store in memory system
          await memory.addMemory(
            baseType as 'message' | 'thought' | 'document' | 'task',
            formattedContent,
            {
              title: entry.title,
              filePath: entry.filePath,
              type: entry.type,
              tags: entry.tags,
              importance: entry.importance,
              source: entry.source
            }
          );
          
          // Update statistics
          stats.entriesAdded++;
          stats.typeStats[entry.type] = (stats.typeStats[entry.type] || 0) + 1;
        }
        
        console.log(`Processed ${file}: Added ${memoryEntries.length} memory entries`);
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
      }
    }
    
    console.log('Finished loading markdown files as memory:');
    console.log(`- Files processed: ${stats.filesProcessed}`);
    console.log(`- Memory entries added: ${stats.entriesAdded}`);
    console.log('- Types distribution:', stats.typeStats);
    
    return stats;
  } catch (error) {
    console.error('Error loading markdown files as memory:', error);
    throw error;
  }
}

/**
 * Convert markdown memory type to base memory type
 * @param type Markdown memory type
 * @returns Base memory type
 */
function convertToBaseMemoryType(type: string): string {
  // Map markdown memory types to base memory types
  switch (type) {
    case MarkdownMemoryType.STRATEGY:
    case MarkdownMemoryType.VISION:
    case MarkdownMemoryType.PROCESS:
    case MarkdownMemoryType.KNOWLEDGE:
      return MEMORY_TYPES.DOCUMENT;
    case MarkdownMemoryType.PERSONA:
      return MEMORY_TYPES.DOCUMENT;
    default:
      return MEMORY_TYPES.DOCUMENT;
  }
} 