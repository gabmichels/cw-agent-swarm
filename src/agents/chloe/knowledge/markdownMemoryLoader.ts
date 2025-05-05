import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { MemoryType, ExtendedMemorySource } from '../../../server/memory/config/types';
import { logger } from '../../../lib/logging';
import { ImportanceCalculator } from '../../../lib/memory/ImportanceCalculator';
import { TagExtractor, Tag, TagAlgorithm } from '../../../lib/memory/TagExtractor';
import { ChloeMemory } from '../memory';

// Define memory types constants to replace the import from qdrant
const MEMORY_TYPES = {
  DOCUMENT: 'document',
  MESSAGE: 'message',
  THOUGHT: 'thought',
  TASK: 'task'
};

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
  importance_score?: number;
  source: string;
  filePath: string;
  metadata?: {
    source?: string;
    critical?: boolean;
    importance?: number;
    importance_score?: number;
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

// Fix for MAX_CHUNK_SIZE and split function
const MAX_CHUNK_SIZE = 4000; // Max size for a chunk in characters

/**
 * Split markdown into smaller chunks for better memory retrieval
 */
async function splitMarkdownIntoChunks(content: string): Promise<string[]> {
  // If content is small enough, just return it as a single chunk
  if (content.length <= MAX_CHUNK_SIZE) {
    return [content];
  }

  // Split by headers
  const headerSections = content.split(/^#{1,6} /gm);
  const chunks: string[] = [];
  let currentChunk = '';

  // Process each section
  for (const section of headerSections) {
    // If adding this section would make the chunk too large
    if (currentChunk.length + section.length > MAX_CHUNK_SIZE) {
      // If current chunk is not empty, add it to chunks
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // If the section itself is too large, split it further
      if (section.length > MAX_CHUNK_SIZE) {
        // Split by paragraphs
        const paragraphs = section.split(/\n\s*\n/);
        for (const paragraph of paragraphs) {
          if (currentChunk.length + paragraph.length > MAX_CHUNK_SIZE) {
            if (currentChunk.length > 0) {
              chunks.push(currentChunk);
              currentChunk = '';
            }
            
            // If paragraph is still too large, split it by sentences
            if (paragraph.length > MAX_CHUNK_SIZE) {
              const sentences = paragraph.split(/(?<=[.!?])\s+/);
              for (const sentence of sentences) {
                if (currentChunk.length + sentence.length > MAX_CHUNK_SIZE) {
                  if (currentChunk.length > 0) {
                    chunks.push(currentChunk);
                  }
                  
                  // If sentence is too large, split arbitrarily
                  for (let i = 0; i < sentence.length; i += MAX_CHUNK_SIZE) {
                    chunks.push(sentence.substring(i, i + MAX_CHUNK_SIZE));
                  }
                  
                  currentChunk = '';
                } else {
                  currentChunk += (currentChunk ? ' ' : '') + sentence;
                }
              }
            } else {
              chunks.push(paragraph);
            }
          } else {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
          }
        }
      } else {
        chunks.push(section);
      }
    } else {
      currentChunk += (currentChunk ? '\n' : '') + section;
    }
  }
  
  // Add the last chunk if not empty
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Extract title from frontmatter or first heading
 */
function extractTitle(frontMatter: any, content: string): string {
  // Use frontmatter title if available
  if (frontMatter.title) {
    return frontMatter.title;
  }
  
  // Try to extract the first heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim();
  }
  
  // Fallback to filename if needed
  return 'Untitled Document';
}

/**
 * Extract headings from markdown content
 * @param content Markdown content
 * @returns Array of headings
 */
function extractHeadings(content: string): string[] {
  // Extract H1, H2, and H3 headings (more comprehensive than before)
  const headingMatches = Array.from(content.matchAll(/^(#{1,3})\s+(.*?)$/gm));
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
 * Determine the appropriate memory type based on file path
 * @param filePath Path to the markdown file
 * @returns Appropriate StandardMemoryType
 */
function determineMemoryType(filePath: string): string {
  const lowerPath = filePath.toLowerCase();
  
  // Check for specific directories or patterns
  if (lowerPath.includes('/strategy/') || lowerPath.includes('strategy_')) {
    return 'strategy';
  }
  
  if (lowerPath.includes('/persona/') || lowerPath.includes('persona_')) {
    return 'persona';
  }
  
  if (lowerPath.includes('/vision/') || lowerPath.includes('vision_')) {
    return 'vision';
  }
  
  if (lowerPath.includes('/process/') || lowerPath.includes('process_')) {
    return 'process';
  }
  
  return MemoryType.DOCUMENT;
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
    
    // Also extract explicit hashtags from content
    const explicitTags = extractTags(content);
    
    // Get standard tags from path
    const standardTags = getStandardTagsFromPath(filePath);
    
    // Combine all tags and ensure uniqueness
    const allTags = Array.from(new Set([
      ...titleTags,
      ...headingTags,
      ...explicitTags,
      ...standardTags
    ]));
    
    // Log detailed tag extraction info for debugging
    logger.debug(`Tag extraction for ${filePath}:`, {
      titleTags,
      headingTags,
      explicitTags,
      standardTags,
      combinedTags: allTags
    });
    
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
      ImportanceLevel.CRITICAL,  // Always CRITICAL for markdown files
      ExtendedMemorySource.FILE,
      `Loaded from ${filePath}`,
      allTags,
      {
        filePath,
        source: "markdown",
        critical: true,
        importance: 1.0,      // Explicit numeric importance
        title: title,
        contentType: 'markdown',
        extractedFrom: filePath,
        lastModified: new Date().toISOString(),
        headings: headings     // Store headings for better retrieval context
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
    
    // By default, we prioritize the docs/ and knowledge/ directories
    // These directories contain the most important documentation and knowledge
    // that should be stored with CRITICAL importance and critical=true flag
    const priorityDirectories = directories.length > 0 ? directories : ['docs/', 'knowledge/'];
    
    for (const dir of priorityDirectories) {
      // Use glob to find all markdown files
      const files = glob.sync(`${dir}/**/*.md`, { nodir: true });
      
      // Log how many files were found in each directory
      logger.info(`Found ${files.length} markdown files in ${dir}`);
      
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
  // Extract content from markdown file
  const { data: frontMatter, content: markdownContent } = matter(content);
  
  // Generate standardized metadata for the file
  const standardMetadata = {
    source: ExtendedMemorySource.FILE,
    contentType: 'markdown',
    fileType: 'md',
    filePath,
    lastModified: new Date().toISOString(),
    critical: true, // Markdown files are always critical
    ...frontMatter // Include any frontmatter as metadata
  };
  
  // Extract the title from frontmatter or first heading
  const title = extractTitle(frontMatter, markdownContent);
  
  // Get predefined tags from frontmatter
  const predefinedTags = frontMatter.tags || [];
  
  // Extract tags from title and content
  const extractedTags = extractTagsFromMarkdown(title, markdownContent, predefinedTags);
  
  // Get all unique tags as strings
  const allTagStrings = [
    ...Array.isArray(predefinedTags) ? predefinedTags : [predefinedTags],
    ...extractedTags.map(tag => tag.text)
  ].filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
  
  // Calculate importance directly for markdown (always high)
  const importanceScore = ImportanceCalculator.calculateImportanceScore({
    content: markdownContent,
    source: MemorySource.FILE,
    type: MemoryType.DOCUMENT,
    tags: extractedTags,
    tagConfidence: 0.9, // High confidence for markdown files
    metadata: standardMetadata
  });
  
  // For small files, return as a single memory entry
  if (markdownContent.length < MAX_CHUNK_SIZE) {
    return [{
      title,
      content: markdownContent,
      type: MemoryType.DOCUMENT,
      tags: allTagStrings,
      importance: ImportanceLevel.CRITICAL, // Markdown is always critical
      importance_score: importanceScore,
      source: ExtendedMemorySource.FILE,
      filePath,
      metadata: {
        ...standardMetadata,
        extractedTags,
        tagConfidence: 0.9,
      }
    }];
  }
  
  // For larger files, split into chunks
  const chunks = await splitMarkdownIntoChunks(markdownContent);
  
  // Create a memory entry for each chunk
  return chunks.map((chunk, index) => {
    // Extract chunk-specific tags
    const chunkTags = TagExtractor.extractTags(chunk, {
      algorithm: TagAlgorithm.TFIDF,
      maxTags: 10
    });
    
    // Combine with file-level tags in a way compatible with the Tag interface
    const mergedTagsArray = TagExtractor.mergeTags(extractedTags, chunkTags);
    
    // Map to string tags for storage
    const stringTags = [
      ...allTagStrings,
      ...chunkTags.map(tag => tag.text)
    ].filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
    
    // Calculate chunk-specific importance
    const chunkImportanceScore = ImportanceCalculator.calculateImportanceScore({
      content: chunk,
      source: MemorySource.FILE,
      type: MemoryType.DOCUMENT,
      tags: mergedTagsArray,
      tagConfidence: 0.85,
      metadata: standardMetadata
    });
    
    return {
      title: `${title} (Part ${index + 1})`,
      content: chunk,
      type: MemoryType.DOCUMENT,
      tags: stringTags,
      importance: ImportanceLevel.CRITICAL,
      importance_score: chunkImportanceScore,
      source: ExtendedMemorySource.FILE,
      filePath,
      metadata: {
        ...standardMetadata,
        extractedTags: mergedTagsArray.map(tag => ({ text: tag.text, confidence: tag.confidence })),
        tagConfidence: 0.85,
        partIndex: index,
        totalParts: chunks.length
      }
    };
  });
}

/**
 * Extract tags from markdown content
 */
function extractTagsFromMarkdown(
  title: string,
  content: string,
  predefinedTags: string[] = []
): Tag[] {
  // Extract tags using title and content with different weights
  const extractedTags = TagExtractor.extractTagsFromFields([
    { content: title, weight: 1.5 },     // Title has higher weight
    { content: content, weight: 1.0 }    // Content has standard weight
  ], {
    algorithm: TagAlgorithm.TFIDF,
    maxTags: 15,
    minConfidence: 0.2
  });
  
  // Convert predefined tags to Tag objects with maximum confidence
  const predefinedTagObjects = predefinedTags.map(tag => ({
    text: tag,
    confidence: 1.0,
    approved: true,
    algorithm: 'manual' as any
  })) as Tag[];
  
  // Merge predefined tags with extracted tags, prioritizing predefined
  return TagExtractor.mergeTags(predefinedTagObjects, extractedTags);
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
 * Extract tags from markdown content
 * @param content Markdown content
 * @returns Array of tags
 */
function extractTags(content: string): string[] {
  try {
    const tags = new Set<string>();
    
    // Extract explicit hashtags like #tag
    const hashtagMatches = content.match(/#([a-zA-Z0-9_]+)/g);
    if (hashtagMatches) {
      for (const tag of hashtagMatches) {
        // Remove # prefix and add to set if at least 3 chars
        const cleanTag = tag.substring(1).toLowerCase();
        if (cleanTag.length >= 3) {
          tags.add(cleanTag);
        }
      }
    }
    
    // Extract heading content as potential tags (more important for knowledge organization)
    // Look for markdown headers (e.g., ## Heading)
    const headingMatches = content.match(/^#+\s+(.+)$/gm);
    if (headingMatches) {
      for (const heading of headingMatches) {
        // Remove heading markers and extract keywords
        const cleanHeading = heading.replace(/^#+\s+/, '').trim();
        
        // Split heading into words
        const words = cleanHeading.split(/\s+/);
        
        // Add individual words if 4+ chars (likely significant)
        for (const word of words) {
          const cleanWord = word.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
          if (cleanWord.length >= 4 && !isStopWord(cleanWord)) {
            tags.add(cleanWord);
          }
        }
        
        // For multi-word headings (2-3 words), add the whole phrase as a tag
        if (words.length >= 2 && words.length <= 3) {
          const phraseTag = cleanHeading.toLowerCase()
            .replace(/[^a-zA-Z0-9_\s]/g, '')  // Remove special chars except spaces
            .replace(/\s+/g, '_');            // Replace spaces with underscores
          
          if (phraseTag.length >= 5) {
            tags.add(phraseTag);
          }
        }
      }
    }
    
    return Array.from(tags);
  } catch (error) {
    logger.error('Error extracting tags:', error);
    return [];
  }
}

/**
 * Check if a word is a common stop word that shouldn't be used as a tag
 * @param word Word to check
 * @returns True if it's a stop word
 */
function isStopWord(word: string): boolean {
  const stopWords = [
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'has',
    'should', 'would', 'could', 'about', 'then', 'than', 'what', 'when',
    'where', 'which', 'their', 'they', 'them', 'these', 'those', 'some',
    'will', 'been', 'were', 'because'
  ];
  return stopWords.includes(word.toLowerCase());
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