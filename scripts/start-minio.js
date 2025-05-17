// Script to start MinIO container if not running
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function startMinioContainer() {
  console.log('Checking if MinIO container is running...');
  
  try {
    // Check if the MinIO container is running
    const { stdout } = await execAsync('docker ps --filter "name=minio" --format "{{.Names}}"');
    
    if (stdout.trim()) {
      console.log('MinIO container is already running.');
    } else {
      console.log('MinIO container is not running. Starting it...');
      
      // Try to start existing container first
      try {
        await execAsync('docker start minio');
        console.log('Started existing MinIO container.');
      } catch (startError) {
        // If no container exists, run a new one
        console.log('No existing container found. Creating a new MinIO container...');
        await execAsync(
          'docker run -d --name minio ' +
          '-p 9000:9000 -p 9001:9001 ' +
          '-e "MINIO_ROOT_USER=minioadmin" ' +
          '-e "MINIO_ROOT_PASSWORD=minioadmin" ' +
          '-v minio-data:/data ' +
          'minio/minio server /data --console-address ":9001"'
        );
        console.log('New MinIO container created and started.');
      }
    }
    
    // Verify MinIO bucket setup
    console.log('\nVerifying MinIO bucket setup...');
    await execAsync('node scripts/verify-minio-setup.js');
    
    console.log('\nMinIO is ready to use!');
    console.log('- S3 API endpoint: http://localhost:9000');
    console.log('- Web console: http://localhost:9001 (login with minioadmin/minioadmin)');
  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('command not found')) {
      console.error('\nDocker might not be installed or not in PATH.');
      console.error('Please install Docker Desktop from https://www.docker.com/products/docker-desktop/');
    }
  }
}

startMinioContainer(); 