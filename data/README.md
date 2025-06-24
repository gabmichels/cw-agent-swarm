# Data Directory

This directory contains static data files used by the agents in the system. This includes:

- Training data
- Initial memory documents
- Configuration files
- Other static resources
- **N8N Workflow Repository** (external dependency)

## Structure

- `memory/` - Initial memory for agents
- `config/` - Configuration files
- `resources/` - Shared resources
- `agents/` - Agent-specific data and configurations
- `knowledge/` - Knowledge base files organized by domain
- `sources/` - External data source configurations
- `files/` - File storage and uploads
- `cache/` - Temporary cache files
- `n8n-workflows-repo/` - **External N8N workflow repository (requires setup)**

## 🚨 Required Setup: N8N Workflows Repository

**IMPORTANT**: After cloning this repository, you must set up the N8N workflows repository for workflow functionality to work.

### Setup Instructions

1. **Navigate to the data directory**:
   ```bash
   cd data/
   ```

2. **Clone the N8N workflows repository**:
   ```bash
   git clone https://github.com/Zie619/n8n-workflows.git n8n-workflows-repo
   ```

3. **Install Python dependencies** (requires Python 3.7+):
   ```bash
   cd n8n-workflows-repo
   pip install -r requirements.txt
   # or on Windows:
   py -m pip install -r requirements.txt
   ```

4. **Initialize the workflow database**:
   ```bash
   python workflow_db.py --index
   # or on Windows:
   py workflow_db.py --index
   ```

5. **Start the FastAPI server** (optional for development):
   ```bash
   python api_server.py --port 8080
   # or on Windows:
   py api_server.py --port 8080
   ```

### Verification

After setup, you should have:
- ✅ `data/n8n-workflows-repo/` directory with 2,053+ workflow files
- ✅ `data/n8n-workflows-repo/workflows.db` SQLite database
- ✅ FastAPI server running on `http://localhost:8080` (if started)

### Updating Workflows

To update to the latest workflows:
```bash
cd data/n8n-workflows-repo
git pull origin main
python workflow_db.py --reindex
# or on Windows:
py workflow_db.py --reindex
```

### Troubleshooting

**Common Issues:**

1. **Python not found**: Install Python 3.7+ from [python.org](https://python.org)
2. **Permission errors**: Run commands as administrator (Windows) or use `sudo` (Linux/Mac)
3. **Port 8080 in use**: Change port with `--port 8081` or kill existing process
4. **Database errors**: Delete `workflows.db` and re-run `--index` command

**Dependencies:**
- Python 3.7+ with pip
- Git (for cloning and updates)
- ~50MB disk space for workflows and database

### Future Plans

> **Note**: In future versions, the N8N workflows repository may be moved to a separate external location outside this project for better modularity and easier maintenance.

## Usage

Data in this directory is designed to be read by the `@crowd-wisdom/data` package,
which provides utilities for loading and interacting with these files in a
structured way.

```typescript
import { loadMemoryData } from '@crowd-wisdom/data';

// Load initial memory for Chloe
const chloeMemory = await loadMemoryData('chloe');

// Access workflow data (after setup)
import { WorkflowSearchService } from '../src/services/external-workflows';
const workflows = await WorkflowSearchService.search('email automation');
```

## Security Notes

- The `n8n-workflows-repo/` directory contains external code and should be treated with appropriate caution
- Database files contain indexed workflow metadata only (no sensitive data)
- FastAPI server runs locally only by default 