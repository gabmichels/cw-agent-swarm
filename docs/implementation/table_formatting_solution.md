# Table Formatting Solution for Coda Integration

## Problem
Markdown tables from LLM responses and chat exports don't display properly in Coda documents, appearing as raw markdown instead of formatted tables.

## Solution
Created a shared utility `CodaFormatting.ts` that converts markdown tables to multiple Coda-friendly formats.

## Implementation

### Shared Utility Location
```
src/agents/shared/tools/utils/CodaFormatting.ts
```

### Key Functions

#### `formatContentForCoda(content, options)`
Main function that processes content for optimal Coda display:
- Converts markdown tables to HTML + fallback formats
- Handles different content formats (markdown, plain, html)
- Preserves content structure while improving readability

#### `convertMarkdownTablesToCodaFormat(content)`
Converts markdown tables to:
1. **HTML Table**: Styled table with borders and headers
2. **Bulleted Format**: Most reliable format in Coda
   - Example: "• **Item 1:** - **Day:** Day 1 - **Action:** Create social channels - **Owner:** Social Agent"

### Usage Examples

#### Export Route (Current)
```typescript
import { formatContentForCoda } from '../../../../../agents/shared/tools/utils/CodaFormatting';

const formattedContent = formatContentForCoda(content, {
  format: 'markdown',
  convertTables: true,
  preserveStructure: true
});
```

#### LLM Workflow (Phase 3.1)
```typescript
import { formatContentForCoda } from '../../shared/tools/utils/CodaFormatting';

// When LLM generates response with tables
const llmResponse = "Here's your action plan:\n\n| Day | Action | Owner |\n|-----|--------|-------|\n...";
const codaReadyContent = formatContentForCoda(llmResponse, {
  convertTables: true
});
```

## Conversion Example

### Input (Markdown Table)
```markdown
| Day | Action | Owner |
|-----|--------|-------|
| Day 1 | Create all social channels | Social Agent |
| Day 2 | Develop content calendar | Content Agent |
```

### Output (Coda-Friendly)
```html
<table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">
  <thead>
    <tr>
      <th style="padding: 8px; background-color: #f5f5f5;">Day</th>
      <th style="padding: 8px; background-color: #f5f5f5;">Action</th>
      <th style="padding: 8px; background-color: #f5f5f5;">Owner</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 8px;">Day 1</td>
      <td style="padding: 8px;">Create all social channels</td>
      <td style="padding: 8px;">Social Agent</td>
    </tr>
  </tbody>
</table>

**Alternative Format:**

• **Day Day 1:**
  - **Day:** Day 1
  - **Action:** Create all social channels
  - **Owner:** Social Agent

• **Day Day 2:**
  - **Day:** Day 2
  - **Action:** Develop content calendar
  - **Owner:** Content Agent
```

## Integration Points

### Current Integration
- ✅ **Export Route**: `src/app/api/multi-agent/export/coda/route.ts`
  - Used when "Export to Coda" button is clicked
  - Handles chat message exports with table formatting

### Future Integration (Phase 3.1)
- 🚧 **LLM-to-Coda Workflow**: When implementing automatic LLM response → Coda workflow
  - Must import and use `formatContentForCoda()` 
  - Ensure consistency with export functionality
  - Handle real-time table conversion for LLM-generated content

## Benefits
1. **Consistency**: Same table formatting across all Coda integrations
2. **Reliability**: Multiple format options (HTML + bulleted fallback)
3. **Maintainability**: Single source of truth for table formatting logic
4. **Extensibility**: Easy to add new formatting options as needed

## Next Steps for Phase 3.1
When implementing LLM-to-Coda workflow:
1. Import `formatContentForCoda` from shared utility
2. Apply table formatting before sending to Coda API
3. Use same configuration options as export route
4. Test with various table formats from LLM responses 