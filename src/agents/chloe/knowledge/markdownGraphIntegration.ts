/**
 * Markdown Knowledge Graph Integration
 * 
 * This module handles synchronizing markdown content with the knowledge graph,
 * extracting entities, relationships and concepts from the markdown content.
 */

import { KnowledgeGraphManager, KnowledgeNode } from '../knowledge/graphManager';
import { KnowledgeNodeType, KnowledgeEdgeType } from './graph';
import * as yaml from 'yaml';
import { marked } from 'marked';

/**
 * Options for the markdown graph integration
 */
export interface MarkdownGraphSyncOptions {
  /**
   * The file path to process
   */
  filePath: string;
  
  /**
   * The content of the markdown file
   */
  content: string;
  
  /**
   * Optional logger function
   */
  logFunction?: (message: string, data?: any) => void;
}

/**
 * Interface for extracted frontmatter from Markdown
 */
interface MarkdownFrontmatter {
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  type?: string;
  importance?: string;
  source?: string;
  [key: string]: any;
}

/**
 * Result of graph synchronization
 */
export interface GraphSyncResult {
  nodesAdded: number;
  edgesAdded: number;
  nodeTypes: Record<string, number>;
  concepts: string[];
}

/**
 * Map a string node type to a valid KnowledgeNodeType
 */
function mapToValidNodeType(type: string): KnowledgeNodeType {
  const validTypes: Record<string, KnowledgeNodeType> = {
    'document': 'concept',
    'section': 'concept',
    'concept': 'concept',
    'task': 'task',
    'strategy': 'strategy',
    'insight': 'insight',
    'project': 'project', 
    'agent': 'agent',
    'tool': 'tool',
    'trend': 'trend'
  };
  
  return validTypes[type] || 'concept';
}

/**
 * Map a string edge type to a valid KnowledgeEdgeType
 */
function mapToValidEdgeType(type: string): KnowledgeEdgeType {
  const validTypes: Record<string, KnowledgeEdgeType> = {
    'contains': 'related_to',
    'parent_of': 'depends_on',
    'has_concept': 'related_to',
    'related_to': 'related_to',
    'depends_on': 'depends_on',
    'contradicts': 'contradicts',
    'supports': 'supports',
    'used_by': 'used_by',
    'reported_by': 'reported_by',
    'produced_by': 'produced_by'
  };
  
  return validTypes[type] || 'related_to';
}

/**
 * Extract frontmatter from markdown content
 */
function extractFrontmatter(content: string): { frontmatter: MarkdownFrontmatter; content: string } {
  // Check if content has frontmatter
  if (!content.startsWith('---')) {
    return { frontmatter: {}, content };
  }
  
  try {
    // Find the end of frontmatter
    const endOfFrontmatter = content.indexOf('---', 3);
    if (endOfFrontmatter === -1) {
      return { frontmatter: {}, content };
    }
    
    // Extract frontmatter and parse as YAML
    const frontmatterContent = content.substring(3, endOfFrontmatter).trim();
    const frontmatter = yaml.parse(frontmatterContent) || {};
    
    // Extract remaining content
    const remainingContent = content.substring(endOfFrontmatter + 3).trim();
    
    return { frontmatter, content: remainingContent };
  } catch (error) {
    console.error('Error parsing frontmatter:', error);
    return { frontmatter: {}, content };
  }
}

/**
 * Parse markdown headings to extract structure
 */
function extractSections(content: string): { title: string; content: string; level: number }[] {
  const tokens = marked.lexer(content);
  
  const sections: { title: string; content: string; level: number }[] = [];
  let currentSection: { title: string; content: string; level: number } | null = null;
  
  for (const token of tokens) {
    if (token.type === 'heading') {
      // If we have a current section, push it before starting a new one
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // Start a new section
      currentSection = {
        title: token.text,
        content: '',
        level: token.depth
      };
    } else if (currentSection) {
      // Add content to current section
      if (token.type === 'text' || token.type === 'paragraph') {
        currentSection.content += token.text + '\n';
      } else if (token.type === 'list') {
        // Handle lists
        const items = token.items.map((item: any) => `- ${item.text}`).join('\n');
        currentSection.content += items + '\n\n';
      }
    }
  }
  
  // Don't forget to add the last section
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Extract entities, concepts, and relationships from markdown content
 */
export async function extractEntitiesFromMarkdown(options: MarkdownGraphSyncOptions): Promise<{
  nodes: { type: string; id: string; label: string; description?: string; metadata?: Record<string, any> }[];
  edges: { from: string; to: string; type: string; label: string }[];
}> {
  const { filePath, content, logFunction } = options;
  const log = logFunction || ((msg, data) => console.log(msg, data));
  
  // Parse the markdown file
  const { frontmatter, content: contentWithoutFrontmatter } = extractFrontmatter(content);
  
  // Extract sections from the markdown
  const sections = extractSections(contentWithoutFrontmatter);
  
  // Build base node for the file
  const fileId = `file-${filePath.replace(/\//g, '-').replace(/\./g, '-')}`;
  const fileType = frontmatter.type || 'document';
  const fileNode = {
    type: fileType,
    id: fileId,
    label: frontmatter.title || filePath.split('/').pop() || 'Untitled',
    description: frontmatter.description || sections[0]?.content.substring(0, 200) || '',
    metadata: {
      ...frontmatter,
      filePath,
      sourceType: 'markdown',
      tags: frontmatter.tags || []
    }
  };
  
  // Build nodes for each section
  const sectionNodes = sections.map((section, index) => {
    const sectionId = `${fileId}-section-${index}`;
    return {
      type: 'section',
      id: sectionId,
      label: section.title,
      description: section.content.substring(0, 200),
      metadata: {
        filePath,
        sourceType: 'markdown',
        tags: frontmatter.tags || [],
        level: section.level,
        parentFile: fileId
      }
    };
  });
  
  // Build edges between file and sections
  const sectionEdges = sectionNodes.map((section) => ({
    from: fileId,
    to: section.id,
    type: 'contains',
    label: 'Contains section'
  }));
  
  // Build edges between sections to represent hierarchy
  const hierarchyEdges: { from: string; to: string; type: string; label: string }[] = [];
  let lastSectionByLevel: Record<number, string> = {};
  
  sections.forEach((section, index) => {
    const sectionId = `${fileId}-section-${index}`;
    
    // Connect to parent section based on heading level
    for (let level = section.level - 1; level >= 1; level--) {
      if (lastSectionByLevel[level]) {
        hierarchyEdges.push({
          from: lastSectionByLevel[level],
          to: sectionId,
          type: 'parent_of',
          label: 'Parent of'
        });
        break;
      }
    }
    
    // Update last section for this level
    lastSectionByLevel[section.level] = sectionId;
  });
  
  // Extract concepts from tags
  const conceptNodes: { type: string; id: string; label: string; description?: string; metadata?: Record<string, any> }[] = [];
  const conceptEdges: { from: string; to: string; type: string; label: string }[] = [];
  
  if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
    frontmatter.tags.forEach((tag: string) => {
      const conceptId = `concept-${tag.toLowerCase().replace(/\s+/g, '-')}`;
      
      // Add concept node
      conceptNodes.push({
        type: 'concept',
        id: conceptId,
        label: tag,
        description: `Concept extracted from tag: ${tag}`,
        metadata: {
          sourceType: 'tag',
          occurrences: 1
        }
      });
      
      // Connect file to concept
      conceptEdges.push({
        from: fileId,
        to: conceptId,
        type: 'has_concept',
        label: 'Has concept'
      });
    });
  }
  
  // Combine all nodes and edges
  const allNodes = [fileNode, ...sectionNodes, ...conceptNodes];
  const allEdges = [...sectionEdges, ...hierarchyEdges, ...conceptEdges];
  
  return { nodes: allNodes, edges: allEdges };
}

/**
 * Synchronize a markdown file with the knowledge graph
 */
export async function syncMarkdownWithGraph(options: MarkdownGraphSyncOptions): Promise<GraphSyncResult> {
  const { filePath, content, logFunction } = options;
  const log = logFunction || ((msg, data) => console.log(msg, data));
  
  log(`Synchronizing markdown file with knowledge graph: ${filePath}`);
  
  try {
    // Initialize knowledge graph manager
    const graph = new KnowledgeGraphManager();
    
    // Extract entities from the markdown
    const { nodes, edges } = await extractEntitiesFromMarkdown(options);
    
    // Track stats for result
    const nodeTypes: Record<string, number> = {};
    const concepts: string[] = [];
    
    // Add all nodes to the graph
    for (const node of nodes) {
      try {
        // Map the node type to a valid KnowledgeNodeType
        await graph.addNode({
          ...node,
          type: mapToValidNodeType(node.type)
        });
        
        // Update stats
        nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
        
        // Track concepts
        if (node.type === 'concept') {
          concepts.push(node.label);
        }
      } catch (error) {
        log(`Error adding node ${node.id} to graph:`, { error: String(error) });
      }
    }
    
    // Add all edges to the graph
    for (const edge of edges) {
      try {
        // Map the edge type to a valid KnowledgeEdgeType
        await graph.addEdge({
          ...edge,
          type: mapToValidEdgeType(edge.type)
        });
      } catch (error) {
        log(`Error adding edge from ${edge.from} to ${edge.to}:`, { error: String(error) });
      }
    }
    
    // Return stats
    return {
      nodesAdded: nodes.length,
      edgesAdded: edges.length,
      nodeTypes,
      concepts
    };
  } catch (error) {
    log(`Error synchronizing markdown with graph:`, { error: String(error) });
    throw error;
  }
} 