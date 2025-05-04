/**
 * Test script for the standardized memory hybrid search functionality
 * Run with: npm run memory:test-hybrid-search
 */

import fetch from 'node-fetch';
import * as chalk from 'chalk';
import * as readline from 'readline';

// Set the base URL for the API
const BASE_URL = 'http://localhost:3000/api/memory';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin as any,
  output: process.stdout as any
});

// Default search parameters
const DEFAULT_PARAMS = {
  limit: 10,
  hybridRatio: 0.7,
  minScore: 0.2
};

/**
 * Perform a hybrid search with the given query and options
 */
async function performHybridSearch(
  query: string, 
  options?: { 
    types?: string[], 
    tags?: string[], 
    limit?: number, 
    hybridRatio?: number 
  }
) {
  console.log(chalk.blue(`\nPerforming hybrid search for: "${query}"`));
  
  try {
    // Build filter if types or tags are specified
    const filter: any = {};
    
    if (options?.types && options.types.length > 0) {
      filter.must = filter.must || [];
      filter.must.push({
        key: 'type',
        match: {
          in: options.types
        }
      });
    }
    
    if (options?.tags && options.tags.length > 0) {
      filter.must = filter.must || [];
      filter.must.push({
        key: 'metadata.tags',
        match: {
          in: options.tags
        }
      });
    }
    
    // Set up request body
    const body: {
      query: string;
      limit: number;
      filter?: any;
      hybridRatio?: number;
    } = {
      query,
      limit: options?.limit || DEFAULT_PARAMS.limit,
      filter: Object.keys(filter).length > 0 ? filter : undefined
    };
    
    // Add hybridRatio if specified
    if (options?.hybridRatio !== undefined) {
      body.hybridRatio = options.hybridRatio;
    }
    
    console.log(chalk.gray(`Request body: ${JSON.stringify(body, null, 2)}`));
    
    // Make the API request
    const response = await fetch(`${BASE_URL}/hybrid-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    
    if (!data.results || !Array.isArray(data.results)) {
      console.log(chalk.yellow('No results found or invalid response format.'));
      return;
    }
    
    // Display results
    console.log(chalk.green(`\nFound ${data.results.length} results:`));
    
    if (data.results.length === 0) {
      console.log(chalk.yellow('No matches found for this query.'));
      return;
    }
    
    // Print each result with relevant information
    data.results.forEach((result: any, index: number) => {
      const { point, score } = result;
      const memory = point.payload;
      
      console.log(chalk.white(`\n--- Result ${index + 1} (score: ${chalk.cyan(score.toFixed(3))}) ---`));
      console.log(chalk.white(`ID: ${point.id.substring(0, 12)}...`));
      console.log(chalk.white(`Type: ${memory.type}`));
      console.log(chalk.white(`Date: ${new Date(memory.timestamp).toLocaleString()}`));
      
      if (memory.metadata?.tags && memory.metadata.tags.length > 0) {
        console.log(chalk.white(`Tags: ${memory.metadata.tags.join(', ')}`));
      }
      
      // Display text content, highlighting the query terms
      const text = memory.text || 'No content';
      const lines = text.split('\n');
      const snippet = lines.length > 5 ? lines.slice(0, 5).join('\n') + '\n...' : text;
      
      console.log(chalk.white('Content:'));
      console.log(chalk.gray(highlightQuery(snippet, query)));
    });
    
    console.log(chalk.blue('\nSearch completed successfully.'));
    
  } catch (error) {
    console.error(chalk.red('Error performing search:'), error);
  }
}

/**
 * Highlight query terms in text
 */
function highlightQuery(text: string, query: string): string {
  // Split query into terms and filter out empty ones
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  
  let result = text;
  
  // Highlight each term
  terms.forEach(term => {
    if (term.length > 2) {  // Skip very short terms
      const regex = new RegExp(escapeRegExp(term), 'gi');
      result = result.replace(regex, chalk.yellow('$&'));
    }
  });
  
  return result;
}

/**
 * Escape special regex characters for safe use in RegExp
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Interactive CLI for testing hybrid search
 */
async function interactiveSearch() {
  console.log(chalk.blue('=== Memory System Hybrid Search Tester ==='));
  console.log(chalk.gray('Type "exit" to quit the program\n'));
  
  // Start the interactive search loop
  await promptForSearch();
}

/**
 * Prompt for search query and options
 */
async function promptForSearch() {
  function ask(question: string): Promise<string> {
    return new Promise(resolve => {
      rl.question(question, resolve);
    });
  }
  
  try {
    // Get search query
    const query = await ask(chalk.green('Enter search query: '));
    
    if (query.toLowerCase() === 'exit') {
      console.log(chalk.blue('\nExiting search tester. Goodbye!'));
      rl.close();
      return;
    }
    
    // Get optional parameters
    const typesInput = await ask(chalk.green('Filter by memory types (comma-separated, or leave empty): '));
    const tagsInput = await ask(chalk.green('Filter by tags (comma-separated, or leave empty): '));
    const limitInput = await ask(chalk.green(`Result limit (default: ${DEFAULT_PARAMS.limit}): `));
    const ratioInput = await ask(chalk.green(`Hybrid ratio (0.0-1.0, default: ${DEFAULT_PARAMS.hybridRatio}): `));
    
    // Parse inputs
    const types = typesInput ? typesInput.split(',').map(s => s.trim()).filter(Boolean) : [];
    const tags = tagsInput ? tagsInput.split(',').map(s => s.trim()).filter(Boolean) : [];
    const limit = limitInput ? parseInt(limitInput, 10) : DEFAULT_PARAMS.limit;
    const hybridRatio = ratioInput ? parseFloat(ratioInput) : DEFAULT_PARAMS.hybridRatio;
    
    // Perform search
    await performHybridSearch(query, { types, tags, limit, hybridRatio });
    
    // Continue with next search
    await promptForSearch();
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    await promptForSearch();
  }
}

// Start the interactive search
interactiveSearch().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  rl.close();
  process.exit(1);
}); 