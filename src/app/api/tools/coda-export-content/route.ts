import { NextRequest, NextResponse } from 'next/server';
import { codaIntegration } from '../../../../agents/chloe/tools/coda';
import axios from 'axios';

// Mark as server-side only
export const runtime = 'nodejs';

// Generate a title from content using OpenRouter
async function generateTitleWithAI(content: string): Promise<string> {
  try {
    // Check if we have the OpenRouter API key
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('No API key found for OpenRouter');
      return `Exported Document - ${new Date().toLocaleDateString()}`;
    }
    
    // Truncate content if it's too long
    const truncatedContent = content.length > 1500 
      ? content.substring(0, 1500) + '...' 
      : content;
    
    // Try with multiple model options to handle fallback cases
    const modelOptions = [
      'deepseek/deepseek-chat-v3-0324:free',
      'meta-llama/llama-4-scout:free',
      'google/gemini-2.0-flash-001'
    ];
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: modelOptions[0], // Use the first model as primary
        fallbacks: modelOptions.slice(1), // Use the rest as fallbacks
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Generate ONLY a short, descriptive title (3-7 words) with no formatting or explanation.'
          },
          {
            role: 'user',
            content: `Generate a concise title for this content (just the title, no formatting or explanation):\n\n${truncatedContent}`
          }
        ],
        max_tokens: 20,
        temperature: 0.7,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error from OpenRouter:', errorData);
      return `Exported Document - ${new Date().toLocaleDateString()}`;
    }
    
    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      // Clean up any formatting, explanations, or unnecessary text
      let title = data.choices[0].message.content.trim();
      
      // Remove markdown formatting (**, *, etc.)
      title = title.replace(/\*\*/g, '').replace(/\*/g, '');
      
      // Remove quotes
      title = title.replace(/^["']|["']$/g, '');
      
      // Remove any explanations in parentheses or after colons
      title = title.split(/[:\(\[]/, 1)[0].trim();

      // Limit to first line only (in case model returns multiple lines)
      title = title.split('\n', 1)[0].trim();

      // If still too long or empty, use default
      if (!title || title.length > 50) {
        return `Exported Document - ${new Date().toLocaleDateString()}`;
      }
      
      return title;
    }
    
    return `Exported Document - ${new Date().toLocaleDateString()}`;
  } catch (error) {
    console.error('Error generating title with AI:', error);
    return `Exported Document - ${new Date().toLocaleDateString()}`;
  }
}

// Generate content for a topic using OpenRouter
async function generateContentWithAI(topic: string): Promise<string> {
  try {
    // Check if we have the OpenRouter API key
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('No API key found for OpenRouter');
      return `Failed to generate content - no API key configured.`;
    }
    
    // Try with multiple model options to handle fallback cases
    const modelOptions = [
      'deepseek/deepseek-chat-v3-0324:free',
      'meta-llama/llama-4-scout:free', 
      'google/gemini-2.0-flash-001'
    ];
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: modelOptions[0], // Use the first model as primary
        fallbacks: modelOptions.slice(1), // Use the rest as fallbacks
        messages: [
          {
            role: 'system',
            content: 'You are a marketing professional with expertise in creating well-structured content. Create a detailed, comprehensive document on the requested topic. Use markdown formatting with headings, subheadings, bullet points, and numbered lists as appropriate.'
          },
          {
            role: 'user',
            content: `Create a comprehensive guide about "${topic}". Include sections covering background, key strategies, implementation steps, and best practices.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error from OpenRouter:', errorData);
      return `Failed to generate content. Error: ${JSON.stringify(errorData)}`;
    }
    
    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    }
    
    return `Failed to generate content. No content in response.`;
  } catch (error) {
    console.error('Error generating content with AI:', error);
    return `Error generating content: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userContent = body.content || "";
    const userTopic = body.topic || "";
    
    // If no content or topic provided, return error
    if (!userContent && !userTopic) {
      return NextResponse.json({ 
        success: false, 
        error: "Either content or topic is required" 
      });
    }
    
    try {
      let content = userContent;
      let title;
      
      // If we have a topic but no content, generate content based on the topic
      if (userTopic && !userContent) {
        console.log(`Generating content for topic: "${userTopic}"`);
        content = await generateContentWithAI(userTopic);
        title = userTopic;
      } else {
        // Generate a title using OpenRouter from the content
        title = await generateTitleWithAI(content);
      }
      
      console.log(`Generated title: "${title}"`);
      
      // Log the content being sent to Coda
      console.log(`Sending content to Coda (${content.length} chars): ${content.substring(0, 100)}...`);
      
      // Create the document with title and content
      const doc = await codaIntegration.createDoc(title, content);
      
      return NextResponse.json({ 
        success: true, 
        docId: doc.id,
        title,
        browserLink: doc.browserLink,
        message: "Successfully exported content to Coda document"
      });
    } catch (error) {
      console.error('Error exporting content to Coda:', error);
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
        error: "Failed to export content to Coda. " + errorMessage
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