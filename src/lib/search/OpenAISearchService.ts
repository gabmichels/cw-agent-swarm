import { OpenAI } from 'openai';
import { logger } from '../logging';

// Define SearchResponse interface directly to avoid missing module errors
export interface SearchResponse {
  results: string;
  citations: string[];
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Result from an OpenAI search operation
 */
export interface OpenAISearchResult {
  query: string;
  result: string;
  citations: {
    uri: string;
    title?: string;
    snippet?: string;
  }[];
  error?: string;
}

/**
 * Service for performing advanced web searches using OpenAI's search-capable model
 */
export class OpenAISearchService {
  /**
   * Perform a web search using OpenAI's search-capable model
   * @param query The search query
   * @param options Optional parameters
   * @returns Search results with citations
   */
  public async search(query: string, options: {
    maxTokens?: number;
    temperature?: number;
    detailedResults?: boolean;
  } = {}): Promise<OpenAISearchResult> {
    try {
      logger.info(`Performing OpenAI search for: "${query}"`);
      
      const maxTokens = options.maxTokens || 1500;
      const temperature = options.temperature || 0.2;
      const detailedResults = options.detailedResults || false;

      // Create system message based on detail level
      const systemMessage = detailedResults
        ? "You are a comprehensive web search assistant. Provide detailed information about the query topic, including key facts, different perspectives, and recent developments. Include citations for your information sources."
        : "You are a concise web search assistant. Provide a brief answer to the query with the most relevant information. Include citations for your information sources.";

      // Use the search-capable model with proper type handling
      const response = await openai.chat.completions.create({
        model: "gpt-4o-search-preview",
        messages: [
          {
            role: "system",
            content: systemMessage
          },
          {
            role: "user",
            content: query
          }
        ],
        max_tokens: maxTokens,
        temperature: temperature,
        // Cast to any to avoid type checking for this special OpenAI API feature
        tools: [{ type: "search" }] as any
      });

      // Extract the response and citations
      const content = response.choices[0]?.message?.content || '';
      
      // Extract citations from the tool calls
      const toolCalls = response.choices[0]?.message?.tool_calls || [];
      const citations = toolCalls.flatMap(toolCall => {
        // Type assertion to handle the search tool type
        if (toolCall.type === 'function') {
          return [];
        }
        
        // We need to check if it's a search tool and extract the results
        const searchToolCall = toolCall as any;
        if (searchToolCall.type === 'search' && searchToolCall.search) {
          try {
            const searchResults = JSON.parse(searchToolCall.search.search_results || '[]');
            return searchResults.map((result: any) => ({
              uri: result.url || result.uri || '',
              title: result.title || '',
              snippet: result.snippet || ''
            }));
          } catch (error) {
            logger.error(`Error parsing search results: ${error}`);
            return [];
          }
        }
        return [];
      });

      // Return the formatted result
      return {
        query,
        result: content,
        citations
      };
    } catch (error) {
      logger.error(`Error in OpenAI search: ${error}`);
      return {
        query,
        result: '',
        citations: [],
        error: `Failed to perform search: ${error}`
      };
    }
  }

  /**
   * Perform a research-focused search intended to gather comprehensive information
   * @param topic The research topic
   * @returns Detailed research results with citations
   */
  public async researchTopic(topic: string): Promise<OpenAISearchResult> {
    return this.search(topic, {
      maxTokens: 3000,
      temperature: 0.1,
      detailedResults: true
    });
  }

  /**
   * Check if a fact or claim is accurate using search
   * @param claim The claim to fact-check
   * @returns Fact-checking results with citations
   */
  public async factCheck(claim: string): Promise<OpenAISearchResult> {
    const query = `Fact check: ${claim}`;
    return this.search(query, {
      maxTokens: 1000,
      temperature: 0.1
    });
  }

  /**
   * Get current information about a time-sensitive topic
   * @param topic The topic to get updates on
   * @returns Current information with citations
   */
  public async getCurrentInfo(topic: string): Promise<OpenAISearchResult> {
    const query = `What are the latest updates or current information about ${topic}?`;
    return this.search(query, {
      maxTokens: 1200,
      temperature: 0.2
    });
  }
}

export const searchWithOpenAI = async (query: string): Promise<SearchResponse> => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: query,
        },
      ],
      tools: [{ 
        type: "function" as const, 
        function: { 
          name: "search", 
          description: "Search for information", 
          parameters: { 
            type: "object", 
            properties: {}, 
            required: [] 
          } 
        } 
      }],
      tool_choice: { type: "function", function: { name: "search" } },
    });

    const toolCall = response.choices[0]?.message.tool_calls?.[0];
    
    // Check if we have a tool call and if it's a function call
    if (toolCall && toolCall.type === 'function') {
      // Create a more specific variable with type assertion
      const searchToolCall = toolCall as { type: 'function', function: { name: string, arguments: string } };
      
      // Check if this is a search function call
      if (searchToolCall.function.name === 'search') {
        try {
          // Extract citations
          const regex = /"citation": \[([^\]]*)\]/;
          const match = searchToolCall.function.arguments.match(regex);
          
          if (match && match[1]) {
            const citations = match[1]
              .split(',')
              .map((s) => s.trim().replace(/"/g, ''))
              .filter(Boolean);
            
            if (citations.length > 0) {
              return { 
                results: searchToolCall.function.arguments, 
                citations 
              };
            }
          }
          
          return { 
            results: searchToolCall.function.arguments, 
            citations: [] 
          };
        } catch (e) {
          console.error("Error parsing search results:", e);
          return { 
            results: JSON.stringify({ error: "Failed to parse search results" }), 
            citations: [] 
          };
        }
      }
    }

    return { 
      results: JSON.stringify({ error: "No search results" }), 
      citations: [] 
    };
  } catch (e) {
    console.error("Error searching with OpenAI:", e);
    return { 
      results: JSON.stringify({ error: "Error searching with OpenAI" }), 
      citations: [] 
    };
  }
}; 