# Document Generation System

This system allows Chloe and other agents to create and update structured documents in Coda, enhancing their ability to produce and maintain complex content.

## Overview

The Document Generation System provides:

1. Creation of new documents in Coda with structured content
2. Updates to existing documents by ID or section name
3. Intelligent parsing of user requests to determine document type and structure
4. Special document types with predefined structure (e.g., marketing goals documents)

## Configuration

The system uses configuration from the global `config.py` module, which loads settings from the `.env` file.

### Environment Variables

Add these settings to your `.env` file:

```
# Coda Integration
CODA_API_KEY=your_coda_api_token_here
CODA_DOC_ID=your_coda_document_id
CODA_REFLECTION_TABLE_ID=your_table_id
CODA_WEEKLY_REFLECTION_BLOCK_ID=your_weekly_block_id
```

The `CODA_API_KEY` is required for document creation and updates.

## Usage

### Creating Documents

You can create documents using the CMO tools:

```python
from apps.agents.shared.tools.cmo_tools import create_document

# Create a general document
result = create_document(
    title="Project Overview",
    content="""
# Introduction
This document provides an overview of our project.

# Goals
Our primary goals are to...

# Timeline
We aim to complete this project by Q3 2026.
""",
    doc_type="general"
)

# Create a marketing goals document
result = create_document(
    title="Marketing Strategy 2026",
    content="""
# Goals
1. Increase market share by 15%
2. Expand into 3 new market segments
3. Launch 2 new product lines

# Strategies
## Digital Marketing
- Increase content production by 30%
- Implement advanced SEO strategy
- Leverage social media for brand awareness

## Customer Retention
- Develop loyalty program
- Enhance customer service experience

# Metrics
- Customer Acquisition Cost: target $50 by Q4
- Conversion Rate: increase to 5% by Q3
- Brand Awareness: 40% growth by year-end

# Timeline
## Q1
- Finalize strategy
- Build team structure
- Initial campaign planning

## Q2
- Launch initial campaigns
- Begin measuring baseline metrics
""",
    doc_type="marketing_goals"
)
```

### Updating Documents

You can update existing documents by ID:

```python
from apps.agents.shared.tools.cmo_tools import update_document

# Update a document
result = update_document(
    doc_id="doc-xyz123",
    content="New content to add to the document",
    section="Updates",
    append=True  # Add to existing content
)
```

### Processing Document Requests

The system can intelligently process user requests to create or update documents:

```python
from apps.agents.shared.tools.cmo_tools import process_document_request

# Process a user request
result = process_document_request(
    user_message="Can you please update your thoughts on our marketing strategy in doc-abc123?",
    generated_content="Based on recent market analysis, I recommend adjusting our strategy to..."
)
```

## Document Types

### General Documents

Generic documents with custom sections. When parsed, the system identifies section headings and organizes content appropriately.

### Marketing Goals Documents

Specialized documents with predefined sections:
- Executive Summary
- Key Goals
- Strategies
- Key Metrics
- Timeline

The system automatically formats content into these sections and creates a metrics tracking table.

## Referencing Documents

Users can reference documents in several ways:

1. Explicit ID: `doc-xyz123`
2. Bracketed ID: `[CODA_DOC_ID:doc-xyz123]`
3. URL: `https://coda.io/d/doc-xyz123`

The system will extract the document ID and update the specified document.

## Implementation Details

### Code Structure

- `document_generation.py`: Main module with document creation and parsing functions
- `coda_client.py`: Extended Coda API client with document creation capabilities
- New CMO tools in `cmo_tools.py`:
  - `create_document`
  - `update_document`
  - `process_document_request`
  - `list_coda_documents`

### Content Parsing

The system uses sophisticated regex parsing to:
- Extract document structure from free-form content
- Identify headers, sections, bullet points
- Parse marketing goals, strategies, metrics, and timelines
- Generate appropriate document structure based on content

## Example Usage Scenarios

1. **Creating Marketing Documents:**
   - "Chloe, can you create a document with our marketing goals for 2026?"
   - "Please put together a document outlining our Q3 social media strategy."

2. **Updating Existing Documents:**
   - "Chloe, please update our strategy document [CODA_DOC_ID:doc-xyz123] with the latest market research."
   - "Add your thoughts on the recent campaign results to doc-abc456."

3. **Creating Reference Documents:**
   - "Chloe, can you create a document that summarizes our quarterly results?"
   - "Please create a product roadmap document for the next two years." 