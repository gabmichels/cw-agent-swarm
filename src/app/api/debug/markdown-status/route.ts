import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * API endpoint to check markdown loading status
 */
export async function GET(request: NextRequest) {
  try {
    // Get file paths
    const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'cache', 'markdown-cache.json');
    const INIT_FLAG_PATH = path.join(process.cwd(), 'data', 'cache', 'markdown-initialized.flag');
    
    // Check global prevention flag
    const globalAny = global as any;
    const preventFlag = globalAny.preventMarkdownReload === true;
    
    // Check if agent has prevention flag
    const chloePreventFlag = globalAny.chloeAgent && 
                            (globalAny.chloeAgent as any).preventMarkdownReload === true;
    
    // Check cache file existence
    let cacheExists = false;
    let cacheSize = 0;
    let cacheModified = '';
    let cacheEntries = 0;
    
    try {
      const stats = await fs.stat(CACHE_FILE_PATH);
      cacheExists = stats.isFile() && stats.size > 0;
      cacheSize = stats.size;
      cacheModified = stats.mtime.toISOString();
      
      // If cache exists, count entries
      if (cacheExists) {
        const cacheContent = await fs.readFile(CACHE_FILE_PATH, 'utf8');
        const cacheData = JSON.parse(cacheContent);
        cacheEntries = Object.keys(cacheData).length;
      }
    } catch (error) {
      cacheExists = false;
    }
    
    // Check initialization flag existence and content
    let flagExists = false;
    let flagContent = '';
    let flagModified = '';
    
    try {
      const stats = await fs.stat(INIT_FLAG_PATH);
      flagExists = stats.isFile();
      flagModified = stats.mtime.toISOString();
      
      if (flagExists) {
        flagContent = await fs.readFile(INIT_FLAG_PATH, 'utf8');
      }
    } catch (error) {
      flagExists = false;
    }
    
    // Build status response
    const status = {
      preventMarkdownReload: preventFlag,
      chloePreventMarkdownReload: chloePreventFlag,
      cacheFile: {
        exists: cacheExists,
        path: CACHE_FILE_PATH,
        size: cacheSize,
        lastModified: cacheModified,
        entries: cacheEntries
      },
      initFlag: {
        exists: flagExists,
        path: INIT_FLAG_PATH,
        content: flagContent,
        lastModified: flagModified
      },
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error in markdown-status endpoint:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
} 