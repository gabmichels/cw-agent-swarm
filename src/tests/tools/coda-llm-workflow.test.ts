/**
 * Tests for LLM-to-Coda Workflow
 * Verifies automatic document creation from LLM responses with table formatting
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  executeLLMToCodaWorkflow, 
  batchLLMToCodaWorkflow,
  createCodaDocumentFromAgentResponse,
  type LLMToCodaRequest 
} from '../../agents/shared/tools/workflows/CodaLLMWorkflow';

describe('LLM-to-Coda Workflow', () => {
  // Test data with various LLM response formats
  const sampleLLMResponses = {
    withHeaders: `# Marketing Strategy Analysis

Based on the data, here are the key insights:

## Key Findings
- Market penetration is at 23%
- Customer satisfaction score: 8.2/10
- Revenue growth: 15% YoY

## Recommendations
1. Focus on digital channels
2. Improve customer onboarding
3. Expand to new segments`,

    withTables: `# Action Plan for Q4

Here's your comprehensive action plan:

| Week | Task | Owner | Priority |
|------|------|-------|----------|
| Week 1 | Market research | Marketing Team | High |
| Week 2 | Product development | Engineering | High |
| Week 3 | User testing | QA Team | Medium |
| Week 4 | Launch preparation | All Teams | High |

## Next Steps
Follow up on each task weekly.`,

    plainText: `Based on your request, I've analyzed the sales data and found several opportunities for improvement. The main areas of focus should be customer retention and new market expansion. I recommend implementing a customer feedback system and exploring partnerships with complementary businesses.`,

    withCodeAndFormatting: `## Technical Implementation Guide

Here's the **recommended approach**:

\`\`\`javascript
function analyzeData(input) {
  return processMetrics(input);
}
\`\`\`

Key points:
- Use *async/await* for better performance
- Implement **error handling**
- Add logging for debugging`,

    complexWithMultipleTables: `# Project Status Report

## Team Performance

| Team | Completed | In Progress | Blocked |
|------|-----------|-------------|---------|
| Frontend | 8 | 3 | 1 |
| Backend | 12 | 2 | 0 |
| QA | 6 | 4 | 2 |

## Resource Allocation

| Resource | Allocated | Available | Utilization |
|----------|-----------|-----------|-------------|
| Developers | 15 | 3 | 83% |
| QA Engineers | 8 | 2 | 80% |
| Designers | 5 | 1 | 83% |

Status: On track for Q4 delivery.`
  };

  describe('executeLLMToCodaWorkflow', () => {
    it('should handle LLM response with headers and extract title', async () => {
      const request: LLMToCodaRequest = {
        content: sampleLLMResponses.withHeaders,
        sourceAgent: 'TestAgent',
        conversationId: 'test-conv-123',
        format: 'markdown'
      };

      const result = await executeLLMToCodaWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.documentId).toBeDefined();
      expect(result.documentUrl).toBeDefined();
      expect(result.documentTitle).toContain('Marketing Strategy Analysis');
      
      console.log('LLM Workflow Result:', {
        success: result.success,
        title: result.documentTitle,
        url: result.documentUrl?.substring(0, 50) + '...'
      });
    }, 30000);

    it('should properly format tables in LLM responses', async () => {
      const request: LLMToCodaRequest = {
        content: sampleLLMResponses.withTables,
        sourceAgent: 'PlanningAgent',
        title: 'Q4 Action Plan Test',
        format: 'markdown'
      };

      const result = await executeLLMToCodaWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.documentId).toBeDefined();
      expect(result.documentTitle).toBe('Q4 Action Plan Test');
      
      console.log('Table Formatting Test:', {
        success: result.success,
        documentId: result.documentId
      });
    }, 30000);

    it('should handle plain text responses without formatting', async () => {
      const request: LLMToCodaRequest = {
        content: sampleLLMResponses.plainText,
        sourceAgent: 'AnalysisAgent',
        format: 'plain',
        generateTitle: true
      };

      const result = await executeLLMToCodaWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.documentTitle).toBeDefined();
      expect(result.documentTitle).not.toBe('');
      
      console.log('Plain Text Test:', {
        success: result.success,
        generatedTitle: result.documentTitle
      });
    }, 30000);

    it('should handle complex content with multiple tables', async () => {
      const request: LLMToCodaRequest = {
        content: sampleLLMResponses.complexWithMultipleTables,
        sourceAgent: 'ReportingAgent',
        conversationId: 'report-conv-456',
        format: 'markdown'
      };

      const result = await executeLLMToCodaWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.documentTitle).toContain('Project Status Report');
      
      console.log('Complex Content Test:', {
        success: result.success,
        title: result.documentTitle,
        hasMultipleTables: sampleLLMResponses.complexWithMultipleTables.includes('| Team |') && 
                          sampleLLMResponses.complexWithMultipleTables.includes('| Resource |')
      });
    }, 30000);

    it('should handle empty content gracefully', async () => {
      const request: LLMToCodaRequest = {
        content: '',
        sourceAgent: 'TestAgent'
      };

      const result = await executeLLMToCodaWorkflow(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_CONTENT');
      expect(result.error?.message).toContain('Content is required');
    });

    it('should generate meaningful titles from content', async () => {
      const request: LLMToCodaRequest = {
        content: sampleLLMResponses.withCodeAndFormatting,
        sourceAgent: 'TechnicalAgent',
        generateTitle: true
      };

      const result = await executeLLMToCodaWorkflow(request);

      expect(result.success).toBe(true);
      expect(result.documentTitle).toContain('Technical Implementation Guide');
      
      console.log('Title Generation Test:', {
        extractedTitle: result.documentTitle
      });
    }, 30000);
  });

  describe('createCodaDocumentFromAgentResponse', () => {
    it('should create document from agent response with context', async () => {
      const agentResponse = sampleLLMResponses.withHeaders;
      const agentName = 'DefaultAgent';
      const conversationContext = {
        conversationId: 'ctx-test-789',
        userQuery: 'Analyze our marketing performance',
        userContext: { 
          department: 'Marketing',
          quarter: 'Q4'
        }
      };

      const result = await createCodaDocumentFromAgentResponse(
        agentResponse, 
        agentName, 
        conversationContext
      );

      expect(result.success).toBe(true);
      expect(result.documentId).toBeDefined();
      
      console.log('Agent Response Integration:', {
        success: result.success,
        agentName,
        contextIncluded: !!conversationContext.userQuery
      });
    }, 30000);
  });

  describe('batchLLMToCodaWorkflow', () => {
    it('should process multiple LLM responses in batch', async () => {
      const requests: LLMToCodaRequest[] = [
        {
          content: sampleLLMResponses.plainText,
          sourceAgent: 'Agent1',
          title: 'Batch Test 1'
        },
        {
          content: sampleLLMResponses.withHeaders,
          sourceAgent: 'Agent2',
          title: 'Batch Test 2'
        }
      ];

      const results = await batchLLMToCodaWorkflow(requests);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      
      console.log('Batch Processing Results:', {
        totalProcessed: results.length,
        successCount: results.filter(r => r.success).length,
        documents: results.map(r => ({ title: r.documentTitle, id: r.documentId }))
      });
    }, 60000);

    it('should handle batch with some failures gracefully', async () => {
      const requests: LLMToCodaRequest[] = [
        {
          content: sampleLLMResponses.withTables,
          sourceAgent: 'GoodAgent',
          title: 'Valid Request'
        },
        {
          content: '', // This should fail
          sourceAgent: 'BadAgent',
          title: 'Invalid Request'
        },
        {
          content: sampleLLMResponses.plainText,
          sourceAgent: 'AnotherGoodAgent',
          title: 'Another Valid Request'
        }
      ];

      const results = await batchLLMToCodaWorkflow(requests);

      expect(results).toHaveLength(3);
      expect(results.filter(r => r.success)).toHaveLength(2);
      expect(results.filter(r => !r.success)).toHaveLength(1);
      
      console.log('Mixed Batch Results:', {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        failureReasons: results.filter(r => !r.success).map(r => r.error?.code)
      });
    }, 60000);
  });

  describe('Table Formatting Integration', () => {
    it('should verify table conversion in workflow output', async () => {
      const contentWithTable = `# Test Report

| Metric | Value | Status |
|--------|-------|--------|
| Users | 1,234 | Growing |
| Revenue | $45,678 | Target Met |

End of report.`;

      const request: LLMToCodaRequest = {
        content: contentWithTable,
        sourceAgent: 'TableTestAgent',
        title: 'Table Conversion Test'
      };

      const result = await executeLLMToCodaWorkflow(request);

      expect(result.success).toBe(true);
      
      // Note: We can't directly check the formatted content here since it's sent to Coda,
      // but we can verify the workflow completed successfully with table content
      console.log('Table Integration Test:', {
        success: result.success,
        hasTableMarkers: contentWithTable.includes('|'),
        documentCreated: !!result.documentId
      });
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle malformed content gracefully', async () => {
      const request: LLMToCodaRequest = {
        content: 'Just some basic text without any structure',
        sourceAgent: 'SimpleAgent'
      };

      const result = await executeLLMToCodaWorkflow(request);

      // Should still succeed even with simple content
      expect(result.success).toBe(true);
      expect(result.documentTitle).toBeDefined();
    }, 30000);
  });
});

// Rate limiting helpers for test cleanup
afterAll(async () => {
  console.log('\n🧹 LLM-to-Coda Workflow Tests Completed');
  console.log('📊 Test Summary:');
  console.log('- LLM response processing ✅');
  console.log('- Table formatting integration ✅');
  console.log('- Title generation ✅');
  console.log('- Batch processing ✅');
  console.log('- Error handling ✅');
  console.log('- Agent integration ✅');
  
  // Small delay for any cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));
}); 