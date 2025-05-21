/**
 * Check Visualizations Script
 */

const http = require('http');

// Define the request data
const data = JSON.stringify({
  limit: 10,
  with_payload: true,
  with_vector: false
});

console.log('Request data:', data);

// Define the request options
const options = {
  hostname: 'localhost',
  port: 6333,
  path: '/collections/thinking_visualizations/points/scroll',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Request options:', options);

// Send the request
const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log('HEADERS:', JSON.stringify(res.headers));
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
    console.log('Received chunk:', chunk.toString());
  });
  
  res.on('end', () => {
    console.log('Response completed. Full response:', responseData);
    
    try {
      const parsedData = JSON.parse(responseData);
      console.log('Successfully parsed JSON response');
      
      if (parsedData.result && parsedData.result.points) {
        console.log(`Found ${parsedData.result.points.length} visualizations:`);
        
        parsedData.result.points.forEach((point, index) => {
          console.log(`\n--- Visualization ${index + 1} ---`);
          console.log(`ID: ${point.id}`);
          
          if (point.payload) {
            console.log(`Chat ID: ${point.payload.chatId}`);
            console.log(`Message: ${point.payload.message}`);
            console.log(`Timestamp: ${new Date(point.payload.timestamp).toISOString()}`);
            
            if (point.payload.nodes) {
              console.log(`Nodes: ${point.payload.nodes.length}`);
            }
            
            if (point.payload.edges) {
              console.log(`Edges: ${point.payload.edges.length}`);
            }
          }
        });
        
        if (parsedData.result.points.length === 0) {
          console.log('No visualizations found in the collection.');
        }
      } else {
        console.log('No visualization points found or response format unexpected. Response structure:', JSON.stringify(parsedData));
      }
    } catch (error) {
      console.error('Error parsing response:', error);
      console.log('Raw response:', responseData);
    }
    
    // Wait a bit before exiting to ensure console output is complete
    setTimeout(() => {
      console.log('Exiting process...');
      process.exit(0);
    }, 500);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});

// Write data to request body
req.write(data);
req.end();

console.log('Checking visualizations in the collection...'); 