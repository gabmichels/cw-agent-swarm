// This script verifies that the MinIO container is running and the chat-attachments bucket exists
// It will create the bucket if it doesn't exist

const { S3Client, ListBucketsCommand, CreateBucketCommand, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');

async function verifyMinioBucket() {
  console.log('Verifying MinIO setup...');
  
  // Configure S3 client for MinIO
  const s3Client = new S3Client({
    region: 'us-east-1', // Required but doesn't matter for MinIO
    endpoint: 'http://localhost:9000',
    forcePathStyle: true, // Required for MinIO
    credentials: {
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin'
    }
  });
  
  try {
    // List existing buckets
    const listBucketsResponse = await s3Client.send(new ListBucketsCommand({}));
    const buckets = listBucketsResponse.Buckets || [];
    
    console.log('Existing buckets:', buckets.map(b => b.Name).join(', ') || 'None');
    
    // Check if chat-attachments bucket exists
    const bucketName = 'chat-attachments';
    const bucketExists = buckets.some(bucket => bucket.Name === bucketName);
    
    if (bucketExists) {
      console.log(`Bucket '${bucketName}' already exists.`);
    } else {
      console.log(`Bucket '${bucketName}' doesn't exist. Creating it...`);
      
      // Create the bucket
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`Bucket '${bucketName}' created successfully.`);
      
      // Set bucket policy to allow public read
      const bucketPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/*`]
          }
        ]
      };
      
      await s3Client.send(new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify(bucketPolicy)
      }));
      
      console.log(`Public read policy set for bucket '${bucketName}'.`);
    }
    
    console.log('MinIO setup verification completed successfully!');
  } catch (error) {
    console.error('Error during MinIO setup verification:', error);
    console.log('\nMake sure the MinIO container is running:');
    console.log('  docker-compose up -d');
  }
}

verifyMinioBucket(); 