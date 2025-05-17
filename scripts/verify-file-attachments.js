// Script to verify end-to-end file attachment functionality
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');

// Generate test data
const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.png');
const TEST_CHAT_ID = uuidv4();
const TEST_USER_ID = 'test-user-' + Math.random().toString(36).substring(2, 10);
const TEST_AGENT_ID = 'agent-chloe';

async function verifyFileAttachments() {
  console.log('Verifying file attachments end-to-end flow...\n');
  
  // Step 1: Create a test image if it doesn't exist
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    console.log('Creating test image...');
    
    // Create a simple 100x100 PNG with various colors
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    
    // Draw a gradient
    const gradient = ctx.createLinearGradient(0, 0, 100, 100);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.5, '#00ff00');
    gradient.addColorStop(1, '#0000ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 100, 100);
    
    // Add text
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText('Test Image', 20, 50);
    
    // Save to file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(TEST_IMAGE_PATH, buffer);
    console.log('Test image created');
  } else {
    console.log('Using existing test image');
  }
  
  // Step 2: Upload file to the API
  console.log(`\nUploading test image to chat ${TEST_CHAT_ID}...`);
  
  try {
    // Create form data with file and metadata
    const form = new FormData();
    form.append('file_0', fs.createReadStream(TEST_IMAGE_PATH));
    form.append('message', 'Testing file attachment with this image');
    form.append('userId', TEST_USER_ID);
    form.append('agentId', TEST_AGENT_ID);
    form.append('chatId', TEST_CHAT_ID);
    
    // Send the request
    const response = await axios.post(
      `http://localhost:3000/api/multi-agent/chats/${TEST_CHAT_ID}/files`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    
    console.log('Upload successful!');
    
    if (response.data.files && response.data.files.length > 0) {
      const file = response.data.files[0];
      console.log(`\nFile details:`);
      console.log(`- ID: ${file.id}`);
      console.log(`- Name: ${file.originalName}`);
      console.log(`- Type: ${file.contentType}`);
      console.log(`- URL: ${file.url}`);
      
      // Step 3: Verify the file is accessible
      console.log('\nVerifying file is accessible...');
      
      const fileResponse = await axios.get(`http://localhost:3000${file.url}`, {
        responseType: 'arraybuffer',
      });
      
      console.log(`File access successful! Status: ${fileResponse.status}`);
      console.log(`Content-Type: ${fileResponse.headers['content-type']}`);
      console.log(`File size: ${fileResponse.data.length} bytes`);
      
      // Save the retrieved file for comparison
      const retrievedFilePath = path.join(__dirname, 'test-image-retrieved.png');
      fs.writeFileSync(retrievedFilePath, Buffer.from(fileResponse.data));
      console.log(`Retrieved file saved to: ${retrievedFilePath}`);
      
      console.log('\nFile attachment verification completed successfully!');
    } else {
      console.error('No files in response');
    }
  } catch (error) {
    console.error('Error verifying file attachments:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

verifyFileAttachments().catch(console.error); 