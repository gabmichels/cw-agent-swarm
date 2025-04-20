#!/usr/bin/env python3
"""
Cleanup API References
---------------------
Script to remove all references to OPENAI_API_KEY from the codebase and 
replace them with OPENROUTER_API_KEY where appropriate.
"""

import os
import re
import sys
from pathlib import Path
from typing import List, Tuple


def find_files_with_pattern(root_dir: str, pattern: str, extensions: List[str] = None) -> List[str]:
    """Find all files that contain the specified pattern."""
    matching_files = []
    
    # If no extensions provided, search all files
    if extensions is None:
        extensions = ['']
        
    for ext in extensions:
        for path in Path(root_dir).rglob(f'*{ext}'):
            if path.is_file():
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        if re.search(pattern, content):
                            matching_files.append(str(path))
                except Exception as e:
                    print(f"Error reading {path}: {e}")
    
    return matching_files


def replace_in_file(file_path: str, replacements: List[Tuple[str, str]]) -> int:
    """Replace patterns in a file with their replacements."""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        original_content = content
        for pattern, replacement in replacements:
            content = re.sub(pattern, replacement, content)
        
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return 1  # Modified
        return 0  # No change
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return 0


def main():
    # Define the root directory (current directory)
    root_dir = "."
    
    # File extensions to scan
    code_extensions = ['.py', '.js', '.ts', '.md', '.txt', '.env', '.example', '.yaml', '.yml', '.json']
    
    # Find files containing OPENAI_API_KEY
    pattern = r'OPENAI_API_KEY'
    matching_files = find_files_with_pattern(root_dir, pattern, code_extensions)
    
    print(f"Found {len(matching_files)} files containing '{pattern}'")
    
    # Define replacements
    replacements = [
        # General environment variable checks
        (r'os\.environ\.get\(["\']OPENAI_API_KEY["\']\)', 'os.environ.get("OPENROUTER_API_KEY")'),
        (r'os\.getenv\(["\']OPENAI_API_KEY["\']\)', 'os.getenv("OPENROUTER_API_KEY")'),
        (r'os\.environ\[["\']OPENAI_API_KEY["\']\]', 'os.environ["OPENROUTER_API_KEY"]'),
        
        # Combined checks (OPENAI_API_KEY or OPENROUTER_API_KEY)
        (r'(not os\.environ\.get\(["\']OPENAI_API_KEY["\']\) and not os\.environ\.get\(["\']OPENROUTER_API_KEY["\']\))', 
         'not os.environ.get("OPENROUTER_API_KEY")'),
        (r'(os\.getenv\(["\']OPENROUTER_API_KEY["\']\, os\.getenv\(["\']OPENAI_API_KEY["\']\)))', 
         'os.getenv("OPENROUTER_API_KEY")'),
        
        # Error messages mentioning OPENAI_API_KEY
        (r'["\']No API key found\. Set OPENROUTER_API_KEY or OPENAI_API_KEY[^"\']*["\']', 
         '"No API key found. Set OPENROUTER_API_KEY in your environment."'),
        (r'["\']Neither OPENAI_API_KEY nor OPENROUTER_API_KEY[^"\']*["\']', 
         '"OPENROUTER_API_KEY environment variable is not set. Please set it in the .env file."'),
        
        # UI labels
        (r'["\'"]OpenAI API Key["\'"]', '"OpenRouter API Key"'),
        
        # Docker and environment variables
        (r'ENV OPENAI_API_KEY=["\'][^"\']*["\']', ''),
        (r'OPENAI_API_KEY=[^\\n]*\\n', ''),
        (r'OPENAI_API_KEY=[^\n]*\n', ''),
        
        # Other mentions
        (r'OPENAI_API_KEY', 'OPENROUTER_API_KEY'),
    ]
    
    # Process each file
    modified_count = 0
    for file_path in matching_files:
        print(f"Processing {file_path}...")
        modified = replace_in_file(file_path, replacements)
        modified_count += modified
    
    print(f"Modified {modified_count} files")


if __name__ == "__main__":
    main() 