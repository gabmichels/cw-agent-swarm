/**
 * Direct test of Coda tools to verify they work when called directly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createCodaCreateDocumentTool, createCodaListDocumentsTool } from '../../agents/shared/tools/adapters/CodaToolAdapter';
import type { Tool } from '../../lib/tools/types';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file in project root
const rootEnvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(rootEnvPath)) {
  console.log('Loading API keys from root .env file for Coda direct tests');
  dotenv.config({ path: rootEnvPath });
}

// Type definitions for Coda API responses
interface CodaDocument {
  id: string;
  name: string;
  browserLink: string;
  [key: string]: any;
}

interface CodaListResponse {
  documents: CodaDocument[];
  [key: string]: any;
}

interface CodaCreateResponse {
  id: string;
  name: string;
  browserLink: string;
  [key: string]: any;
}

describe('Coda Tools Direct Test', () => {
  let createTool: Tool;
  let listTool: Tool;

  beforeEach(() => {
    createTool = createCodaCreateDocumentTool();
    listTool = createCodaListDocumentsTool();
  });

  it('should create a Coda document and verify it exists', async () => {
    if (!process.env.CODA_API_KEY) {
      console.warn('⚠️ CODA_API_KEY not set, skipping Coda direct test');
      return;
    }

    console.log('🧪 Testing Coda tools directly...');

    // Step 1: List existing documents to get baseline
    console.log('📋 Step 1: Listing existing documents...');
    const listResult = await listTool.execute({});
    
    expect(listResult.success).toBe(true);
    expect(listResult.data).toBeDefined();
    
    const listData = listResult.data as CodaListResponse;
    expect(listData.documents).toBeInstanceOf(Array);
    
    console.log(`📊 Found ${listData.documents.length} existing documents`);

    // Step 2: Create a new document
    const testTitle = `Direct Test Document ${Date.now()}`;
    console.log(`📝 Step 2: Creating document "${testTitle}"...`);
    
    const createResult = await createTool.execute({
      title: testTitle,
      content: 'This is a test document created by direct tool testing.'
    });

    expect(createResult.success).toBe(true);
    expect(createResult.data).toBeDefined();
    
    const createData = createResult.data as CodaCreateResponse;
    
    // Log the result for debugging
    console.log('✅ Create result:', {
      success: createResult.success,
      documentId: createResult.success ? createData.id : null,
      error: createResult.error
    });

    expect(createData.id).toBeTruthy();
    expect(createData.name).toBe(testTitle);
    expect(createData.browserLink).toBeTruthy();

    // Log success details
    console.log(`📄 Document created with ID: ${createData.id}`);
    console.log(`🔗 Browser link: ${createData.browserLink}`);

    // Step 3: Verify the document exists by listing again
    console.log('🔍 Step 3: Verifying document exists...');
    const verifyListResult = await listTool.execute({});
    expect(verifyListResult.success).toBe(true);
    
    const verifyListData = verifyListResult.data as CodaListResponse;
    const foundDoc = verifyListData.documents.find(doc => doc.id === createData.id);
    expect(foundDoc).toBeDefined();
    expect(foundDoc?.name).toBe(testTitle);

    console.log('✅ Document verified in document list!');
    console.log('🎉 Coda tools working perfectly when called directly!');
  });
}); 