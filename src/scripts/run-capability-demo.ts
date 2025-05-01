/**
 * Script to run the capability system demonstration
 */

import { runCapabilityDemo } from '../agents/shared/coordination/CapabilitySystemDemo';

// Run the capability demo
runCapabilityDemo()
  .then(() => {
    console.log('Capability demo completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error running capability demo:', error);
    process.exit(1);
  }); 