import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Testing chat API...');
    
    // Test a simple message
    const testMessage = "Hi Chloe, this is a test message";
    
    // For real implementation, we would use:
    // const chloe = require('../../../agents/chloe');
    // const response = await chloe.processMessage(testMessage);
    
    // For now, simulate a response
    const response = `This is a test response to your message: "${testMessage}"`;
    
    return NextResponse.json({
      status: 'success',
      testMessage,
      response
    });
  } catch (error: any) {
    console.error('Error testing chat API:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error.message || 'Unknown error',
        stack: error.stack 
      },
      { status: 500 }
    );
  }
} 