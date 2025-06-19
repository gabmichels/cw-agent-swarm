import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType, ImportanceLevel } from '../../../../constants/memory';

/**
 * Debug API endpoint to inspect what memory content is actually stored
 * This helps verify if agents have access to critical personal information
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debug: Inspecting memory content...');
    
    const { memoryService } = await getMemoryServices();
    
    if (!memoryService) {
      return NextResponse.json({
        error: 'Memory service not available'
      }, { status: 500 });
    }

    // Search for document memories
    let allDocs: any[] = [];
    try {
      allDocs = await memoryService.searchMemories({
        type: MemoryType.DOCUMENT,
        limit: 50
      });
      console.log(`Found ${allDocs.length} total document memories`);
    } catch (error: unknown) {
      console.log('Error searching all docs:', error instanceof Error ? error.message : String(error));
    }

    // Test personal info queries
    const testQueries = [
      'contact information email addresses',
      'personal details birthday address', 
      'role responsibilities',
      'phone numbers contact details'
    ];

    const queryResults: Record<string, any> = {};
    for (const query of testQueries) {
      try {
        const results = await memoryService.searchMemories({
          type: MemoryType.DOCUMENT,
          query: query,
          limit: 3
        });
        
        queryResults[query] = {
          count: results.length,
          results: results.map((r: any) => ({
            id: r.id,
            critical: r.payload?.metadata?.critical || false,
            contentPreview: (r.payload?.text || '').substring(0, 150),
            hasContactInfo: checkForContactInfo(r.payload?.text || ''),
            hasPersonalInfo: checkForPersonalDetails(r.payload?.text || '')
          }))
        };
      } catch (error: unknown) {
        queryResults[query] = {
          count: 0,
          error: error instanceof Error ? error.message : String(error),
          results: []
        };
      }
    }

    // Analyze document memories
    const documentAnalysis = allDocs.map((doc: any) => {
      const metadata = doc.payload?.metadata || {};
      const content = doc.payload?.text || '';
      
      return {
        id: doc.id,
        critical: metadata.critical,
        importance: metadata.importance,
        fileName: metadata.fileName,
        source: metadata.source,
        contentLength: content.length,
        contentPreview: content.substring(0, 200),
        hasContactInfo: checkForContactInfo(content),
        hasAddresses: checkForAddresses(content),
        hasPersonalDetails: checkForPersonalDetails(content),
        fullContentAvailable: content.length > 0
      };
    });

    // Filter for critical memories
    const criticalMemories = documentAnalysis.filter((doc: any) => doc.critical === true);

    return NextResponse.json({
      success: true,
      analysis: {
        criticalMemoriesFound: criticalMemories.length,
        documentMemoriesFound: allDocs.length,
        criticalMemories: criticalMemories,
        documentMemories: documentAnalysis.slice(0, 5), // Limit for safety
        queryTests: queryResults,
        summary: {
          hasCriticalMemories: criticalMemories.length > 0,
          hasPersonalInformation: documentAnalysis.some((m: any) => m.hasContactInfo || m.hasPersonalDetails || m.hasAddresses),
          totalMemoriesWithContent: documentAnalysis.filter((m: any) => m.contentLength > 0).length
        }
      }
    });

  } catch (error) {
    console.error('Error inspecting memory:', error);
    return NextResponse.json({
      error: 'Failed to inspect memory content',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

function checkForContactInfo(text: string): boolean {
  if (!text) return false;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phonePattern = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/;
  return emailPattern.test(text) || phonePattern.test(text);
}

function checkForPersonalDetails(text: string): boolean {
  if (!text) return false;
  const patterns = [
    /birthday/i,
    /born\s+on/i,
    /date\s+of\s+birth/i,
    /social\s+security/i,
    /SSN/i,
    /driver.s?\s+license/i
  ];
  return patterns.some(pattern => pattern.test(text));
}

function checkForAddresses(text: string): boolean {
  if (!text) return false;
  const addressPattern = /\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Place|Pl)/i;
  return addressPattern.test(text);
} 