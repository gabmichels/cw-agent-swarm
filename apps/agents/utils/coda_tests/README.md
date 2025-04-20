# Coda Integration Test Utilities

This directory contains utilities for testing and debugging the Coda API integration.

## Files

- `run_coda_test.bat`: A Windows batch file that runs a test of the Coda API integration
- `minimal_coda_test.py`: A Python script that tests basic Coda API functionality

## Usage

1. Ensure your `.env` file contains a valid `CODA_API_TOKEN` with appropriate permissions
2. Run `run_coda_test.bat` from this directory
3. Check the output to verify if Coda integration is working properly

## Common Issues

1. **API Token Not Found**: Ensure your `.env` file has `CODA_API_TOKEN=your_token_here` (not `CODA_API_KEY`)
2. **403 Forbidden**: Your token lacks the necessary permissions. Generate a new token with both read and write access.
3. **Import Failures**: Verify that your Python path includes the project root directory

## Creating a Coda API Token

1. Go to [Coda Account Settings](https://coda.io/account)
2. Navigate to the "API tokens" section
3. Click "Create Token"
4. Give it a name (e.g., "Document Creation Access")
5. Select all the necessary permissions:
   - **Read**: To list documents
   - **Write**: To create/update documents
6. Copy the new token and update your `.env` file 