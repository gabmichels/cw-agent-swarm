/**
 * Audit Scheduler Task Creation
 * 
 * This script scans the codebase to identify instances where createTask is used directly
 * instead of createTaskForAgent, which is required for proper agent ID assignment.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SOURCE_DIR = path.resolve(__dirname, '../src');
const IGNORE_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'test',
  'tests',
];
const SCHEDULER_PATTERN = /\b(?:scheduler|Scheduler)\b.*\bcreateTask\b(?!\w*ForAgent)/g;
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Results storage
const results = {
  potentialIssues: [],
  totalFiles: 0,
  scannedFiles: 0,
  issueFiles: 0,
};

/**
 * Check if a file should be ignored
 * @param {string} filePath - Path to the file
 * @returns {boolean} - True if the file should be ignored
 */
function shouldIgnoreFile(filePath) {
  // Ignore files in ignored directories
  if (IGNORE_DIRS.some(dir => filePath.includes(`/${dir}/`))) {
    return true;
  }
  
  // Only scan files with specified extensions
  const ext = path.extname(filePath).toLowerCase();
  if (!FILE_EXTENSIONS.includes(ext)) {
    return true;
  }
  
  return false;
}

/**
 * Scan a file for direct uses of createTask
 * @param {string} filePath - Path to the file
 */
function scanFile(filePath) {
  try {
    results.scannedFiles++;
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for scheduler.createTask pattern
    const matches = content.match(SCHEDULER_PATTERN);
    if (matches && matches.length > 0) {
      results.issueFiles++;
      
      // Get line numbers for each match
      const lines = content.split('\n');
      const lineMatches = [];
      
      for (let i = 0; i < lines.length; i++) {
        if (SCHEDULER_PATTERN.test(lines[i])) {
          lineMatches.push({
            line: i + 1,
            content: lines[i].trim()
          });
        }
      }
      
      results.potentialIssues.push({
        file: filePath.replace(SOURCE_DIR + '/', ''),
        matches: lineMatches,
        count: matches.length
      });
    }
  } catch (error) {
    console.error(`Error scanning file ${filePath}:`, error.message);
  }
}

/**
 * Recursively scan a directory for files
 * @param {string} dirPath - Path to the directory
 */
function scanDirectory(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.includes(entry.name)) {
          scanDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        if (!shouldIgnoreFile(fullPath)) {
          results.totalFiles++;
          scanFile(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error.message);
  }
}

/**
 * Use git grep to find potential issues faster
 */
function scanWithGit() {
  try {
    // Use git grep to find potential issues
    const cmd = `git grep -l "createTask" -- "*.ts" "*.tsx" "*.js" "*.jsx" | xargs grep -l "scheduler\\|Scheduler"`;
    const output = execSync(cmd, { cwd: path.resolve(__dirname, '..') }).toString();
    
    // Process each file found
    const files = output.split('\n').filter(Boolean);
    results.totalFiles = files.length;
    
    for (const file of files) {
      scanFile(path.resolve(__dirname, '..', file));
    }
    
    return true;
  } catch (error) {
    console.log('Git grep not available or failed, falling back to directory scan');
    return false;
  }
}

/**
 * Generate a Markdown report of the results
 * @returns {string} - Markdown report
 */
function generateReport() {
  let report = '# Scheduler Task Creation Audit Report\n\n';
  
  report += `## Summary\n\n`;
  report += `- Total files scanned: ${results.scannedFiles}\n`;
  report += `- Files with potential issues: ${results.issueFiles}\n`;
  report += `- Total potential issues found: ${results.potentialIssues.reduce((sum, issue) => sum + issue.count, 0)}\n\n`;
  
  if (results.potentialIssues.length > 0) {
    report += `## Potential Issues\n\n`;
    report += `The following files contain direct calls to \`createTask\` that should be replaced with \`createTaskForAgent\`:\n\n`;
    
    for (const issue of results.potentialIssues) {
      report += `### ${issue.file}\n\n`;
      
      for (const match of issue.matches) {
        report += `- Line ${match.line}: \`${match.content}\`\n`;
      }
      
      report += '\n';
    }
    
    report += `## Recommendation\n\n`;
    report += `Replace all direct calls to \`createTask\` with \`createTaskForAgent\` to ensure proper agent ID assignment.\n\n`;
    report += `Example:\n\n`;
    report += "```typescript\n";
    report += "// INCORRECT\n";
    report += "await scheduler.createTask(taskData);\n\n";
    report += "// CORRECT\n";
    report += "await scheduler.createTaskForAgent(taskData, 'agent-id');\n";
    report += "```\n";
  } else {
    report += `## No Issues Found\n\n`;
    report += `No direct calls to \`createTask\` were found. All task creation appears to be using \`createTaskForAgent\` correctly.\n`;
  }
  
  return report;
}

// Main execution
console.log('Scanning codebase for direct uses of createTask...');

// Try git grep first, fall back to directory scan
if (!scanWithGit()) {
  scanDirectory(SOURCE_DIR);
}

// Generate and save report
const report = generateReport();
const reportPath = path.resolve(__dirname, '../scheduler-task-creation-audit.md');
fs.writeFileSync(reportPath, report);

console.log(`\nScan complete!`);
console.log(`- Scanned ${results.scannedFiles} files`);
console.log(`- Found ${results.issueFiles} files with potential issues`);
console.log(`- Total potential issues: ${results.potentialIssues.reduce((sum, issue) => sum + issue.count, 0)}`);
console.log(`\nReport saved to: ${reportPath}`);

// Exit with error code if issues were found
process.exit(results.issueFiles > 0 ? 1 : 0); 