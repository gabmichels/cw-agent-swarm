import { stemmer } from 'stemmer';
import stopwords from './stopwords';

/**
 * Tag extraction algorithms supported by the TagExtractor
 */
export enum TagAlgorithm {
  TFIDF = 'tfidf',
  RAKE = 'rake',
  BASIC = 'basic'
}

/**
 * Tag with additional metadata including confidence score
 */
export interface Tag {
  text: string;
  confidence: number;
  algorithm?: TagAlgorithm;
  approved?: boolean;
  source?: string;
}

/**
 * Options for tag extraction
 */
export interface TagExtractionOptions {
  algorithm?: TagAlgorithm;
  maxTags?: number;
  minConfidence?: number;
  includePOS?: Array<'noun' | 'verb' | 'adjective'>;
  useStemming?: boolean;
  allowedWordLengths?: {min: number, max: number};
  customStopwords?: string[];
}

/**
 * Centralized utility for extracting tags/keywords from content
 * Supports multiple algorithms and proper text normalization
 */
export class TagExtractor {
  // Corpus-wide statistics for TF-IDF calculations
  private static corpusTermFrequency: Map<string, number> = new Map();
  private static documentCount: number = 0;
  private static initialized: boolean = false;
  
  // Default stopwords (common English words with low information value)
  private static defaultStopwords: Set<string> = new Set(stopwords);
  
  // Document frequency for terms (used in IDF calculation)
  private static documentFrequency: Map<string, number> = new Map();
  
  // Additional statistics for scoring
  private static avgDocumentLength: number = 0;
  private static totalTerms: number = 0;
  
  /**
   * Initialize the TagExtractor with pre-stored corpus statistics if available
   */
  public static initialize(storedStats?: {
    corpusTermFrequency: Record<string, number>;
    documentFrequency: Record<string, number>;
    documentCount: number;
    avgDocumentLength: number;
    totalTerms: number;
  }): void {
    if (storedStats) {
      // Convert stored objects back to Maps
      this.corpusTermFrequency = new Map(Object.entries(storedStats.corpusTermFrequency));
      this.documentFrequency = new Map(Object.entries(storedStats.documentFrequency));
      this.documentCount = storedStats.documentCount;
      this.avgDocumentLength = storedStats.avgDocumentLength;
      this.totalTerms = storedStats.totalTerms;
    }
    
    this.initialized = true;
  }
  
  /**
   * Get corpus statistics for persistence
   */
  public static getCorpusStatistics(): {
    corpusTermFrequency: Record<string, number>;
    documentFrequency: Record<string, number>;
    documentCount: number;
    avgDocumentLength: number;
    totalTerms: number;
  } {
    // Convert Maps to plain objects for storage
    return {
      corpusTermFrequency: Object.fromEntries(this.corpusTermFrequency),
      documentFrequency: Object.fromEntries(this.documentFrequency),
      documentCount: this.documentCount,
      avgDocumentLength: this.avgDocumentLength,
      totalTerms: this.totalTerms
    };
  }
  
  /**
   * Extract tags from content using the specified algorithm
   * 
   * @param content The text content to extract tags from
   * @param options Options for tag extraction
   * @returns Array of extracted tags with confidence scores
   */
  public static extractTags(content: string, options: TagExtractionOptions = {}): Tag[] {
    // Ensure the extractor is initialized
    if (!this.initialized) {
      this.initialize();
    }
    
    // Set default options
    const algorithm = options.algorithm || TagAlgorithm.TFIDF;
    const maxTags = options.maxTags || 10;
    const minConfidence = options.minConfidence || 0.1;
    const useStemming = options.useStemming !== undefined ? options.useStemming : true;
    
    // Create a custom stopword set with default plus any custom stopwords
    const stopwordSet = new Set(this.defaultStopwords);
    if (options.customStopwords) {
      options.customStopwords.forEach(word => stopwordSet.add(word.toLowerCase()));
    }
    
    // Normalize and tokenize the text
    const normalizedText = this.normalizeText(content);
    const terms = this.tokenizeText(normalizedText, stopwordSet, options.allowedWordLengths);
    
    // Skip processing for very short content
    if (terms.length < 3) {
      return [];
    }
    
    // Apply stemming if enabled
    const processedTerms = useStemming ? terms.map(term => stemmer(term)) : terms;
    
    // Count term frequencies in this document
    const termFrequencies = this.countTermFrequencies(processedTerms);
    
    // Extract tags based on the selected algorithm
    let extractedTags: Tag[] = [];
    
    switch (algorithm) {
      case TagAlgorithm.TFIDF:
        extractedTags = this.extractTagsWithTFIDF(termFrequencies, normalizedText);
        break;
      case TagAlgorithm.RAKE:
        extractedTags = this.extractTagsWithRAKE(normalizedText, stopwordSet);
        break;
      case TagAlgorithm.BASIC:
      default:
        extractedTags = this.extractTagsBasic(termFrequencies);
        break;
    }
    
    // Update corpus statistics with this document
    this.updateCorpusStatistics(processedTerms, termFrequencies);
    
    // Filter by minimum confidence and take top tags
    return extractedTags
      .filter(tag => tag.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxTags);
  }
  
  /**
   * Normalize text by converting to lowercase, removing punctuation, etc.
   * 
   * @param text The text to normalize
   * @returns Normalized text
   */
  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      // Replace newlines with spaces
      .replace(/\r?\n|\r/g, ' ')
      // Replace punctuation with spaces
      .replace(/[^\w\s]/g, ' ')
      // Replace multiple spaces with a single space
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Tokenize text into individual terms
   * 
   * @param text The normalized text to tokenize
   * @param stopwords Set of stopwords to exclude
   * @param allowedWordLengths Min and max word lengths to include
   * @returns Array of terms
   */
  private static tokenizeText(
    text: string, 
    stopwords: Set<string>,
    allowedWordLengths: {min: number, max: number} = {min: 3, max: 25}
  ): string[] {
    return text
      .split(' ')
      .filter(term => 
        // Filter out stopwords
        !stopwords.has(term) && 
        // Filter by word length
        term.length >= allowedWordLengths.min && 
        term.length <= allowedWordLengths.max && 
        // Ensure term contains at least one letter (not just numbers)
        /[a-z]/.test(term)
      );
  }
  
  /**
   * Count the frequency of each term in the document
   * 
   * @param terms Array of terms from the document
   * @returns Map of term frequencies
   */
  private static countTermFrequencies(terms: string[]): Map<string, number> {
    const frequencies = new Map<string, number>();
    
    for (const term of terms) {
      frequencies.set(term, (frequencies.get(term) || 0) + 1);
    }
    
    return frequencies;
  }
  
  /**
   * Extract tags using TF-IDF algorithm
   * 
   * @param termFrequencies Map of term frequencies in the document
   * @param originalText Original normalized text (for context)
   * @returns Array of tags with TF-IDF scores
   */
  private static extractTagsWithTFIDF(termFrequencies: Map<string, number>, originalText: string): Tag[] {
    const documentLength = Array.from(termFrequencies.values()).reduce((sum, freq) => sum + freq, 0);
    const tags: Tag[] = [];
    
    // Calculate TF-IDF score for each term
    termFrequencies.forEach((frequency, term) => {
      // Term Frequency (normalized by document length)
      const tf = frequency / documentLength;
      
      // Get document frequency (number of documents containing this term)
      const df = this.documentFrequency.get(term) || 0;
      
      // Calculate Inverse Document Frequency (add 1 to document count to handle first document)
      const idf = Math.log((this.documentCount + 1) / (df + 1)) + 1;
      
      // TF-IDF score
      const tfidf = tf * idf;
      
      // Only include terms that appear more than once or have a significant TF-IDF score
      if (frequency > 1 || tfidf > 0.01) {
        tags.push({
          text: term,
          confidence: Math.min(tfidf, 1), // Normalize to 0-1 range
          algorithm: TagAlgorithm.TFIDF,
          approved: false
        });
      }
    });
    
    return tags;
  }
  
  /**
   * Extract tags using RAKE (Rapid Automatic Keyword Extraction) algorithm
   * 
   * @param text Normalized text
   * @param stopwords Set of stopwords to use as delimiters
   * @returns Array of tags with RAKE scores
   */
  private static extractTagsWithRAKE(text: string, stopwords: Set<string>): Tag[] {
    // Split text into phrases based on stopwords and punctuation
    const phrases = text
      .replace(/[.,:;()\-—–]/g, ' ')
      .split(' ')
      .filter(word => word.length > 0 && !stopwords.has(word))
      .join(' ')
      .split(/\s+/)
      .filter(phrase => phrase.length > 0);
    
    // Count co-occurrences of words within phrases
    const wordFrequency: Map<string, number> = new Map();
    const wordDegree: Map<string, number> = new Map();
    
    for (const phrase of phrases) {
      const words = phrase.split(/\s+/);
      
      for (const word of words) {
        // Update word frequency
        wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
        
        // Update word degree (co-occurrence)
        wordDegree.set(word, (wordDegree.get(word) || 0) + words.length);
      }
    }
    
    // Calculate RAKE score for each word
    const wordScores: Map<string, number> = new Map();
    
    wordFrequency.forEach((freq, word) => {
      const degree = wordDegree.get(word) || 0;
      wordScores.set(word, degree / freq);
    });
    
    // Calculate phrase scores
    const phraseScores: Map<string, number> = new Map();
    
    for (const phrase of phrases) {
      const words = phrase.split(/\s+/);
      let score = 0;
      
      for (const word of words) {
        score += wordScores.get(word) || 0;
      }
      
      if (words.length > 0 && score > 0) {
        phraseScores.set(phrase, score);
      }
    }
    
    // Convert to tags
    const tags: Tag[] = [];
    let maxScore = 0;
    
    phraseScores.forEach((score, phrase) => {
      maxScore = Math.max(maxScore, score);
      tags.push({
        text: phrase,
        confidence: score,
        algorithm: TagAlgorithm.RAKE,
        approved: false
      });
    });
    
    // Normalize confidence scores to 0-1 range
    if (maxScore > 0) {
      for (const tag of tags) {
        tag.confidence = Math.min(tag.confidence / maxScore, 1);
      }
    }
    
    return tags;
  }
  
  /**
   * Extract tags using a basic frequency-based approach
   * 
   * @param termFrequencies Map of term frequencies
   * @returns Array of tags with basic frequency-based scores
   */
  private static extractTagsBasic(termFrequencies: Map<string, number>): Tag[] {
    const tags: Tag[] = [];
    let maxFrequency = 0;
    
    // Find the maximum frequency for normalization
    termFrequencies.forEach(frequency => {
      maxFrequency = Math.max(maxFrequency, frequency);
    });
    
    // Convert term frequencies to tags
    termFrequencies.forEach((frequency, term) => {
      // Only include terms that appear more than once
      if (frequency > 1) {
        tags.push({
          text: term,
          confidence: maxFrequency > 0 ? frequency / maxFrequency : 0,
          algorithm: TagAlgorithm.BASIC,
          approved: false
        });
      }
    });
    
    return tags;
  }
  
  /**
   * Update corpus statistics with a new document
   * 
   * @param terms Terms in the document
   * @param termFrequencies Frequencies of terms in the document
   */
  private static updateCorpusStatistics(terms: string[], termFrequencies: Map<string, number>): void {
    // Increment document count
    this.documentCount++;
    
    // Track total terms for average document length calculation
    const documentLength = terms.length;
    this.totalTerms += documentLength;
    this.avgDocumentLength = this.totalTerms / this.documentCount;
    
    // Update document frequency (for IDF calculation)
    const uniqueTerms = new Set(terms);
    uniqueTerms.forEach(term => {
      this.documentFrequency.set(term, (this.documentFrequency.get(term) || 0) + 1);
    });
    
    // Update corpus term frequency
    termFrequencies.forEach((frequency, term) => {
      this.corpusTermFrequency.set(term, (this.corpusTermFrequency.get(term) || 0) + frequency);
    });
  }
  
  /**
   * Calculate tag overlap between a query and a document's tags
   * Used for boosting search results with matching tags
   * 
   * @param queryTags Tags extracted from the query
   * @param documentTags Tags from the document
   * @returns Overlap score (0-1)
   */
  public static calculateTagOverlap(queryTags: Tag[] | string[], documentTags: Tag[] | string[]): number {
    // Convert tags to a standard format (array of strings)
    const queryTagTexts = queryTags.map(tag => typeof tag === 'string' ? tag : tag.text);
    const documentTagTexts = documentTags.map(tag => typeof tag === 'string' ? tag : tag.text);
    
    // Count overlapping tags
    let overlapCount = 0;
    for (const queryTag of queryTagTexts) {
      if (documentTagTexts.includes(queryTag)) {
        overlapCount++;
      }
    }
    
    // Calculate overlap score (normalize by the smaller set size)
    const minSize = Math.min(queryTagTexts.length, documentTagTexts.length);
    return minSize > 0 ? overlapCount / minSize : 0;
  }
  
  /**
   * Validate and approve tags
   * 
   * @param existingTags Tags to validate
   * @param approvedTags Tags that are approved
   * @param rejectedTags Tags that are rejected
   * @returns Updated tags with approval status
   */
  public static validateTags(
    existingTags: Tag[],
    approvedTags: string[] = [],
    rejectedTags: string[] = []
  ): Tag[] {
    // Create sets for faster lookups
    const approvedTagSet = new Set(approvedTags.map(tag => tag.toLowerCase()));
    const rejectedTagSet = new Set(rejectedTags.map(tag => tag.toLowerCase()));
    
    // Update approval status for each tag
    return existingTags.map(tag => {
      const lowerText = tag.text.toLowerCase();
      
      if (approvedTagSet.has(lowerText)) {
        return { ...tag, approved: true, confidence: 1.0 };
      } else if (rejectedTagSet.has(lowerText)) {
        return { ...tag, approved: false, confidence: 0 };
      }
      
      return tag;
    }).filter(tag => tag.confidence > 0); // Remove rejected tags
  }
  
  /**
   * Merge tags from multiple sources, prioritizing approved tags
   * 
   * @param tagSets Multiple sets of tags to merge
   * @returns Merged set of unique tags
   */
  public static mergeTags(...tagSets: Tag[][]): Tag[] {
    const tagMap = new Map<string, Tag>();
    
    // Process tag sets in order (later sets can override earlier ones)
    for (const tags of tagSets) {
      for (const tag of tags) {
        const existingTag = tagMap.get(tag.text.toLowerCase());
        
        if (!existingTag || 
            (tag.approved && !existingTag.approved) || 
            (tag.confidence > existingTag.confidence)) {
          tagMap.set(tag.text.toLowerCase(), tag);
        }
      }
    }
    
    return Array.from(tagMap.values());
  }
  
  /**
   * Extract tags from multiple fields with specified weights
   * Useful for structured content with fields of different importance
   * 
   * @param fields Fields with their content and weights
   * @param options Tag extraction options
   * @returns Combined tags from all fields
   */
  public static extractTagsFromFields(
    fields: Array<{ content: string, weight: number }>,
    options: TagExtractionOptions = {}
  ): Tag[] {
    const tagSets: Tag[][] = [];
    
    // Extract tags from each field
    for (const field of fields) {
      const tags = this.extractTags(field.content, options);
      
      // Apply field weight to confidence scores
      const weightedTags = tags.map(tag => ({
        ...tag,
        confidence: tag.confidence * field.weight
      }));
      
      tagSets.push(weightedTags);
    }
    
    // Merge and return all tags
    return this.mergeTags(...tagSets);
  }
} 