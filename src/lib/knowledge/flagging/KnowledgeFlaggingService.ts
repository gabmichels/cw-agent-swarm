import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { OpenAI } from 'openai';
import { 
  FlaggedKnowledgeItem, 
  FlaggedItemStatus, 
  FlaggedItemsFilter, 
  FlaggingResult, 
  FlaggingStats,
  KnowledgeSourceType,
  SuggestedKnowledgeProperties,
  SuggestedKnowledgeType,
  SuggestedRelationship,
  SuggestedConceptProperties,
  SuggestedPrincipleProperties,
  SuggestedFrameworkProperties,
  SuggestedResearchProperties,
  SuggestedRelationshipProperties
} from './types';
import { KnowledgeGraph } from '../KnowledgeGraph';
import { KnowledgeGraphService } from '../KnowledgeGraphService';
import { logger } from '../../logging';
import { KnowledgeGraphManager } from '../../../agents/chloe/knowledge/graphManager';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Service for flagging and managing potential knowledge items to add to the knowledge graph
 */
export class KnowledgeFlaggingService {
  private flaggedItems: Map<string, FlaggedKnowledgeItem> = new Map();
  private knowledgeGraph: KnowledgeGraph;
  private knowledgeGraphService: KnowledgeGraphService;
  private dataDir: string;
  private initialized: boolean = false;
  private knowledgeGraphManager: KnowledgeGraphManager | null = null;
  
  /**
   * Create a new knowledge flagging service
   */
  constructor(knowledgeGraph: KnowledgeGraph, dataDir?: string) {
    this.knowledgeGraph = knowledgeGraph;
    this.knowledgeGraphService = new KnowledgeGraphService(knowledgeGraph);
    
    // Set default data directory in the knowledge graph's data directory
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'knowledge', 
      knowledgeGraph.getDomain(), 'flagged');
    
    // Create directory if it doesn't exist
    this.ensureDirectoryExists();
  }

  /**
   * Load flagged items from disk
   */
  public async load(): Promise<void> {
    try {
      this.initialized = true;
      console.log("Knowledge flagging service initialized");
      
      // Check if the flagged items file exists
      const flaggedItemsFile = path.join(this.dataDir, 'flagged-items.json');
      
      if (fs.existsSync(flaggedItemsFile)) {
        const items = JSON.parse(fs.readFileSync(flaggedItemsFile, 'utf-8')) as FlaggedKnowledgeItem[];
        this.flaggedItems = new Map(items.map(item => [item.id, item]));
        console.log(`Loaded ${items.length} flagged knowledge items`);
      } else {
        console.log('No flagged knowledge items found');
      }
    } catch (error) {
      console.error('Error loading flagged items:', error);
      throw error;
    }
  }

  /**
   * Save flagged items to disk
   */
  public async save(): Promise<void> {
    try {
      const flaggedItemsFile = path.join(this.dataDir, 'flagged-items.json');
      fs.writeFileSync(
        flaggedItemsFile, 
        JSON.stringify(Array.from(this.flaggedItems.values()), null, 2)
      );
      console.log(`Saved ${this.flaggedItems.size} flagged knowledge items`);
    } catch (error) {
      console.error('Error saving flagged items:', error);
      throw error;
    }
  }

  /**
   * Ensure the data directory exists
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log(`Created flagged items directory: ${this.dataDir}`);
    }
  }

  /**
   * Flag knowledge from a conversation
   */
  public async flagFromConversation(
    conversation: string, 
    context: string = ''
  ): Promise<FlaggingResult> {
    try {
      const extractedKnowledge = await this.extractKnowledgeFromText(
        conversation,
        'conversation',
        context
      );
      
      if (!extractedKnowledge) {
        return { 
          success: false, 
          error: 'No relevant knowledge was extracted from the conversation' 
        };
      }
      
      const flaggedItem: FlaggedKnowledgeItem = {
        id: uuidv4(),
        title: extractedKnowledge.title,
        content: extractedKnowledge.content,
        sourceType: 'conversation',
        sourceReference: `Conversation at ${new Date().toISOString()}`,
        suggestedType: extractedKnowledge.suggestedType,
        suggestedCategory: extractedKnowledge.suggestedCategory,
        suggestedSubcategory: extractedKnowledge.suggestedSubcategory,
        confidence: extractedKnowledge.confidence,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        suggestedProperties: extractedKnowledge.suggestedProperties,
        suggestedRelationships: extractedKnowledge.suggestedRelationships,
        metadata: {
          originalConversation: conversation.length > 500 
            ? conversation.substring(0, 500) + '...' 
            : conversation,
          context
        }
      };
      
      // Store the flagged item
      this.flaggedItems.set(flaggedItem.id, flaggedItem);
      await this.save();
      
      return { success: true, itemId: flaggedItem.id };
    } catch (error) {
      console.error('Error flagging knowledge from conversation:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Flag knowledge from a file
   */
  public async flagFromFile(
    fileContent: string,
    fileName: string,
    fileType: string,
    metadata: Record<string, any> = {}
  ): Promise<FlaggingResult> {
    try {
      // Special handling based on file type could be added here
      const context = `File: ${fileName}, Type: ${fileType}`;
      
      const extractedKnowledge = await this.extractKnowledgeFromText(
        fileContent,
        'file',
        context
      );
      
      if (!extractedKnowledge) {
        return { 
          success: false, 
          error: 'No relevant knowledge was extracted from the file' 
        };
      }
      
      const flaggedItem: FlaggedKnowledgeItem = {
        id: uuidv4(),
        title: extractedKnowledge.title,
        content: extractedKnowledge.content,
        sourceType: 'file',
        sourceReference: fileName,
        suggestedType: extractedKnowledge.suggestedType,
        suggestedCategory: extractedKnowledge.suggestedCategory,
        suggestedSubcategory: extractedKnowledge.suggestedSubcategory,
        confidence: extractedKnowledge.confidence,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        suggestedProperties: extractedKnowledge.suggestedProperties,
        suggestedRelationships: extractedKnowledge.suggestedRelationships,
        metadata: {
          fileName,
          fileType,
          ...metadata
        }
      };
      
      // Store the flagged item
      this.flaggedItems.set(flaggedItem.id, flaggedItem);
      await this.save();
      
      return { success: true, itemId: flaggedItem.id };
    } catch (error) {
      console.error('Error flagging knowledge from file:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Flag knowledge from market scanning
   */
  public async flagFromMarketScan(
    source: string,
    content: string,
    url?: string,
    metadata: Record<string, any> = {}
  ): Promise<FlaggingResult> {
    try {
      const context = `Source: ${source}, URL: ${url || 'unknown'}`;
      
      const extractedKnowledge = await this.extractKnowledgeFromText(
        content,
        'market_scan',
        context
      );
      
      if (!extractedKnowledge) {
        return { 
          success: false, 
          error: 'No relevant knowledge was extracted from the market scan' 
        };
      }
      
      const flaggedItem: FlaggedKnowledgeItem = {
        id: uuidv4(),
        title: extractedKnowledge.title,
        content: extractedKnowledge.content,
        sourceType: 'market_scan',
        sourceReference: source,
        suggestedType: extractedKnowledge.suggestedType,
        suggestedCategory: extractedKnowledge.suggestedCategory,
        suggestedSubcategory: extractedKnowledge.suggestedSubcategory,
        confidence: extractedKnowledge.confidence,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        suggestedProperties: extractedKnowledge.suggestedProperties,
        suggestedRelationships: extractedKnowledge.suggestedRelationships,
        metadata: {
          source,
          url,
          scanDate: new Date().toISOString(),
          ...metadata
        }
      };
      
      // Store the flagged item
      this.flaggedItems.set(flaggedItem.id, flaggedItem);
      await this.save();
      
      return { success: true, itemId: flaggedItem.id };
    } catch (error) {
      console.error('Error flagging knowledge from market scan:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Flag knowledge from web search
   */
  public async flagFromWebSearch(
    query: string,
    content: string,
    source: string,
    url?: string,
    metadata: Record<string, any> = {}
  ): Promise<FlaggingResult> {
    try {
      const context = `Search Query: ${query}, Source: ${source}, URL: ${url || 'unknown'}`;
      
      const extractedKnowledge = await this.extractKnowledgeFromText(
        content,
        'web_search',
        context
      );
      
      if (!extractedKnowledge) {
        return { 
          success: false, 
          error: 'No relevant knowledge was extracted from the web search' 
        };
      }
      
      const flaggedItem: FlaggedKnowledgeItem = {
        id: uuidv4(),
        title: extractedKnowledge.title,
        content: extractedKnowledge.content,
        sourceType: 'web_search',
        sourceReference: source,
        suggestedType: extractedKnowledge.suggestedType,
        suggestedCategory: extractedKnowledge.suggestedCategory,
        suggestedSubcategory: extractedKnowledge.suggestedSubcategory,
        confidence: extractedKnowledge.confidence,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        suggestedProperties: extractedKnowledge.suggestedProperties,
        suggestedRelationships: extractedKnowledge.suggestedRelationships,
        metadata: {
          query,
          source,
          url,
          searchDate: new Date().toISOString(),
          ...metadata
        }
      };
      
      // Store the flagged item
      this.flaggedItems.set(flaggedItem.id, flaggedItem);
      await this.save();
      
      return { success: true, itemId: flaggedItem.id };
    } catch (error) {
      console.error('Error flagging knowledge from web search:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Flag knowledge manually
   */
  public async flagManually(
    title: string,
    content: string,
    suggestedType: SuggestedKnowledgeType,
    suggestedCategory: string,
    suggestedProperties: SuggestedKnowledgeProperties,
    metadata: Record<string, any> = {}
  ): Promise<FlaggingResult> {
    try {
      // Extract tags from metadata if present
      const tags = metadata.tags || [];
      
      const flaggedItem: FlaggedKnowledgeItem = {
        id: uuidv4(),
        title,
        content,
        sourceType: 'manual_entry',
        sourceReference: 'Manual entry',
        suggestedType,
        suggestedCategory,
        confidence: 1.0, // Manually entered items have high confidence
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        suggestedProperties,
        metadata: {
          manualEntryDate: new Date().toISOString(),
          tags, // Store tags in metadata
          ...metadata
        }
      };
      
      // Store the flagged item
      this.flaggedItems.set(flaggedItem.id, flaggedItem);
      await this.save();
      
      return { success: true, itemId: flaggedItem.id };
    } catch (error) {
      console.error('Error flagging knowledge manually:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get a flagged item by ID
   */
  public getFlaggedItem(id: string): FlaggedKnowledgeItem | undefined {
    return this.flaggedItems.get(id);
  }

  /**
   * Get all flagged items, optionally filtered
   */
  public getFlaggedItems(filter?: FlaggedItemsFilter): FlaggedKnowledgeItem[] {
    let items = Array.from(this.flaggedItems.values());
    
    if (filter) {
      if (filter.status) {
        items = items.filter(item => item.status === filter.status);
      }
      
      if (filter.sourceType) {
        items = items.filter(item => item.sourceType === filter.sourceType);
      }
      
      if (filter.suggestedType) {
        items = items.filter(item => item.suggestedType === filter.suggestedType);
      }
      
      if (filter.category) {
        items = items.filter(item => 
          item.suggestedCategory === filter.category || 
          item.suggestedSubcategory === filter.category
        );
      }
      
      if (filter.confidence) {
        const confidenceFilter = filter.confidence;
        if (confidenceFilter.min !== undefined) {
          items = items.filter(item => item.confidence >= confidenceFilter.min!);
        }
        
        if (confidenceFilter.max !== undefined) {
          items = items.filter(item => item.confidence <= confidenceFilter.max!);
        }
      }
      
      if (filter.dateRange) {
        if (filter.dateRange.from) {
          const fromDate = new Date(filter.dateRange.from).getTime();
          items = items.filter(item => new Date(item.createdAt).getTime() >= fromDate);
        }
        
        if (filter.dateRange.to) {
          const toDate = new Date(filter.dateRange.to).getTime();
          items = items.filter(item => new Date(item.createdAt).getTime() <= toDate);
        }
      }
    }
    
    // Sort by creation date, newest first
    return items.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Update the status of a flagged item
   */
  public async updateItemStatus(
    id: string, 
    status: FlaggedItemStatus
  ): Promise<FlaggingResult> {
    const item = this.flaggedItems.get(id);
    
    if (!item) {
      return { success: false, error: `Item with ID ${id} not found` };
    }
    
    item.status = status;
    item.updatedAt = new Date().toISOString();
    
    if (status === 'approved' || status === 'rejected') {
      item.processedAt = new Date().toISOString();
    }
    
    this.flaggedItems.set(id, item);
    await this.save();
    
    return { success: true, itemId: id };
  }

  /**
   * Get or create the KnowledgeGraphManager instance
   */
  private getKnowledgeGraphManager(): KnowledgeGraphManager {
    if (!this.knowledgeGraphManager) {
      this.knowledgeGraphManager = new KnowledgeGraphManager();
    }
    return this.knowledgeGraphManager;
  }

  /**
   * Process an approved item by adding it to the knowledge graph
   */
  public async processApprovedItem(id: string): Promise<FlaggingResult> {
    const item = this.flaggedItems.get(id);
    
    if (!item) {
      return { success: false, error: `Item with ID ${id} not found` };
    }
    
    if (item.status !== 'approved') {
      return { success: false, error: `Item with ID ${id} is not approved` };
    }
    
    try {
      // Use the KnowledgeGraphService to add the item with quality scoring and relationship suggestions
      logger.info(`Processing approved item: ${item.title}`);
      const itemId = await this.knowledgeGraphService.addApprovedItem(item);
      
      if (!itemId) {
        return { success: false, error: `Failed to add item to knowledge graph` };
      }
      
      // If there are tags in the metadata, sync them to the graph node
      if (item.metadata?.tags && Array.isArray(item.metadata.tags)) {
        try {
          const graphManager = this.getKnowledgeGraphManager();
          
          // Create a memory-like object with id and tags
          const memoryObject = {
            id: itemId,
            tags: item.metadata.tags,
            metadata: {
              flaggedItemId: id,
              ...item.metadata
            }
          };
          
          // Sync tags to the graph
          await graphManager.syncTagsToGraph(memoryObject);
          logger.info(`Synced ${item.metadata.tags.length} tags to graph node ${itemId}`);
        } catch (tagSyncError) {
          logger.error(`Error syncing tags to graph for item ${id}:`, tagSyncError);
          // Continue processing even if tag sync fails
        }
      }
      
      // Mark as processed
      item.processedAt = new Date().toISOString();
      this.flaggedItems.set(id, item);
      await this.save();
      
      return { success: true, itemId: id };
    } catch (error) {
      logger.error(`Error processing approved item ${id}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process all approved items
   */
  public async processAllApprovedItems(): Promise<FlaggingResult[]> {
    const approvedItems = this.getFlaggedItems({ status: 'approved' });
    const results: FlaggingResult[] = [];
    
    for (const item of approvedItems) {
      if (!item.processedAt) {
        results.push(await this.processApprovedItem(item.id));
      }
    }
    
    return results;
  }

  /**
   * Get statistics about flagged items
   */
  public getStats(): FlaggingStats {
    const items = Array.from(this.flaggedItems.values());
    
    const bySourceType: Record<KnowledgeSourceType, number> = {
      conversation: 0,
      file: 0,
      market_scan: 0,
      manual_entry: 0,
      web_search: 0
    };
    
    const byKnowledgeType: Record<SuggestedKnowledgeType, number> = {
      concept: 0,
      principle: 0,
      framework: 0,
      research: 0,
      relationship: 0
    };
    
    let pendingItems = 0;
    let approvedItems = 0;
    let rejectedItems = 0;
    
    for (const item of items) {
      bySourceType[item.sourceType]++;
      byKnowledgeType[item.suggestedType]++;
      
      if (item.status === 'pending') pendingItems++;
      else if (item.status === 'approved') approvedItems++;
      else if (item.status === 'rejected') rejectedItems++;
    }
    
    // Get the 5 most recently flagged items
    const recentlyFlagged = items
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
    
    return {
      totalItems: items.length,
      pendingItems,
      approvedItems,
      rejectedItems,
      bySourceType,
      byKnowledgeType,
      recentlyFlagged
    };
  }

  /**
   * Extract knowledge from text using LLM
   */
  private async extractKnowledgeFromText(
    text: string,
    sourceType: KnowledgeSourceType,
    context: string = ''
  ): Promise<{
    title: string;
    content: string;
    suggestedType: SuggestedKnowledgeType;
    suggestedCategory: string;
    suggestedSubcategory?: string;
    confidence: number;
    suggestedProperties: SuggestedKnowledgeProperties;
    suggestedRelationships?: SuggestedRelationship[];
  } | null> {
    // Use OpenAI to extract knowledge
    try {
      // Get existing knowledge categories from the graph
      const knowledgeSummary = this.knowledgeGraph.getSummary();
      const existingCategories = knowledgeSummary.categories.join(', ');
      
      const prompt = `
You are an expert knowledge curator for a ${this.knowledgeGraph.getDomain()} knowledge graph. 
Your task is to identify and extract valuable knowledge from the given text that would be worth adding to the knowledge base.

Knowledge should be:
1. Factual and accurate
2. Relevant to ${this.knowledgeGraph.getDomain()}
3. Significant enough to be worth storing
4. Not obvious or trivial
5. Generalizable (not just applicable to one specific case)

Context: ${context}

Existing knowledge categories: ${existingCategories || 'None yet'}

Source text:
${text.length > 4000 ? text.substring(0, 4000) + '...' : text}

If you don't find any valuable knowledge to extract, return {"found": false}.

If you find valuable knowledge, analyze it and return a structured JSON with:
{
  "found": true,
  "title": "Brief descriptive title for this knowledge",
  "content": "Concise summary of the knowledge",
  "suggestedType": "concept | principle | framework | research | relationship",
  "suggestedCategory": "Suggested category (can use existing or propose new)",
  "suggestedSubcategory": "Optional subcategory",
  "confidence": 0.1-1.0, // How confident are you this is valuable knowledge
  "reasoning": "Explain why this is valuable knowledge",
  "suggestedProperties": {
    // For concept
    "type": "concept",
    "name": "Name of concept",
    "description": "Detailed description"
  }, // OR for principle, framework, research, relationship with appropriate properties
  "suggestedRelationships": [
    {
      "sourceConceptName": "This concept", 
      "targetConceptName": "Related concept",
      "relationshipType": "influences | contains | implements | related | opposite",
      "description": "How they relate",
      "strength": 0.1-1.0
    }
  ]
}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a knowledge extraction system that identifies valuable knowledge to add to a domain-specific knowledge graph." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content);
      
      // Return null if no valuable knowledge was found
      if (!parsed.found) {
        return null;
      }

      return {
        title: parsed.title,
        content: parsed.content,
        suggestedType: parsed.suggestedType,
        suggestedCategory: parsed.suggestedCategory,
        suggestedSubcategory: parsed.suggestedSubcategory,
        confidence: parsed.confidence,
        suggestedProperties: parsed.suggestedProperties,
        suggestedRelationships: parsed.suggestedRelationships || []
      };
    } catch (error) {
      console.error('Error extracting knowledge from text:', error);
      return null;
    }
  }

  /**
   * Process a concept item
   */
  private async processConceptItem(item: FlaggedKnowledgeItem): Promise<void> {
    const properties = item.suggestedProperties as SuggestedConceptProperties;
    
    if (properties.type !== 'concept') {
      throw new Error('Item properties are not for a concept');
    }
    
    // Add the concept to the knowledge graph
    const conceptId = this.knowledgeGraph.addConcept({
      name: properties.name,
      description: properties.description,
      category: item.suggestedCategory,
      subcategory: item.suggestedSubcategory,
      relatedConcepts: properties.relatedConcepts || [],
      metadata: {
        sourceType: item.sourceType,
        sourceReference: item.sourceReference,
        flaggedItemId: item.id,
        addedAt: new Date().toISOString()
      }
    });
    
    // Process suggested relationships if any
    if (item.suggestedRelationships && item.suggestedRelationships.length > 0) {
      await this.processRelationships(conceptId, item.suggestedRelationships);
    }
    
    // Save the knowledge graph
    await this.knowledgeGraph.save();
  }

  /**
   * Process a principle item
   */
  private async processPrincipleItem(item: FlaggedKnowledgeItem): Promise<void> {
    const properties = item.suggestedProperties as SuggestedPrincipleProperties;
    
    if (properties.type !== 'principle') {
      throw new Error('Item properties are not for a principle');
    }
    
    // Add the principle to the knowledge graph
    this.knowledgeGraph.addPrinciple({
      name: properties.name,
      description: properties.description,
      category: item.suggestedCategory,
      importance: properties.importance,
      // Store examples in metadata to maintain the information
      metadata: {
        sourceType: item.sourceType,
        sourceReference: item.sourceReference,
        flaggedItemId: item.id,
        addedAt: new Date().toISOString(),
        examples: properties.examples
      }
    });
    
    // Save the knowledge graph
    await this.knowledgeGraph.save();
  }

  /**
   * Process a framework item
   */
  private async processFrameworkItem(item: FlaggedKnowledgeItem): Promise<void> {
    const properties = item.suggestedProperties as SuggestedFrameworkProperties;
    
    if (properties.type !== 'framework') {
      throw new Error('Item properties are not for a framework');
    }
    
    // Add the framework to the knowledge graph
    this.knowledgeGraph.addFramework({
      name: properties.name,
      description: properties.description,
      // Ensure each step has an id
      steps: properties.steps.map(step => ({
        id: `step_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        name: step.name,
        description: step.description,
        order: step.order
      })),
      principles: [], // Empty principles array
      category: item.suggestedCategory,
      metadata: {
        sourceType: item.sourceType,
        sourceReference: item.sourceReference,
        flaggedItemId: item.id,
        addedAt: new Date().toISOString()
      }
    });
    
    // Save the knowledge graph
    await this.knowledgeGraph.save();
  }

  /**
   * Process a research item
   */
  private async processResearchItem(item: FlaggedKnowledgeItem): Promise<void> {
    const properties = item.suggestedProperties as SuggestedResearchProperties;
    
    if (properties.type !== 'research') {
      throw new Error('Item properties are not for research');
    }
    
    // Add the research to the knowledge graph
    this.knowledgeGraph.addResearch({
      title: properties.title,
      abstract: properties.content || "", // Use content as abstract
      findings: [], // Initialize empty findings
      authors: [],  // Initialize empty authors
      year: properties.year,
      source: properties.source,
      relatedConcepts: [], // Empty related concepts
      category: item.suggestedCategory,
      relevance: properties.relevance,
      url: properties.url,
      metadata: {
        sourceType: item.sourceType,
        sourceReference: item.sourceReference,
        flaggedItemId: item.id,
        addedAt: new Date().toISOString(),
        originalContent: properties.content // Store original content in metadata
      }
    });
    
    // Save the knowledge graph
    await this.knowledgeGraph.save();
  }

  /**
   * Process a relationship item
   */
  private async processRelationshipItem(item: FlaggedKnowledgeItem): Promise<void> {
    const properties = item.suggestedProperties as SuggestedRelationshipProperties;
    
    if (properties.type !== 'relationship') {
      throw new Error('Item properties are not for a relationship');
    }
    
    // Try to find the source and target concepts in the knowledge graph
    const sourceConcepts = this.knowledgeGraph.findConcepts(properties.sourceConceptName);
    const targetConcepts = this.knowledgeGraph.findConcepts(properties.targetConceptName);
    
    if (sourceConcepts.length === 0) {
      throw new Error(`Source concept '${properties.sourceConceptName}' not found`);
    }
    
    if (targetConcepts.length === 0) {
      throw new Error(`Target concept '${properties.targetConceptName}' not found`);
    }
    
    // Use the first matching concept for each
    const sourceConcept = sourceConcepts[0];
    const targetConcept = targetConcepts[0];
    
    // Add the relationship to the knowledge graph
    this.knowledgeGraph.addRelationship({
      source: sourceConcept.id,
      target: targetConcept.id,
      type: properties.relationshipType,
      description: properties.description,
      strength: properties.strength,
      metadata: {
        sourceType: item.sourceType,
        sourceReference: item.sourceReference,
        flaggedItemId: item.id,
        addedAt: new Date().toISOString()
      }
    });
    
    // Save the knowledge graph
    await this.knowledgeGraph.save();
  }

  /**
   * Process suggested relationships
   */
  private async processRelationships(
    conceptId: string, 
    relationships: SuggestedRelationship[]
  ): Promise<void> {
    for (const relationship of relationships) {
      // Find target concept
      const targetConcepts = this.knowledgeGraph.findConcepts(relationship.targetConceptName);
      
      if (targetConcepts.length > 0) {
        // Add relationship to the first matching target concept
        this.knowledgeGraph.addRelationship({
          source: conceptId,
          target: targetConcepts[0].id,
          type: relationship.relationshipType,
          description: relationship.description,
          strength: relationship.strength
        });
      }
    }
  }
} 