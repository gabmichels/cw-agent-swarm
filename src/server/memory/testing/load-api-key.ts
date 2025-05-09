import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load API key from environment
export function loadApiKey(): string | undefined {
  // First try environment variable
  let apiKey = process.env.OPENAI_API_KEY;
  
  // If not found, try loading from .env file
  if (!apiKey) {
    try {
      // Try to load from project root .env
      const rootEnvPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(rootEnvPath)) {
        const envConfig = dotenv.parse(fs.readFileSync(rootEnvPath));
        apiKey = envConfig.OPENAI_API_KEY;
        
        // If found in .env, set it in process.env for the current process
        if (apiKey) {
          process.env.OPENAI_API_KEY = apiKey;
          console.log('Loaded OpenAI API key from .env file');
        }
      }
    } catch (error) {
      console.error('Error loading .env file:', error);
    }
  }
  
  // Return the API key (might still be undefined)
  return apiKey;
} 