import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Use the full path to the cache file
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'cache', 'markdown-cache.json');

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
    // Check if file exists
    const fileExists = fs.existsSync(CACHE_FILE_PATH);
    
    if (fileExists) {
      // Delete the file
      fs.unlinkSync(CACHE_FILE_PATH);
      console.log('Successfully deleted markdown cache file');
      
      return res.status(200).json({
        success: true,
        message: 'Successfully deleted markdown cache file'
      });
    } else {
      console.log('Cache file not found, nothing to delete');
      
      return res.status(200).json({
        success: true,
        message: 'Cache file not found, nothing to delete'
      });
    }
  } catch (error) {
    console.error('Error in clear-markdown-cache API:', error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 