import { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  success?: boolean;
  error?: string;
  memoryId?: string;
};

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse<ResponseData>
) {
  console.log("DEBUG: /api/memory/[id]/tags/reject API endpoint called");
  console.log("DEBUG: Request method:", req.method);
  console.log("DEBUG: Memory ID:", req.query.id);
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    console.log("DEBUG: Method not allowed:", req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get memory ID from path
    const memoryId = req.query.id as string;
    
    console.log(`DEBUG: Rejecting tags for memory ${memoryId}`);
    
    // Basic validation
    if (!memoryId) {
      console.log("DEBUG: Missing memoryId in path");
      return res.status(400).json({ error: 'Memory ID is required' });
    }

    // Currently we're just simulating the rejection
    // In a real implementation, you would:
    // 1. Fetch the memory from the database
    // 2. Clear any suggested tags
    // 3. Set a flag to prevent auto-generation
    // 4. Save the updated memory back to the database

    // Return success
    return res.status(200).json({
      success: true,
      memoryId
    });
  } catch (error) {
    console.error("DEBUG: Error rejecting tags:", error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 