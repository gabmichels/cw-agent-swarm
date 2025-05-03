import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Make sure this runs server-side only
export const runtime = 'nodejs';

/**
 * Recursively find all route files in the API directory
 */
function findApiRoutes(dir: string, baseDir: string): string[] {
  const routes: string[] = [];
  
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recursively search subdirectories
        routes.push(...findApiRoutes(fullPath, baseDir));
      } else if (file === 'route.ts' || file === 'route.js') {
        // Found a route file
        const relativePath = path.relative(baseDir, dir);
        const apiPath = '/' + relativePath.replace(/\\/g, '/');
        routes.push(apiPath);
      }
    }
  } catch (error) {
    console.error('Error reading directory:', error);
  }
  
  return routes;
}

/**
 * GET handler that returns debug information about the API
 */
export async function GET(request: NextRequest) {
  try {
    // Get base directory for API routes
    const apiBaseDir = path.resolve(process.cwd(), 'src/app/api');
    
    // Find all API routes
    const routes = findApiRoutes(apiBaseDir, apiBaseDir);
    
    // Get system information
    const systemInfo = {
      nodejsVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      cwd: process.cwd(),
      env: process.env.NODE_ENV
    };
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      apiRoutes: routes.sort(),
      systemInfo,
      requestInfo: {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries())
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 