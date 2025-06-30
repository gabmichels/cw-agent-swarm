import { NextResponse } from 'next/server';
// Note: Chloe agent system has been removed
import fs from 'fs';
import path from 'path';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Fix the reflection manager issues
 */
export async function GET() {
  try {
    console.log('Attempting to fix Reflection Manager issues');

    // Find the reflection manager file
    const projectRoot = process.cwd();
    const reflectionManagerPath = path.join(projectRoot, 'src', 'agents', 'chloe', 'core', 'reflectionManager.ts');

    // Check if the file exists
    if (!fs.existsSync(reflectionManagerPath)) {
      return NextResponse.json({
        status: 'error',
        message: 'Reflection manager file not found',
        path: reflectionManagerPath
      }, { status: 404 });
    }

    // Read the file content
    const fileContent = fs.readFileSync(reflectionManagerPath, 'utf8');

    // Fix the weekly reflection method by replacing 'weekly_reflection' with 'thought' as ChloeMemoryType
    const fixedContent = fileContent.replace(
      `'weekly_reflection',`,
      `'thought' as ChloeMemoryType, // Fixed - was 'weekly_reflection'`
    );

    // Write the file back
    fs.writeFileSync(reflectionManagerPath, fixedContent, 'utf8');

    // Reload the reflection manager in the agent
    // const chloe = await getGlobalChloeAgent(); // Chloe agent system has been removed
    // if (chloe) {
    //   // Reinitialize the agent
    //   await chloe.initialize();
    // }

    return NextResponse.json({
      status: 'success',
      message: 'Reflection manager fixed successfully',
      changes: 1
    });
  } catch (error) {
    console.error('Error fixing reflection manager:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to fix reflection manager',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 