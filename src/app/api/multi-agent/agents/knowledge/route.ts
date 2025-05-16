/**
 * API endpoint for processing knowledge files and creating agent memories
 */

import { NextResponse } from 'next/server';
import { getMemoryServices } from '@/server/memory/services';
import { DefaultKnowledgeProcessor } from '@/server/memory/services/multi-agent/DefaultKnowledgeProcessor';

/**
 * Route to process knowledge for an agent
 * POST /api/multi-agent/agents/knowledge
 */
export async function POST(request: Request) {
  try {
    // Parse the request body
    const data = await request.json();
    
    // Validate agentId
    const { agentId, markdownContents = [], knowledgePaths = [] } = data;
    
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // Initialize memory services
    const services = await getMemoryServices();
    const client = services.client;
    
    // Create knowledge processor
    const knowledgeProcessor = new DefaultKnowledgeProcessor(client);
    
    // Track results
    const results = {
      uploadedFiles: {
        processed: 0,
        memoryCount: 0,
        errors: 0
      },
      knowledgePaths: {
        processed: 0,
        memoryCount: 0,
        errors: 0
      }
    };
    
    // Process uploaded markdown content
    if (markdownContents && markdownContents.length > 0) {
      for (let i = 0; i < markdownContents.length; i++) {
        const item = markdownContents[i];
        const { content, fileName } = item;
        
        if (!content) {
          continue;
        }
        
        try {
          // Process this markdown content
          const result = await knowledgeProcessor.processMarkdownContent(
            agentId, 
            content, 
            fileName || `uploaded_content_${i + 1}.md`,
            {
              maxTagsPerMemory: 15,
              importance: 'high',
              includeFilename: true
            }
          );
          
          // Update results
          results.uploadedFiles.processed++;
          results.uploadedFiles.memoryCount += result.memoryIds.length;
          results.uploadedFiles.errors += result.errorCount;
          
        } catch (error) {
          console.error(`Error processing markdown content ${i}:`, error);
          results.uploadedFiles.errors++;
        }
      }
    }
    
    // Process knowledge paths if provided
    if (knowledgePaths && knowledgePaths.length > 0) {
      try {
        const result = await knowledgeProcessor.processKnowledgePaths(
          agentId,
          knowledgePaths,
          {
            maxTagsPerMemory: 15,
            importance: 'high',
            includeFilename: true
          }
        );
        
        // Update results
        results.knowledgePaths.processed = result.fileCount;
        results.knowledgePaths.memoryCount = result.memoryIds.length;
        results.knowledgePaths.errors = result.errorCount;
      } catch (error) {
        console.error('Error processing knowledge paths:', error);
        results.knowledgePaths.errors++;
      }
    }
    
    // Return the results
    return NextResponse.json({
      success: true,
      message: 'Knowledge processing completed',
      results
    });
    
  } catch (error) {
    console.error('Error processing knowledge for agent:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Error processing knowledge: ${error instanceof Error ? error.message : String(error)}` 
      },
      { status: 500 }
    );
  }
} 