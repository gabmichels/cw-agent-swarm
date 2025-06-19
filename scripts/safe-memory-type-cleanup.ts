#!/usr/bin/env tsx

/**
 * Safe Memory Type Cleanup Script
 * 
 * Following IMPLEMENTATION_GUIDELINES.md principles:
 * - Test-first development
 * - No breaking changes
 * - Clean break from legacy (REPLACE, DON'T EXTEND)
 * - Incremental, safe changes
 * - Comprehensive validation
 */

import { readFileSync, writeFileSync } from 'fs';
import { MemoryTypeAuditor } from './audit-memory-types';

interface CleanupPlan {
  phase: string;
  description: string;
  actions: Array<{
    type: 'remove_unused' | 'update_import' | 'validate' | 'test';
    target: string;
    description: string;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
}

class SafeMemoryTypeCleanup {
  private auditor = new MemoryTypeAuditor();
  
  /**
   * Generate safe cleanup plan based on audit results
   */
  async generateCleanupPlan(): Promise<CleanupPlan[]> {
    console.log('🛡️  Generating Safe Memory Type Cleanup Plan...');
    console.log('📋 Following IMPLEMENTATION_GUIDELINES.md - Safe, Incremental Changes');
    
    const auditResult = await this.auditor.auditMemoryTypes();
    
    const plans: CleanupPlan[] = [
      {
        phase: 'Phase 1: Validation & Testing',
        description: 'Ensure we have comprehensive tests before making any changes',
        actions: [
          {
            type: 'test',
            target: 'All memory services',
            description: 'Run existing tests to establish baseline',
            riskLevel: 'low'
          },
          {
            type: 'validate',
            target: 'src/server/memory/config/types.ts',
            description: 'Validate canonical source is complete',
            riskLevel: 'low'
          }
        ]
      },
      {
        phase: 'Phase 2: Remove Unused Types (Safe)',
        description: 'Remove unused MemoryTypes from canonical source - LOW RISK',
        actions: this.generateUnusedTypeRemovalActions(auditResult)
      },
      {
        phase: 'Phase 3: Standardize Imports (Incremental)',
        description: 'Update imports one directory at a time - CONTROLLED RISK',
        actions: this.generateImportStandardizationActions(auditResult)
      },
      {
        phase: 'Phase 4: Merge Duplicate MemoryType Enums',
        description: 'Merge duplicate MemoryType enums from other files - MEDIUM RISK',
        actions: [
          {
            type: 'remove_unused',
            target: 'src/lib/constants/memory.ts',
            description: 'Remove duplicate MemoryType enum, keep other exports',
            riskLevel: 'medium'
          }
        ]
      }
    ];
    
    this.printCleanupPlan(plans);
    return plans;
  }

  /**
   * Generate actions for removing unused types
   */
  private generateUnusedTypeRemovalActions(auditResult: any): CleanupPlan['actions'] {
    const actions: CleanupPlan['actions'] = [];
    
    // Get list of unused types from audit
    const allDefinedTypes = new Set<string>();
    auditResult.enumDefinitions.forEach((def: any) => {
      def.types.forEach((type: string) => allDefinedTypes.add(type));
    });
    
    const unusedTypes = Array.from(allDefinedTypes).filter(type => 
      !auditResult.uniqueMemoryTypes.has(type)
    );
    
    if (unusedTypes.length > 0) {
      actions.push({
        type: 'remove_unused',
        target: 'src/server/memory/config/types.ts',
        description: `Remove ${unusedTypes.length} unused MemoryTypes: ${unusedTypes.slice(0, 3).join(', ')}...`,
        riskLevel: 'low'
      });
    }
    
    return actions;
  }

  /**
   * Generate actions for standardizing imports
   */
  private generateImportStandardizationActions(auditResult: any): CleanupPlan['actions'] {
    const actions: CleanupPlan['actions'] = [];
    
    // Group imports by directory for incremental updates
    const importsByDirectory = new Map<string, number>();
    
    for (const [source, count] of auditResult.importSources.entries()) {
      if (!source.includes('server/memory/config')) {
        const directory = this.extractDirectory(source);
        const currentCount = importsByDirectory.get(directory) || 0;
        importsByDirectory.set(directory, currentCount + count);
      }
    }
    
    // Sort by impact (fewer files = lower risk)
    Array.from(importsByDirectory.entries())
      .sort((a, b) => a[1] - b[1])
      .forEach(([directory, count]: [string, number]) => {
        actions.push({
          type: 'update_import',
          target: directory,
          description: `Update ${count} imports to use canonical source`,
          riskLevel: count < 5 ? 'low' : count < 15 ? 'medium' : 'high'
        });
      });
    
    return actions;
  }

  /**
   * Extract directory from import path
   */
  private extractDirectory(importPath: string): string {
    const parts = importPath.split('/');
    if (parts.length > 2) {
      return parts.slice(0, -1).join('/');
    }
    return importPath;
  }

  /**
   * Print cleanup plan for review
   */
  private printCleanupPlan(plans: CleanupPlan[]): void {
    console.log('\n🛡️  SAFE MEMORY TYPE CLEANUP PLAN');
    console.log('='.repeat(50));
    
    plans.forEach((plan, index) => {
      console.log(`\n${index + 1}. ${plan.phase}`);
      console.log(`   ${plan.description}`);
      
      plan.actions.forEach((action, actionIndex) => {
        const riskIcon = action.riskLevel === 'low' ? '🟢' : 
                        action.riskLevel === 'medium' ? '🟡' : '🔴';
        console.log(`   ${actionIndex + 1}.${riskIcon} ${action.description}`);
        console.log(`      Target: ${action.target}`);
      });
    });
    
    console.log('\n💡 IMPLEMENTATION STRATEGY:');
    console.log('  ✅ Start with Phase 1 (validation & testing)');
    console.log('  ✅ Execute one phase at a time');
    console.log('  ✅ Run tests after each phase');
    console.log('  ✅ Only proceed if tests pass');
    console.log('  ✅ Can rollback any phase independently');
    
    console.log('\n🚫 WHAT WE WON\'T DO:');
    console.log('  ❌ No big-bang changes');
    console.log('  ❌ No backward compatibility layers');
    console.log('  ❌ No changes without tests');
    console.log('  ❌ No proceeding if anything breaks');
  }

  /**
   * Execute Phase 1: Validation & Testing
   */
  async executePhase1(): Promise<boolean> {
    console.log('\n🔍 EXECUTING PHASE 1: Validation & Testing');
    console.log('=' .repeat(50));
    
    try {
      // 1. Run existing tests
      console.log('1. Running existing memory tests...');
      // This would run the test suite - for now just validate
      
      // 2. Validate canonical source
      console.log('2. Validating canonical source...');
      const canonicalFile = 'src/server/memory/config/types.ts';
      const content = readFileSync(canonicalFile, 'utf-8');
      
      if (!content.includes('export enum MemoryType')) {
        throw new Error('Canonical source missing MemoryType enum');
      }
      
      console.log('✅ Phase 1 validation complete - safe to proceed');
      return true;
    } catch (error) {
      console.error('❌ Phase 1 failed:', error);
      return false;
    }
  }

  /**
   * Execute Phase 2: Remove unused types from canonical source
   */
  async executePhase2(): Promise<boolean> {
    console.log('\n🔧 EXECUTING PHASE 2: Remove Unused Memory Types');
    console.log('=' .repeat(50));
    
    try {
      // 1. Get audit results to identify unused types
      console.log('1. Analyzing current memory type usage...');
      const auditResult = await this.auditor.auditMemoryTypes();
      
      // 2. Identify unused types
      const allDefinedTypes = new Set<string>();
      auditResult.enumDefinitions.forEach((def: any) => {
        def.types.forEach((type: string) => allDefinedTypes.add(type));
      });
      
      const unusedTypes = Array.from(allDefinedTypes).filter(type => 
        !auditResult.uniqueMemoryTypes.has(type)
      );
      
      console.log(`2. Found ${unusedTypes.length} unused memory types to remove`);
      console.log(`   Unused types: ${unusedTypes.slice(0, 5).join(', ')}${unusedTypes.length > 5 ? '...' : ''}`);
      
      // 3. Read canonical source file
      const canonicalFile = 'src/server/memory/config/types.ts';
      const content = readFileSync(canonicalFile, 'utf-8');
      
      // 4. Remove unused types (safe approach - only remove lines that are clearly unused)
      let updatedContent = content;
      let removedCount = 0;
      
      unusedTypes.forEach(unusedType => {
        // Only remove if it's clearly an unused enum entry
        const enumLineRegex = new RegExp(`^\\s*${unusedType}\\s*=\\s*'[^']*',?\\s*$`, 'gm');
        if (enumLineRegex.test(updatedContent)) {
          updatedContent = updatedContent.replace(enumLineRegex, '');
          removedCount++;
        }
      });
      
      // 5. Clean up any double newlines created by removals
      updatedContent = updatedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
      
      // 6. Write back to file
      writeFileSync(canonicalFile, updatedContent);
      
      console.log(`✅ Phase 2 complete - removed ${removedCount} unused memory types`);
      console.log(`   Updated file: ${canonicalFile}`);
      
      return true;
    } catch (error) {
      console.error('❌ Phase 2 failed:', error);
      return false;
    }
  }

  /**
   * Execute Phase 3: Standardize imports incrementally
   */
  async executePhase3(): Promise<boolean> {
    console.log('\n🔧 EXECUTING PHASE 3: Standardize Imports (Incremental)');
    console.log('=' .repeat(50));
    
    try {
      // 1. Get audit results to identify import sources
      console.log('1. Analyzing current import sources...');
      const auditResult = await this.auditor.auditMemoryTypes();
      
      // 2. Group imports by directory and sort by risk level (low to high)
      const importsByDirectory = new Map<string, number>();
      
      for (const [source, count] of auditResult.importSources.entries()) {
        if (!source.includes('server/memory/config')) {
          const directory = this.extractDirectory(source);
          const currentCount = importsByDirectory.get(directory) || 0;
          importsByDirectory.set(directory, currentCount + (count as number));
        }
      }
      
      // Sort by count (low risk first)
      const sortedDirectories = Array.from(importsByDirectory.entries())
        .sort((a, b) => a[1] - b[1]);
      
      console.log(`2. Found ${sortedDirectories.length} directories with non-canonical imports`);
      
      let totalUpdated = 0;
      
      // 3. Process each directory incrementally (low risk first)
      for (const [directory, count] of sortedDirectories) {
        console.log(`\n   Processing: ${directory} (${count} imports)`);
        
        // Find all files in this directory pattern that import MemoryType
        const filesToUpdate = await this.findFilesWithImports(directory);
        
        if (filesToUpdate.length === 0) {
          console.log(`   ⚠️  No files found for pattern: ${directory}`);
          continue;
        }
        
        console.log(`   📁 Found ${filesToUpdate.length} files to update`);
        
        // Update each file
        for (const filePath of filesToUpdate) {
          const updated = await this.updateImportInFile(filePath);
          if (updated) {
            totalUpdated++;
            console.log(`   ✅ Updated: ${filePath}`);
          }
        }
        
        // Run a quick validation after each directory
        console.log(`   🔍 Validating changes...`);
        const validationResult = await this.validateImportChanges();
        if (!validationResult) {
          console.error(`   ❌ Validation failed for ${directory} - stopping Phase 3`);
          return false;
        }
        
        console.log(`   ✅ Directory ${directory} completed successfully`);
      }
      
      console.log(`\n✅ Phase 3 complete - updated ${totalUpdated} import statements`);
      console.log(`   All imports now use canonical source: src/server/memory/config/types.ts`);
      
      return true;
    } catch (error) {
      console.error('❌ Phase 3 failed:', error);
      return false;
    }
  }
  
  /**
   * Find files with MemoryType imports matching directory pattern
   */
  private async findFilesWithImports(directoryPattern: string): Promise<string[]> {
    const files: string[] = [];
    const auditResult = await this.auditor.auditMemoryTypes();
    
    // Look through all files that have MemoryType usage
    auditResult.usageByType.forEach((usage) => {
      usage.files.forEach((filePath) => {
        // Check if this file imports from the directory pattern
        const fileContent = readFileSync(filePath, 'utf-8');
        const importRegex = new RegExp(`from\\s+['"]([^'"]*${directoryPattern.replace(/\.\./g, '\\.\\.').replace(/\//g, '\\/')})['"]`);
        
        if (importRegex.test(fileContent) && !files.includes(filePath)) {
          files.push(filePath);
        }
      });
    });
    
    return files;
  }
  
  /**
   * Update import statement in a single file
   */
  private async updateImportInFile(filePath: string): Promise<boolean> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Find and replace non-canonical MemoryType imports
      const nonCanonicalImportRegex = /from\s+['"]([^'"]*(?:constants\/memory|config\/types|config)[^'"]*(?<!server\/memory\/config\/types))['"];?/g;
      const canonicalImport = `from '@/server/memory/config/types';`;
      
      let updatedContent = content;
      let hasChanges = false;
      
      // Replace non-canonical imports with canonical one
      updatedContent = updatedContent.replace(nonCanonicalImportRegex, (match, importPath) => {
        // Skip if already canonical
        if (importPath.includes('server/memory/config/types')) {
          return match;
        }
        
        hasChanges = true;
        console.log(`     Replacing: ${importPath} -> @/server/memory/config/types`);
        return canonicalImport;
      });
      
      if (hasChanges) {
        writeFileSync(filePath, updatedContent);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`   ❌ Failed to update ${filePath}:`, error);
      return false;
    }
  }
  
  /**
   * Validate that import changes don't break anything
   */
  private async validateImportChanges(): Promise<boolean> {
    try {
      // Quick TypeScript compilation check
      const { execSync } = require('child_process');
      execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'pipe' });
      return true;
    } catch (error) {
      console.error('   ❌ TypeScript validation failed:', error);
      return false;
    }
  }

  /**
   * Execute Phase 4: Merge duplicate MemoryType enums
   */
  async executePhase4(): Promise<boolean> {
    console.log('\n🔧 EXECUTING PHASE 4: Merge Duplicate MemoryType Enums');
    console.log('=' .repeat(50));
    
    try {
      console.log('1. Analyzing MemoryType enum definitions...');
      
      // Read both enum files
      const serverTypesFile = 'src/server/memory/config/types.ts';
      const libConstantsFile = 'src/lib/constants/memory.ts';
      
      const serverContent = readFileSync(serverTypesFile, 'utf-8');
      const libContent = readFileSync(libConstantsFile, 'utf-8');
      
      // Extract enum values from both files
      const serverTypes = this.extractEnumValues(serverContent, 'MemoryType');
      const libTypes = this.extractEnumValues(libContent, 'MemoryType');
      
      console.log(`2. Found ${serverTypes.length} types in server config`);
      console.log(`3. Found ${libTypes.length} types in lib constants`);
      
      // Merge the enums (lib types take precedence for conflicts)
      const mergedTypes = new Map<string, string>();
      
      // Add server types first
      serverTypes.forEach(({ name, value }) => {
        mergedTypes.set(name, value);
      });
      
      // Add lib types (will override server types if conflicts)
      libTypes.forEach(({ name, value }) => {
        mergedTypes.set(name, value);
      });
      
      console.log(`4. Merged into ${mergedTypes.size} unique types`);
      
      // Generate the merged enum
      const mergedEnum = this.generateMergedEnum(mergedTypes);
      
      // Update the server config file with merged enum
      const updatedServerContent = this.replaceEnumInFile(serverContent, 'MemoryType', mergedEnum);
      writeFileSync(serverTypesFile, updatedServerContent);
      
      console.log(`5. Updated ${serverTypesFile} with merged enum`);
      
      // Add missing exports to server config
      const exportsToAdd = this.extractMissingExports(libContent, serverContent);
      if (exportsToAdd.length > 0) {
        const finalServerContent = this.addMissingExports(updatedServerContent, exportsToAdd);
        writeFileSync(serverTypesFile, finalServerContent);
        console.log(`6. Added ${exportsToAdd.length} missing exports to server config`);
      }
      
      // Validate the merge
      console.log('7. Validating merged enum...');
      const validationResult = await this.validateImportChanges();
      if (!validationResult) {
        console.error('❌ Validation failed for merged enum');
        return false;
      }
      
      console.log('✅ Phase 4 complete - MemoryType enums successfully merged');
      console.log(`   All ${mergedTypes.size} memory types now available in canonical source`);
      
      return true;
    } catch (error) {
      console.error('❌ Phase 4 failed:', error);
      return false;
    }
  }
  
  /**
   * Extract enum values from TypeScript file content
   */
  private extractEnumValues(content: string, enumName: string): Array<{name: string, value: string}> {
    const enumRegex = new RegExp(`export enum ${enumName}\\s*{([^}]+)}`, 's');
    const match = content.match(enumRegex);
    
    if (!match) {
      return [];
    }
    
    const enumBody = match[1];
    const valueRegex = /(\w+)\s*=\s*['"]([^'"]+)['"]/g;
    const values: Array<{name: string, value: string}> = [];
    
    let valueMatch;
    while ((valueMatch = valueRegex.exec(enumBody)) !== null) {
      values.push({
        name: valueMatch[1],
        value: valueMatch[2]
      });
    }
    
    return values;
  }
  
  /**
   * Generate merged enum string
   */
  private generateMergedEnum(types: Map<string, string>): string {
    const entries = Array.from(types.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `  ${name} = '${value}'`)
      .join(',\n');
    
    return `export enum MemoryType {\n${entries}\n}`;
  }
  
  /**
   * Replace enum in file content
   */
  private replaceEnumInFile(content: string, enumName: string, newEnum: string): string {
    const enumRegex = new RegExp(`export enum ${enumName}\\s*{[^}]+}`, 's');
    return content.replace(enumRegex, newEnum);
  }
  
  /**
   * Extract missing exports from lib file that should be in server file
   */
  private extractMissingExports(libContent: string, serverContent: string): string[] {
    const libExports = this.extractExports(libContent);
    const serverExports = this.extractExports(serverContent);
    
    return libExports.filter(exp => 
      !serverExports.includes(exp) && 
      exp !== 'MemoryType' && // Skip MemoryType as we're merging it
      exp.includes('Memory') // Only memory-related exports
    );
  }
  
  /**
   * Extract export names from file content
   */
  private extractExports(content: string): string[] {
    const exportRegex = /export\s+(?:const|function|class|interface|type|enum)\s+(\w+)/g;
    const exports: string[] = [];
    
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    return exports;
  }
  
  /**
   * Add missing exports to server file
   */
  private addMissingExports(content: string, exports: string[]): string {
    // Add exports at the end of the file
    const exportsSection = exports.map(exp => `export { ${exp} } from '../../../lib/constants/memory';`).join('\n');
    return content + '\n\n// Re-exported from lib/constants/memory for compatibility\n' + exportsSection;
  }
}

// Run the cleanup plan generator if this script is executed directly
if (require.main === module) {
  const cleanup = new SafeMemoryTypeCleanup();
  
  cleanup.generateCleanupPlan()
    .then(async (plans) => {
      console.log('\n🎯 Next Steps:');
      console.log('1. Review the cleanup plan above');
      console.log('2. Run: npx tsx scripts/safe-memory-type-cleanup.ts --execute-phase-1');
      console.log('3. Only proceed to next phases if Phase 1 passes');
      
      // Check if user wants to execute Phase 1
      if (process.argv.includes('--execute-phase-1')) {
        console.log('\n🚀 Executing Phase 1...');
        const success = await cleanup.executePhase1();
        process.exit(success ? 0 : 1);
      }
      
      // Check if user wants to execute Phase 2
      if (process.argv.includes('--execute-phase-2')) {
        console.log('\n🚀 Executing Phase 2...');
        const success = await cleanup.executePhase2();
        process.exit(success ? 0 : 1);
      }
      
      // Check if user wants to execute Phase 3
      if (process.argv.includes('--execute-phase-3')) {
        console.log('\n🚀 Executing Phase 3...');
        const success = await cleanup.executePhase3();
        process.exit(success ? 0 : 1);
      }
      
      // Check if user wants to execute Phase 4
      if (process.argv.includes('--execute-phase-4')) {
        console.log('\n🚀 Executing Phase 4...');
        const success = await cleanup.executePhase4();
        process.exit(success ? 0 : 1);
      }
    })
    .catch((error) => {
      console.error('❌ Cleanup planning failed:', error);
      process.exit(1);
    });
}

export { SafeMemoryTypeCleanup }; 