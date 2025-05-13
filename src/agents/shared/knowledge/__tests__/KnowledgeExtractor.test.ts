/**
 * Knowledge Extractor Tests
 * 
 * Tests for the KnowledgeExtractor utility class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultKnowledgeGraph } from '../DefaultKnowledgeGraph';
import { KnowledgeExtractor } from '../KnowledgeExtractor';
import { KnowledgeNodeType, KnowledgeEdgeType } from '../interfaces/KnowledgeGraph.interface';

describe('KnowledgeExtractor', () => {
  let graph: DefaultKnowledgeGraph;
  let extractor: KnowledgeExtractor;
  
  beforeEach(async () => {
    graph = new DefaultKnowledgeGraph();
    await graph.initialize();
    extractor = new KnowledgeExtractor(graph);
  });
  
  describe('Basic Extraction', () => {
    it('should extract concepts from text', async () => {
      const text = `
        The Theory of Relativity is a fundamental concept in physics.
        It relates to the concept of spacetime and the nature of gravity.
      `;
      
      const result = await extractor.extractKnowledge({
        content: text,
        nodeTypes: [KnowledgeNodeType.CONCEPT],
        source: 'test'
      });
      
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.nodes.some(node => node.label.includes('Theory of Relativity'))).toBe(true);
      expect(result.stats.entityCount).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });
    
    it('should extract tools from text', async () => {
      const text = `
        Python is a popular programming language for data science.
        Many developers use TypeScript framework to build web applications.
      `;
      
      const result = await extractor.extractKnowledge({
        content: text,
        nodeTypes: [KnowledgeNodeType.TOOL],
        source: 'test'
      });
      
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.nodes.some(node => 
        node.type === KnowledgeNodeType.TOOL && 
        (node.label.includes('Python') || node.label.includes('TypeScript'))
      )).toBe(true);
    });
    
    it('should extract processes from text', async () => {
      const text = `
        The development process involves multiple stages including requirements gathering,
        design, implementation, and testing. The deployment workflow requires careful planning.
      `;
      
      const result = await extractor.extractKnowledge({
        content: text,
        nodeTypes: [KnowledgeNodeType.PROCESS],
        source: 'test'
      });
      
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.nodes.some(node => 
        node.type === KnowledgeNodeType.PROCESS && 
        (node.label.includes('development process') || node.label.includes('deployment workflow'))
      )).toBe(true);
    });
  });
  
  describe('Relationship Extraction', () => {
    it('should extract relationships between entities', async () => {
      const text = `
        Machine Learning depends on Statistics for many of its methods.
        Python is widely used by Data Scientists due to its simplicity.
        The training process leads to model generation and eventually deployment.
      `;
      
      const result = await extractor.extractKnowledge({
        content: text,
        nodeTypes: [KnowledgeNodeType.CONCEPT, KnowledgeNodeType.TOOL, KnowledgeNodeType.PROCESS],
        edgeTypes: [
          KnowledgeEdgeType.DEPENDS_ON, 
          KnowledgeEdgeType.USED_BY, 
          KnowledgeEdgeType.LEADS_TO
        ],
        source: 'test'
      });
      
      expect(result.nodes.length).toBeGreaterThan(1);
      expect(result.edges.length).toBeGreaterThan(0);
      
      // Verify that at least one of the expected relationship types is found
      const foundRelationships = result.edges.map(edge => edge.type);
      const hasExpectedRelationship = [
        KnowledgeEdgeType.DEPENDS_ON, 
        KnowledgeEdgeType.USED_BY, 
        KnowledgeEdgeType.LEADS_TO
      ].some(type => foundRelationships.includes(type));
      
      expect(hasExpectedRelationship).toBe(true);
    });
  });
  
  describe('Configuration Options', () => {
    it('should respect confidence threshold', async () => {
      const text = `
        Machine Learning is a branch of Artificial Intelligence.
        Natural Language Processing is used in many applications.
        Computer Vision focuses on image recognition tasks.
      `;
      
      // Create an extractor with a very high confidence threshold
      const highConfidenceExtractor = new KnowledgeExtractor(graph, {
        minConfidence: 0.99
      });
      
      const result = await highConfidenceExtractor.extractKnowledge({
        content: text,
        nodeTypes: [KnowledgeNodeType.CONCEPT],
        source: 'test'
      });
      
      // Should extract no entities due to high threshold
      expect(result.nodes).toHaveLength(0);
      
      // Now try with a lower threshold
      const lowConfidenceExtractor = new KnowledgeExtractor(graph, {
        minConfidence: 0.1
      });
      
      const lowThresholdResult = await lowConfidenceExtractor.extractKnowledge({
        content: text,
        nodeTypes: [KnowledgeNodeType.CONCEPT],
        source: 'test'
      });
      
      // Should extract some entities with the lower threshold
      expect(lowThresholdResult.nodes.length).toBeGreaterThan(0);
    });
    
    it('should limit the number of extracted nodes', async () => {
      const text = `
        In computer science: Algorithm design, Data structures, Computational complexity,
        Compiler theory, Operating systems, Computer networks, Database systems,
        Artificial intelligence, Machine learning, Computer graphics, Cryptography,
        Software engineering, Human-computer interaction, Computer security,
        Distributed systems, Parallel computing, Quantum computing, Robotics,
        Natural language processing, Computer vision, and Game theory are all important concepts.
      `;
      
      // Create an extractor with a low node limit
      const limitedExtractor = new KnowledgeExtractor(graph, {
        maxNodes: 3
      });
      
      const result = await limitedExtractor.extractKnowledge({
        content: text,
        nodeTypes: [KnowledgeNodeType.CONCEPT],
        source: 'test'
      });
      
      // Should respect the node limit
      expect(result.nodes.length).toBeLessThanOrEqual(3);
      
      // Now try with a higher limit
      const unlimitedExtractor = new KnowledgeExtractor(graph, {
        maxNodes: 50
      });
      
      const unlimitedResult = await unlimitedExtractor.extractKnowledge({
        content: text,
        nodeTypes: [KnowledgeNodeType.CONCEPT],
        source: 'test'
      });
      
      // Should extract more entities
      expect(unlimitedResult.nodes.length).toBeGreaterThan(3);
    });
  });
  
  describe('Graph Integration', () => {
    it('should add extracted knowledge to the graph', async () => {
      // Get initial node count
      const initialVisData = graph.getVisualizationData();
      const initialNodeCount = initialVisData.nodes.length;
      
      // Extract knowledge with autoAddToGraph enabled
      const extractor = new KnowledgeExtractor(graph, {
        autoAddToGraph: true
      });
      
      const text = `
        Software Engineering is a systematic approach to software development.
        It encompasses various methodologies such as Agile and Waterfall.
        Testing frameworks are essential tools for ensuring software quality.
      `;
      
      await extractor.extractKnowledge({
        content: text,
        nodeTypes: [KnowledgeNodeType.CONCEPT, KnowledgeNodeType.PROCESS, KnowledgeNodeType.TOOL],
        source: 'test'
      });
      
      // Check that nodes were added to the graph
      const updatedVisData = graph.getVisualizationData();
      expect(updatedVisData.nodes.length).toBeGreaterThan(initialNodeCount);
      
      // Verify that we can query for the added nodes
      const softwareEngineeringNodes = await graph.findNodes('Software Engineering');
      expect(softwareEngineeringNodes.length).toBeGreaterThan(0);
      
      // Check that a tool node was added
      const toolNodes = await graph.findNodes('', { 
        nodeTypes: [KnowledgeNodeType.TOOL] 
      });
      expect(toolNodes.length).toBeGreaterThan(0);
    });
    
    it('should not add to graph when autoAddToGraph is disabled', async () => {
      // Get initial node count
      const initialVisData = graph.getVisualizationData();
      const initialNodeCount = initialVisData.nodes.length;
      
      // Create extractor with autoAddToGraph disabled
      const noAddExtractor = new KnowledgeExtractor(graph, {
        autoAddToGraph: false
      });
      
      const text = `
        Data Science is an interdisciplinary field that uses scientific methods,
        processes, algorithms and systems to extract knowledge from data.
      `;
      
      const result = await noAddExtractor.extractKnowledge({
        content: text,
        nodeTypes: [KnowledgeNodeType.CONCEPT, KnowledgeNodeType.PROCESS],
        source: 'test'
      });
      
      // Verify entities were extracted but not added to graph
      expect(result.nodes.length).toBeGreaterThan(0);
      
      // Check that graph remains unchanged
      const updatedVisData = graph.getVisualizationData();
      expect(updatedVisData.nodes.length).toBe(initialNodeCount);
      
      // Verify that we cannot query for the extracted nodes
      const dataScienceNodes = await graph.findNodes('Data Science');
      expect(dataScienceNodes).toHaveLength(0);
    });
  });
}); 