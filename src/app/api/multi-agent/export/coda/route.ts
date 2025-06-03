import { NextRequest, NextResponse } from 'next/server';
import { createAllEnhancedCodaTools } from '../../../../../agents/shared/tools/implementations/CodaTools';
import { logger } from '../../../../../lib/logging';

export async function POST(request: NextRequest) {
  try {
    const { messageId, timestamp, content, title, format } = await request.json();

    if (!content) {
      return NextResponse.json({ 
        error: 'Content is required for export' 
      }, { status: 400 });
    }

    logger.info('Exporting message to Coda', {
      messageId: messageId?.substring(0, 10) + '...',
      contentLength: content.length,
      hasTitle: !!title,
      format
    });

    // Create enhanced Coda tools
    const enhancedCodaTools = createAllEnhancedCodaTools();
    const createTool = enhancedCodaTools.find(tool => tool.id === 'enhanced_coda_create');

    if (!createTool) {
      throw new Error('Enhanced Coda create tool not available');
    }

    // Generate title if not provided
    const documentTitle = title || generateTitleFromContent(content) || `Exported Message - ${new Date().toLocaleDateString()}`;

    // Format content based on requested format
    const formattedContent = formatContentForCoda(content, format);

    // Add export metadata
    const enhancedContent = `${formattedContent}

---

## Export Information
- **Exported from**: Crowd Wisdom Chat
- **Message ID**: ${messageId || 'N/A'}
- **Export Date**: ${new Date().toLocaleString()}
- **Original Timestamp**: ${timestamp ? new Date(timestamp).toLocaleString() : 'N/A'}`;

    // Execute the enhanced Coda create tool
    const result = await createTool.execute({
      title: documentTitle,
      content: enhancedContent,
      autoTitle: false
    });

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to create Coda document');
    }

    const documentData = result.data as any;

    logger.info('Successfully exported message to Coda', {
      documentId: documentData.id,
      documentName: documentData.name,
      browserLink: documentData.browserLink
    });

    return NextResponse.json({
      success: true,
      url: documentData.browserLink || documentData.link,
      title: documentData.name || documentTitle,
      documentId: documentData.id,
      message: 'Successfully exported to Coda'
    });

  } catch (error) {
    logger.error('Error exporting to Coda', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to export to Coda' 
    }, { status: 500 });
  }
}

/**
 * Generate a title from content by looking for headers or using first line
 */
function generateTitleFromContent(content: string): string | null {
  if (!content) return null;

  // Look for markdown headers
  const headerMatch = content.match(/^#+\s+(.+)$/m);
  if (headerMatch && headerMatch[1]) {
    return headerMatch[1].trim();
  }

  // Use first meaningful line
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    // Remove markdown formatting and limit length
    const cleanLine = firstLine
      .replace(/^#+\s*/, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1');
    
    return cleanLine.length > 60 
      ? cleanLine.substring(0, 57) + '...'
      : cleanLine;
  }

  return null;
}

/**
 * Format content for Coda based on requested format
 */
function formatContentForCoda(content: string, format?: string): string {
  if (format === 'plain') {
    // Strip markdown formatting for plain text
    return content
      .replace(/^#+\s/gm, '') // Remove headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/`(.+?)`/g, '$1') // Remove code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1'); // Remove links, keep text
  }
  
  // Default to markdown (Coda supports markdown)
  return content;
} 