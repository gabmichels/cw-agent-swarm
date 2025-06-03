/**
 * Simple LLM-to-Coda Workflow
 * Handles automatic document creation from LLM responses with proper formatting
 */

import { createAllEnhancedCodaTools } from '../implementations/CodaTools';
import { formatContentForCoda, addExportMetadata } from '../utils/CodaFormatting';
import { logger } from '../../../../lib/logging';

export interface LLMToCodaRequest {
  content: string;
  title?: string;
  sourceAgent?: string;
  conversationId?: string;
  userContext?: Record<string, unknown>;
  format?: 'markdown' | 'plain' | 'html';
  generateTitle?: boolean;
}

export interface LLMToCodaResult {
  success: boolean;
  documentId?: string;
  documentUrl?: string;
  documentTitle?: string;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Execute LLM-to-Coda workflow
 * Simple flow: LLM content → Format for Coda → Create document
 */
export async function executeLLMToCodaWorkflow(request: LLMToCodaRequest): Promise<LLMToCodaResult> {
  try {
    const {
      content,
      title,
      sourceAgent = 'DefaultAgent',
      conversationId,
      userContext,
      format = 'markdown',
      generateTitle = true
    } = request;

    if (!content || content.trim().length === 0) {
      return {
        success: false,
        error: {
          message: 'Content is required for LLM-to-Coda workflow',
          code: 'MISSING_CONTENT'
        }
      };
    }

    logger.info('Starting LLM-to-Coda workflow', {
      contentLength: content.length,
      hasTitle: !!title,
      sourceAgent,
      conversationId: conversationId?.substring(0, 10) + '...',
      format
    });

    // Get enhanced Coda tools
    const enhancedCodaTools = createAllEnhancedCodaTools();
    const createTool = enhancedCodaTools.find(tool => tool.id === 'enhanced_coda_create');

    if (!createTool) {
      throw new Error('Enhanced Coda create tool not available');
    }

    // Generate title if needed
    const documentTitle = title || (generateTitle ? generateTitleFromLLMContent(content) : null) || 
      `${sourceAgent} Response - ${new Date().toLocaleDateString()}`;

    // Format content for Coda using shared utility (includes table conversion)
    const formattedContent = formatContentForCoda(content, {
      format,
      convertTables: true, // ⚠️ Important: Convert markdown tables to Coda-friendly format
      preserveStructure: true
    });

    // Add workflow metadata
    const enhancedContent = addExportMetadata(formattedContent, {
      source: `LLM Workflow (${sourceAgent})`,
      generatedBy: sourceAgent,
      timestamp: new Date().toLocaleString(),
      ...(conversationId && { messageId: conversationId })
    });

    // Execute document creation
    const result = await createTool.execute({
      title: documentTitle,
      content: enhancedContent,
      autoTitle: false // We've already generated the title
    });

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to create Coda document via LLM workflow');
    }

    const documentData = result.data as any;

    logger.info('LLM-to-Coda workflow completed successfully', {
      documentId: documentData.id,
      documentName: documentData.name,
      browserLink: documentData.browserLink,
      sourceAgent,
      conversationId
    });

    return {
      success: true,
      documentId: documentData.id,
      documentUrl: documentData.browserLink || documentData.link,
      documentTitle: documentData.name || documentTitle
    };

  } catch (error) {
    logger.error('LLM-to-Coda workflow failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      sourceAgent: request.sourceAgent,
      conversationId: request.conversationId
    });

    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to execute LLM-to-Coda workflow',
        code: 'WORKFLOW_EXECUTION_FAILED',
        details: error instanceof Error ? error.stack : error
      }
    };
  }
}

/**
 * Generate title from LLM content by analyzing structure and content
 */
function generateTitleFromLLMContent(content: string): string | null {
  if (!content) return null;

  // Look for markdown headers (most common in LLM responses)
  const headerMatches = content.match(/^#+\s+(.+)$/gm);
  if (headerMatches && headerMatches.length > 0) {
    // Use first header, clean it up
    const firstHeader = headerMatches[0].replace(/^#+\s*/, '').trim();
    return firstHeader.length > 60 ? firstHeader.substring(0, 57) + '...' : firstHeader;
  }

  // Look for bold text that might be a title
  const boldMatch = content.match(/^\*\*(.+?)\*\*/m);
  if (boldMatch && boldMatch[1]) {
    const boldText = boldMatch[1].trim();
    return boldText.length > 60 ? boldText.substring(0, 57) + '...' : boldText;
  }

  // Extract from first meaningful line
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    
    // Skip common LLM prefixes
    const cleanLine = firstLine
      .replace(/^(Here's|Here is|I'll|Let me|Based on)/i, '')
      .replace(/^#+\s*/, '') // Remove any header markers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold formatting
      .replace(/\*(.+?)\*/g, '$1') // Remove italic formatting
      .replace(/`(.+?)`/g, '$1') // Remove code formatting
      .trim();
    
    if (cleanLine.length > 10) { // Only use if meaningful
      return cleanLine.length > 60 ? cleanLine.substring(0, 57) + '...' : cleanLine;
    }
  }

  return null;
}

/**
 * Batch LLM-to-Coda workflow for multiple responses
 */
export async function batchLLMToCodaWorkflow(
  requests: LLMToCodaRequest[]
): Promise<LLMToCodaResult[]> {
  const results: LLMToCodaResult[] = [];

  for (const request of requests) {
    try {
      // Add small delay between requests to avoid rate limiting
      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const result = await executeLLMToCodaWorkflow(request);
      results.push(result);

    } catch (error) {
      results.push({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Batch workflow item failed',
          code: 'BATCH_ITEM_FAILED'
        }
      });
    }
  }

  logger.info('Batch LLM-to-Coda workflow completed', {
    totalRequests: requests.length,
    successfulRequests: results.filter(r => r.success).length,
    failedRequests: results.filter(r => !r.success).length
  });

  return results;
}

/**
 * Helper function for DefaultAgent integration
 * Provides a simple interface for agents to create Coda documents from their responses
 */
export async function createCodaDocumentFromAgentResponse(
  agentResponse: string,
  agentName: string = 'DefaultAgent',
  conversationContext?: {
    conversationId?: string;
    userQuery?: string;
    userContext?: Record<string, unknown>;
  }
): Promise<LLMToCodaResult> {
  return executeLLMToCodaWorkflow({
    content: agentResponse,
    sourceAgent: agentName,
    conversationId: conversationContext?.conversationId,
    userContext: {
      ...conversationContext?.userContext,
      originalQuery: conversationContext?.userQuery
    },
    format: 'markdown',
    generateTitle: true
  });
} 