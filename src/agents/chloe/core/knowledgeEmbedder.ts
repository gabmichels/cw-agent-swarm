import { KnowledgeLoader, KnowledgeContent } from './knowledgeLoader';
import { AGENT_CONFIGS, AgentConfig } from '../types/agent';

interface EmbeddingOptions {
  includeCompany?: boolean;
  includeDomains?: string[];
  includeAgent?: string;
  maxTokens?: number;
}

export class KnowledgeEmbedder {
  private knowledgeLoader: KnowledgeLoader;

  constructor(knowledgeLoader: KnowledgeLoader) {
    this.knowledgeLoader = knowledgeLoader;
  }

  /**
   * Embed knowledge for a specific agent automatically
   */
  async embedKnowledgeForAgent(agentId: string, request: string, maxTokens: number = 4000): Promise<string> {
    const agentConfig = AGENT_CONFIGS[agentId];
    
    if (!agentConfig) {
      console.warn(`No configuration found for agent ${agentId}, using default knowledge embedding`);
      return this.embedKnowledge(request, { maxTokens });
    }
    
    return this.embedKnowledge(request, {
      includeCompany: true,
      includeDomains: agentConfig.departments,
      includeAgent: agentId,
      maxTokens
    });
  }

  /**
   * Embed relevant knowledge into a request
   */
  async embedKnowledge(request: string, options: EmbeddingOptions = {}): Promise<string> {
    const {
      includeCompany = true,
      includeDomains = [],
      includeAgent,
      maxTokens = 4000
    } = options;

    let knowledgeContent: KnowledgeContent[] = [];

    // Add company knowledge if requested
    if (includeCompany) {
      knowledgeContent = knowledgeContent.concat(
        this.knowledgeLoader.getKnowledge('company')
      );
    }

    // Add domain-specific knowledge
    for (const domain of includeDomains) {
      knowledgeContent = knowledgeContent.concat(
        this.knowledgeLoader.getDomainKnowledge(domain)
      );
    }

    // Add agent-specific knowledge
    if (includeAgent) {
      knowledgeContent = knowledgeContent.concat(
        this.knowledgeLoader.getKnowledge('agents', includeAgent)
      );
    }

    // Format knowledge content
    const formattedKnowledge = this.formatKnowledge(knowledgeContent);

    // Combine with original request
    return this.combineRequestAndKnowledge(request, formattedKnowledge, maxTokens);
  }

  /**
   * Format knowledge content for embedding
   */
  private formatKnowledge(knowledge: KnowledgeContent[]): string {
    return knowledge.map(item => {
      const header = `# ${item.category}/${item.subcategory}/${item.filename}`;
      return `${header}\n${item.content}`;
    }).join('\n\n');
  }

  /**
   * Combine request and knowledge while respecting token limits
   */
  private combineRequestAndKnowledge(
    request: string,
    knowledge: string,
    maxTokens: number
  ): string {
    // Simple token estimation (rough approximation)
    const requestTokens = this.estimateTokens(request);
    const knowledgeTokens = this.estimateTokens(knowledge);
    const availableTokens = maxTokens - requestTokens;

    if (knowledgeTokens <= availableTokens) {
      return `${request}\n\nRelevant Knowledge:\n${knowledge}`;
    }

    // If knowledge is too large, truncate it
    const truncatedKnowledge = this.truncateKnowledge(knowledge, availableTokens);
    return `${request}\n\nRelevant Knowledge (truncated):\n${truncatedKnowledge}`;
  }

  /**
   * Estimate number of tokens in a string
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate knowledge to fit within token limit
   */
  private truncateKnowledge(knowledge: string, maxTokens: number): string {
    const estimatedChars = maxTokens * 4;
    return knowledge.slice(0, estimatedChars) + '...';
  }
} 