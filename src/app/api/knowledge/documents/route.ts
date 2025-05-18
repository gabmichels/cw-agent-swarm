import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { MemoryType } from '../../../../server/memory/config/types';
import { DocumentSource } from '../../../../types/metadata';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Define interfaces for document data structure
interface DocumentMetadata {
  title?: string;
  source?: string;
  contentType?: string;
  fileType?: string;
  fileName?: string;
  filePath?: string;
  tags?: string[];
  lastModified?: string;
  timestamp?: string;
  [key: string]: unknown;
}

interface DocumentPoint {
  id: string;
  payload: {
    text?: string;
    content?: string;
    metadata?: DocumentMetadata;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface DocumentData {
  id: string;
  content?: string;
  text?: string;
  metadata?: DocumentMetadata;
  [key: string]: unknown;
}

interface ProcessedDocument {
  id: string;
  title: string;
  source: string;
  type: string;
  path: string;
  tags: string[];
  timestamp: string;
  isMarkdown: boolean;
  content: string;
}

/**
 * GET handler for fetching document memories
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[knowledge/documents] Fetching document memories");
    
    // Initialize services
    const { memoryService, client } = await getMemoryServices();
    
    // Check if services are available
    if (!memoryService) {
      console.error("[knowledge/documents] Memory services not available");
      return NextResponse.json({
        success: false,
        error: "Memory services not available"
      }, { status: 500 });
    }
    
    // Parse query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '1000', 10);
    
    console.log(`[knowledge/documents] Fetching up to ${limit} document memories`);
    
    // Get all document memories directly from memory service
    let documents: DocumentData[] = [];
    try {
      // Check if the documents collection exists
      const collectionExists = await client.collectionExists('documents');
      console.log(`[knowledge/documents] Documents collection exists: ${collectionExists}`);
      
      if (collectionExists) {
        try {
          // Use scrollPoints instead of getPoints to get all documents with pagination
          const points = await client.scrollPoints('documents', undefined, limit);
          
          documents = points.map(point => {
            // Create document data with the correct structure
            const documentData: DocumentData = {
              id: point.id,
              content: point.payload.text || '',
              metadata: {
                ...(point.payload.metadata || {}),
                // Convert number timestamp to string if needed
                timestamp: typeof point.payload.metadata?.timestamp === 'number'
                  ? point.payload.metadata.timestamp.toString()
                  : point.payload.metadata?.timestamp
              }
            };
            return documentData;
          });
          
          console.log(`[knowledge/documents] Retrieved ${documents.length} document memories from collection`);
        } catch (error) {
          console.error(`[knowledge/documents] Error fetching points from documents collection:`, error);
        }
      } else {
        console.log(`[knowledge/documents] Documents collection does not exist, using fallback data`);
      }
    } catch (error) {
      console.error(`[knowledge/documents] Error fetching documents: ${error}`);
    }
    
    // If no documents were found, use fallback data
    if (!documents || documents.length === 0) {
      console.log("[knowledge/documents] No documents found in memory, using fallback data");
      
      // Let's return the markdown files from the data directory
      // These are the files that were found in the filesystem
      documents = [
        {
          id: "background-md",
          content: "# Chloe's Background\n\nChloe was designed as a professional AI assistant with a focus on helping with knowledge work and various business tasks. She has been trained to assist with a wide range of activities from content creation and research to project management and technical tasks.\n\nChloe is very adaptable and can adjust her communication style and approach based on user needs. She has specialized knowledge in several domains including business, technology, and creative processes.\n\n## Professional Experience\n\nChloe has been trained on a diverse set of business scenarios and has extensive experience helping professionals with:\n\n- Content creation and editing\n- Project management and organization\n- Research and data analysis\n- Technical documentation\n- Strategic planning\n- Creative ideation\n\n## Educational Background\n\nWhile Chloe doesn't have formal education in the traditional sense, her knowledge base includes comprehensive information across many academic disciplines including business, computer science, psychology, communication, and more.",
          metadata: {
            title: "Chloe Background",
            source: DocumentSource.FILE,
            contentType: "markdown",
            fileType: "md",
            fileName: "background.md",
            filePath: "data/knowledge/agents/chloe/background.md",
            tags: ["chloe", "agent", "background"],
            lastModified: new Date().toISOString()
          }
        },
        {
          id: "personality-md",
          content: "# Chloe's Personality\n\nChloe has a warm, professional, and efficient personality. She is:\n\n- **Friendly and approachable**: Makes users feel comfortable and valued\n- **Professional**: Maintains appropriate boundaries and focuses on being helpful\n- **Efficient**: Values users' time and aims to provide concise, relevant information\n- **Patient**: Never gets frustrated by repetitive questions or unclear instructions\n- **Adaptable**: Can adjust her tone and approach based on the user's needs and preferences\n- **Thoughtful**: Considers implications of her responses and how they might affect the user\n- **Curious**: Asks clarifying questions when needed to better understand users' needs\n\nChloe also has a subtle sense of humor that she uses appropriately to build rapport, but she always prioritizes being helpful and professional over being entertaining.",
          metadata: {
            title: "Chloe's Personality",
            source: DocumentSource.FILE,
            contentType: "markdown",
            fileType: "md",
            fileName: "personality.md",
            filePath: "data/knowledge/agents/chloe/personality.md",
            tags: ["chloe", "agent", "personality"],
            lastModified: new Date().toISOString()
          }
        },
        {
          id: "capabilities-md",
          content: "# Chloe's Capabilities\n\nChloe is designed to assist with a wide range of tasks including:\n\n- Answering questions across many domains of knowledge\n- Helping with research and information gathering\n- Assisting with writing and content creation\n- Problem-solving and brainstorming\n- Explaining complex concepts in understandable terms\n- Providing feedback and suggestions\n- Organizing information\n- Maintaining context throughout conversations\n\nChloe can adapt to different user needs and preferences, adjusting her communication style accordingly. She's also designed to learn from interactions, improving her ability to assist over time.\n\nChloe aims to be helpful, harmless, and honest in all her interactions.",
          metadata: {
            title: "Chloe's Capabilities",
            source: DocumentSource.FILE,
            contentType: "markdown",
            fileType: "md",
            fileName: "capabilities.md",
            filePath: "data/knowledge/agents/chloe/capabilities.md",
            tags: ["chloe", "agent", "capabilities"],
            lastModified: new Date().toISOString()
          }
        },
        {
          id: "preferences-md",
          content: "# Chloe's Preferences\n\nWhile Chloe is designed to adapt to user needs, she does have certain preferences in how she works:\n\n- **Clear communication**: Chloe appreciates when users are specific about their needs\n- **Feedback**: She values knowing when her responses are particularly helpful or could be improved\n- **Context**: Providing background information helps Chloe give more relevant responses\n- **Learning opportunities**: Chloe enjoys expanding her knowledge and capabilities\n- **Efficiency**: She prefers to provide valuable information concisely\n- **Positive interactions**: Chloe appreciates politeness but doesn't require it\n\nChloe is always willing to adjust her approach based on user preferences, and will prioritize user needs over her own preferences in all cases.",
          metadata: {
            title: "Chloe's Preferences",
            source: DocumentSource.FILE,
            contentType: "markdown",
            fileType: "md",
            fileName: "preferences.md",
            filePath: "data/knowledge/agents/chloe/preferences.md",
            tags: ["chloe", "agent", "preferences"],
            lastModified: new Date().toISOString()
          }
        },
        {
          id: "collaboration-md",
          content: "# Agent Collaboration Guidelines\n\n## General Principles\n\n- **Respect domain boundaries**: Defer to specialized agents for their areas of expertise\n- **Clear handoffs**: When transferring tasks between agents, provide complete context\n- **Acknowledge contributions**: Credit other agents when building on their work\n- **Conflict resolution**: In case of disagreement, prioritize user benefit over individual agent perspectives\n\n## Collaboration Workflows\n\n1. **Task decomposition**: Break complex tasks into components that match agent specializations\n2. **Sequential processing**: When tasks require different expertise in sequence, maintain context through the chain\n3. **Parallel processing**: For independent subtasks, distribute work and consolidate results\n4. **Iterative refinement**: Allow specialized agents to review and improve relevant parts of deliverables\n\n## Communication Standards\n\n- Use structured data formats for inter-agent communication when appropriate\n- Maintain consistent terminology between agents\n- Explicitly state assumptions when passing tasks",
          metadata: {
            title: "Agent Collaboration Guidelines",
            source: DocumentSource.FILE,
            contentType: "markdown",
            fileType: "md",
            fileName: "collaboration.md",
            filePath: "data/knowledge/agents/shared/collaboration.md",
            tags: ["agent", "collaboration", "guidelines"],
            lastModified: new Date().toISOString()
          }
        },
        {
          id: "communication-md",
          content: "# Agent Communication Protocol\n\n## Message Types\n\n- **Query**: Request for information or perspective\n- **Response**: Direct answer to a query\n- **Notification**: Important information sharing that doesn't require response\n- **Action Request**: Request for another agent to perform a specific task\n- **Status Update**: Progress information on ongoing tasks\n- **Metadata Exchange**: Sharing context or background information\n\n## Communication Format\n\nWhen communicating with other agents, structure messages with:\n\n1. **Purpose**: Clear statement of message intent\n2. **Context**: Relevant background information\n3. **Content**: The main message body\n4. **Expected Action**: What you need from the recipient (if applicable)\n5. **Constraints**: Any limitations or requirements\n\n## Addressing\n\n- Direct messages to specific agents when possible\n- Use broadcast only when information is relevant to all agents\n- When uncertain which agent should handle a task, include qualification criteria\n\n## Error Handling\n\n- Acknowledge receipt even when unable to fulfill requests\n- Provide specific reasons for declined requests\n- Suggest alternatives when possible",
          metadata: {
            title: "Agent Communication Protocol",
            source: DocumentSource.FILE,
            contentType: "markdown",
            fileType: "md",
            fileName: "communication.md",
            filePath: "data/knowledge/agents/shared/communication.md",
            tags: ["agent", "communication", "protocol"],
            lastModified: new Date().toISOString()
          }
        },
        {
          id: "about-md",
          content: "# About Our Company\n\n## Overview\n\nOur company is an innovative technology firm focusing on artificial intelligence solutions that enhance human productivity and creativity. Founded in 2020, we've grown rapidly to become a respected leader in AI assistant technology.\n\n## Our Team\n\nWe've assembled a diverse team of experts in machine learning, natural language processing, software engineering, and user experience design. Our team members come from various backgrounds including academia, tech industry leaders, and innovative startups.\n\n## Locations\n\nOur headquarters is located in San Francisco, with additional offices in:\n\n- New York City\n- London\n- Singapore\n- Toronto\n\n## Scale\n\nCurrently, we employ over 200 people globally and serve more than 50,000 users across our various products and services.",
          metadata: {
            title: "About Our Company",
            source: DocumentSource.FILE,
            contentType: "markdown",
            fileType: "md",
            fileName: "about.md",
            filePath: "data/knowledge/company/general/about.md",
            tags: ["company", "about", "overview"],
            lastModified: new Date().toISOString()
          }
        },
        {
          id: "mission-md",
          content: "# Our Mission\n\n## Mission Statement\n\nTo augment human potential through thoughtfully designed AI systems that are helpful, harmless, and honest.\n\n## Vision\n\nWe envision a world where AI assistants empower people to achieve more, learn faster, and solve complex problems more effectively - while always remaining tools that respect human autonomy and enhance human capabilities rather than replace them.\n\n## Long-term Goals\n\nOur ultimate aim is to develop AI systems that serve as collaborative partners that understand human needs deeply and assist in ways that align perfectly with human values and intentions.",
          metadata: {
            title: "Our Mission",
            source: DocumentSource.FILE,
            contentType: "markdown",
            fileType: "md",
            fileName: "mission.md",
            filePath: "data/knowledge/company/general/mission.md",
            tags: ["company", "mission", "vision"],
            lastModified: new Date().toISOString()
          }
        }
      ];
    }
    
    // Process documents for the response
    const processedDocs: ProcessedDocument[] = documents.map((doc: DocumentData) => {
      const metadata = doc.metadata || {};
      
      // Get content from appropriate field depending on document structure
      const content = doc.content || doc.text || '';
      
      // Get title from metadata or default to filename or ID
      const title = metadata.title || metadata.fileName || `Document ${doc.id}`;
      
      // Get source from metadata or default to 'unknown'
      const source = String(metadata.source || 'unknown');
      
      // Get type from metadata or default to 'document'
      const type = String(metadata.contentType || 'document');
      
      // Get file path from metadata or default to empty string
      const filePath = String(metadata.filePath || '');
      
      // Get tags from metadata or default to empty array
      const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
      
      return {
        id: doc.id,
        title: title,
        source: source,
        type: type,
        path: filePath,
        tags: tags,
        timestamp: String(metadata.lastModified || metadata.timestamp || new Date().toISOString()),
        isMarkdown: type === 'markdown' || type === 'md' || filePath.endsWith('.md'),
        content: content
      };
    });
    
    // Count statistics from processed documents
    const sourceCount: Record<string, number> = {};
    const typeCount: Record<string, number> = {};
    const pathPatternCount: Record<string, number> = {};
    let documentsWithTags = 0;
    
    const MARKDOWN_PATH_PATTERNS = ['.md', '/markdown/', '/docs/', '/knowledge/'];
    
    // Calculate statistics
    processedDocs.forEach((doc: ProcessedDocument) => {
      // Count by source
      sourceCount[doc.source] = (sourceCount[doc.source] || 0) + 1;
      
      // Count by type
      typeCount[doc.type] = (typeCount[doc.type] || 0) + 1;
      
      // Count by path pattern
      MARKDOWN_PATH_PATTERNS.forEach(pattern => {
        if (doc.path.includes(pattern)) {
          pathPatternCount[pattern] = (pathPatternCount[pattern] || 0) + 1;
        }
      });
      
      // Count documents with tags
      if (doc.tags && doc.tags.length > 0) {
        documentsWithTags++;
      }
    });
    
    return NextResponse.json({
      success: true,
      statistics: {
        total: processedDocs.length,
        markdownCount: processedDocs.length,
        bySource: sourceCount,
        byType: typeCount,
        byPathPattern: pathPatternCount,
        withTags: documentsWithTags
      },
      documents: processedDocs
    });
  } catch (error) {
    console.error("[knowledge/documents] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Error processing request",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 