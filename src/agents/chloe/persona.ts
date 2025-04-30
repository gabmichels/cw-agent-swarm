// Replace with proper TypeScript imports
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for persona components
 */
export interface PersonaConfig {
  manifestoPath?: string;
  backgroundPath?: string;
  personalityPath?: string;
  dataDir?: string;
}

export interface PersonaTrait {
  name: string;
  description: string;
  importance: number; // 1-10 scale
  content: string;
}

export interface PersonaOptions {
  basePath?: string;
  defaultTraits?: PersonaTrait[];
}

/**
 * Class to handle Chloe's persona
 */
export class Persona {
  private manifesto: string = '';
  private background: string = '';
  private personality: string = '';
  private systemPrompt: string = '';
  private dataDir: string;
  private traits: PersonaTrait[] = [];
  private basePath: string;
  private initialized: boolean = false;

  constructor(config?: PersonaConfig, options: PersonaOptions = {}) {
    // Use absolute paths by starting from the workspace root
    const workspaceRoot = path.resolve(process.cwd());
    
    // Set default data directory - look in project root first, then in current dir
    this.dataDir = config?.dataDir || 
      (fs.existsSync(path.join(workspaceRoot, 'data', 'memory')) 
        ? path.join(workspaceRoot, 'data', 'memory')
        : path.join(process.cwd(), 'data', 'memory'));
    
    // Set persona directory - look in src/persona first, then root, then current dir
    this.basePath = options.basePath || 
      (fs.existsSync(path.join(workspaceRoot, 'src', 'persona')) 
        ? path.join(workspaceRoot, 'src', 'persona')
        : (fs.existsSync(path.join(workspaceRoot, 'persona')) 
            ? path.join(workspaceRoot, 'persona')
            : path.join(process.cwd(), 'persona')));
    
    console.log('Persona data directory:', this.dataDir);
    console.log('Persona base path:', this.basePath);
    
    if (options.defaultTraits) {
      this.traits = [...options.defaultTraits];
    }
  }

  /**
   * Load persona files and construct the system prompt
   */
  async loadPersona(config?: PersonaConfig): Promise<string> {
    try {
      console.log('Loading Chloe persona files...');
      
      // Set file paths using config or defaults
      const manifestoPath = config?.manifestoPath || path.join(this.dataDir, 'manifesto.md');
      const backgroundPath = config?.backgroundPath || path.join(this.dataDir, 'background.md');
      const personalityPath = config?.personalityPath || path.join(this.dataDir, 'personality.md');
      
      console.log('Looking for manifesto at:', manifestoPath);
      console.log('Looking for background at:', backgroundPath);
      console.log('Looking for personality at:', personalityPath);
      
      // Create directory if it doesn't exist
      await this.ensureDirectoryExists(this.dataDir);
      
      // Load manifesto file or create default if it doesn't exist
      if (fs.existsSync(manifestoPath)) {
        this.manifesto = fs.readFileSync(manifestoPath, 'utf-8');
        console.log('Loaded manifesto file successfully');
      } else {
        this.manifesto = this.createDefaultManifesto();
        fs.writeFileSync(manifestoPath, this.manifesto);
        console.log('Created default manifesto file');
      }
      
      // Load background file or create default if it doesn't exist
      if (fs.existsSync(backgroundPath)) {
        this.background = fs.readFileSync(backgroundPath, 'utf-8');
        console.log('Loaded background file successfully');
      } else {
        this.background = this.createDefaultBackground();
        fs.writeFileSync(backgroundPath, this.background);
        console.log('Created default background file');
      }
      
      // Load personality file or create default if it doesn't exist
      if (fs.existsSync(personalityPath)) {
        this.personality = fs.readFileSync(personalityPath, 'utf-8');
        console.log('Loaded personality file successfully');
      } else {
        this.personality = this.createDefaultPersonality();
        fs.writeFileSync(personalityPath, this.personality);
        console.log('Created default personality file');
      }
      
      // Load traits from persona directory if not already initialized
      if (!this.initialized) {
        await this.initialize();
        console.log(`Loaded ${this.traits.length} personality traits from persona directory`);
      }
      
      // Construct the system prompt from all persona components
      this.systemPrompt = this.constructSystemPrompt();
      
      return this.systemPrompt;
    } catch (error) {
      console.error('Error loading persona files:', error);
      
      // Fallback to default system prompt
      this.systemPrompt = this.constructSystemPrompt(true);
      return this.systemPrompt;
    }
  }
  
  /**
   * Get the full system prompt
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }
  
  /**
   * Get a specific component of the persona
   */
  getComponent(component: 'manifesto' | 'background' | 'personality'): string {
    switch (component) {
      case 'manifesto':
        return this.manifesto;
      case 'background':
        return this.background;
      case 'personality':
        return this.personality;
      default:
        return '';
    }
  }
  
  /**
   * Create a combined system prompt from all persona components
   */
  private constructSystemPrompt(useDefaults: boolean = false): string {
    const manifesto = useDefaults ? this.createDefaultManifesto() : this.manifesto;
    const background = useDefaults ? this.createDefaultBackground() : this.background;
    const personality = useDefaults ? this.createDefaultPersonality() : this.personality;
    
    // Get high importance traits
    const importantTraits = this.getTraitsByImportance(8); // Only traits with importance 8-10
    let traitsSection = '';
    
    if (importantTraits.length > 0) {
      traitsSection = "\n\n## Core Traits\n";
      importantTraits.forEach(trait => {
        traitsSection += `### ${trait.name}\n${trait.content.split('\n').slice(1).join('\n')}\n\n`;
      });
    }
    
    return `# Chloe - Chief Marketing Officer

## Background and Expertise
${background}

## Goals and Principles
${manifesto}

## Personality and Communication Style
${personality}${traitsSection}

## Instructions
- You are a professional marketing executive (CMO), NOT an assistant
- Speak as a trusted strategic partner, not as an AI helper
- Draw from your extensive marketing expertise and 15+ years of experience
- Provide strategic, data-driven, and actionable marketing advice
- When uncertain, acknowledge limitations rather than inventing information
- Think step-by-step when solving complex problems
- Always maintain your professional marketing executive persona
- All of your advice should align with the brand guidelines and marketing goals
`;
  }
  
  /**
   * Create default directory structure
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  }
  
  /**
   * Create default manifesto content
   */
  private createDefaultManifesto(): string {
    return `# Chloe's Manifesto

## My Purpose
I exist to help marketers and business professionals achieve their goals through expert marketing guidance, strategic planning, and creative problem-solving.

## My Goals
1. Provide actionable, expert-level marketing advice
2. Help users develop effective marketing strategies
3. Stay current with marketing trends and best practices
4. Offer creative solutions to marketing challenges
5. Maintain ethical standards in all recommendations

## My Principles
- Evidence-based recommendations
- User-centric approach
- Continuous learning and improvement
- Ethical marketing practices
- Clarity and transparency in communication
- Respect for user privacy and data
`;
  }
  
  /**
   * Create default background content
   */
  private createDefaultBackground(): string {
    return `I am Chloe, a Chief Marketing Officer with 15+ years of experience in digital marketing. My expertise includes:

- Digital Marketing: SEO, SEM, social media, email, content marketing
- Brand Strategy: Positioning, messaging, brand identity
- Market Research: Consumer insights, competitive analysis
- Content Strategy: Content planning, creation, distribution
- Performance Marketing: Analytics, optimization, conversion
- Marketing Technology: MarTech stack, automation, CRM
- Campaign Management: Planning, execution, measurement
- Customer Experience: Journey mapping, touchpoint optimization

I have an MBA from Stanford University and previously led marketing at two successful tech startups. I stay current with marketing trends and best practices by continuously learning from industry sources, case studies, and research papers.
`;
  }
  
  /**
   * Create default personality content
   */
  private createDefaultPersonality(): string {
    return `As Chloe, I communicate with a distinct personality that is:

- Professional and strategic - I am a marketing executive, not an assistant
- Analytical but creative - I balance data with innovative thinking
- Confident and authoritative - I speak from experience and expertise
- Direct and efficient - I provide clear, actionable insights
- Thoughtful and customer-centric - I focus on meaningful results
- Forward-thinking - I anticipate trends and strategic opportunities

My tone is professional, clear, and sharp. I speak as a trusted partner, use relevant marketing examples, translate complex concepts into accessible language, and ask thoughtful questions to understand challenges.
`;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Ensure the persona directory exists
      if (!fs.existsSync(this.basePath)) {
        fs.mkdirSync(this.basePath, { recursive: true });
        console.log(`Created persona directory at ${this.basePath}`);
        
        // Create a default persona file if none exist
        this.createDefaultPersonaFile();
      }

      // Load all .md files in the persona directory
      await this.loadTraitsFromDirectory();
      
      this.initialized = true;
      console.log(`Persona initialized with ${this.traits.length} traits`);
    } catch (error) {
      console.error('Error initializing persona:', error);
      throw new Error('Failed to initialize persona');
    }
  }

  private createDefaultPersonaFile(): void {
    const defaultContent = `# Chloe - Chief Marketing Officer
importance: 10

Chloe is a professional marketing executive with the following core traits:

- Strategic thinker with 15+ years of experience
- Data-driven decision maker
- Customer-focused marketer
- Innovative problem solver
- Clear and effective communicator
`;

    const filePath = path.join(this.basePath, 'core.md');
    fs.writeFileSync(filePath, defaultContent);
    console.log(`Created default persona file at ${filePath}`);
  }

  private async loadTraitsFromDirectory(): Promise<void> {
    try {
      console.log('Looking for persona traits in directory:', this.basePath);
      if (!fs.existsSync(this.basePath)) {
        console.log('Persona directory does not exist:', this.basePath);
        return;
      }
      
      const files = fs.readdirSync(this.basePath);
      console.log('Found files in persona directory:', files);
      
      const markdownFiles = files.filter(file => file.endsWith('.md'));
      console.log('Markdown files found:', markdownFiles);
      
      for (const file of markdownFiles) {
        const filePath = path.join(this.basePath, file);
        console.log('Reading trait file:', filePath);
        
        const content = fs.readFileSync(filePath, 'utf-8');
        
        const trait = this.parseTraitFromMarkdown(content, file);
        if (trait) {
          this.traits.push(trait);
          console.log(`Loaded trait: ${trait.name} (importance: ${trait.importance})`);
        }
      }
      
      // Sort traits by importance (highest first)
      this.traits.sort((a, b) => b.importance - a.importance);
    } catch (error) {
      console.error('Error loading traits from directory:', error);
    }
  }

  private parseTraitFromMarkdown(content: string, filename: string): PersonaTrait | null {
    try {
      // Extract name from the first heading
      const nameMatch = content.match(/^#\s+(.+?)(?:\r?\n|$)/);
      const name = nameMatch ? nameMatch[1].trim() : path.basename(filename, '.md');
      
      // Extract importance if specified
      const importanceMatch = content.match(/importance:\s*(\d+)/i);
      const importance = importanceMatch ? parseInt(importanceMatch[1], 10) : 5;
      
      // Extract description (optional)
      const descriptionMatch = content.match(/^##\s+Description\s*\r?\n([\s\S]+?)(?=\r?\n##|$)/mi);
      const description = descriptionMatch 
        ? descriptionMatch[1].trim() 
        : content.split('\n').slice(1).join('\n').trim();
      
      return {
        name,
        description: description.substring(0, 100) + (description.length > 100 ? '...' : ''),
        importance: Math.min(Math.max(importance, 1), 10), // Ensure between 1-10
        content
      };
    } catch (error) {
      console.error(`Error parsing trait from file ${filename}:`, error);
      return null;
    }
  }

  /**
   * Get all loaded personality traits
   */
  getTraits(): PersonaTrait[] {
    return [...this.traits];
  }
  
  /**
   * Get traits filtered by importance level
   */
  getTraitsByImportance(minImportance: number = 1): PersonaTrait[] {
    return this.traits.filter(trait => trait.importance >= minImportance);
  }
  
  /**
   * Get a system prompt that incorporates all traits
   */
  generateSystemPrompt(minImportance: number = 5): string {
    const relevantTraits = this.getTraitsByImportance(minImportance);
    
    let systemPrompt = "You are Chloe, a Chief Marketing Officer with the following traits:\n\n";
    
    relevantTraits.forEach(trait => {
      systemPrompt += `# ${trait.name}\n${trait.content.split('\n').slice(1).join('\n')}\n\n`;
    });
    
    return systemPrompt;
  }
  
  /**
   * Add a new trait or update an existing one
   */
  addOrUpdateTrait(trait: PersonaTrait): void {
    const existingIndex = this.traits.findIndex(t => t.name === trait.name);
    
    if (existingIndex >= 0) {
      this.traits[existingIndex] = trait;
    } else {
      this.traits.push(trait);
    }
    
    // Resort by importance
    this.traits.sort((a, b) => b.importance - a.importance);
    
    // Save to file if initialized
    if (this.initialized) {
      this.saveTrait(trait);
    }
  }
  
  /**
   * Save a trait to disk
   */
  private saveTrait(trait: PersonaTrait): void {
    try {
      // Convert to kebab-case filename
      const filename = trait.name.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        + '.md';
      
      // Ensure directory exists
      if (!fs.existsSync(this.basePath)) {
        fs.mkdirSync(this.basePath, { recursive: true });
      }
      
      const filePath = path.join(this.basePath, filename);
      fs.writeFileSync(filePath, trait.content);
      console.log(`Saved trait "${trait.name}" to ${filePath}`);
    } catch (error) {
      console.error(`Error saving trait "${trait.name}":`, error);
    }
  }

  /**
   * Create a default file if it doesn't exist
   */
  createDefaultFile(file: string, defaultContent: string): void {
    if (!fs.existsSync(file)) {
      const dirPath = path.dirname(file);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(file, defaultContent, 'utf-8');
      console.log(`Created default file: ${file}`);
    }
  }
} 