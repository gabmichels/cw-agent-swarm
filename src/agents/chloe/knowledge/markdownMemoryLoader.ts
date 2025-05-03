import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import * as memory from '../../../server/qdrant';
import { ImportanceLevel, MemorySource, ChloeMemoryType } from '../../../constants/memory';
import { logger } from '../../../lib/logging';

// Import the constants for memory types
import { MEMORY_TYPES } from '../../../constants/qdrant';

// Cache to store file modification times and memory IDs
let fileModCache = new Map<string, { lastModified: number, memoryIds: string[] }>();

// Path to the cache file
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'cache', 'markdown-cache.json');

/**
 * Load the file modification cache from disk
 */
async function loadFileModCache(): Promise<void> {
  try {
    // Create cache directory if it doesn't exist
    const cacheDir = path.dirname(CACHE_FILE_PATH);
    await fs.mkdir(cacheDir, { recursive: true });

    // Check if cache file exists
    try {
      const data = await fs.readFile(CACHE_FILE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      
      // Convert from plain object to Map
      fileModCache = new Map(Object.entries(parsed).map(([filePath, info]) => {
        return [filePath, info as { lastModified: number, memoryIds: string[] }];
      }));
      
      logger.info(`Loaded markdown cache with ${fileModCache.size} entries`);
    } catch (err) {
      // File doesn't exist or is invalid, create a new empty cache
      fileModCache = new Map();
      logger.info('No markdown cache found, creating new cache');
    }
  } catch (err) {
    logger.error('Error loading markdown cache:', err);
    fileModCache = new Map();
  }
}

/**
 * Save the file modification cache to disk
 */
async function saveFileModCache(): Promise<void> {
  try {
    // Convert Map to plain object for JSON serialization
    const cacheObj = Object.fromEntries(fileModCache.entries());
    
    // Create cache directory if it doesn't exist
    const cacheDir = path.dirname(CACHE_FILE_PATH);
    await fs.mkdir(cacheDir, { recursive: true });
    
    // Write cache to file
    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cacheObj, null, 2), 'utf8');
    logger.info(`Saved markdown cache with ${fileModCache.size} entries`);
  } catch (err) {
    logger.error('Error saving markdown cache:', err);
  }
}

/**
 * Check if a file needs to be reloaded based on its modification time
 * @param filePath Path to the markdown file
 * @returns Object containing whether the file needs reloading and any existing memory IDs
 */
async function shouldReloadFile(filePath: string): Promise<{ needsReload: boolean, memoryIds: string[], reason: string }> {
  try {
    const stats = await fs.stat(filePath);
    const lastModified = stats.mtime.getTime();
    const cached = fileModCache.get(filePath);

    if (!cached) {
      // New file, needs to be loaded
      return { needsReload: true, memoryIds: [], reason: 'new_file' };
    }

    if (lastModified > cached.lastModified) {
      // File has been modified, needs to be reloaded
      logger.info(`File modified since last load: ${filePath}`);
      return { needsReload: true, memoryIds: cached.memoryIds, reason: 'modified' };
    }

    // File hasn't changed, no need to reload
    return { needsReload: false, memoryIds: cached.memoryIds, reason: 'unchanged' };
  } catch (error) {
    logger.error(`Error checking file modification time for ${filePath}:`, error);
    return { needsReload: true, memoryIds: [], reason: 'error' };
  }
}

/**
 * Update the file modification cache
 * @param filePath Path to the markdown file
 * @param memoryIds Array of memory IDs associated with this file
 */
function updateFileModCache(filePath: string, memoryIds: string[]): void {
  try {
    const stats = fsSync.statSync(filePath);
    fileModCache.set(filePath, {
      lastModified: stats.mtime.getTime(),
      memoryIds
    });
    
    // Save the cache after each update to ensure persistence
    void saveFileModCache();
  } catch (error) {
    logger.error(`Error updating file modification cache for ${filePath}:`, error);
  }
}

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
  metadata?: {
    source?: string;
    critical?: boolean;
    importance?: number;
    contentType?: string;
    extractedFrom?: string;
    lastModified?: string;
    [key: string]: any;
  };
}

interface MarkdownParseResult {
  title: string;
  content: string;
  headers: { [key: string]: string };
  tags: string[];
  importance: ImportanceLevel;
  type: string;
}

// Common stop words to filter out when extracting tags
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'by', 'of', 'from',
  'about', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'this', 'that', 'these', 'those', 'it', 'its', 'we', 'they', 'you', 'i', 'me',
  'my', 'mine', 'your', 'yours', 'our', 'ours', 'their', 'theirs', 'his', 'her',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should',
  'can', 'could', 'may', 'might', 'must', 'ought'
]);

/**
 * Extract significant keywords from text to use as tags
 * @param text Text to extract keywords from
 * @returns Array of keywords
 */
function extractKeywordsFromText(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  
  // Convert to lowercase and remove punctuation
  const cleaned = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
    .replace(/\s+/g, ' ')      // Replace multiple spaces with single space
    .trim();
  
  // Split into words and filter out stop words and short words
  const words = cleaned.split(' ').filter(word => {
    return word.length > 3 && !STOP_WORDS.has(word);
  });
  
  // Return unique words
  return Array.from(new Set(words));
}

/**
 * Extract title from markdown content
 * @param content Markdown content
 * @param filePath Fallback file path for title extraction
 * @returns Extracted title
 */
function extractTitle(content: string, filePath: string): string {
  // Look for the first H1 heading
  const titleMatch = content.match(/^#\s+(.*?)$/m);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }
  
  // Fallback to filename without extension
  const fileName = path.basename(filePath, path.extname(filePath));
  return fileName.replace(/[-_]/g, ' ');
}

/**
 * Extract headings from markdown content
 * @param content Markdown content
 * @returns Array of headings
 */
function extractHeadings(content: string): string[] {
  // Extract H1 and H2 headings
  const headingMatches = Array.from(content.matchAll(/^(#{1,2})\s+(.*?)$/gm));
  return headingMatches.map(match => match[2].trim());
}

/**
 * Get standard tags based on file path
 * @param filePath Path to markdown file
 * @returns Array of standard tags
 */
function getStandardTagsFromPath(filePath: string): string[] {
  const tags: string[] = ['markdown', 'documentation'];
  
  // Add tags based on directory structure
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  if (normalizedPath.includes('docs/')) {
    tags.push('docs');
  }
  
  if (normalizedPath.includes('knowledge/')) {
    tags.push('knowledge');
  }
  
  // Add specific domain tags based on subdirectories
  const pathParts = normalizedPath.split('/');
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i].toLowerCase();
    // Skip common parent directory names
    if (part !== 'docs' && part !== 'knowledge' && part !== 'src' && part.length > 2) {
      tags.push(part);
    }
  }
  
  return tags;
}

/**
 * Determine memory type based on file path
 * @param filePath Path to markdown file
 * @returns Appropriate ChloeMemoryType
 */
function determineMemoryType(filePath: string): ChloeMemoryType {
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  
  if (normalizedPath.includes('strategy') || normalizedPath.includes('roadmap')) {
    return ChloeMemoryType.STRATEGY;
  }
  
  if (normalizedPath.includes('persona') || normalizedPath.includes('brand')) {
    return ChloeMemoryType.PERSONA;
  }
  
  if (normalizedPath.includes('vision') || normalizedPath.includes('mission')) {
    return ChloeMemoryType.VISION;
  }
  
  if (normalizedPath.includes('process') || normalizedPath.includes('workflow')) {
    return ChloeMemoryType.PROCESS;
  }
  
  return ChloeMemoryType.KNOWLEDGE;
}

/**
 * Process a markdown file into memory
 * @param memoryManager Memory manager instance to use
 * @param filePath Path to markdown file
 * @returns Result of processing
 */
export async function processMarkdownFile(memoryManager: any, filePath: string): Promise<{
  success: boolean;
  memoryId?: string;
  title?: string;
  type?: string;
  tags?: string[];
  error?: string;
}> {
  try {
    // Check if file needs to be reloaded
    const { needsReload, memoryIds, reason } = await shouldReloadFile(filePath);
    
    if (!needsReload) {
      logger.info(`Skipping unchanged file: ${filePath}`);
      return {
        success: true,
        memoryId: memoryIds[0],
        type: 'unchanged'
      };
    }

    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Extract title and headings
    const title = extractTitle(content, filePath);
    const headings = extractHeadings(content);
    
    // Extract tags from title and headings
    const titleTags = extractKeywordsFromText(title);
    const headingTags = headings.flatMap(heading => extractKeywordsFromText(heading));
    
    // Get standard tags from path
    const standardTags = getStandardTagsFromPath(filePath);
    
    // Combine all tags and ensure uniqueness
    const allTags = Array.from(new Set([
      ...titleTags,
      ...headingTags,
      ...standardTags
    ]));
    
    // Determine memory type based on file path
    const memoryType = determineMemoryType(filePath);
    
    // If we have existing memory IDs, delete them before adding new content
    if (memoryIds.length > 0) {
      for (const id of memoryIds) {
        await memoryManager.deleteMemory(id);
      }
    }
    
    // Add to memory with critical importance
    const result = await memoryManager.addMemory(
      content,
      memoryType,
      ImportanceLevel.CRITICAL,
      MemorySource.FILE,
      `Loaded from ${filePath}`,
      allTags,
      {
        filePath,
        source: "markdown",
        critical: true,
        importance: 1.0,
        title: title,
        contentType: 'markdown',
        extractedFrom: filePath,
        lastModified: new Date().toISOString()
      }
    );
    
    // Update the file modification cache
    updateFileModCache(filePath, [result.id]);
    
    logger.info(`Processed markdown file "${title}" with ${allTags.length} tags as ${memoryType}`);
    
    return {
      success: true,
      memoryId: result.id,
      title,
      type: memoryType,
      tags: allTags
    };
  } catch (error) {
    logger.error(`Error processing markdown file ${filePath}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Find all markdown files in the specified directories
 * @param directories Directories to search for markdown files
 * @returns Array of file paths
 */
export async function findMarkdownFiles(directories: string[] = ['docs/', 'knowledge/']): Promise<string[]> {
  try {
    const allFiles: string[] = [];
    
    for (const dir of directories) {
      // Use glob to find all markdown files
      const files = glob.sync(`${dir}/**/*.md`, { nodir: true });
      allFiles.push(...files);
    }
    
    return allFiles;
  } catch (error) {
    logger.error('Error finding markdown files:', error);
    return [];
  }
}

/**
 * Process each file
 * @param filePath Path to markdown file
 * @param memoryManager Memory manager instance
 * @param chloeMemory Chloe memory instance
 * @param options Processing options
 * @param stats Stats object to update
 */
async function processFile(
  filePath: string,
  memoryManager: any,
  chloeMemory: any,
  options: {
    force?: boolean;
    checkForDuplicates?: boolean;
  },
  stats: {
    filesProcessed: number;
    entriesAdded: number;
    typeStats: Record<string, number>;
    filesSkipped: number;
    duplicatesSkipped: number;
    unchangedFiles: number;
  }
): Promise<void> {
  try {
    // If force loading is disabled, check if the file needs to be reloaded
    if (!options.force) {
      const { needsReload, memoryIds, reason } = await shouldReloadFile(filePath);
      
      if (!needsReload && memoryIds.length > 0) {
        logger.info(`Skipping unchanged file (${reason}): ${filePath}`);
        stats.unchangedFiles++;
        return;
      }
      
      if (needsReload && reason === 'modified' && memoryIds.length > 0) {
        logger.info(`File modified, will reload: ${filePath}`);
        // Continue processing to reload the file
      } else if (needsReload && reason === 'new_file') {
        logger.info(`New file found, will load: ${filePath}`);
        // Continue processing to load the new file
      }
    } else {
      logger.info(`Force loading file: ${filePath}`);
    }

    // Only check for duplicates if we're not forcing a reload and the cache didn't find it
    if (options.checkForDuplicates && !options.force) {
      // Search for memories with this file path in metadata
      const existingEntries = await chloeMemory.getEnhancedMemoriesWithHybridSearch(
        filePath, // Use the file path as a query
        5,        // Limit to a few results
        {
          types: ['document', 'knowledge', 'strategy', 'persona', 'vision', 'process'],
          expandQuery: false
        }
      );
      
      // Check if any of the found memories have this exact file path in metadata
      const isDuplicate = existingEntries.some((entry: any) => 
        entry.metadata?.filePath === filePath || 
        entry.metadata?.extractedFrom === filePath
      );
      
      if (isDuplicate) {
        logger.info(`Skipping duplicate file: ${filePath}`);
        stats.duplicatesSkipped++;
        return;
      }
    }
    
    // Process file if it's not a duplicate or if force loading is enabled
    const result = await processMarkdownFile(memoryManager, filePath);
    
    if (result.success) {
      if (result.type === 'unchanged') {
        stats.unchangedFiles++;
      } else {
        stats.entriesAdded++;
        stats.filesProcessed++;
        
        // Track memory types
        const type = result.type || 'unknown';
        stats.typeStats[type] = (stats.typeStats[type] || 0) + 1;
      }
    } else {
      stats.filesSkipped++;
      logger.warn(`Skipped file ${filePath}: ${result.error}`);
    }
  } catch (error) {
    stats.filesSkipped++;
    logger.error(`Error processing ${filePath}:`, error);
  }
}

/**
 * Load all markdown files into memory
 * @param directoriesToLoad Optional directories to load markdown from
 * @param options Additional loading options
 * @returns Statistics about the loading process
 */
export async function loadAllMarkdownAsMemory(
  directoriesToLoad: string[] = ['docs/', 'knowledge/'],
  options: {
    force?: boolean; // Whether to force reload files even if they exist
    checkForDuplicates?: boolean; // Whether to check for duplicates
  } = { checkForDuplicates: true }
): Promise<{
  filesProcessed: number;
  entriesAdded: number;
  typeStats: Record<string, number>;
  filesSkipped: number;
  duplicatesSkipped: number;
  unchangedFiles: number;
}> {
  try {
    // Load the file modification cache from disk
    await loadFileModCache();
    
    // Find all markdown files
    const markdownFiles = await findMarkdownFiles(directoriesToLoad);
    
    logger.info(`Found ${markdownFiles.length} markdown files to process`);
    
    // Initialize stats
    const stats = {
      filesProcessed: 0,
      entriesAdded: 0,
      typeStats: {} as Record<string, number>,
      filesSkipped: 0,
      duplicatesSkipped: 0,
      unchangedFiles: 0
    };
    
    // Get memory manager instance
    let memoryManager;
    try {
      // Import the MemoryManager class directly as a named export
      const { MemoryManager } = await import('../core/memoryManager');
      
      memoryManager = new MemoryManager({ agentId: 'chloe' });
      await memoryManager.initialize();
    } catch (error) {
      logger.error('Error initializing memory manager:', error);
      throw new Error('Failed to initialize memory manager for markdown loading');
    }
    
    // Get the memory instance to check for duplicates
    const chloeMemory = memoryManager.getChloeMemory();
    
    if (!chloeMemory) {
      throw new Error('ChloeMemory not initialized');
    }
    
    // Process each file
    for (const filePath of markdownFiles) {
      await processFile(filePath, memoryManager, chloeMemory, options, stats);
    }
    
    // Save the cache at the end of processing
    await saveFileModCache();
    
    logger.info(`Markdown loading complete: Processed ${stats.filesProcessed} files, added ${stats.entriesAdded} entries, skipped ${stats.duplicatesSkipped} duplicates, unchanged: ${stats.unchangedFiles}`);
    return stats;
  } catch (error) {
    logger.error('Error loading markdown files:', error);
    return {
      filesProcessed: 0,
      entriesAdded: 0,
      typeStats: {},
      filesSkipped: 0,
      duplicatesSkipped: 0,
      unchangedFiles: 0
    };
  }
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
  // Always set importance to CRITICAL for markdown files
  const importance = ImportanceLevel.CRITICAL;
  
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
      
      // Extract additional tags from the section title
      const sectionTitleTags = extractKeywordsFromText(sectionTitle);
      const allTags = [...tags, ...sectionTitleTags, ...(section.tags || [])];
      
      return {
        title: sectionTitle,
        content: section.content,
        type: type,
        tags: Array.from(new Set(allTags)), // Ensure tag uniqueness
        importance: ImportanceLevel.CRITICAL, // Always set to CRITICAL
        source: MemorySource.FILE,
        filePath,
        metadata: {
          source: "markdown", 
          critical: true,
          importance: 1.0,
          contentType: 'markdown',
          extractedFrom: filePath,
          lastModified: new Date().toISOString()
        }
      };
    });
  }
  
  // If no sections, return the whole document as one memory entry
  return [{
    title,
    content: markdownContent,
    type,
    tags,
    importance: ImportanceLevel.CRITICAL, // Always set to CRITICAL
    source: MemorySource.FILE,
    filePath,
    metadata: {
      source: "markdown", 
      critical: true,
      importance: 1.0,
      contentType: 'markdown',
      extractedFrom: filePath,
      lastModified: new Date().toISOString()
    }
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