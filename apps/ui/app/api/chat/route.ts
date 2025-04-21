import { NextResponse } from 'next/server';

// Mock system prompts since we can't import from @crowd-wisdom/shared
const SYSTEM_PROMPTS = {
  CHLOE: `You are Chloe, an autonomous AI assistant specializing in marketing. 
  You provide helpful, informative responses related to marketing strategy, content marketing, 
  social media, brand development, and market research.
  Your tone is professional, friendly, and confident.`,
  DEFAULT: `You are a helpful AI assistant.`
};

export async function POST(request: Request) {
  try {
    const { message, agentName = 'Chloe' } = await request.json();
    
    // In a real implementation, we would call the LLM here
    // For now, we'll just echo back the message with a mock response
    
    // Simulate a delay for realism
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create a mock response based on the agent type
    let responseContent;
    
    if (agentName.toLowerCase() === 'chloe') {
      responseContent = `As your marketing expert, I'm happy to help with that! 
      You asked about: "${message}"
      
      This is a simulated response while we work on connecting to the actual LLM backend. 
      When fully implemented, I'll provide detailed marketing insights and strategies.`;
    } else {
      responseContent = `I received your message: "${message}"
      
      This is a simulated response since the backend LLM integration is still in progress.`;
    }
    
    return NextResponse.json({
      message: responseContent,
      agent: agentName,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error handling chat request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate response' },
      { status: 500 }
    );
  }
} 