import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '@/server/memory/services';
import { createAgentMemoryService } from '@/server/memory/services/multi-agent';
import { initializeCollections } from '@/server/memory/scripts/init-collections';
import { MemoryType } from '@/server/memory/config/types';
import { DocumentMetadata, DocumentSource, MetadataField } from '@/types/metadata';
import { extractTags, TagExtractionOptions } from '@/utils/tagExtractor';

/**
 * POST /api/multi-agent/agents/[agentId]/memories
 * Adds memories to an agent
 */
export async function POST(
  request: NextRequest,
  context: { params: { agentId: string } }
) {
  const params = await context.params;
  const agentId = params.agentId;
  
  try {
    if (!agentId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent ID is required' 
      }, { status: 400 });
    }
    
    // Check if request body is valid
    const body = await request.json();
    
    if (!body.memories || !Array.isArray(body.memories) || body.memories.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Memories array is required'
      }, { status: 400 });
    }
    
    // Initialize collections first
    await initializeCollections();
    
    // Initialize services
    const { memoryService, client } = await getMemoryServices();
    
    // DEBUG: Check client status
    const clientStatus = await client.getStatus();
    console.log('DEBUG: Memory client status:', 
                JSON.stringify({
                  initialized: clientStatus.initialized,
                  connected: clientStatus.connected,
                  usingFallback: clientStatus.usingFallback
                }));
    
    const agentService = await createAgentMemoryService(memoryService);
    
    // First check if agent exists
    const agentResult = await agentService.getAgent(agentId);
    
    if (agentResult.isError || !agentResult.value) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent not found' 
      }, { status: 404 });
    }
    
    // Process each memory
    const memories = body.memories;
    const results = [];
    
    for (const memory of memories) {
      // Validate memory object
      if (!memory.content) {
        results.push({
          success: false,
          error: 'Memory content is required'
        });
        continue;
      }
      
      try {
        // Extract basic content type tags based on source and content
        const getBasicContentTags = (content: string, source?: string): string[] => {
          const basicTags: string[] = ['document', 'knowledge'];
          
          // Add source-based tag
          if (source) {
            if (source.includes('.md')) {
              basicTags.push('markdown');
              basicTags.push(DocumentSource.FILE.toLowerCase());
            } else if (source === DocumentSource.API) {
              basicTags.push(DocumentSource.API.toLowerCase());
            } else if (source === DocumentSource.USER) {
              basicTags.push(DocumentSource.USER.toLowerCase());
            } else if (source === DocumentSource.AGENT) {
              basicTags.push(DocumentSource.AGENT.toLowerCase());
            }
          }
          
          // Detect markdown content
          if (content.includes('# ') || content.includes('## ')) {
            basicTags.push('markdown');
          }
          
          return basicTags;
        };
        
        // Use AI-powered tag extraction if we have an API key
        const getContentTags = async (content: string, source?: string): Promise<string[]> => {
          try {
            // Get basic content type tags
            const basicTags = getBasicContentTags(content, source);
            
            // Define extraction options
            const options: TagExtractionOptions = {
              maxTags: 20,
              minConfidence: 0.4,
              existingTags: basicTags
            };
            
            // Extract tags using the AI-powered tag extractor
            const extractionResult = await extractTags(content, options);
            
            if (extractionResult.success && extractionResult.tags.length > 0) {
              // Get tag text from extraction result and combine with basic tags
              const aiTags = extractionResult.tags.map(tag => tag.text);
              console.log('DEBUG: AI-extracted tags:', aiTags);
              
              // Combine tags and remove duplicates
              const uniqueTags = Array.from(new Set([...basicTags, ...aiTags]));
              return uniqueTags;
            }
            
            // Fallback to basic tags if AI extraction fails
            console.log('DEBUG: Using basic tags (AI extraction failed):', basicTags);
            return basicTags;
          } catch (error) {
            console.error('Tag extraction error:', error);
            return getBasicContentTags(content, source);
          }
        };
        
        // Get tags for the content
        const contentTags = await getContentTags(memory.content, memory.metadata?.source as string);
        
        // Prepare memory metadata using DocumentMetadata interface
        const metadata: DocumentMetadata = {
          ...memory.metadata || {},
          // Required BaseMetadata fields
          schemaVersion: "1.0.0",
          
          // DocumentMetadata specific fields
          source: (memory.metadata?.source as DocumentSource) || DocumentSource.FILE,
          fileName: memory.metadata?.fileName || 'uploaded-document.md',
          
          // Common fields
          agentId: agentId,
          timestamp: new Date().toISOString(),
          critical: memory.metadata?.critical === false ? false : true,
          tags: memory.metadata?.tags || contentTags,
          
          // Additional file metadata if available
          title: memory.metadata?.title || memory.metadata?.fileName || 'Uploaded Document',
          contentType: memory.metadata?.contentType || 'text/markdown'
        };

        // Set a default memory type
        const defaultType = MemoryType.DOCUMENT;
        
        console.log('DEBUG: Adding memory with metadata:', JSON.stringify({
          source: metadata.source,
          memoryType: defaultType,
          critical: metadata.critical,
          agentId: metadata.agentId,
          timestamp: metadata.timestamp,
          tags: metadata.tags,
          schemaVersion: metadata.schemaVersion,
          fileName: metadata.fileName,
          title: metadata.title
        }, null, 2));
        
        // Add memory to agent's memory store
        const result = await memoryService.addMemory({
          content: memory.content,
          type: defaultType,
          metadata: metadata
        });
        
        console.log('DEBUG: Memory add result:', JSON.stringify(result));
        
        if (result.error) {
          console.error('DEBUG: Error adding memory:', result.error.message);
          results.push({
            success: false,
            error: result.error?.message || 'Failed to add memory'
          });
        } else {
          results.push({
            success: true,
            id: result.id
          });
        }
      } catch (error) {
        console.error('DEBUG: Exception adding memory:', error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Check if all memories were successful
    const allSuccessful = results.every(r => r.success);
    
    // DEBUG: Final check of collection status
    try {
      const collectionExists = await client.collectionExists('documents');
      console.log('DEBUG: Documents collection exists:', collectionExists);
      if (collectionExists) {
        const count = await client.getPointCount('documents');
        console.log('DEBUG: Documents collection count:', count);
      }
    } catch (error) {
      console.error('DEBUG: Error checking collection status:', error);
    }
    
    return NextResponse.json({ 
      success: allSuccessful,
      results,
      message: allSuccessful 
        ? `Successfully added ${results.length} memories`
        : `Added ${results.filter(r => r.success).length} of ${results.length} memories`
    }, { status: allSuccessful ? 200 : 207 });
    
  } catch (error) {
    console.error(`Error adding memories to agent ${agentId}:`, error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 