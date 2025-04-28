import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';

// Mark as server-side only
export const runtime = 'nodejs';

interface DiagnosticResults {
  originalUrl?: string;
  originalId?: string;
  resolveResult?: any;
  resolveError?: any;
  extractedDocId?: string;
  attempts: Array<{
    docId: string;
    success: boolean;
    data?: any;
    error?: any;
    status?: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // Get the document info from the request body
    const { url, id } = await request.json();
    
    if (!url && !id) {
      return NextResponse.json(
        { success: false, error: 'URL or ID is required' },
        { status: 400 }
      );
    }
    
    const apiKey = process.env.CODA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Coda API key is not configured' },
        { status: 500 }
      );
    }
    
    const client = axios.create({
      baseURL: 'https://coda.io/apis/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Results to return
    const results: DiagnosticResults = {
      originalUrl: url,
      originalId: id,
      attempts: []
    };
    
    // If URL is provided, try to resolve it first
    if (url) {
      try {
        const resolveResponse = await client.get('/resolveBrowserLink', {
          params: { url }
        });
        
        results.resolveResult = resolveResponse.data;
        
        // Extract doc ID from the response if possible
        if (resolveResponse.data.resource && resolveResponse.data.resource.href) {
          const hrefParts = resolveResponse.data.resource.href.split('/');
          const docsIndex = hrefParts.indexOf('docs');
          
          if (docsIndex !== -1 && docsIndex + 1 < hrefParts.length) {
            results.extractedDocId = hrefParts[docsIndex + 1];
          }
        }
      } catch (error) {
        const axiosError = error as AxiosError;
        results.resolveError = axiosError.response?.data || axiosError.message;
      }
    }
    
    // Try several variations of the document ID
    const idToTry = id || results.extractedDocId || '';
    const variations = [
      idToTry,
      idToTry.startsWith('_') ? idToTry.substring(1) : idToTry,
      !idToTry.startsWith('_') ? `_${idToTry}` : idToTry
    ];
    
    // Try to access the document with each ID variation
    for (const docId of variations) {
      if (!docId) continue;
      
      try {
        console.log(`Trying to access document with ID: ${docId}`);
        const docResponse = await client.get(`/docs/${docId}`);
        
        results.attempts.push({
          docId,
          success: true,
          data: docResponse.data
        });
      } catch (error) {
        const axiosError = error as AxiosError;
        results.attempts.push({
          docId,
          success: false,
          error: axiosError.response?.data || axiosError.message,
          status: axiosError.response?.status
        });
      }
    }
    
    return NextResponse.json({
      success: results.attempts.some(a => a.success),
      diagnostics: results
    });
  } catch (error) {
    console.error('Error in direct document access:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 