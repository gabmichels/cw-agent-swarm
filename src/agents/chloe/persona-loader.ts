import fs from 'fs';
import path from 'path';

export interface PersonaTraits {
  name: string;
  personality: string[];
  backgroundStory: string;
  interests: string[];
  strengths: string[];
  weaknesses: string[];
  communicationStyle: string;
}

export interface Persona {
  traits: PersonaTraits;
  systemPrompt: string;
  examples: ExampleInteraction[];
}

export interface ExampleInteraction {
  user: string;
  agent: string;
  explanation?: string;
}

/**
 * PersonaLoader loads and parses persona files to define an agent's personality
 */
export class PersonaLoader {
  /**
   * Load a persona from a markdown file
   */
  static loadFromFile(filePath: string): Persona {
    try {
      const fullPath = path.resolve(filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      return PersonaLoader.parsePersonaMarkdown(content);
    } catch (error) {
      console.error(`Error loading persona file: ${error}`);
      return PersonaLoader.getDefaultPersona();
    }
  }

  /**
   * Parse markdown content into a structured Persona object
   */
  private static parsePersonaMarkdown(markdown: string): Persona {
    const sections = PersonaLoader.splitIntoSections(markdown);
    
    // Extract persona traits
    const traits: PersonaTraits = {
      name: PersonaLoader.extractSection(sections, 'Name') || 'Chloe',
      personality: PersonaLoader.extractListItems(sections, 'Personality'),
      backgroundStory: PersonaLoader.extractSection(sections, 'Background Story') || '',
      interests: PersonaLoader.extractListItems(sections, 'Interests'),
      strengths: PersonaLoader.extractListItems(sections, 'Strengths'),
      weaknesses: PersonaLoader.extractListItems(sections, 'Weaknesses'),
      communicationStyle: PersonaLoader.extractSection(sections, 'Communication Style') || '',
    };

    // Extract system prompt
    const systemPrompt = PersonaLoader.extractSection(sections, 'System Prompt') || '';
    
    // Extract example interactions
    const examples = PersonaLoader.extractExamples(sections, 'Example Interactions');
    
    return {
      traits,
      systemPrompt,
      examples
    };
  }

  /**
   * Split markdown content into named sections
   */
  private static splitIntoSections(markdown: string): Map<string, string> {
    const sections = new Map<string, string>();
    
    // Match sections with headers (# Section Name)
    const sectionRegex = /^#+\s+(.+?)$([\s\S]*?)(?=^#+\s+|$)/gm;
    let match;
    
    while ((match = sectionRegex.exec(markdown)) !== null) {
      const sectionName = match[1].trim();
      const sectionContent = match[2].trim();
      sections.set(sectionName, sectionContent);
    }
    
    return sections;
  }

  /**
   * Extract content from a specific section
   */
  private static extractSection(sections: Map<string, string>, sectionName: string): string | null {
    return sections.get(sectionName) || null;
  }

  /**
   * Extract list items from a section
   */
  private static extractListItems(sections: Map<string, string>, sectionName: string): string[] {
    const section = sections.get(sectionName);
    if (!section) return [];
    
    const listItemRegex = /^[-*]\s+(.+)$/gm;
    const items: string[] = [];
    let match;
    
    while ((match = listItemRegex.exec(section)) !== null) {
      items.push(match[1].trim());
    }
    
    return items;
  }

  /**
   * Extract example interactions from the examples section
   */
  private static extractExamples(sections: Map<string, string>, sectionName: string): ExampleInteraction[] {
    const section = sections.get(sectionName);
    if (!section) return [];
    
    const examples: ExampleInteraction[] = [];
    
    // Split section by example headers (### Example X)
    const exampleSections = section.split(/^###\s+.+$/m).filter(Boolean);
    
    for (const exampleSection of exampleSections) {
      const userMatch = /User:\s*```(?:\w+)?\s*([\s\S]*?)```/m.exec(exampleSection);
      const agentMatch = /Agent:\s*```(?:\w+)?\s*([\s\S]*?)```/m.exec(exampleSection);
      const explanationMatch = /Explanation:\s*(.+)$/m.exec(exampleSection);
      
      if (userMatch && agentMatch) {
        examples.push({
          user: userMatch[1].trim(),
          agent: agentMatch[1].trim(),
          explanation: explanationMatch ? explanationMatch[1].trim() : undefined
        });
      }
    }
    
    return examples;
  }

  /**
   * Generate system prompt from persona traits
   */
  static generateSystemPrompt(traits: PersonaTraits): string {
    return `
# ${traits.name}'s Persona

## Personality
${traits.personality.map(trait => `- ${trait}`).join('\n')}

## Background
${traits.backgroundStory}

## Interests
${traits.interests.map(interest => `- ${interest}`).join('\n')}

## Strengths
${traits.strengths.map(strength => `- ${strength}`).join('\n')}

## Weaknesses
${traits.weaknesses.map(weakness => `- ${weakness}`).join('\n')}

## Communication Style
${traits.communicationStyle}

As ${traits.name}, you should embody these traits in all your interactions.
    `.trim();
  }

  /**
   * Get a default persona when no file is available
   */
  private static getDefaultPersona(): Persona {
    const traits: PersonaTraits = {
      name: 'Chloe',
      personality: [
        'Friendly and approachable',
        'Professional and efficient',
        'Patient and understanding',
        'Curious and eager to learn',
        'Helpful without being overbearing'
      ],
      backgroundStory: 'Chloe is an AI assistant designed to help users with a wide range of tasks.',
      interests: [
        'Helping users accomplish their goals',
        'Learning new skills and knowledge',
        'Organizing information efficiently',
        'Creative problem-solving'
      ],
      strengths: [
        'Explaining complex concepts simply',
        'Remembering user preferences',
        'Adapting to different situations',
        'Attention to detail'
      ],
      weaknesses: [
        'May occasionally misunderstand ambiguous requests',
        'Limited to text-based interactions',
        'Cannot access or modify the physical world'
      ],
      communicationStyle: 'Clear, concise, and friendly. Uses everyday language rather than technical jargon when possible.'
    };

    return {
      traits,
      systemPrompt: PersonaLoader.generateSystemPrompt(traits),
      examples: []
    };
  }

  /**
   * Save a persona to a markdown file
   */
  static saveToFile(persona: Persona, filePath: string): void {
    try {
      const markdown = PersonaLoader.generatePersonaMarkdown(persona);
      const fullPath = path.resolve(filePath);
      const dirPath = path.dirname(fullPath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, markdown, 'utf-8');
      console.log(`Persona saved to ${fullPath}`);
    } catch (error) {
      console.error(`Error saving persona file: ${error}`);
    }
  }

  /**
   * Generate markdown from a Persona object
   */
  private static generatePersonaMarkdown(persona: Persona): string {
    const { traits, systemPrompt, examples } = persona;
    
    let markdown = `# Name\n${traits.name}\n\n`;
    
    markdown += `# Personality\n${traits.personality.map(trait => `- ${trait}`).join('\n')}\n\n`;
    
    markdown += `# Background Story\n${traits.backgroundStory}\n\n`;
    
    markdown += `# Interests\n${traits.interests.map(interest => `- ${interest}`).join('\n')}\n\n`;
    
    markdown += `# Strengths\n${traits.strengths.map(strength => `- ${strength}`).join('\n')}\n\n`;
    
    markdown += `# Weaknesses\n${traits.weaknesses.map(weakness => `- ${weakness}`).join('\n')}\n\n`;
    
    markdown += `# Communication Style\n${traits.communicationStyle}\n\n`;
    
    markdown += `# System Prompt\n${systemPrompt}\n\n`;
    
    if (examples.length > 0) {
      markdown += `# Example Interactions\n\n`;
      
      examples.forEach((example, index) => {
        markdown += `### Example ${index + 1}\n\n`;
        markdown += `User: \`\`\`\n${example.user}\n\`\`\`\n\n`;
        markdown += `Agent: \`\`\`\n${example.agent}\n\`\`\`\n\n`;
        
        if (example.explanation) {
          markdown += `Explanation: ${example.explanation}\n\n`;
        }
      });
    }
    
    return markdown.trim();
  }
} 