import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Use the full path to the cache file
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'cache', 'markdown-cache.json');
// Add the initialization flag file path
const INIT_FLAG_PATH = path.join(process.cwd(), 'data', 'cache', 'markdown-initialized.flag');

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Simple health check response for GET requests
  if (req.method === 'GET') {
    return res.status(200).json({ 
      success: true, 
      message: 'API is working',
      method: 'GET'
    });
  }
  
  // Only allow POST for actual operations
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed, use POST to clear cache' 
    });
  }

  try {
    const result = {
      cacheFileDeleted: false,
      flagFileDeleted: false
    };

    // Check if cache file exists and delete it
    if (fs.existsSync(CACHE_FILE_PATH)) {
      fs.unlinkSync(CACHE_FILE_PATH);
      console.log('Successfully deleted markdown cache file');
      result.cacheFileDeleted = true;
    } else {
      console.log('Cache file not found, nothing to delete');
    }

    // Check if initialization flag file exists and delete it
    if (fs.existsSync(INIT_FLAG_PATH)) {
      fs.unlinkSync(INIT_FLAG_PATH);
      console.log('Successfully deleted markdown initialization flag file');
      result.flagFileDeleted = true;
    } else {
      console.log('Initialization flag file not found, nothing to delete');
    }

    // Return success even if files don't exist
    return res.status(200).json({
      success: true,
      message: 'Successfully cleared markdown cache and initialization flags',
      details: result
    });
  } catch (error) {
    console.error('Error in clear-markdown-cache API:', error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 