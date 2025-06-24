import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const workingDir = process.cwd();
    const workflowsDir = path.join(workingDir, 'data', 'n8n-workflows-repo', 'workflows');

    console.log('Working directory:', workingDir);
    console.log('Workflows directory:', workflowsDir);
    console.log('Directory exists:', fs.existsSync(workflowsDir));

    let directoryContents = [];
    let firstFileContent = null;

    if (fs.existsSync(workflowsDir)) {
      directoryContents = fs.readdirSync(workflowsDir, { withFileTypes: true })
        .slice(0, 5) // First 5 items only
        .map(item => ({
          name: item.name,
          isDirectory: item.isDirectory(),
          isFile: item.isFile()
        }));

      // Try to read the first JSON file
      const firstJsonFile = fs.readdirSync(workflowsDir)
        .find(file => file.endsWith('.json'));

      if (firstJsonFile) {
        try {
          const content = fs.readFileSync(path.join(workflowsDir, firstJsonFile), 'utf-8');
          const parsed = JSON.parse(content);
          firstFileContent = {
            filename: firstJsonFile,
            hasNodes: !!parsed.nodes,
            nodeCount: parsed.nodes ? parsed.nodes.length : 0,
            hasName: !!parsed.name,
            name: parsed.name,
            keys: Object.keys(parsed)
          };
        } catch (parseError) {
          firstFileContent = {
            filename: firstJsonFile,
            error: parseError instanceof Error ? parseError.message : 'Parse error'
          };
        }
      }
    }

    return NextResponse.json({
      debug: {
        workingDirectory: workingDir,
        workflowsDirectory: workflowsDir,
        directoryExists: fs.existsSync(workflowsDir),
        directoryContents,
        firstFileContent
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        workingDirectory: process.cwd()
      }
    }, { status: 500 });
  }
} 