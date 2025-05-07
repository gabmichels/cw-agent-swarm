import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { MemoryType, ExtendedMemorySource } from '../../../server/memory/config/types';
import { logger } from '../../../lib/logging';
import { ImportanceCalculator } from '../../../lib/memory/ImportanceCalculator';
import { Tag, TagAlgorithm } from '../../../lib/memory/TagExtractor';
import { ChloeMemory } from '../memory';
import { extractTags } from '../../../utils/tagExtractor';
import { MemoryManager } from '../core/memoryManager';
import { COLLECTIONS } from '../../../constants/qdrant';

// Define memory types constants to replace the import from qdrant
const MEMORY_TYPES = {
  DOCUMENT: 'document',
  MESSAGE: 'message',
  THOUGHT: 'thought',
  TASK: 'task'
};

// Cache to store file modification times, content hashes, and memory IDs
let fileModCache = new Map<string, { 
  lastModified: number, 
  contentHash?: string, 
  memoryIds: string[],
  tags?: string[] // Add tags to the cache entry
}>();
let cacheLoaded = false;
// Add a loading flag to prevent concurrent cache operations
let isCacheLoading = false;

// Path to the cache file
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'cache', 'markdown-cache.json');

/**
 * Reset the cache loaded state - call this whenever you need to force a fresh reload
 */
export function resetCacheState() {
  cacheLoaded = false;
  fileModCache.clear();
}

/**
 * Load the file modification cache from disk
 * This function now checks if the cache is already loaded before trying to reload it
 */
async function loadFileModCache(): Promise<void> {
  // If cache is already loaded, don't reload it
  if (cacheLoaded && fileModCache.size > 0) {
    logger.info(`Using existing cache with ${fileModCache.size} entries`);
    return;
  }
  
  // If already loading, wait for it to complete
  if (isCacheLoading) {
    logger.info('Cache is already being loaded, waiting...');
    // Wait for loading to complete
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!isCacheLoading) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
    });
    return;
  }
  
  // Set loading flag
  isCacheLoading = true;
  
  try {
    // Create cache directory if it doesn't exist
    const cacheDir = path.dirname(CACHE_FILE_PATH);
    await fs.mkdir(cacheDir, { recursive: true });

    // Check if cache file exists and has content
    let fileExists = false;
    try {
      const stats = await fs.stat(CACHE_FILE_PATH);
      fileExists = stats.isFile() && stats.size > 0;
    } catch (statErr) {
      fileExists = false;
    }

    if (!fileExists) {
      // No cache file or empty file, we'll create a new one and force reload
      logger.info('No markdown cache file found or file is empty, will reload all files');
      fileModCache = new Map();
      cacheLoaded = true; // Mark as loaded with empty cache
      return;
    }

    const data = await fs.readFile(CACHE_FILE_PATH, 'utf8');
    
    // Ensure we have valid data
    if (!data || data.trim() === '') {
      logger.info('Empty markdown cache file found, will reload all files');
      fileModCache = new Map();
      cacheLoaded = true; // Mark as loaded with empty cache
      return;
    }
    
    try {
      const parsed = JSON.parse(data);
      
      // Check if the parsed result is an empty object
      if (!parsed || Object.keys(parsed).length === 0) {
        logger.info('Empty markdown cache object found, will reload all files');
        fileModCache = new Map();
        cacheLoaded = true;
        return;
      }
      
      // Convert from plain object to Map, normalizing paths
      fileModCache = new Map(Object.entries(parsed).map(([filePath, info]) => {
        const normalizedPath = path.normalize(filePath);
        return [normalizedPath, info as { lastModified: number, contentHash?: string, memoryIds: string[], tags?: string[] }];
      }));
      
      logger.info(`Loaded markdown cache with ${fileModCache.size} entries`);
      cacheLoaded = true;
    } catch (parseErr) {
      logger.warn('Invalid JSON in markdown cache file, will reload all files');
      fileModCache = new Map();
      cacheLoaded = true;
    }
  } catch (err) {
    logger.error('Error loading markdown cache:', err);
    fileModCache = new Map();
    cacheLoaded = true; // Mark as loaded even on error to prevent future loads
  } finally {
    // Reset loading flag
    isCacheLoading = false;
  }
}

/**
 * Save the file modification cache to disk
 */
async function saveFileModCache(): Promise<void> {
  try {
    // Convert Map to plain object for JSON serialization, ensuring paths are normalized
    const cacheObj = Object.fromEntries(
      Array.from(fileModCache.entries()).map(([filePath, info]) => [
        path.normalize(filePath),
        info
      ])
    );
    
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
 * Check if a file needs to be reloaded - SIMPLIFIED VERSION
 * @param filePath Path to the markdown file
 * @returns Object containing whether the file needs reloading and any existing memory IDs
 */
export async function shouldReloadFile(filePath: string): Promise<{ needsReload: boolean, memoryIds: string[], tags?: string[], reason: string }> {
  try {
    // Wait for cache to be loaded if it isn't already
    if (!cacheLoaded) {
      await loadFileModCache();
    }
    
    // Normalize path to prevent path format inconsistencies
    const normalizedPath = path.normalize(filePath);
    
    // Check if file exists in cache - that's it!
    const cached = fileModCache.get(normalizedPath);
    
    // If no cache entry exists, we need to reload
    if (!cached) {
      return { needsReload: true, memoryIds: [], reason: 'new_file' };
    }
    
    // We have a cache entry, so no need to reload
    return { 
      needsReload: false, 
      memoryIds: cached.memoryIds, 
      tags: cached.tags,
      reason: 'in_cache' 
    };
    
  } catch (error) {
    logger.error(`Error checking file in cache for ${filePath}:`, error);
    return { needsReload: true, memoryIds: [], reason: 'error' };
  }
}

/**
 * Update the file modification cache
 * @param filePath Path to the markdown file
 * @param memoryIds Array of memory IDs associated with this file
 * @param tags Optional array of tags to store
 */
async function updateFileModCache(filePath: string, memoryIds: string[], tags?: string[]): Promise<void> {
  try {
    const normalizedPath = path.normalize(filePath);
    
    // Store the path, memory IDs, and tags
    fileModCache.set(normalizedPath, {
      lastModified: Date.now(), // Use current time
      memoryIds,
      tags
    });
    
    // Save the cache after each update to ensure persistence
    await saveFileModCache();
    logger.info(`Added ${normalizedPath} to markdown cache`);
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
  // Extract H1, H2, and H3 headings
  const headingMatches = Array.from(content.matchAll(/^(#{1,3})\s+(.*?)$/gm));
  return headingMatches.map(match => match[2].trim());
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
 * @param needsReload Whether the file needs reloading (should be determined by caller)
 * @param existingMemoryIds Existing memory IDs if any
 * @returns Result of processing
 */
export async function processMarkdownFile(
  memoryManager: any, 
  filePath: string,
  needsReload: boolean = true,
  existingMemoryIds: string[] = []
): Promise<{
  success: boolean;
  memoryId?: string;
  title?: string;
  type?: string;
  tags?: string[];
  error?: string;
}> {
  try {
    // Add file path normalization to handle potential inconsistencies
    const normalizedPath = path.normalize(filePath);
    
    // If file doesn't need reloading, return early with success
    if (!needsReload && existingMemoryIds.length > 0) {
      const cached = fileModCache.get(normalizedPath);
      logger.info(`Skipping unchanged file: ${normalizedPath}`);
      return {
        success: true,
        memoryId: existingMemoryIds[0],
        type: 'unchanged',
        tags: cached?.tags
      };
    }

    // Only read file content when needed
    const content = await fs.readFile(normalizedPath, 'utf8');
    
    // Extract title and headings
    const headings = extractHeadings(content);
    
    // Generate cache key for tag extraction
    const contentHash = generateContentHash(content);
    
    // Get tags using the OpenAI extractor or from cache
    let finalTags: string[] = [];
    
    // Check if we need to extract tags
    const cached = fileModCache.get(normalizedPath);
    const needsTagExtraction = needsReload || !cached?.tags;
    
    if (!needsTagExtraction && cached?.tags) {
      // Use cached tags if available and file hasn't changed
      finalTags = cached.tags;
      logger.debug(`Using cached tags for ${normalizedPath}`);
    } else {
      try {
        // Import the tagExtractor
        const { extractTags } = await import('../../../utils/tagExtractor');
        
        // Extract tags using OpenAI
        const tagResult = await extractTags(content, {
          maxTags: 25,
          minConfidence: 0.3
        });
        
        if (tagResult.success) {
          // Convert Tag objects to string tags
          finalTags = tagResult.tags.map(tag => tag.text);
          logger.debug(`Tag extraction for ${normalizedPath} found ${finalTags.length} tags`);
        } else {
          logger.warn(`Tag extraction for ${normalizedPath} failed: ${tagResult.error}`);
          finalTags = ['markdown', 'document'];
        }
      } catch (tagError) {
        logger.error(`Error using tag extraction for ${normalizedPath}:`, tagError);
        // Fall back to basic tags
        finalTags = ['markdown', 'document'];
      }
    }
    
    // Determine memory type based on file path
    const memoryType = determineMemoryType(normalizedPath);
    
    // If we have existing memory IDs, delete them before adding new content
    if (existingMemoryIds.length > 0) {
      for (const id of existingMemoryIds) {
        await memoryManager.deleteMemory(id);
      }
    }
    
    // Add to memory with critical importance
    const result = await memoryManager.addMemory(
      content,
      memoryType,
      ImportanceLevel.CRITICAL,  // Always CRITICAL for markdown files
      MemorySource.FILE,
      `Loaded from ${normalizedPath}`,
      finalTags,
      {
        filePath: normalizedPath,
        source: "markdown",
        critical: true,
        importance: 1.0,      // Explicit numeric importance
        contentType: 'markdown',
        extractedFrom: normalizedPath,
        lastModified: new Date().toISOString(),
        headings: headings,    // Store headings for better retrieval context
        tagSource: 'openai-extractor', // Mark that we used the OpenAI extractor
        contentHash: contentHash // Store content hash for future cache validation
      }
    );
    
    // Update the file modification cache with both memory IDs and tags
    await updateFileModCache(normalizedPath, [result.id], finalTags);
    
    logger.info(`Processed markdown file "${normalizedPath}" with ${finalTags.length} tags as ${memoryType}`);
    
    return {
      success: true,
      memoryId: result.id,
      type: memoryType,
      tags: finalTags
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
 * Generate a simple hash for content to help with caching
 */
function generateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
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
      // Normalize the directory path first and ensure forward slashes for glob
      const normalizedDir = path.normalize(dir).replace(/\\/g, '/');
      
      // Use glob to find all markdown files
      const files = glob.sync(`${normalizedDir}/**/*.md`, { 
        nodir: true,
        windowsPathsNoEscape: true // Enable Windows path support
      });
      
      // Normalize all file paths before adding them
      const normalizedFiles = files.map(file => path.normalize(file));
      
      // Log how many files were found in each directory
      logger.info(`Found ${normalizedFiles.length} markdown files in ${normalizedDir}`);
      
      allFiles.push(...normalizedFiles);
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
    // Normalize the file path to prevent double-processing due to path format differences
    const normalizedPath = path.normalize(filePath);
    
    // Check cache first - if file is cached and we're not forcing reload, skip completely
    const cached = fileModCache.get(normalizedPath);
    if (cached && !options.force) {
      logger.info(`Skipping cached file: ${normalizedPath} (in_cache)`);
      stats.unchangedFiles++;
      return;
    }
    
    // Log which file we're processing
    logger.debug(`Processing markdown file: ${normalizedPath}`);
    
    // Only check for duplicates if we're not forcing a reload
    if (options.checkForDuplicates && !options.force) {
      // Search for memories with this file path in metadata
      const existingEntries = await chloeMemory.getEnhancedMemoriesWithHybridSearch(
        normalizedPath, // Use the file path as a query
        5,        // Limit to a few results
        {
          types: [MemoryType.DOCUMENT], // Use the proper enum value
          expandQuery: false
        }
      );
      
      // Check if any of the found memories have this exact file path in metadata
      const isDuplicate = existingEntries.some((entry: any) => 
        entry.metadata?.filePath === normalizedPath || 
        entry.metadata?.extractedFrom === normalizedPath
      );
      
      if (isDuplicate) {
        logger.info(`Skipping duplicate file: ${normalizedPath}`);
        stats.duplicatesSkipped++;
        return;
      }
    }
    
    // Process file - pass true for needsReload since we've already checked cache
    const result = await processMarkdownFile(memoryManager, normalizedPath, true, []);
    
    if (result.success) {
      stats.entriesAdded++;
      stats.filesProcessed++;
      
      // Track memory types
      const type = result.type || 'unknown';
      stats.typeStats[type] = (stats.typeStats[type] || 0) + 1;
      
      logger.debug(`Added to memory: ${normalizedPath} as ${type}`);
    } else {
      stats.filesSkipped++;
      logger.warn(`Skipped file ${normalizedPath}: ${result.error}`);
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
  // Initialize stats
  const stats = {
    filesProcessed: 0,
    entriesAdded: 0,
    typeStats: {} as Record<string, number>,
    filesSkipped: 0,
    duplicatesSkipped: 0,
    unchangedFiles: 0
  };

  try {
    // Load cache first
    await loadFileModCache();
    
    // Get memory manager and Chloe memory instances
    const memoryManager = new MemoryManager({ agentId: 'chloe' });
    await memoryManager.initialize();
    const chloeMemory = memoryManager.getChloeMemory();
    
    if (!chloeMemory) {
      throw new Error('ChloeMemory not initialized');
    }

    // Find all markdown files
    const files = await findMarkdownFiles(directoriesToLoad);
    logger.info(`Found ${files.length} markdown files to process`);

    // First pass: Check cache and skip cached files
    const filesToProcess: string[] = [];
    for (const filePath of files) {
      const normalizedPath = path.normalize(filePath);
      const cached = fileModCache.get(normalizedPath);
      
      if (cached && !options.force) {
        logger.info(`Skipping cached file: ${filePath} (in_cache)`);
        stats.unchangedFiles++;
        continue;
      }
      
      filesToProcess.push(filePath);
    }

    // Second pass: Process only uncached files
    for (const filePath of filesToProcess) {
      await processFile(filePath, memoryManager, chloeMemory, options, stats);
    }

    // Save cache after processing
    await saveFileModCache();

    logger.info(`Markdown loading complete: Processed ${stats.filesProcessed} files, added ${stats.entriesAdded} entries, skipped ${stats.duplicatesSkipped} duplicates, unchanged: ${stats.unchangedFiles}`);
    return stats;
  } catch (error) {
    logger.error('Error loading markdown files:', error);
    throw error;
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
  
  // Generate a cache key for tag extraction using content hash
  const contentHash = generateContentHash(markdownContent);
  const normalizedPath = path.normalize(filePath);
  
  // Get tags using the OpenAI extractor or from cache
  let tags: string[] = [];
  
  // Check cache first - if we have tags, use them
  const cached = fileModCache.get(normalizedPath);
  if (cached?.tags) {
    tags = cached.tags;
    logger.debug(`Using cached tags for ${filePath}`);
  } else {
    // Only extract tags if we don't have them in cache
    try {
      // Import the tag extractor only when needed
      const { extractTags } = await import('../../../utils/tagExtractor');
      
      const tagResult = await extractTags(markdownContent, { maxTags: 20 });
      tags = tagResult.tags.map(tag => tag.text);
      
      // Store in cache
      await updateFileModCache(normalizedPath, [], tags);
      logger.debug(`Extracted and cached ${tags.length} tags for ${filePath}`);
    } catch (error) {
      logger.error(`Error extracting tags from ${filePath}:`, error);
      tags = ['markdown', 'document']; // Fallback tags
    }
  }
  
  // Calculate importance (always high for markdown)
  const importanceScore = 0.9; // High importance for all markdown files
  
  // For small files, return as a single memory entry
  if (markdownContent.length < MAX_CHUNK_SIZE) {
    return [{
      title,
      content: markdownContent,
      type: MemoryType.DOCUMENT,
      tags,
      importance: ImportanceLevel.CRITICAL, // Markdown is always critical
      importance_score: importanceScore,
      source: ExtendedMemorySource.FILE,
      filePath,
      metadata: {
        ...standardMetadata,
        tagSource: 'openai-extractor'
      }
    }];
  }
  
  // For larger files, split into chunks
  const chunks = await splitMarkdownIntoChunks(markdownContent);
  
  // Create a memory entry for each chunk with sequential tag extraction
  const chunkEntries: ChloeMemoryEntry[] = [];
  
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    
    // Start with the document-level tags
    let chunkTags: string[] = [...tags];
    
    // Only extract additional tags for large chunks
    if (chunk.length > 1000) {
      const chunkCacheKey = `${normalizedPath}:chunk${index}`;
      const chunkCached = fileModCache.get(chunkCacheKey);
      
      if (chunkCached?.tags) {
        // Use cached chunk tags
        const cachedChunkTags = chunkCached.tags;
        
        // Add any unique tags from this chunk
        cachedChunkTags.forEach(tag => {
          if (!chunkTags.includes(tag)) {
            chunkTags.push(tag);
          }
        });
        logger.debug(`Using cached tags for chunk ${index} of ${filePath}`);
      } else {
        // Only extract tags if we don't have them in cache
        try {
          // Import the tag extractor only when needed
          const { extractTags } = await import('../../../utils/tagExtractor');
          
          const chunkTagResult = await extractTags(chunk, { maxTags: 15 });
          const newChunkTags: string[] = [];
          
          // Add any unique tags from this chunk
          chunkTagResult.tags.forEach(tag => {
            if (!chunkTags.includes(tag.text)) {
              chunkTags.push(tag.text);
              newChunkTags.push(tag.text);
            }
          });
          
          // Cache the chunk-specific tags
          await updateFileModCache(chunkCacheKey, [], newChunkTags);
          logger.debug(`Extracted and cached ${newChunkTags.length} tags for chunk ${index} of ${filePath}`);
        } catch (error) {
          logger.error(`Error extracting tags from chunk ${index} of ${filePath}:`, error);
          // Just use the document tags if chunk tag extraction fails
        }
      }
    }
    
    chunkEntries.push({
      title: `${title} (Part ${index + 1})`,
      content: chunk,
      type: MemoryType.DOCUMENT,
      tags: chunkTags,
      importance: ImportanceLevel.CRITICAL,
      importance_score: importanceScore,
      source: ExtendedMemorySource.FILE,
      filePath,
      metadata: {
        ...standardMetadata,
        tagSource: 'openai-extractor',
        partIndex: index,
        totalParts: chunks.length
      }
    });
  }
  
  return chunkEntries;
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