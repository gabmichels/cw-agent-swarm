import { NextRequest, NextResponse } from 'next/server';

// Default config values
const CONFIG_DEFAULTS = {
  enableThinkingVisualization: process.env.ENABLE_THINKING_VISUALIZATION === 'true' || false,
  enableSampleVisualization: process.env.ENABLE_SAMPLE_VISUALIZATION === 'true' || true,
};

// In-memory config (could be replaced with DB storage in the future)
const config = new Map<string, any>(Object.entries(CONFIG_DEFAULTS));

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    
    if (!key) {
      // Return all config values if no specific key is requested
      return NextResponse.json(Object.fromEntries(config.entries()));
    }
    
    // Return specific config value
    if (config.has(key)) {
      return NextResponse.json({ value: config.get(key) });
    } else {
      return NextResponse.json(
        { error: `Config key not found: ${key}` },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error getting config:', error);
    return NextResponse.json(
      { error: 'Failed to get config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;
    
    if (!key) {
      return NextResponse.json(
        { error: 'Missing required parameter: key' },
        { status: 400 }
      );
    }
    
    // Set the config value
    config.set(key, value);
    
    return NextResponse.json({ 
      success: true,
      key,
      value 
    });
  } catch (error) {
    console.error('Error setting config:', error);
    return NextResponse.json(
      { error: 'Failed to set config' },
      { status: 500 }
    );
  }
} 