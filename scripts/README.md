# Scripts Directory

This directory contains utility scripts for development, deployment, and maintenance of the system.

## Available Scripts

- `setup.js` - Initialize the development environment
- `loaders/memory-loader.js` - Load memory documents into the agent's memory
- `run-chloe.js` - Run a simple terminal interface to interact with the Chloe agent

## Usage

Most scripts can be run using the Node.js runtime:

```bash
node scripts/setup.js
node scripts/loaders/memory-loader.js chloe
node scripts/run-chloe.js
```

Some scripts may require additional permissions or environment variables to be set. 