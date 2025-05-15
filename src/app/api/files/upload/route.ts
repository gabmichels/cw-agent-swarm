import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AgentService } from '../../../../services/AgentService';
import { FileProcessingManager } from '../../../../lib/agents/implementations/managers/FileProcessingManager';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Parse FormData
    const data = await request.formData();
    const file = data.get('file') as File;
    const agentId = data.get('agentId') as string || 'default';
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }
    
    // Get the agent
    const agentProfile = await AgentService.getAgent(agentId);
    
    if (!agentProfile) {
      return NextResponse.json({ 
        error: `Agent with ID ${agentId} not found` 
      }, { status: 404 });
    }

    // Cast to AgentBase
    const agent = agentProfile as unknown as AgentBase;
    
    // Generate a unique filename
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create a unique ID for the file
    const uniqueId = uuidv4();
    const fileExt = file.name.split('.').pop() || 'txt';
    const filename = `${uniqueId}.${fileExt}`;
    
    // Define path to save the file
    const uploadDir = join(process.cwd(), 'uploads');
    const filePath = join(uploadDir, filename);
    
    // Save the file
    await writeFile(filePath, buffer);
    
    // Process the file using the FileProcessingManager
    let processingResult = null;
    try {
      const fileProcessor = new FileProcessingManager(agent);
      await fileProcessor.initialize();
      processingResult = await fileProcessor.processFile(filePath, file.name);
    } catch (error) {
      console.error('Error processing file:', error);
    }
    
    return NextResponse.json({
      success: true,
      filename,
      originalName: file.name,
      size: file.size,
      type: file.type,
      path: `/uploads/${filename}`,
      processingResult
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
} 