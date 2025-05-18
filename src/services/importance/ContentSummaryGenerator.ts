/**
 * Service for generating content summaries from memory items
 * These summaries are used to optimize memory retrieval and relevance evaluation
 */
export class ContentSummaryGenerator {
  /**
   * Maximum length of generated content summaries
   */
  private readonly maxSummaryLength: number = 150;
  
  /**
   * Generate a content summary from text
   * 
   * @param content Full content to summarize
   * @param options Options for summary generation
   * @returns Generated summary string
   */
  generateSummary(
    content: string, 
    options: {
      maxLength?: number;
      extractEntities?: boolean;
      extractKeyPoints?: boolean;
      contentType?: string;
    } = {}
  ): string {
    const maxLength = options.maxLength || this.maxSummaryLength;
    
    if (!content) {
      return '';
    }
    
    // For short content, just return it directly
    if (content.length <= maxLength) {
      return content;
    }
    
    // Extract first sentence if it's reasonable length
    const firstSentenceMatch = content.match(/^.*?[.!?](?:\s|$)/);
    const firstSentence = firstSentenceMatch ? firstSentenceMatch[0].trim() : '';
    
    if (firstSentence && firstSentence.length <= maxLength && firstSentence.length >= 20) {
      return firstSentence;
    }
    
    // Extract key phrases based on common patterns
    const keyPhrases = this.extractKeyPhrases(content);
    if (keyPhrases && keyPhrases.length <= maxLength) {
      return keyPhrases;
    }
    
    // Extract specific entities if requested
    if (options.extractEntities) {
      const entities = this.extractEntities(content);
      if (entities) {
        return `Mentions: ${entities}`.substring(0, maxLength);
      }
    }
    
    // Fall back to first X characters + last Y characters approach
    const firstPart = content.substring(0, Math.floor(maxLength * 0.8));
    const lastPart = content.substring(content.length - Math.floor(maxLength * 0.2));
    return `${firstPart}...${lastPart}`.substring(0, maxLength);
  }
  
  /**
   * Extract key phrases from content
   * Looks for patterns that indicate important information
   * 
   * @param content Content to analyze
   * @returns Extracted key phrases
   */
  private extractKeyPhrases(content: string): string {
    const keyPhrases: string[] = [];
    
    // Look for "key: value" patterns
    const keyValueMatches = content.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*):\s*([^,.]+)/g);
    if (keyValueMatches && keyValueMatches.length > 0) {
      keyPhrases.push(...keyValueMatches.slice(0, 3));
    }
    
    // Look for bullet points
    const bulletPointMatches = content.match(/[•\-*]\s*([^.!?]+)/g);
    if (bulletPointMatches && bulletPointMatches.length > 0) {
      keyPhrases.push(...bulletPointMatches.slice(0, 3));
    }
    
    // Look for numbers, which often indicate important info
    const numberMatches = content.match(/\$?\d+(?:[,.]\d+)?(?:\s*(?:USD|EUR|GBP|dollars|euros|million|billion))?/g);
    if (numberMatches && numberMatches.length > 0) {
      keyPhrases.push(`Values: ${numberMatches.slice(0, 3).join(', ')}`);
    }
    
    // Look for dates
    const dateMatches = content.match(/(?:\d{1,2}\/\d{1,2}\/\d{2,4})|(?:\d{4}-\d{2}-\d{2})|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/g);
    if (dateMatches && dateMatches.length > 0) {
      keyPhrases.push(`Dates: ${dateMatches.slice(0, 2).join(', ')}`);
    }
    
    return keyPhrases.join('; ');
  }
  
  /**
   * Extract named entities from content
   * 
   * @param content Content to analyze
   * @returns Extracted entity string
   */
  private extractEntities(content: string): string {
    // Simple regex-based entity extraction
    const entities: string[] = [];
    
    // Extract proper nouns (simplified approach)
    const properNounMatches = content.match(/(?:[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,5})/g);
    if (properNounMatches && properNounMatches.length > 0) {
      // Filter to avoid common words that might be capitalized mid-sentence
      const filteredProperNouns = properNounMatches.filter(name => 
        name.length > 3 && !name.match(/^(The|This|That|These|Those|When|Where|Why|How|What|Who)$/)
      );
      
      if (filteredProperNouns.length > 0) {
        entities.push(...filteredProperNouns.slice(0, 5));
      }
    }
    
    return entities.join(', ');
  }
  
  /**
   * Extract key topics from content
   * 
   * @param content Content to analyze
   * @returns Array of key topics
   */
  extractTopics(content: string): string[] {
    if (!content) {
      return [];
    }
    
    const topics: string[] = [];
    const lowercasedContent = content.toLowerCase();
    
    // Define topic categories and their keywords
    const topicKeywords: Record<string, string[]> = {
      'budget': ['budget', 'cost', 'price', 'money', 'financial', 'expense', 'funding'],
      'deadline': ['deadline', 'due date', 'timeline', 'schedule', 'by the end of'],
      'requirement': ['need', 'require', 'must have', 'essential', 'necessary'],
      'constraint': ['limit', 'constraint', 'restriction', 'cannot', 'unable to'],
      'question': ['what', 'how', 'when', 'where', 'why', '?'],
      'goal': ['goal', 'objective', 'aim', 'target', 'accomplish']
    };
    
    // Check for each topic
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => lowercasedContent.includes(keyword))) {
        topics.push(topic);
      }
    }
    
    return topics;
  }
} 