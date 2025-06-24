import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

interface DiagnosticResult {
  success: boolean;
  message: string;
  details?: any;
}

async function checkPackageInstalled(packageName: string): Promise<DiagnosticResult> {
  try {
    // Try to resolve the package
    require.resolve(packageName);
    return {
      success: true,
      message: `Package ${packageName} is installed and resolvable`
    };
  } catch (error) {
    return {
      success: false,
      message: `Package ${packageName} is not installed or not resolvable`,
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

async function checkPackageExports(packageName: string): Promise<DiagnosticResult> {
  try {
    // Import the package dynamically
    const pkg = await import(packageName);
    
    return {
      success: true,
      message: `Package ${packageName} exported the following:`,
      details: {
        exports: Object.keys(pkg),
        hasDefaultExport: 'default' in pkg,
        hasChloeAgent: 'ChloeAgent' in pkg
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to import ${packageName}`,
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

async function checkPackageJson(workspace: string = '.'): Promise<DiagnosticResult> {
  try {
    // Get the monorepo root directory
    const rootDir = path.resolve(process.cwd(), workspace);
    
    // Look for package.json files
    const packages: Record<string, any> = {};
    
    // Check root package.json
    const rootPackagePath = path.join(rootDir, 'package.json');
    if (fs.existsSync(rootPackagePath)) {
      const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
      packages['root'] = {
        name: rootPackage.name,
        version: rootPackage.version,
        dependencies: rootPackage.dependencies || {},
        devDependencies: rootPackage.devDependencies || {}
      };
    }
    
    // Check UI package.json
    const uiPackagePath = path.join(rootDir, 'apps/ui/package.json');
    if (fs.existsSync(uiPackagePath)) {
      const uiPackage = JSON.parse(fs.readFileSync(uiPackagePath, 'utf8'));
      packages['ui'] = {
        name: uiPackage.name,
        version: uiPackage.version,
        dependencies: uiPackage.dependencies || {},
        devDependencies: uiPackage.devDependencies || {}
      };
    }
    
    // Check Chloe package
    const chloePackagePath = path.join(rootDir, 'packages/agents/chloe/package.json');
    if (fs.existsSync(chloePackagePath)) {
      const chloePackage = JSON.parse(fs.readFileSync(chloePackagePath, 'utf8'));
      packages['chloe'] = {
        name: chloePackage.name,
        version: chloePackage.version,
        main: chloePackage.main,
        exports: chloePackage.exports,
        dependencies: chloePackage.dependencies || {},
        devDependencies: chloePackage.devDependencies || {}
      };
    }
    
    return {
      success: true,
      message: 'Package.json files found',
      details: packages
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to check package.json files',
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

async function checkEnvironmentVariables(): Promise<DiagnosticResult> {
  // Check for essential environment variables (without revealing values)
  const requiredVars = [
    'OPENROUTER_API_KEY',
    'QDRANT_URL',
    'QDRANT_API_KEY',
    'LANGCHAIN_API_KEY'
  ];
  
  const envStatus = requiredVars.map((varName: any) => ({
    name: varName,
    set: !!process.env[varName]
  }));
  
  const missingVars = envStatus.filter((status: any) => !status.set).map((status: any) => status.name);
  
  return {
    success: missingVars.length === 0,
    message: missingVars.length === 0 
      ? 'All required environment variables are set' 
      : 'Some required environment variables are missing',
    details: {
      status: envStatus,
      missing: missingVars
    }
  };
}

export async function GET() {
  try {
    // Run all diagnostics
    const results = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      cwd: process.cwd(),
      diagnostics: {
        chloePackage: await checkPackageInstalled('../../../agents/chloe'),
        chloeExports: await checkPackageExports('../../../agents/chloe'),
        langchainPackage: await checkPackageInstalled('@langchain/core'),
        openaiPackage: await checkPackageInstalled('@langchain/openai'),
        langgraphPackage: await checkPackageInstalled('@langchain/langgraph'),
        packageJson: await checkPackageJson(),
        environmentVars: await checkEnvironmentVariables()
      }
    };
    
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Diagnostics failed',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 