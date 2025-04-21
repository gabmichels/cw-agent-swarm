import { NextResponse } from 'next/server';

export async function GET() {
  const instructions = {
    timestamp: new Date().toISOString(),
    title: "Troubleshooting Chloe Agent Connection Issues",
    instructions: [
      {
        title: "1. Check Package Installation",
        steps: [
          "Make sure the @crowd-wisdom/agents-chloe package is properly installed",
          "Run 'npm run build' in the packages/agents/chloe directory",
          "Run 'npm install' in the apps/ui directory to ensure dependencies are linked",
          "Check for any build errors in the packages/agents/chloe directory"
        ]
      },
      {
        title: "2. Verify Environment Variables",
        steps: [
          "Create a .env.local file in the apps/ui directory if it doesn't exist",
          "Add the following environment variables to .env.local:",
          "OPENROUTER_API_KEY=your_api_key_here",
          "QDRANT_URL=your_qdrant_url (e.g., http://localhost:6333)",
          "QDRANT_API_KEY=your_qdrant_api_key (if applicable)",
          "LANGCHAIN_API_KEY=your_api_key_here (if applicable)"
        ]
      },
      {
        title: "3. Check API Keys",
        steps: [
          "Ensure you have valid API keys for OpenRouter and other services",
          "Test your OpenRouter API key directly to make sure it's valid",
          "Verify Qdrant is accessible at the configured URL"
        ]
      },
      {
        title: "4. Check Export Format",
        steps: [
          "Make sure packages/agents/chloe/src/index.ts exports ChloeAgent properly",
          "The export should be: export { ChloeAgent } from './agent';",
          "Verify packages/agents/chloe/package.json has correct main and exports fields"
        ]
      },
      {
        title: "5. Rebuild and Restart",
        steps: [
          "Run 'npm run build' in the monorepo root directory",
          "Restart the Next.js development server with 'npm run dev' in apps/ui",
          "Clear browser cache and refresh the page"
        ]
      },
      {
        title: "6. Debug Mode",
        steps: [
          "Use the 'Run Diagnostics' button to identify specific issues",
          "Check the server logs for detailed error messages",
          "Use the 'Check Chloe' button to test direct integration with the agent"
        ]
      },
      {
        title: "7. Troubleshoot Common Errors",
        issues: [
          {
            error: "Module not found: Error: Can't resolve '@crowd-wisdom/agents-chloe'",
            fix: "The package is not properly installed or linked. Run 'npm install' in the monorepo root."
          },
          {
            error: "ChloeAgent is not a constructor",
            fix: "Check that ChloeAgent is exported correctly and is a class."
          },
          {
            error: "Cannot read properties of undefined (reading 'getContext')",
            fix: "The memory system is not initialized properly. Check environment variables for Qdrant."
          },
          {
            error: "OpenRouter API error",
            fix: "Verify your OPENROUTER_API_KEY is correct and has sufficient credits."
          }
        ]
      }
    ],
    resources: [
      {
        title: "Documentation",
        link: "/docs/agents/chloe"
      },
      {
        title: "OpenRouter",
        link: "https://openrouter.ai/docs"
      },
      {
        title: "Qdrant",
        link: "https://qdrant.tech/documentation/"
      }
    ]
  };
  
  return NextResponse.json(instructions);
} 