#!/usr/bin/env python3

import os
import json
import ast
from pathlib import Path
from typing import Dict, List, Set, Tuple
import re
from collections import defaultdict
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('codebase_analysis.log'),
        logging.StreamHandler()
    ]
)

class CodebaseAnalyzer:
    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir)
        self.ignore_dirs = {'.git', 'node_modules', '.next', '__pycache__'}
        self.typescript_extensions = {'.ts', '.tsx'}
        self.javascript_extensions = {'.js', '.jsx'}
        self.python_extensions = {'.py'}
        self.allowed_extensions = self.typescript_extensions | self.javascript_extensions | self.python_extensions
        
        # Analysis results
        self.file_count = defaultdict(int)
        self.total_lines = defaultdict(int)
        self.imports = defaultdict(set)
        self.dependencies = set()
        self.potential_issues = []
        self.complexity_scores = {}

    def analyze_codebase(self) -> Dict:
        """Main method to analyze the codebase."""
        logging.info(f"Starting codebase analysis in {self.root_dir}")
        
        for root, dirs, files in os.walk(self.root_dir):
            # Skip ignored directories
            dirs[:] = [d for d in dirs if d not in self.ignore_dirs]
            
            for file in files:
                file_path = Path(root) / file
                if file_path.suffix in self.allowed_extensions:
                    self._analyze_file(file_path)

        return self._generate_report()

    def _analyze_file(self, file_path: Path) -> None:
        """Analyze a single file and update the analysis results."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            ext = file_path.suffix
            self.file_count[ext] += 1
            self.total_lines[ext] += len(content.splitlines())
            
            if ext in self.typescript_extensions | self.javascript_extensions:
                self._analyze_typescript_javascript(file_path, content)
            elif ext in self.python_extensions:
                self._analyze_python(file_path, content)
                
        except Exception as e:
            logging.error(f"Error analyzing {file_path}: {str(e)}")
            self.potential_issues.append(f"Error reading {file_path}: {str(e)}")

    def _analyze_typescript_javascript(self, file_path: Path, content: str) -> None:
        """Analyze TypeScript/JavaScript files."""
        # Find imports
        import_pattern = r'import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+[\'"]([^\'"]+)[\'"]'
        imports = re.findall(import_pattern, content)
        self.imports[file_path].update(imports)
        
        # Find potential issues
        if len(content.splitlines()) > 500:
            self.potential_issues.append(f"Large file detected: {file_path} ({len(content.splitlines())} lines)")
        
        # Check for TODO comments
        todos = re.findall(r'//\s*TODO:', content, re.IGNORECASE)
        if todos:
            self.potential_issues.append(f"TODOs found in {file_path}: {len(todos)} items")

    def _analyze_python(self, file_path: Path, content: str) -> None:
        """Analyze Python files."""
        try:
            tree = ast.parse(content)
            
            # Find imports
            for node in ast.walk(tree):
                if isinstance(node, (ast.Import, ast.ImportFrom)):
                    if isinstance(node, ast.Import):
                        for name in node.names:
                            self.imports[file_path].add(name.name)
                    else:
                        self.imports[file_path].add(node.module)
            
            # Calculate complexity (simplified)
            complexity = sum(1 for node in ast.walk(tree) if isinstance(node, (ast.If, ast.For, ast.While, ast.Try)))
            self.complexity_scores[file_path] = complexity
            
            if complexity > 20:
                self.potential_issues.append(f"High complexity detected in {file_path}: {complexity} control structures")
                
        except SyntaxError as e:
            self.potential_issues.append(f"Syntax error in {file_path}: {str(e)}")

    def _generate_report(self) -> Dict:
        """Generate a comprehensive report of the analysis."""
        report = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_files": sum(self.file_count.values()),
                "files_by_extension": dict(self.file_count),
                "total_lines": sum(self.total_lines.values()),
                "lines_by_extension": dict(self.total_lines),
            },
            "dependencies": {
                "internal_imports": {str(k): list(v) for k, v in self.imports.items()},
            },
            "issues": {
                "potential_issues": self.potential_issues,
                "high_complexity_files": {
                    str(k): v for k, v in self.complexity_scores.items() 
                    if v > 20
                }
            },
            "recommendations": self._generate_recommendations()
        }
        
        return report

    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on the analysis."""
        recommendations = []
        
        # File size recommendations
        large_files = [issue for issue in self.potential_issues if "Large file detected" in issue]
        if large_files:
            recommendations.append("Consider splitting large files into smaller, more manageable modules")
        
        # Complexity recommendations
        if any(score > 20 for score in self.complexity_scores.values()):
            recommendations.append("Review and refactor files with high complexity scores")
        
        # TODO recommendations
        todos = [issue for issue in self.potential_issues if "TODOs found" in issue]
        if todos:
            recommendations.append("Address pending TODOs in the codebase")
        
        return recommendations

def main():
    # Get the root directory (assuming script is run from project root)
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    analyzer = CodebaseAnalyzer(root_dir)
    report = analyzer.analyze_codebase()
    
    # Save the report
    report_path = os.path.join(root_dir, 'codebase_analysis_report.json')
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
    
    logging.info(f"Analysis complete. Report saved to {report_path}")
    
    # Print summary
    print("\nCodebase Analysis Summary:")
    print(f"Total files analyzed: {report['summary']['total_files']}")
    print(f"Total lines of code: {report['summary']['total_lines']}")
    print(f"Files by extension: {report['summary']['files_by_extension']}")
    print(f"\nPotential issues found: {len(report['issues']['potential_issues'])}")
    print("\nRecommendations:")
    for rec in report['recommendations']:
        print(f"- {rec}")

if __name__ == "__main__":
    main() 