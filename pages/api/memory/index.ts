import { NextApiRequest, NextApiResponse } from 'next';
import { NextConfig } from 'next';

/**
 * Backward compatibility handler for memory API
 * Redirects requests to the new App Router API endpoint
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Legacy memory API endpoint called - redirecting to new App Router endpoint');
  
  try {
    // Determine the internal URL to forward to
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = req.headers.host || 'localhost:3000';
    const url = `${protocol}://${host}/api/memory`;
    
    // Forward the request to the new App Router endpoint
    const options: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        // Add special header to indicate this should be handled by App Router
        'x-use-app-router': 'true',
        // Forward client IP and other relevant headers
        'X-Forwarded-For': req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '',
        'X-Original-URL': `${url}`,
      },
    };
    
    // Add body for non-GET requests
    if (req.method !== 'GET' && req.body) {
      options.body = JSON.stringify(req.body);
    }
    
    // Include query parameters for GET requests
    const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    
    console.log(`Forwarding request to App Router at: ${fullUrl}`);
    
    // Make the request to the App Router API
    const response = await fetch(fullUrl, options);
    
    // Log the response status for debugging
    console.log(`Response from App Router: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error response from App Router: ${errorText}`);
      return res.status(response.status).json({ 
        error: `Failed to get data from App Router: ${response.statusText}`,
        details: errorText
      });
    }
    
    const data = await response.json();
    
    // Forward the response status and data
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error forwarding to new memory API:', error);
    res.status(500).json({ 
      error: 'Failed to process memory request',
      message: 'The application is being upgraded to a new memory system. Please try again later.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 