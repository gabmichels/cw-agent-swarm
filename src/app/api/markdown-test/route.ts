import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType } from '../../../server/memory/config/types';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Define custom interfaces for memory data structures
interface MemoryMetadata {
  source?: string;
  contentType?: string;
  fileType?: string;
  filePath?: string;
  extractedFrom?: string;
  critical?: boolean;
  importance?: string;
  title?: string;
  timestamp?: string;
  lastModified?: string;
  tags?: string[];
  type?: string;
  [key: string]: any;
}

interface MemoryPayload {
  text?: string;
  content?: string;
  metadata?: MemoryMetadata;
  [key: string]: any;
}

interface MemoryPoint {
  id: string;
  metadata?: MemoryMetadata;
  payload?: MemoryPayload;
  text?: string;
  [key: string]: any;
}

interface SearchResult {
  point: MemoryPoint;
  score: number;
}

// Define constants for markdown identification
const MARKDOWN_SOURCES = ['markdown', 'file', 'docs'];
const MARKDOWN_CONTENT_TYPES = ['markdown', 'md'];
const MARKDOWN_PATH_PATTERNS = ['.md', '/markdown/', '/docs/', '/knowledge/'];
const MARKDOWN_INDICATORS = ['# ', '## ', '```', '**'];

/**
 * GET handler for testing markdown documents in memory
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[markdown-test] Testing access to markdown documents in memory");
    
    // Initialize services
    const { searchService, memoryService, client } = await getMemoryServices();
    
    // Check if services are available
    if (!searchService) {
      console.error("[markdown-test] Memory services not available");
      return NextResponse.json({
        success: false,
        error: "Memory services not available"
      }, { status: 500 });
    }
    
    // Parse query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    
    console.log(`[markdown-test] Fetching up to ${limit} document memories`);
    
    // Search for all documents
    const allDocuments = await searchService.search('', {
      types: [MemoryType.DOCUMENT],
      limit: limit
    }) as SearchResult[];
    
    console.log(`[markdown-test] Retrieved ${allDocuments.length} document memories`);
    
    // Identify markdown documents using multiple criteria
    const markdownDocs = allDocuments.filter(memory => {
      const metadata = memory.point?.metadata || {};
      const payload = memory.point?.payload || {};
      const payloadMetadata = payload.metadata || {};
      
      // Check for markdown source
      const source = metadata.source || payloadMetadata.source;
      const isMarkdownSource = source && MARKDOWN_SOURCES.includes(String(source));
      
      // Check for markdown content type
      const contentType = metadata.contentType || metadata.fileType || 
                        payloadMetadata.contentType || payloadMetadata.fileType;
      const isMarkdownContentType = contentType && 
                                  MARKDOWN_CONTENT_TYPES.includes(String(contentType));
      
      // Check file path for markdown patterns
      const filePath = String(metadata.filePath || metadata.extractedFrom || 
                            payloadMetadata.filePath || payloadMetadata.extractedFrom || '');
      const isMarkdownPath = MARKDOWN_PATH_PATTERNS.some(pattern => filePath.includes(pattern));
      
      // Check for critical importance (markdown files are typically marked as critical)
      const isCritical = metadata.critical === true || 
                        payloadMetadata.critical === true || 
                        metadata.importance === 'critical' ||
                        payloadMetadata.importance === 'critical';
      
      // Check content for markdown indicators
      const content = String(memory.point.text || payload.text || '');
      const hasMarkdownIndicators = MARKDOWN_INDICATORS.some(indicator => 
                                                          content.includes(indicator));
      
      // Return true if any strong indicators are present
      return isMarkdownSource || isMarkdownContentType || isMarkdownPath || 
            (hasMarkdownIndicators && (isCritical || filePath.length > 0));
    });
    
    console.log(`[markdown-test] Found ${markdownDocs.length} potential markdown documents`);
    
    // Build stats for display
    const sourceCount: Record<string, number> = {};
    const typeCount: Record<string, number> = {};
    const pathPatternCount: Record<string, number> = {};
    let documentsWithTags = 0;
    
    // Process each document
    const processedDocs = markdownDocs.map(doc => {
      const metadata = doc.point?.metadata || {};
      const payload = doc.point?.payload || {};
      const payloadMetadata = payload.metadata || {};
      
      // Count source
      const source = String(metadata.source || payloadMetadata.source || 'unknown');
      sourceCount[source] = (sourceCount[source] || 0) + 1;
      
      // Count type
      const type = String(metadata.type || payloadMetadata.type || 'document');
      typeCount[type] = (typeCount[type] || 0) + 1;
      
      // Count pattern matches
      const filePath = String(metadata.filePath || metadata.extractedFrom || 
                            payloadMetadata.filePath || payloadMetadata.extractedFrom || '');
      
      MARKDOWN_PATH_PATTERNS.forEach(pattern => {
        if (filePath.includes(pattern)) {
          pathPatternCount[pattern] = (pathPatternCount[pattern] || 0) + 1;
        }
      });
      
      // Check for tags
      const tags = metadata.tags || payloadMetadata.tags;
      if (tags && Array.isArray(tags) && tags.length > 0) {
        documentsWithTags++;
      }
      
      // Extract important information for display
      const content = String(doc.point.text || payload.text || '');
      
      // Use title directly from metadata without processing content
      const title = metadata.title || payloadMetadata.title || 'Untitled Document';
      
      return {
        id: doc.point?.id || 'unknown',
        title: title,
        source,
        type,
        path: filePath,
        tags: tags && Array.isArray(tags) ? tags : [],
        timestamp: metadata.timestamp || metadata.lastModified || 
                  payloadMetadata.timestamp || payloadMetadata.lastModified || 
                  new Date().toISOString(),
        isMarkdown: true,
        // Return the full content, not just a preview
        content: content
      };
    });
    
    return NextResponse.json({
      success: true,
      statistics: {
        total: allDocuments.length,
        markdownCount: markdownDocs.length,
        bySource: sourceCount,
        byType: typeCount,
        byPathPattern: pathPatternCount,
        withTags: documentsWithTags
      },
      documents: processedDocs
    });
  } catch (error) {
    console.error("[markdown-test] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Error processing request",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 