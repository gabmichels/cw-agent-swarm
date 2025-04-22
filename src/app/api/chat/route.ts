import { POST, GET } from './proxy';

// Add server-only markers to prevent client-side execution
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export { POST, GET }; 