# PowerShell script to run memory retrieval tests

Write-Host "Running Memory Retriever Integration Tests..." -ForegroundColor Green

# Enable TypeScript transpile-only mode to bypass strict type checking
npx ts-node --transpile-only tests/memory-retrieval/memory-retriever-test.ts

Write-Host "Tests completed." -ForegroundColor Green 