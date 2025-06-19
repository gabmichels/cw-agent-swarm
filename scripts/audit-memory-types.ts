#!/usr/bin/env tsx

/**
 * Memory Type Usage Audit Script
 * 
 * This script safely analyzes MemoryType usage across the codebase
 * following IMPLEMENTATION_GUIDELINES.md principles:
 * - Discovery before action
 * - No changes, only analysis
 * - Comprehensive data collection
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// Types for our audit
interface MemoryTypeUsage {
  type: string;
  files: string[];
  usageCount: number;
  contexts: Array<{
    file: string;
    line: number;
    context: string;
  }>;
}

interface AuditResult {
  totalFiles: number;
  filesWithMemoryTypes: number;
  uniqueMemoryTypes: Set<string>;
  usageByType: Map<string, MemoryTypeUsage>;
  enumDefinitions: Array<{
    file: string;
    enumName: string;
    types: string[];
  }>;
  importSources: Map<string, number>;
}

class MemoryTypeAuditor {
  private result: AuditResult = {
    totalFiles: 0,
    filesWithMemoryTypes: 0,
    uniqueMemoryTypes: new Set(),
    usageByType: new Map(),
    enumDefinitions: [],
    importSources: new Map()
  };

  /**
   * Main audit function - safe discovery only
   */
  async auditMemoryTypes(): Promise<AuditResult> {
    console.log('🔍 Starting Memory Type Usage Audit...');
    console.log('📋 Following IMPLEMENTATION_GUIDELINES.md - Discovery First!');
    
    // Scan the src directory
    this.scanDirectory('./src');
    
    // Also scan tests and other relevant directories
    this.scanDirectory('./tests');
    this.scanDirectory('./testing');
    
    this.generateReport();
    return this.result;
  }

  /**
   * Recursively scan directory for TypeScript files
   */
  private scanDirectory(dirPath: string): void {
    try {
      const items = readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and other irrelevant directories
          if (!item.startsWith('.') && !['node_modules', 'dist', 'build'].includes(item)) {
            this.scanDirectory(fullPath);
          }
        } else if (stat.isFile() && this.isRelevantFile(fullPath)) {
          this.result.totalFiles++;
          this.analyzeFile(fullPath);
        }
      }
    } catch (error) {
      // Safely handle directory access errors
      console.warn(`⚠️  Could not scan directory: ${dirPath}`);
    }
  }

  /**
   * Check if file is relevant for our audit
   */
  private isRelevantFile(filePath: string): boolean {
    const ext = extname(filePath);
    return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
  }

  /**
   * Analyze a single file for MemoryType usage
   */
  private analyzeFile(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      let hasMemoryTypeUsage = false;

      // Check for enum definitions
      this.findEnumDefinitions(filePath, content);

      // Check for imports
      this.findImports(filePath, content);

      // Check for actual usage
      lines.forEach((line, index) => {
        this.findMemoryTypeUsage(filePath, line, index + 1);
        
        if (this.containsMemoryTypeReference(line)) {
          hasMemoryTypeUsage = true;
        }
      });

      if (hasMemoryTypeUsage) {
        this.result.filesWithMemoryTypes++;
      }
    } catch (error) {
      console.warn(`⚠️  Could not analyze file: ${filePath}`);
    }
  }

  /**
   * Find MemoryType enum definitions
   */
  private findEnumDefinitions(filePath: string, content: string): void {
    const enumRegex = /export\s+enum\s+MemoryType\s*\{([^}]+)\}/g;
    let match;

    while ((match = enumRegex.exec(content)) !== null) {
      const enumBody = match[1];
      const types = this.extractEnumValues(enumBody);
      
      this.result.enumDefinitions.push({
        file: filePath,
        enumName: 'MemoryType',
        types
      });
    }
  }

  /**
   * Extract enum values from enum body
   */
  private extractEnumValues(enumBody: string): string[] {
    const types: string[] = [];
    const lines = enumBody.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
        const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=/);
        if (match) {
          types.push(match[1]);
        }
      }
    }
    
    return types;
  }

  /**
   * Find import statements for MemoryType
   */
  private findImports(filePath: string, content: string): void {
    const importRegex = /import\s+.*MemoryType.*from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const count = this.result.importSources.get(importPath) || 0;
      this.result.importSources.set(importPath, count + 1);
    }
  }

  /**
   * Find actual MemoryType usage in code
   */
  private findMemoryTypeUsage(filePath: string, line: string, lineNumber: number): void {
    // Look for MemoryType.SOMETHING patterns
    const usageRegex = /MemoryType\.([A-Z_][A-Z0-9_]*)/g;
    let match;

    while ((match = usageRegex.exec(line)) !== null) {
      const memoryType = match[1];
      this.result.uniqueMemoryTypes.add(memoryType);
      
      if (!this.result.usageByType.has(memoryType)) {
        this.result.usageByType.set(memoryType, {
          type: memoryType,
          files: [],
          usageCount: 0,
          contexts: []
        });
      }

      const usage = this.result.usageByType.get(memoryType)!;
      usage.usageCount++;
      
      if (!usage.files.includes(filePath)) {
        usage.files.push(filePath);
      }
      
      usage.contexts.push({
        file: filePath,
        line: lineNumber,
        context: line.trim()
      });
    }
  }

  /**
   * Check if line contains any MemoryType reference
   */
  private containsMemoryTypeReference(line: string): boolean {
    return /MemoryType/i.test(line);
  }

  /**
   * Generate comprehensive audit report
   */
  private generateReport(): void {
    console.log('\n📊 MEMORY TYPE USAGE AUDIT REPORT');
    console.log('='.repeat(50));
    
    console.log(`\n📁 Files Scanned: ${this.result.totalFiles}`);
    console.log(`📝 Files with MemoryType Usage: ${this.result.filesWithMemoryTypes}`);
    console.log(`🔤 Unique MemoryTypes Found: ${this.result.uniqueMemoryTypes.size}`);
    
    console.log('\n🏗️  MemoryType Enum Definitions:');
    this.result.enumDefinitions.forEach(def => {
      console.log(`  📍 ${def.file}`);
      console.log(`     Types (${def.types.length}): ${def.types.slice(0, 5).join(', ')}${def.types.length > 5 ? '...' : ''}`);
    });
    
    console.log('\n📦 Import Sources:');
    Array.from(this.result.importSources.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([source, count]) => {
        console.log(`  ${count}x from: ${source}`);
      });
    
    console.log('\n🎯 Most Used MemoryTypes:');
    Array.from(this.result.usageByType.entries())
      .sort((a, b) => b[1].usageCount - a[1].usageCount)
      .slice(0, 10)
      .forEach(([type, usage]) => {
        console.log(`  ${type}: ${usage.usageCount} uses in ${usage.files.length} files`);
      });
    
    console.log('\n🚫 Potentially Unused MemoryTypes:');
    const allDefinedTypes = new Set<string>();
    this.result.enumDefinitions.forEach(def => {
      def.types.forEach(type => allDefinedTypes.add(type));
    });
    
    const unusedTypes = Array.from(allDefinedTypes).filter(type => 
      !this.result.uniqueMemoryTypes.has(type)
    );
    
    if (unusedTypes.length > 0) {
      console.log(`  Found ${unusedTypes.length} potentially unused types:`);
      unusedTypes.slice(0, 10).forEach(type => {
        console.log(`    - ${type}`);
      });
      if (unusedTypes.length > 10) {
        console.log(`    ... and ${unusedTypes.length - 10} more`);
      }
    } else {
      console.log('  ✅ All defined types appear to be used');
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('  1. Keep src/server/memory/config/types.ts as single source of truth');
    console.log('  2. Remove unused MemoryType definitions from other files');
    console.log('  3. Update imports to use canonical source');
    console.log('  4. Consider removing unused MemoryTypes after verification');
    
    console.log('\n✅ Audit Complete - No changes made (discovery only)');
  }
}

// Run the audit if this script is executed directly
if (require.main === module) {
  const auditor = new MemoryTypeAuditor();
  auditor.auditMemoryTypes()
    .then(() => {
      console.log('\n🎉 Memory Type Audit completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Audit failed:', error);
      process.exit(1);
    });
}

export { MemoryTypeAuditor }; 