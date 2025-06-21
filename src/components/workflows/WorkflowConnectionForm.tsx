/**
 * Workflow Connection Form - Phase 2 of Orchestration Platform
 * 
 * Allows users to connect external workflows (n8n/Zapier) to agents
 * with NLP trigger configuration and parameter definition.
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - React functional components with TypeScript
 * - Comprehensive form validation
 * - Immutable state management
 * - Error handling with user feedback
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ulid } from 'ulid';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import { PlusIcon, TrashIcon, TestTubeIcon, CheckIcon, XIcon, AlertTriangleIcon } from 'lucide-react';

// ============================================================================
// Interfaces and Types
// ============================================================================

export interface WorkflowParameter {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'object';
  readonly required: boolean;
  readonly description?: string;
  readonly defaultValue?: unknown;
}

export interface WorkflowConnectionFormData {
  readonly workflowName: string;
  readonly platform: 'n8n' | 'zapier';
  readonly workflowIdOrUrl: string;
  readonly nlpTriggers: readonly string[];
  readonly description: string;
  readonly parameters: readonly WorkflowParameter[];
}

export interface WorkflowTestResult {
  readonly success: boolean;
  readonly message: string;
  readonly executionTime?: number;
  readonly error?: string;
}

export interface WorkflowConnectionFormProps {
  readonly agentId: string;
  readonly onSubmit: (data: WorkflowConnectionFormData) => Promise<void>;
  readonly onTest?: (data: Partial<WorkflowConnectionFormData>) => Promise<WorkflowTestResult>;
  readonly onCancel?: () => void;
  readonly initialData?: Partial<WorkflowConnectionFormData>;
  readonly isSubmitting?: boolean;
}

// ============================================================================
// Validation Functions
// ============================================================================

const validateWorkflowName = (name: string): string | null => {
  if (!name.trim()) return 'Workflow name is required';
  if (name.length < 3) return 'Workflow name must be at least 3 characters';
  if (name.length > 100) return 'Workflow name must be less than 100 characters';
  return null;
};

const validateWorkflowIdOrUrl = (value: string, platform: 'n8n' | 'zapier'): string | null => {
  if (!value.trim()) return 'Workflow ID/URL is required';
  
  if (platform === 'zapier') {
    const zapierUrlPattern = /^https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[a-zA-Z0-9]+$/;
    if (!zapierUrlPattern.test(value)) {
      return 'Invalid Zapier webhook URL format. Expected: https://hooks.zapier.com/hooks/catch/123/abc';
    }
  } else if (platform === 'n8n') {
    // N8N workflow IDs are typically alphanumeric
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return 'Invalid N8N workflow ID format. Use only letters, numbers, hyphens, and underscores';
    }
  }
  
  return null;
};

const validateNlpTriggers = (triggers: readonly string[]): string | null => {
  if (triggers.length === 0) return 'At least one NLP trigger is required';
  if (triggers.some(trigger => !trigger.trim())) return 'All NLP triggers must be non-empty';
  if (triggers.some(trigger => trigger.length < 3)) return 'NLP triggers must be at least 3 characters';
  return null;
};

const validateParameters = (parameters: readonly WorkflowParameter[]): string | null => {
  const names = parameters.map(p => p.name);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length > 0) return `Duplicate parameter names: ${duplicates.join(', ')}`;
  
  for (const param of parameters) {
    if (!param.name.trim()) return 'Parameter names cannot be empty';
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(param.name)) {
      return `Invalid parameter name "${param.name}". Use only letters, numbers, and underscores, starting with a letter`;
    }
  }
  
  return null;
};

// ============================================================================
// Component Implementation
// ============================================================================

export const WorkflowConnectionForm: React.FC<WorkflowConnectionFormProps> = ({
  agentId,
  onSubmit,
  onTest,
  onCancel,
  initialData,
  isSubmitting = false
}) => {
  // ============================================================================
  // State Management
  // ============================================================================

  const [formData, setFormData] = useState<WorkflowConnectionFormData>({
    workflowName: initialData?.workflowName || '',
    platform: initialData?.platform || 'n8n',
    workflowIdOrUrl: initialData?.workflowIdOrUrl || '',
    nlpTriggers: initialData?.nlpTriggers || [''],
    description: initialData?.description || '',
    parameters: initialData?.parameters || []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<WorkflowTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // ============================================================================
  // Form Handlers
  // ============================================================================

  const updateFormData = useCallback(<K extends keyof WorkflowConnectionFormData>(
    key: K,
    value: WorkflowConnectionFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    
    // Clear related errors when field is updated
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  }, [errors]);

  const addNlpTrigger = useCallback(() => {
    updateFormData('nlpTriggers', [...formData.nlpTriggers, '']);
  }, [formData.nlpTriggers, updateFormData]);

  const updateNlpTrigger = useCallback((index: number, value: string) => {
    const newTriggers = [...formData.nlpTriggers];
    newTriggers[index] = value;
    updateFormData('nlpTriggers', newTriggers);
  }, [formData.nlpTriggers, updateFormData]);

  const removeNlpTrigger = useCallback((index: number) => {
    if (formData.nlpTriggers.length > 1) {
      const newTriggers = formData.nlpTriggers.filter((_, i) => i !== index);
      updateFormData('nlpTriggers', newTriggers);
    }
  }, [formData.nlpTriggers, updateFormData]);

  const addParameter = useCallback(() => {
    const newParameter: WorkflowParameter = {
      name: '',
      type: 'string',
      required: false,
      description: ''
    };
    updateFormData('parameters', [...formData.parameters, newParameter]);
  }, [formData.parameters, updateFormData]);

  const updateParameter = useCallback((index: number, updates: Partial<WorkflowParameter>) => {
    const newParameters = [...formData.parameters];
    newParameters[index] = { ...newParameters[index], ...updates };
    updateFormData('parameters', newParameters);
  }, [formData.parameters, updateFormData]);

  const removeParameter = useCallback((index: number) => {
    const newParameters = formData.parameters.filter((_, i) => i !== index);
    updateFormData('parameters', newParameters);
  }, [formData.parameters, updateFormData]);

  // ============================================================================
  // Validation
  // ============================================================================

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    const nameError = validateWorkflowName(formData.workflowName);
    if (nameError) newErrors.workflowName = nameError;

    const idUrlError = validateWorkflowIdOrUrl(formData.workflowIdOrUrl, formData.platform);
    if (idUrlError) newErrors.workflowIdOrUrl = idUrlError;

    const triggersError = validateNlpTriggers(formData.nlpTriggers.filter(t => t.trim()));
    if (triggersError) newErrors.nlpTriggers = triggersError;

    const parametersError = validateParameters(formData.parameters);
    if (parametersError) newErrors.parameters = parametersError;

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // ============================================================================
  // Actions
  // ============================================================================

  const handleTest = useCallback(async () => {
    if (!onTest) return;

    const basicValidation = validateWorkflowName(formData.workflowName) || 
                           validateWorkflowIdOrUrl(formData.workflowIdOrUrl, formData.platform);
    
    if (basicValidation) {
      setErrors({ test: basicValidation });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await onTest(formData);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsTesting(false);
    }
  }, [formData, onTest]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setActiveTab('basic'); // Switch to basic tab to show errors
      return;
    }

    // Filter out empty triggers
    const cleanedData: WorkflowConnectionFormData = {
      ...formData,
      nlpTriggers: formData.nlpTriggers.filter(trigger => trigger.trim())
    };

    try {
      await onSubmit(cleanedData);
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to save workflow' });
    }
  }, [formData, validateForm, onSubmit]);

  // ============================================================================
  // Auto-save draft (optional feature)
  // ============================================================================

  useEffect(() => {
    const draftKey = `workflow-draft-${agentId}`;
    const timer = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify(formData));
    }, 1000);

    return () => clearTimeout(timer);
  }, [formData, agentId]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Connect External Workflow</CardTitle>
        <CardDescription>
          Connect your n8n or Zapier workflow to this agent so it can be triggered through natural language commands.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="triggers">NLP Triggers</TabsTrigger>
              <TabsTrigger value="parameters">Parameters</TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workflowName">Workflow Name *</Label>
                  <Input
                    id="workflowName"
                    value={formData.workflowName}
                    onChange={(e) => updateFormData('workflowName', e.target.value)}
                    placeholder="e.g., Email Marketing Campaign"
                    className={errors.workflowName ? 'border-red-500' : ''}
                  />
                  {errors.workflowName && (
                    <p className="text-sm text-red-500">{errors.workflowName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platform">Platform *</Label>
                  <Select
                    value={formData.platform}
                    onValueChange={(value: 'n8n' | 'zapier') => updateFormData('platform', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="n8n">n8n</SelectItem>
                      <SelectItem value="zapier">Zapier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workflowIdOrUrl">
                  {formData.platform === 'zapier' ? 'Zapier Webhook URL' : 'n8n Workflow ID'} *
                </Label>
                <Input
                  id="workflowIdOrUrl"
                  value={formData.workflowIdOrUrl}
                  onChange={(e) => updateFormData('workflowIdOrUrl', e.target.value)}
                  placeholder={
                    formData.platform === 'zapier'
                      ? 'https://hooks.zapier.com/hooks/catch/123/abc'
                      : 'wf_abc123'
                  }
                  className={errors.workflowIdOrUrl ? 'border-red-500' : ''}
                />
                {errors.workflowIdOrUrl && (
                  <p className="text-sm text-red-500">{errors.workflowIdOrUrl}</p>
                )}
                <p className="text-sm text-gray-500">
                  {formData.platform === 'zapier'
                    ? 'Copy the webhook URL from your Zapier trigger'
                    : 'Find the workflow ID in your n8n workflow settings'
                  }
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  placeholder="Describe what this workflow does and when it should be used..."
                  rows={3}
                  className={errors.description ? 'border-red-500' : ''}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description}</p>
                )}
              </div>

              {/* Test Connection */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Test Connection</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={isTesting || !onTest}
                  >
                    <TestTubeIcon className="w-4 h-4 mr-2" />
                    {isTesting ? 'Testing...' : 'Test'}
                  </Button>
                </div>
                
                {testResult && (
                  <Alert className={testResult.success ? 'border-green-500' : 'border-red-500'}>
                    <div className="flex items-center">
                      {testResult.success ? (
                        <CheckIcon className="w-4 h-4 text-green-500 mr-2" />
                      ) : (
                        <XIcon className="w-4 h-4 text-red-500 mr-2" />
                      )}
                      <AlertDescription>
                        {testResult.message}
                        {testResult.executionTime && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({testResult.executionTime}ms)
                          </span>
                        )}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
                
                {errors.test && (
                  <Alert className="border-red-500 mt-2">
                    <AlertTriangleIcon className="w-4 h-4" />
                    <AlertDescription>{errors.test}</AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>

            {/* NLP Triggers Tab */}
            <TabsContent value="triggers" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label>Natural Language Triggers *</Label>
                  <p className="text-sm text-gray-500 mb-3">
                    Add example phrases that should trigger this workflow. Be specific and include variations.
                  </p>
                </div>

                {formData.nlpTriggers.map((trigger, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={trigger}
                      onChange={(e) => updateNlpTrigger(index, e.target.value)}
                      placeholder={`e.g., ${index === 0 ? 'start email marketing flow' : 'send the current email campaign'}`}
                      className="flex-1"
                    />
                    {formData.nlpTriggers.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeNlpTrigger(index)}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addNlpTrigger}
                  className="w-full"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add Another Trigger
                </Button>

                {errors.nlpTriggers && (
                  <Alert className="border-red-500">
                    <AlertTriangleIcon className="w-4 h-4" />
                    <AlertDescription>{errors.nlpTriggers}</AlertDescription>
                  </Alert>
                )}

                {/* Example triggers for inspiration */}
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h4 className="font-medium mb-2">Example Triggers</h4>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'start email marketing flow',
                      'send the current email campaign',
                      'launch marketing campaign',
                      'trigger email sequence',
                      'execute social media post',
                      'create customer report'
                    ].map((example) => (
                      <Badge key={example} variant="secondary" className="text-xs">
                        {example}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Parameters Tab */}
            <TabsContent value="parameters" className="space-y-4">
              <div>
                <Label>Workflow Parameters</Label>
                <p className="text-sm text-gray-500 mb-3">
                  Define parameters that can be extracted from user messages and passed to your workflow.
                </p>
              </div>

              {formData.parameters.length > 0 && (
                <div className="space-y-4">
                  {formData.parameters.map((param, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                          <Label>Parameter Name</Label>
                          <Input
                            value={param.name}
                            onChange={(e) => updateParameter(index, { name: e.target.value })}
                            placeholder="e.g., campaignName"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select
                            value={param.type}
                            onValueChange={(value: WorkflowParameter['type']) => 
                              updateParameter(index, { type: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">String</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="boolean">Boolean</SelectItem>
                              <SelectItem value="object">Object</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`required-${index}`}
                            checked={param.required}
                            onChange={(e) => updateParameter(index, { required: e.target.checked })}
                          />
                          <Label htmlFor={`required-${index}`}>Required</Label>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeParameter(index)}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="mt-3 space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={param.description || ''}
                          onChange={(e) => updateParameter(index, { description: e.target.value })}
                          placeholder="Describe this parameter..."
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={addParameter}
                className="w-full"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Parameter
              </Button>

              {errors.parameters && (
                <Alert className="border-red-500">
                  <AlertTriangleIcon className="w-4 h-4" />
                  <AlertDescription>{errors.parameters}</AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>

          <Separator />

          {/* Form Actions */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? 'Saving...' : 'Save Workflow'}
            </Button>
          </div>

          {errors.submit && (
            <Alert className="border-red-500">
              <AlertTriangleIcon className="w-4 h-4" />
              <AlertDescription>{errors.submit}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Example Usage Component
// ============================================================================

export const WorkflowConnectionFormExample: React.FC = () => {
  const handleSubmit = async (data: WorkflowConnectionFormData) => {
    console.log('Workflow data:', data);
    // Implementation would save to backend
  };

  const handleTest = async (data: Partial<WorkflowConnectionFormData>): Promise<WorkflowTestResult> => {
    // Simulate test
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: Math.random() > 0.5,
      message: Math.random() > 0.5 ? 'Connection successful!' : 'Connection failed',
      executionTime: Math.floor(Math.random() * 1000) + 500
    };
  };

  const exampleData: Partial<WorkflowConnectionFormData> = {
    workflowName: 'Email Marketing Campaign',
    platform: 'n8n',
    workflowIdOrUrl: 'wf_abc123',
    nlpTriggers: [
      'start email marketing flow',
      'send the current email marketing campaign',
      'launch marketing campaign',
      'trigger email sequence'
    ],
    description: 'Sends personalized email campaign to segmented audience',
    parameters: [
      { name: 'campaignName', type: 'string', required: true, description: 'Name of the campaign' },
      { name: 'audience', type: 'string', required: false, description: 'Target audience segment' }
    ]
  };

  return (
    <WorkflowConnectionForm
      agentId="example-agent-id"
      onSubmit={handleSubmit}
      onTest={handleTest}
      initialData={exampleData}
    />
  );
}; 