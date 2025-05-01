import { NextRequest, NextResponse } from 'next/server';
import { getChloeInstance } from '../../../agents/chloe';
import * as serverQdrant from '../../../server/qdrant';
import { 
  POST as proxyPost, 
  GET as proxyGet
} from './proxy';

// Add server-only markers to prevent client-side execution
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Clean and deduplicate thought messages before returning them
function deduplicateThoughts(thoughts: string[]): string[] {
  if (!thoughts || !Array.isArray(thoughts)) return [];
  
  const seen = new Set<string>();
  return thoughts.filter(thought => {
    // Normalize the thought by removing timestamps and trimming
    const normalizedThought = thought.replace(/^\[\d{2}:\d{2}:\d{2}\]/i, '').trim();
    
    // Skip if we've already seen this normalized thought
    if (seen.has(normalizedThought)) return false;
    
    // Add to seen set and keep this thought
    seen.add(normalizedThought);
    return true;
  });
}

// Handler function to process messages through Chloe
async function handler(message: string, options: {
  userId: string;
  rememberMessage: boolean;
  attachments?: any[];
  visionResponseFor?: string;
}) {
  // Initialize Chloe agent if needed
  const agent = await getChloeInstance();
  
  if (!agent) {
    throw new Error('Failed to initialize Chloe agent');
  }
  
  // Process the message
  const response = await agent.processMessage(message, { 
    userId: options.userId, 
    attachments: options.attachments 
  });
  
  return response;
}

// Use our own implementation for POST
export async function POST(request: NextRequest) {
  try {
    const response = await proxyPost(request);
    
    // Check if we need to deduplicate thoughts and responses
    if (response && response.status === 200) {
      const data = await response.json();
      
      // Deduplicate thoughts if present
      if (data.thoughts && Array.isArray(data.thoughts)) {
        data.thoughts = deduplicateThoughts(data.thoughts);
      }
      
      // Return the deduplicated data
      return NextResponse.json(data);
    }
    
    return response;
  } catch (error) {
    console.error('Error in chat route handler:', error);
    return NextResponse.json(
      { error: 'Internal server error processing chat request' },
      { status: 500 }
    );
  }
}

// Export the GET function from the proxy
export async function GET(request: NextRequest) {
  return proxyGet(request);
} 