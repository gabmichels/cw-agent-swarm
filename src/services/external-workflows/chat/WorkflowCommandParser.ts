/**
 * WorkflowCommandParser.ts - Advanced natural language processing for workflow commands
 * 
 * Provides sophisticated parsing of natural language into structured workflow commands,
 * with support for intent recognition, parameter extraction, and command disambiguation.
 * Follows IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability.
 */

import { ulid } from 'ulid';
import { createLogger } from '../../../lib/logging/winston-logger';

// === Command Parsing Interfaces ===

export interface ParsedWorkflowCommand {
  readonly parseId: string; // ULID format: wf_parse_[ULID]
  readonly originalText: string;
  readonly normalizedText: string;
  readonly detectedIntent: WorkflowIntent;
  readonly extractedEntities: WorkflowEntities;
  readonly commandStructure: CommandStructure;
  readonly confidence: number;
  readonly alternativeInterpretations?: readonly AlternativeInterpretation[];
  readonly parseMetadata: ParseMetadata;
}

export interface WorkflowIntent {
  readonly primary: IntentType;
  readonly secondary?: IntentType;
  readonly confidence: number;
  readonly keywords: readonly string[];
  readonly negativeIndicators: readonly string[];
  readonly timeContext?: TimeContext;
  readonly urgencyLevel: UrgencyLevel;
}

export type IntentType =
  | 'execute_workflow'
  | 'check_execution_status'
  | 'cancel_execution'
  | 'list_available_workflows'
  | 'get_execution_history'
  | 'schedule_workflow_execution'
  | 'modify_workflow_parameters'
  | 'duplicate_workflow'
  | 'workflow_information_request'
  | 'troubleshoot_workflow';

export interface WorkflowEntities {
  readonly workflowIdentifiers: readonly WorkflowIdentifier[];
  readonly parameters: readonly ExtractedParameter[];
  readonly timeExpressions: readonly TimeExpression[];
  readonly userReferences: readonly string[];
  readonly systemReferences: readonly string[];
  readonly actionModifiers: readonly ActionModifier[];
}

export interface WorkflowIdentifier {
  readonly type: 'exact_name' | 'partial_name' | 'id' | 'alias' | 'description_based';
  readonly value: string;
  readonly confidence: number;
  readonly context: string;
  readonly position: [number, number]; // [start, end] indices in original text
}

export interface ExtractedParameter {
  readonly name: string;
  readonly value: unknown;
  readonly type: ParameterType;
  readonly confidence: number;
  readonly source: 'explicit' | 'inferred' | 'default' | 'context';
  readonly validationStatus: 'valid' | 'needs_validation' | 'invalid';
}

export type ParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'email'
  | 'url'
  | 'json_object'
  | 'array'
  | 'file_reference';

export interface TimeExpression {
  readonly originalText: string;
  readonly parsedTime?: Date;
  readonly isRelative: boolean;
  readonly timeType: 'absolute' | 'relative' | 'recurring' | 'conditional';
  readonly confidence: number;
}

export interface ActionModifier {
  readonly type: 'force' | 'dry_run' | 'silent' | 'verbose' | 'priority' | 'conditional';
  readonly value?: string;
  readonly confidence: number;
}

export interface CommandStructure {
  readonly verb: string;
  readonly object: string;
  readonly modifiers: readonly string[];
  readonly prepositions: readonly string[];
  readonly clauses: readonly CommandClause[];
  readonly sentenceType: 'imperative' | 'interrogative' | 'declarative';
}

export interface CommandClause {
  readonly type: 'main' | 'conditional' | 'temporal' | 'causal' | 'purpose';
  readonly content: string;
  readonly keywords: readonly string[];
}

export interface TimeContext {
  readonly immediacy: 'now' | 'soon' | 'later' | 'scheduled';
  readonly frequency?: 'once' | 'recurring' | 'on_demand';
  readonly constraints?: readonly string[];
}

export type UrgencyLevel = 'low' | 'normal' | 'high' | 'urgent' | 'emergency';

export interface AlternativeInterpretation {
  readonly intent: WorkflowIntent;
  readonly entities: WorkflowEntities;
  readonly confidence: number;
  readonly reasoning: string;
}

export interface ParseMetadata {
  readonly parseTime: Date;
  readonly processingDuration: number;
  readonly textComplexity: TextComplexity;
  readonly linguisticFeatures: LinguisticFeatures;
  readonly disambiguationNeeded: boolean;
  readonly confidenceFactors: ConfidenceFactors;
}

export interface TextComplexity {
  readonly wordCount: number;
  readonly sentenceCount: number;
  readonly averageWordLength: number;
  readonly complexityScore: number; // 0-1 scale
}

export interface LinguisticFeatures {
  readonly hasQuestions: boolean;
  readonly hasNegations: boolean;
  readonly hasConditionals: boolean;
  readonly hasComparatives: boolean;
  readonly hasTemporalReferences: boolean;
  readonly dominantTense: 'past' | 'present' | 'future' | 'mixed';
  readonly subjectivity: 'objective' | 'subjective' | 'mixed';
}

export interface ConfidenceFactors {
  readonly keywordMatches: number;
  readonly structuralClarity: number;
  readonly contextualCoherence: number;
  readonly entityExtractionQuality: number;
  readonly overallParsability: number;
}

// === Parser Configuration ===

export interface WorkflowCommandParserConfig {
  readonly enableAdvancedNLP: boolean;
  readonly enableContextualAnalysis: boolean;
  readonly enableAlternativeInterpretations: boolean;
  readonly maxAlternatives: number;
  readonly confidenceThreshold: number;
  readonly enableParameterInference: boolean;
  readonly enableTemporalParsing: boolean;
  readonly parsingTimeout: number;
}

const DEFAULT_PARSER_CONFIG: WorkflowCommandParserConfig = {
  enableAdvancedNLP: true,
  enableContextualAnalysis: true,
  enableAlternativeInterpretations: true,
  maxAlternatives: 3,
  confidenceThreshold: 0.6,
  enableParameterInference: true,
  enableTemporalParsing: true,
  parsingTimeout: 5000
};

// === Parser Interface ===

export interface IWorkflowCommandParser {
  parseCommand(text: string, context?: ParseContext): Promise<ParsedWorkflowCommand>;
  parseCommandSync(text: string, context?: ParseContext): ParsedWorkflowCommand;
  validateParsedCommand(parsed: ParsedWorkflowCommand): ValidationResult;
  suggestCorrections(parsed: ParsedWorkflowCommand): readonly CorrectionSuggestion[];
  extractWorkflowReferences(text: string): readonly WorkflowIdentifier[];
  extractParameters(text: string, expectedParams?: readonly string[]): readonly ExtractedParameter[];
}

export interface ParseContext {
  readonly userId?: string;
  readonly previousCommands?: readonly string[];
  readonly availableWorkflows?: readonly string[];
  readonly userPreferences?: Record<string, unknown>;
  readonly conversationHistory?: readonly string[];
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
  readonly suggestions: readonly string[];
}

export interface ValidationError {
  readonly type: 'missing_workflow' | 'invalid_parameter' | 'ambiguous_intent' | 'syntax_error';
  readonly message: string;
  readonly field?: string;
  readonly severity: 'error' | 'warning';
}

export interface ValidationWarning {
  readonly type: 'low_confidence' | 'possible_ambiguity' | 'missing_context';
  readonly message: string;
  readonly suggestion?: string;
}

export interface CorrectionSuggestion {
  readonly type: 'intent_clarification' | 'parameter_completion' | 'workflow_disambiguation';
  readonly suggestion: string;
  readonly confidence: number;
  readonly explanation: string;
}

// === Implementation ===

export class WorkflowCommandParser implements IWorkflowCommandParser {
  private readonly serviceName = 'WorkflowCommandParser';
  private readonly logger = createLogger({ moduleId: this.serviceName });
  private readonly config: WorkflowCommandParserConfig;

  // Command pattern libraries
  private readonly intentPatterns = new Map<IntentType, readonly RegExp[]>();
  private readonly parameterPatterns = new Map<ParameterType, readonly RegExp[]>();
  private readonly timePatterns: readonly RegExp[] = [];
  private readonly urgencyKeywords = new Map<UrgencyLevel, readonly string[]>();

  constructor(config: Partial<WorkflowCommandParserConfig> = {}) {
    this.config = { ...DEFAULT_PARSER_CONFIG, ...config };

    this.initializePatterns();

    this.logger.info(`[${this.serviceName}] Initialized with config`, {
      enableAdvancedNLP: this.config.enableAdvancedNLP,
      enableContextualAnalysis: this.config.enableContextualAnalysis,
      confidenceThreshold: this.config.confidenceThreshold
    });
  }

  // === Main Parsing Methods ===

  async parseCommand(
    text: string,
    context?: ParseContext
  ): Promise<ParsedWorkflowCommand> {
    const parseId = `wf_parse_${ulid()}`;
    const startTime = Date.now();

    this.logger.debug(`[${this.serviceName}] Starting async command parsing`, {
      parseId,
      textLength: text.length,
      hasContext: !!context
    });

    try {
      // Add timeout protection for async parsing
      const parsePromise = this.performParsing(parseId, text, context, startTime);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Parsing timeout')), this.config.parsingTimeout);
      });

      return await Promise.race([parsePromise, timeoutPromise]);

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Async parsing failed`, {
        parseId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback to synchronous parsing
      this.logger.info(`[${this.serviceName}] Falling back to synchronous parsing`, { parseId });
      return this.parseCommandSync(text, context);
    }
  }

  parseCommandSync(text: string, context?: ParseContext): ParsedWorkflowCommand {
    const parseId = `wf_parse_${ulid()}`;
    const startTime = Date.now();

    this.logger.debug(`[${this.serviceName}] Starting sync command parsing`, {
      parseId,
      textLength: text.length,
      hasContext: !!context
    });

    return this.performParsingSync(parseId, text, context, startTime);
  }

  // === Command Validation ===

  validateParsedCommand(parsed: ParsedWorkflowCommand): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Check confidence levels
    if (parsed.confidence < this.config.confidenceThreshold) {
      warnings.push({
        type: 'low_confidence',
        message: `Low parsing confidence (${(parsed.confidence * 100).toFixed(1)}%)`,
        suggestion: 'Consider rephrasing for better recognition'
      });
    }

    // Check for workflow identifiers
    if (parsed.extractedEntities.workflowIdentifiers.length === 0) {
      errors.push({
        type: 'missing_workflow',
        message: 'No workflow identifier found in command',
        severity: 'error'
      });
      suggestions.push('Please specify which workflow you want to work with');
    }

    // Check for ambiguous intent
    if (parsed.detectedIntent.confidence < 0.7) {
      warnings.push({
        type: 'possible_ambiguity',
        message: 'Intent may be ambiguous',
        suggestion: 'Try using more specific action words like "run", "execute", "check status", etc.'
      });
    }

    // Check for required parameters based on intent
    if (parsed.detectedIntent.primary === 'execute_workflow') {
      const hasParameters = parsed.extractedEntities.parameters.length > 0;
      if (!hasParameters) {
        warnings.push({
          type: 'missing_context',
          message: 'No parameters detected for workflow execution',
          suggestion: 'Consider providing input parameters for the workflow'
        });
      }
    }

    const isValid = errors.length === 0;

    this.logger.debug(`[${this.serviceName}] Command validation completed`, {
      parseId: parsed.parseId,
      isValid,
      errorsCount: errors.length,
      warningsCount: warnings.length
    });

    return { isValid, errors, warnings, suggestions };
  }

  // === Correction Suggestions ===

  suggestCorrections(parsed: ParsedWorkflowCommand): readonly CorrectionSuggestion[] {
    const suggestions: CorrectionSuggestion[] = [];

    // Intent clarification suggestions
    if (parsed.detectedIntent.confidence < 0.8) {
      const intentSuggestion: CorrectionSuggestion = {
        type: 'intent_clarification',
        suggestion: this.generateIntentClarification(parsed.detectedIntent),
        confidence: 0.7,
        explanation: 'The intended action is unclear. Consider using more specific verbs.'
      };
      suggestions.push(intentSuggestion);
    }

    // Parameter completion suggestions
    if (parsed.extractedEntities.parameters.length === 0 &&
      parsed.detectedIntent.primary === 'execute_workflow') {
      const paramSuggestion: CorrectionSuggestion = {
        type: 'parameter_completion',
        suggestion: 'Add parameters like: with email="user@example.com" or using name="John"',
        confidence: 0.8,
        explanation: 'Workflow execution typically requires input parameters'
      };
      suggestions.push(paramSuggestion);
    }

    // Workflow disambiguation suggestions
    if (parsed.extractedEntities.workflowIdentifiers.length > 1) {
      const workflowSuggestion: CorrectionSuggestion = {
        type: 'workflow_disambiguation',
        suggestion: `Specify which workflow: ${parsed.extractedEntities.workflowIdentifiers.map(w => `"${w.value}"`).join(' or ')}`,
        confidence: 0.9,
        explanation: 'Multiple workflows were detected. Please specify which one you mean.'
      };
      suggestions.push(workflowSuggestion);
    }

    return suggestions;
  }

  // === Entity Extraction ===

  extractWorkflowReferences(text: string): readonly WorkflowIdentifier[] {
    const identifiers: WorkflowIdentifier[] = [];
    const normalizedText = text.toLowerCase();

    // Extract quoted workflow names
    const quotedMatches = text.match(/"([^"]+)"/g);
    if (quotedMatches) {
      quotedMatches.forEach((match, index) => {
        const name = match.slice(1, -1);
        const startPos = text.indexOf(match);
        identifiers.push({
          type: 'exact_name',
          value: name,
          confidence: 0.95,
          context: 'quoted_string',
          position: [startPos, startPos + match.length]
        });
      });
    }

    // Extract workflow IDs (alphanumeric with hyphens/underscores)
    const idPattern = /\b[a-zA-Z0-9][-_a-zA-Z0-9]{2,}[a-zA-Z0-9]\b/g;
    let idMatch;
    while ((idMatch = idPattern.exec(text)) !== null) {
      if (this.looksLikeWorkflowId(idMatch[0])) {
        identifiers.push({
          type: 'id',
          value: idMatch[0],
          confidence: 0.8,
          context: 'identifier_pattern',
          position: [idMatch.index, idMatch.index + idMatch[0].length]
        });
      }
    }

    // Extract potential workflow names after keywords
    const workflowKeywords = ['workflow', 'automation', 'process', 'task'];
    workflowKeywords.forEach(keyword => {
      const pattern = new RegExp(`${keyword}\\s+(?:called\\s+|named\\s+)?([a-zA-Z][a-zA-Z0-9\\s]{2,})`, 'gi');
      let match;
      while ((match = pattern.exec(text)) !== null) {
        identifiers.push({
          type: 'partial_name',
          value: match[1].trim(),
          confidence: 0.7,
          context: `after_keyword_${keyword}`,
          position: [match.index + match[0].indexOf(match[1]), match.index + match[0].length]
        });
      }
    });

    this.logger.debug(`[${this.serviceName}] Extracted workflow references`, {
      text: text.substring(0, 100),
      identifiersCount: identifiers.length,
      types: identifiers.map(i => i.type)
    });

    return identifiers;
  }

  extractParameters(
    text: string,
    expectedParams?: readonly string[]
  ): readonly ExtractedParameter[] {
    const parameters: ExtractedParameter[] = [];

    // Extract key-value pairs
    const kvPatterns = [
      /(\w+)\s*=\s*"([^"]+)"/g,        // key="value"
      /(\w+)\s*:\s*"([^"]+)"/g,        // key: "value"
      /(\w+)\s*=\s*([^\s,]+)/g,        // key=value
      /(\w+)\s*:\s*([^\s,]+)/g,        // key: value
      /with\s+(\w+)\s*=\s*"([^"]+)"/g, // with key="value"
      /using\s+(\w+)\s*=\s*"([^"]+)"/g // using key="value"
    ];

    kvPatterns.forEach((pattern, patternIndex) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const paramName = match[1].toLowerCase();
        const paramValue = match[2];

        const parameter: ExtractedParameter = {
          name: paramName,
          value: this.convertParameterValue(paramValue),
          type: this.inferParameterType(paramValue),
          confidence: 0.8 - (patternIndex * 0.1), // Higher confidence for more explicit patterns
          source: 'explicit',
          validationStatus: 'needs_validation'
        };

        parameters.push(parameter);
      }
    });

    // Extract contextual parameters if expected params are provided
    if (expectedParams && this.config.enableParameterInference) {
      expectedParams.forEach(expectedParam => {
        if (!parameters.some(p => p.name === expectedParam)) {
          const inferredValue = this.inferParameterFromContext(text, expectedParam);
          if (inferredValue) {
            parameters.push(inferredValue);
          }
        }
      });
    }

    this.logger.debug(`[${this.serviceName}] Extracted parameters`, {
      text: text.substring(0, 100),
      parametersCount: parameters.length,
      parameterNames: parameters.map(p => p.name)
    });

    return parameters;
  }

  // === Private Implementation Methods ===

  private async performParsing(
    parseId: string,
    text: string,
    context: ParseContext | undefined,
    startTime: number
  ): Promise<ParsedWorkflowCommand> {
    // For now, delegate to sync implementation
    // In a real implementation, this could use async NLP services
    return this.performParsingSync(parseId, text, context, startTime);
  }

  private performParsingSync(
    parseId: string,
    text: string,
    context: ParseContext | undefined,
    startTime: number
  ): ParsedWorkflowCommand {
    const normalizedText = this.normalizeText(text);

    // 1. Detect intent
    const detectedIntent = this.detectIntent(normalizedText);

    // 2. Extract entities
    const extractedEntities = this.extractEntities(text, context);

    // 3. Analyze command structure
    const commandStructure = this.analyzeCommandStructure(normalizedText);

    // 4. Calculate confidence
    const confidence = this.calculateOverallConfidence(
      detectedIntent,
      extractedEntities,
      commandStructure
    );

    // 5. Generate alternatives if enabled
    const alternativeInterpretations = this.config.enableAlternativeInterpretations
      ? this.generateAlternativeInterpretations(text, detectedIntent, extractedEntities)
      : undefined;

    // 6. Create metadata
    const parseMetadata = this.createParseMetadata(
      text,
      normalizedText,
      startTime,
      confidence
    );

    const result: ParsedWorkflowCommand = {
      parseId,
      originalText: text,
      normalizedText,
      detectedIntent,
      extractedEntities,
      commandStructure,
      confidence,
      alternativeInterpretations,
      parseMetadata
    };

    this.logger.debug(`[${this.serviceName}] Command parsing completed`, {
      parseId,
      intent: detectedIntent.primary,
      confidence,
      entitiesCount: Object.values(extractedEntities).reduce((sum, arr) => sum + arr.length, 0),
      processingTime: Date.now() - startTime
    });

    return result;
  }

  private initializePatterns(): void {
    // Initialize intent patterns
    this.intentPatterns.set('execute_workflow', [
      /\b(run|execute|start|trigger|launch|fire)\b/i,
      /\b(go|do|perform|carry out)\b/i
    ]);

    this.intentPatterns.set('check_execution_status', [
      /\b(status|progress|how.*(doing|going))\b/i,
      /\b(check|see|show).*(status|progress)\b/i
    ]);

    this.intentPatterns.set('cancel_execution', [
      /\b(cancel|stop|abort|halt|terminate|kill)\b/i,
      /\b(end|cease|quit)\b/i
    ]);

    // Initialize parameter patterns
    this.parameterPatterns.set('email', [
      /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g
    ]);

    this.parameterPatterns.set('url', [
      /https?:\/\/[^\s]+/g
    ]);

    this.parameterPatterns.set('date', [
      /\b\d{4}-\d{2}-\d{2}\b/g,
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g
    ]);

    // Initialize urgency keywords
    this.urgencyKeywords.set('urgent', ['urgent', 'asap', 'immediately', 'right now', 'emergency']);
    this.urgencyKeywords.set('high', ['soon', 'quickly', 'fast', 'priority', 'important']);
    this.urgencyKeywords.set('low', ['later', 'whenever', 'eventually', 'no rush', 'low priority']);
    this.urgencyKeywords.set('normal', []);
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s"'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private detectIntent(normalizedText: string): WorkflowIntent {
    const intentScores = new Map<IntentType, number>();

    // Score each intent type
    for (const [intentType, patterns] of this.intentPatterns.entries()) {
      let score = 0;
      const matchedKeywords: string[] = [];

      patterns.forEach(pattern => {
        const matches = normalizedText.match(pattern);
        if (matches) {
          score += matches.length * 0.3;
          matchedKeywords.push(...matches);
        }
      });

      if (score > 0) {
        intentScores.set(intentType, score);
      }
    }

    // Get highest scoring intent
    let primaryIntent: IntentType = 'execute_workflow'; // default
    let maxScore = 0;
    let matchedKeywords: string[] = [];

    for (const [intent, score] of intentScores.entries()) {
      if (score > maxScore) {
        maxScore = score;
        primaryIntent = intent;
      }
    }

    // Determine urgency
    const urgencyLevel = this.detectUrgency(normalizedText);

    // Detect time context
    const timeContext = this.detectTimeContext(normalizedText);

    const confidence = Math.min(maxScore / 2, 1.0); // Normalize confidence

    return {
      primary: primaryIntent,
      confidence,
      keywords: matchedKeywords,
      negativeIndicators: [],
      timeContext,
      urgencyLevel
    };
  }

  private extractEntities(text: string, context?: ParseContext): WorkflowEntities {
    return {
      workflowIdentifiers: this.extractWorkflowReferences(text),
      parameters: this.extractParameters(text, context?.availableWorkflows),
      timeExpressions: this.extractTimeExpressions(text),
      userReferences: this.extractUserReferences(text),
      systemReferences: this.extractSystemReferences(text),
      actionModifiers: this.extractActionModifiers(text)
    };
  }

  private analyzeCommandStructure(normalizedText: string): CommandStructure {
    const words = normalizedText.split(/\s+/);

    // Simple structure analysis
    const verb = this.findMainVerb(words);
    const object = this.findMainObject(words);
    const modifiers = this.findModifiers(words);
    const prepositions = this.findPrepositions(words);
    const sentenceType = this.determineSentenceType(normalizedText);

    return {
      verb,
      object,
      modifiers,
      prepositions,
      clauses: [], // Could be enhanced with clause parsing
      sentenceType
    };
  }

  private calculateOverallConfidence(
    intent: WorkflowIntent,
    entities: WorkflowEntities,
    structure: CommandStructure
  ): number {
    let confidence = intent.confidence * 0.4; // 40% from intent

    // Add confidence from entities
    if (entities.workflowIdentifiers.length > 0) {
      const avgIdentifierConfidence = entities.workflowIdentifiers
        .reduce((sum, id) => sum + id.confidence, 0) / entities.workflowIdentifiers.length;
      confidence += avgIdentifierConfidence * 0.3; // 30% from workflow identification
    }

    // Add confidence from parameters
    if (entities.parameters.length > 0) {
      const avgParamConfidence = entities.parameters
        .reduce((sum, param) => sum + param.confidence, 0) / entities.parameters.length;
      confidence += avgParamConfidence * 0.2; // 20% from parameters
    }

    // Add confidence from structure clarity
    const structureClarity = structure.verb && structure.object ? 0.1 : 0.05;
    confidence += structureClarity; // 10% from structure

    return Math.min(confidence, 1.0);
  }

  private generateAlternativeInterpretations(
    text: string,
    primaryIntent: WorkflowIntent,
    primaryEntities: WorkflowEntities
  ): AlternativeInterpretation[] {
    // Simple alternative generation - could be enhanced
    const alternatives: AlternativeInterpretation[] = [];

    // If primary intent is execute, consider status check
    if (primaryIntent.primary === 'execute_workflow') {
      const altIntent: WorkflowIntent = {
        ...primaryIntent,
        primary: 'check_execution_status',
        confidence: primaryIntent.confidence * 0.7
      };

      alternatives.push({
        intent: altIntent,
        entities: primaryEntities,
        confidence: altIntent.confidence,
        reasoning: 'Could be asking for status instead of execution'
      });
    }

    return alternatives.slice(0, this.config.maxAlternatives);
  }

  private createParseMetadata(
    originalText: string,
    normalizedText: string,
    startTime: number,
    confidence: number
  ): ParseMetadata {
    const processingDuration = Date.now() - startTime;
    const words = originalText.split(/\s+/);
    const sentences = originalText.split(/[.!?]+/).filter(s => s.trim().length > 0);

    const textComplexity: TextComplexity = {
      wordCount: words.length,
      sentenceCount: sentences.length,
      averageWordLength: words.reduce((sum, word) => sum + word.length, 0) / words.length,
      complexityScore: Math.min(words.length / 20, 1.0) // Simple complexity score
    };

    const linguisticFeatures: LinguisticFeatures = {
      hasQuestions: /\?/.test(originalText),
      hasNegations: /\b(not|no|never|don't|won't|can't)\b/i.test(originalText),
      hasConditionals: /\b(if|when|unless|provided)\b/i.test(originalText),
      hasComparatives: /\b(better|worse|more|less|than)\b/i.test(originalText),
      hasTemporalReferences: /\b(now|then|later|before|after|today|tomorrow)\b/i.test(originalText),
      dominantTense: 'present', // Could be enhanced with proper tense detection
      subjectivity: 'objective'
    };

    const confidenceFactors: ConfidenceFactors = {
      keywordMatches: confidence * 0.3,
      structuralClarity: confidence * 0.25,
      contextualCoherence: confidence * 0.2,
      entityExtractionQuality: confidence * 0.15,
      overallParsability: confidence * 0.1
    };

    return {
      parseTime: new Date(),
      processingDuration,
      textComplexity,
      linguisticFeatures,
      disambiguationNeeded: confidence < 0.8,
      confidenceFactors
    };
  }

  // === Utility Methods ===

  private looksLikeWorkflowId(text: string): boolean {
    // Heuristics for workflow ID detection
    return text.length >= 3 &&
      text.length <= 50 &&
      /^[a-zA-Z]/.test(text) &&
      !/^(the|and|or|but|for|with|from|to|of|in|on|at)$/i.test(text);
  }

  private convertParameterValue(value: string): unknown {
    // Try to convert to appropriate type
    if (value === 'true' || value === 'false') {
      return value === 'true';
    }

    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }

    if (/^\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }

    return value; // Keep as string
  }

  private inferParameterType(value: string): ParameterType {
    if (this.parameterPatterns.get('email')![0].test(value)) return 'email';
    if (this.parameterPatterns.get('url')![0].test(value)) return 'url';
    if (this.parameterPatterns.get('date')![0].test(value)) return 'date';
    if (/^(true|false)$/i.test(value)) return 'boolean';
    if (/^\d+$/.test(value)) return 'number';
    if (/^\d*\.\d+$/.test(value)) return 'number';

    return 'string';
  }

  private inferParameterFromContext(text: string, paramName: string): ExtractedParameter | null {
    // Simple context-based parameter inference
    const normalizedText = text.toLowerCase();
    const normalizedParam = paramName.toLowerCase();

    if (normalizedParam.includes('email')) {
      const emailMatch = normalizedText.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/);
      if (emailMatch) {
        return {
          name: paramName,
          value: emailMatch[0],
          type: 'email',
          confidence: 0.7,
          source: 'inferred',
          validationStatus: 'needs_validation'
        };
      }
    }

    return null;
  }

  private detectUrgency(text: string): UrgencyLevel {
    for (const [level, keywords] of this.urgencyKeywords.entries()) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return level;
      }
    }
    return 'normal';
  }

  private detectTimeContext(text: string): TimeContext | undefined {
    if (/\b(now|immediately|asap)\b/i.test(text)) {
      return { immediacy: 'now' };
    }
    if (/\b(soon|quickly)\b/i.test(text)) {
      return { immediacy: 'soon' };
    }
    if (/\b(later|eventually)\b/i.test(text)) {
      return { immediacy: 'later' };
    }
    if (/\b(schedule|at|every)\b/i.test(text)) {
      return { immediacy: 'scheduled' };
    }
    return undefined;
  }

  private extractTimeExpressions(text: string): readonly TimeExpression[] {
    const expressions: TimeExpression[] = [];

    // Simple time expression patterns
    const timePatterns = [
      { pattern: /\bnow\b/gi, type: 'absolute' as const },
      { pattern: /\bin (\d+) (minutes?|hours?|days?)\b/gi, type: 'relative' as const },
      { pattern: /\bat (\d{1,2}:\d{2})\b/gi, type: 'absolute' as const },
      { pattern: /\bevery (day|week|month)\b/gi, type: 'recurring' as const }
    ];

    timePatterns.forEach(({ pattern, type }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        expressions.push({
          originalText: match[0],
          isRelative: type === 'relative',
          timeType: type,
          confidence: 0.8
        });
      }
    });

    return expressions;
  }

  private extractUserReferences(text: string): readonly string[] {
    const references: string[] = [];

    // Extract @mentions
    const mentionMatches = text.match(/@([a-zA-Z0-9_]+)/g);
    if (mentionMatches) {
      references.push(...mentionMatches);
    }

    return references;
  }

  private extractSystemReferences(text: string): readonly string[] {
    const systemKeywords = ['n8n', 'zapier', 'automation', 'workflow', 'system'];
    return systemKeywords.filter(keyword =>
      text.toLowerCase().includes(keyword)
    );
  }

  private extractActionModifiers(text: string): readonly ActionModifier[] {
    const modifiers: ActionModifier[] = [];

    const modifierPatterns = [
      { pattern: /\b(force|forced)\b/i, type: 'force' as const },
      { pattern: /\b(dry.?run|test.?mode)\b/i, type: 'dry_run' as const },
      { pattern: /\b(silent|quietly)\b/i, type: 'silent' as const },
      { pattern: /\b(verbose|detailed)\b/i, type: 'verbose' as const }
    ];

    modifierPatterns.forEach(({ pattern, type }) => {
      if (pattern.test(text)) {
        modifiers.push({
          type,
          confidence: 0.8
        });
      }
    });

    return modifiers;
  }

  private findMainVerb(words: string[]): string {
    const verbPatterns = ['run', 'execute', 'start', 'stop', 'check', 'show', 'list', 'cancel'];
    for (const word of words) {
      if (verbPatterns.includes(word)) {
        return word;
      }
    }
    return words[0] || ''; // Fallback to first word
  }

  private findMainObject(words: string[]): string {
    const objectPatterns = ['workflow', 'automation', 'process', 'task'];
    for (const word of words) {
      if (objectPatterns.includes(word)) {
        return word;
      }
    }
    return ''; // No clear object found
  }

  private findModifiers(words: string[]): readonly string[] {
    const modifierWords = ['my', 'the', 'all', 'specific', 'particular'];
    return words.filter(word => modifierWords.includes(word));
  }

  private findPrepositions(words: string[]): readonly string[] {
    const prepositions = ['with', 'for', 'from', 'to', 'in', 'on', 'at', 'by'];
    return words.filter(word => prepositions.includes(word));
  }

  private determineSentenceType(text: string): CommandStructure['sentenceType'] {
    if (text.includes('?')) return 'interrogative';
    if (/^(run|execute|start|stop|show|list)/i.test(text.trim())) return 'imperative';
    return 'declarative';
  }

  private generateIntentClarification(intent: WorkflowIntent): string {
    const actionSuggestions = {
      execute_workflow: 'Try: "run workflow [name]" or "execute [workflow name]"',
      check_execution_status: 'Try: "check status of [workflow]" or "how is [workflow] doing?"',
      cancel_execution: 'Try: "cancel [workflow]" or "stop [workflow execution]"',
      list_available_workflows: 'Try: "list my workflows" or "show available workflows"'
    };

    return actionSuggestions[intent.primary as keyof typeof actionSuggestions] ||
      'Please specify the action you want to take (run, check, cancel, list, etc.)';
  }
} 