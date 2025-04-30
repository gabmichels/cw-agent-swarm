import React from 'react';
import { 
  SuggestedKnowledgeProperties, 
  SuggestedConceptProperties, 
  SuggestedPrincipleProperties, 
  SuggestedFrameworkProperties, 
  SuggestedResearchProperties, 
  SuggestedRelationshipProperties 
} from '../../lib/knowledge/flagging/types'; // Adjust path as needed

interface KnowledgePreviewProps {
  suggestedType: string;
  properties: SuggestedKnowledgeProperties;
}

const KnowledgePreview: React.FC<KnowledgePreviewProps> = ({ suggestedType, properties }) => {
  
  const renderProperties = (props: any) => {
    // Helper to render key-value pairs nicely, handling arrays and objects
    return Object.entries(props)
      .filter(([key]) => key !== 'type') // Don't show the 'type' property itself
      .map(([key, value]) => {
        let displayValue: React.ReactNode;
        if (Array.isArray(value)) {
          // Display arrays as lists or comma-separated strings
          if (value.length === 0) {
            displayValue = <span className="text-gray-400 italic">None</span>;
          } else if (typeof value[0] === 'object' && value[0] !== null) {
            // Array of objects (e.g., framework steps)
            displayValue = (
              <ul className="list-disc list-inside pl-4 mt-1 space-y-1">
                {value.map((item, index) => (
                  <li key={index}>
                    {item.name ? <strong>{item.name}: </strong> : ''}
                    {item.description || JSON.stringify(item)}
                  </li>
                ))}
              </ul>
            );
          } else {
            // Simple array
            displayValue = value.join(', ');
          }
        } else if (typeof value === 'object' && value !== null) {
          // Simple objects (could be expanded, but keep simple for now)
          displayValue = JSON.stringify(value);
        } else if (typeof value === 'number' && (key === 'confidence' || key === 'strength' || key === 'relevance')) {
           displayValue = `${(value * 100).toFixed(0)}%`;
        } else {
          displayValue = String(value);
        }

        // Capitalize key for display
        const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

        return (
          <div key={key} className="mb-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{displayKey}</p>
            <p className="text-sm">{displayValue}</p>
          </div>
        );
      });
  };

  return (
    <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 mt-3">
      <h4 className="text-md font-semibold mb-3 capitalize border-b border-gray-700 pb-2">
        Preview: {suggestedType} Addition
      </h4>
      <div className="space-y-2">
        {renderProperties(properties)}
      </div>
    </div>
  );
};

export default KnowledgePreview; 