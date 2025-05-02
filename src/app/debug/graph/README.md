# Debug Graph Visualization

This component provides visualization and debugging tools for Chloe's decision-making process by showing both:

1. Execution traces - What steps were taken, in what order, and with what results
2. Knowledge graph - What information was used to make decisions

## Features

- **Tabbed Interface**: Switch between execution trace and knowledge graph views.
- **Execution Trace View**: Shows the detailed steps of the most recent task execution.
- **Knowledge Graph View**: Visualizes the knowledge entities and their relationships.
- **Connected Visualization**: Highlights which knowledge nodes were used in each execution step.
- **Filtering**: Filter knowledge graph by entity type, search terms, etc.

## How It Works

### Execution Trace

The execution trace shows each step in Chloe's decision-making process:

- The goal that was being pursued
- A list of sub-goals or steps with their statuses
- Timestamps and durations
- Success/error status for each step
- Final results or errors

### Knowledge Graph

The knowledge graph shows the structured information Chloe used to make decisions:

- Concepts - Key ideas and topics
- Tasks - Action items and operations
- Tools - Instruments or methods used to accomplish tasks
- Strategies - Approaches to solving problems
- Insights - Learned information from experiences

### Connection Mechanism

The debug graph connects execution traces with knowledge graph elements using a content-based mapping:

1. Extraction: Keywords and concepts are extracted from execution trace steps
2. Matching: These keywords are matched with knowledge graph nodes
3. Relevance: A confidence score is calculated for each match
4. Visualization: Connected elements are highlighted when a trace step is selected

This allows you to see:
- Which knowledge was applied during each step
- How decisions were informed by the knowledge graph
- Where knowledge gaps may exist

## Implementation Details

The connection between execution traces and knowledge graph is implemented in the `ExecutionTraceKnowledgeConnector` service. This service analyzes the content of execution steps and finds matching knowledge graph nodes based on content similarity.

The current implementation uses a simple keyword-based matching algorithm, but this could be extended to use:
- Semantic similarity
- Causal relationships
- Reference tracking
- Metadata analysis

## Usage

1. Click on any row in the execution trace to see related knowledge nodes
2. Use filters to focus on specific types of knowledge
3. Nodes and edges with golden highlights are directly connected to the selected execution step
4. Explore the confidence and explanation of connections in the Connection Info panel

## Future Improvements

- Implement semantic similarity for better trace-to-knowledge matching
- Add bidirectional highlighting (from knowledge to trace)
- Support for historical executions and comparing different runs
- Add more detailed visualization of complex decision processes
- Include feedback mechanisms to improve the knowledge graph based on execution results 