import { NextRequest, NextResponse } from 'next/server';
import { codaIntegration } from '../../../../agents/shared/tools/integrations/coda';
import OpenAI from 'openai';

// Mark as server-side only
export const runtime = 'nodejs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = body.title;
    const contentPrompt = body.contentPrompt;
    
    if (!title || !contentPrompt) {
      return NextResponse.json({ 
        success: false, 
        error: "Title and content prompt are required" 
      });
    }
    
    try {
      // First check if we have the OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ 
          success: false, 
          error: "OpenAI API key is not configured" 
        });
      }
      
      // Generate content using OpenAI
      console.log(`Generating content for "${title}" with prompt: ${contentPrompt}`);
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_VISION_MODEL_NAME || "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a knowledgeable assistant that creates well-structured, informative documents. Format your response using Markdown with clear headings, bullet points, and sections."
          },
          {
            role: "user",
            content: `Please create a document titled "${title}" about: ${contentPrompt}. Make it comprehensive, well-structured, and professional.`
          }
        ],
        temperature: 0.7,
        max_tokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 4000,
      });
      
      const generatedContent = response.choices[0].message.content;
      
      if (!generatedContent) {
        return NextResponse.json({ 
          success: false, 
          error: "Failed to generate content with LLM" 
        });
      }
      
      // Create the document in Coda with the generated content
      const doc = await codaIntegration.createDoc(title, generatedContent);
      
      return NextResponse.json({ 
        success: true, 
        docId: doc.id,
        title,
        browserLink: doc.browserLink,
        message: "Successfully created Coda document with LLM content"
      });
    } catch (error) {
      console.error('Error creating Coda document with LLM content:', error);
      // If the error is about Coda integration being disabled, provide a clearer message
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Coda integration is disabled')) {
        return NextResponse.json({ 
          success: false, 
          error: "Coda integration is not enabled. Please check your CODA_API_KEY."
        });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: "Failed to create Coda document with LLM content. " + errorMessage
      });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ 
      success: false, 
      error: "Error processing request" 
    });
  }
} 