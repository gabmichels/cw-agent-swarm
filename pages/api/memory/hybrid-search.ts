import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Backward compatibility handler for memory hybrid-search API
 * Redirects requests to the new App Router API endpoint
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Legacy hybrid-search API endpoint called - redirecting to new App Router endpoint');
  
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Determine the internal URL to forward to
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = req.headers.host || 'localhost:3000';
    const url = `${protocol}://${host}/api/memory/hybrid-search`;
    
    // Forward the request to the new App Router endpoint
    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add special header to indicate this should be handled by App Router
        'x-use-app-router': 'true',
        // Forward client IP and other relevant headers
        'X-Forwarded-For': req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '',
        'X-Original-URL': `${url}`,
      },
      body: JSON.stringify(req.body)
    };
    
    console.log(`Forwarding request to App Router at: ${url}`);
    
    // Make the request to the App Router API
    const response = await fetch(url, options);
    
    // Log the response status for debugging
    console.log(`Response from App Router: ${response.status} ${response.statusText}`);
    
    // Check for successful response
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error response from App Router: ${response.status} ${response.statusText}`, errorText);
      return res.status(response.status).json({ 
        error: `Search failed: ${response.statusText}`,
        details: errorText
      });
    }
    
    // Process successful response
    const data = await response.json();
    
    // Forward the response status and data
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error forwarding to new hybrid-search API:', error);
    res.status(500).json({ 
      error: 'Failed to process search request',
      message: 'The application is being upgraded to a new memory system. Please try again later.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 