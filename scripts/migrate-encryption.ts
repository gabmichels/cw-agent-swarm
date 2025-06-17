#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { PrismaSocialMediaDatabase } from '../src/services/social-media/database/PrismaSocialMediaDatabase';

async function migrateEncryption() {
  console.log('🔄 Starting encryption migration...');
  
  const prisma = new PrismaClient();
  const database = new PrismaSocialMediaDatabase(prisma);

  try {
    const migratedCount = await database.migrateOldEncryptedConnections();
    
    if (migratedCount > 0) {
      console.log(`✅ Migration complete!`);
      console.log(`📊 ${migratedCount} social media connections have been marked as expired`);
      console.log(`🔐 These connections used the old SOCIAL_MEDIA_ENCRYPTION_KEY encryption`);
      console.log(`🔄 Users will need to reconnect their social media accounts to use the new ENCRYPTION_MASTER_KEY`);
      console.log(`\n📝 Next steps:`);
      console.log(`   1. Remove SOCIAL_MEDIA_ENCRYPTION_KEY from your .env files`);
      console.log(`   2. Ensure ENCRYPTION_MASTER_KEY is set with a 64-character hex value`);
      console.log(`   3. Users can now reconnect their social media accounts through the UI`);
    } else {
      console.log(`✅ No migration needed - all connections are already using the new encryption format`);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateEncryption().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
}); 