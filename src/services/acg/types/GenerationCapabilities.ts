/**
 * GenerationCapabilities.ts - Capability definitions for ACG generators
 * 
 * Defines the capabilities that content generators can have and the constraints
 * they operate under. Follows strict typing with readonly properties.
 */

import { ContentType } from './ContentGenerationTypes';

// ===== Core Capability Types =====

export enum GenerationCapability {
  // Core generation methods
  LLM_POWERED = 'llm_powered',
  TEMPLATE_BASED = 'template_based',
  HYBRID_GENERATION = 'hybrid_generation',

  // Context awareness
  CONTEXT_AWARE = 'context_aware',
  CONVERSATION_AWARE = 'conversation_aware',
  USER_PREFERENCE_AWARE = 'user_preference_aware',

  // Platform integration
  PLATFORM_OPTIMIZATION = 'platform_optimization',
  PLATFORM_AWARE = 'platform_aware',
  MULTI_PLATFORM = 'multi_platform',
  FORMAT_ADAPTATION = 'format_adaptation',

  // Content features
  PERSONALIZATION = 'personalization',
  TONE_ADAPTATION = 'tone_adaptation',
  LENGTH_OPTIMIZATION = 'length_optimization',

  // Advanced features
  REAL_TIME_GENERATION = 'real_time_generation',
  BATCH_GENERATION = 'batch_generation',
  STREAMING_GENERATION = 'streaming_generation',

  // Quality assurance
  CONTENT_VALIDATION = 'content_validation',
  FACT_CHECKING = 'fact_checking',
  ANTI_HALLUCINATION = 'anti_hallucination',

  // Performance features
  CACHING = 'caching',
  FALLBACK_SUPPORT = 'fallback_support',
  RETRY_LOGIC = 'retry_logic'
}

// ===== Capability Definitions =====

export interface CapabilityDefinition {
  readonly capability: GenerationCapability;
  readonly description: string;
  readonly requirements: readonly string[];
  readonly dependencies: readonly GenerationCapability[];
  readonly performance: PerformanceCharacteristics;
  readonly constraints: CapabilityConstraints;
}

export interface PerformanceCharacteristics {
  readonly averageLatencyMs: number;
  readonly maxLatencyMs: number;
  readonly throughputPerSecond: number;
  readonly memoryUsageMB: number;
  readonly cpuIntensive: boolean;
  readonly scalable: boolean;
}

export interface CapabilityConstraints {
  readonly maxContentLength?: number;
  readonly minContentLength?: number;
  readonly supportedLanguages?: readonly string[];
  readonly supportedFormats?: readonly string[];
  readonly rateLimits?: RateLimit;
  readonly qualityThresholds?: QualityThresholds;
}

export interface RateLimit {
  readonly requestsPerMinute: number;
  readonly requestsPerHour: number;
  readonly requestsPerDay: number;
  readonly burstLimit: number;
}

export interface QualityThresholds {
  readonly minConfidenceScore: number;
  readonly minReadabilityScore: number;
  readonly maxErrorRate: number;
  readonly minSuccessRate: number;
}

// ===== Generator Capability Sets =====

export interface GeneratorCapabilitySet {
  readonly generatorId: string;
  readonly capabilities: readonly GenerationCapability[];
  readonly supportedTypes: readonly ContentType[];
  readonly priority: number;
  readonly enabled: boolean;
  readonly configuration: GeneratorConfiguration;
}

export interface GeneratorConfiguration {
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly fallbackEnabled: boolean;
  readonly cachingEnabled: boolean;
  readonly validationEnabled: boolean;
  readonly customSettings: Record<string, unknown>;
}

// ===== Platform Capability Mappings =====

export interface PlatformCapabilityMapping {
  readonly platform: string;
  readonly requiredCapabilities: readonly GenerationCapability[];
  readonly optionalCapabilities: readonly GenerationCapability[];
  readonly constraints: PlatformConstraints;
}

export interface PlatformConstraints {
  readonly maxContentLength: number;
  readonly allowedFormats: readonly string[];
  readonly characterRestrictions: readonly string[];
  readonly requiredElements: readonly string[];
  readonly forbiddenElements: readonly string[];
}

// ===== Capability Registry =====

export interface CapabilityRegistry {
  readonly capabilities: ReadonlyMap<GenerationCapability, CapabilityDefinition>;
  readonly generators: ReadonlyMap<string, GeneratorCapabilitySet>;
  readonly platforms: ReadonlyMap<string, PlatformCapabilityMapping>;
}

// ===== Capability Validation =====

export interface CapabilityValidationResult {
  readonly isValid: boolean;
  readonly missingCapabilities: readonly GenerationCapability[];
  readonly conflictingCapabilities: readonly GenerationCapability[];
  readonly warnings: readonly string[];
  readonly recommendations: readonly string[];
}

// ===== Predefined Capability Sets =====

export const EMAIL_GENERATOR_CAPABILITIES: readonly GenerationCapability[] = [
  GenerationCapability.LLM_POWERED,
  GenerationCapability.TEMPLATE_BASED,
  GenerationCapability.CONTEXT_AWARE,
  GenerationCapability.USER_PREFERENCE_AWARE,
  GenerationCapability.PERSONALIZATION,
  GenerationCapability.TONE_ADAPTATION,
  GenerationCapability.CONTENT_VALIDATION,
  GenerationCapability.FALLBACK_SUPPORT
] as const;

export const SOCIAL_MEDIA_GENERATOR_CAPABILITIES: readonly GenerationCapability[] = [
  GenerationCapability.LLM_POWERED,
  GenerationCapability.PLATFORM_OPTIMIZATION,
  GenerationCapability.MULTI_PLATFORM,
  GenerationCapability.LENGTH_OPTIMIZATION,
  GenerationCapability.TONE_ADAPTATION,
  GenerationCapability.REAL_TIME_GENERATION,
  GenerationCapability.CONTENT_VALIDATION,
  GenerationCapability.CACHING
] as const;

export const DOCUMENT_GENERATOR_CAPABILITIES: readonly GenerationCapability[] = [
  GenerationCapability.LLM_POWERED,
  GenerationCapability.TEMPLATE_BASED,
  GenerationCapability.HYBRID_GENERATION,
  GenerationCapability.CONTEXT_AWARE,
  GenerationCapability.FORMAT_ADAPTATION,
  GenerationCapability.BATCH_GENERATION,
  GenerationCapability.CONTENT_VALIDATION,
  GenerationCapability.FACT_CHECKING
] as const;

export const CALENDAR_GENERATOR_CAPABILITIES: readonly GenerationCapability[] = [
  GenerationCapability.TEMPLATE_BASED,
  GenerationCapability.CONTEXT_AWARE,
  GenerationCapability.USER_PREFERENCE_AWARE,
  GenerationCapability.PERSONALIZATION,
  GenerationCapability.CONTENT_VALIDATION,
  GenerationCapability.FALLBACK_SUPPORT
] as const;

// ===== Capability Definitions Registry =====

export const CAPABILITY_DEFINITIONS: Record<GenerationCapability, CapabilityDefinition> = {
  [GenerationCapability.LLM_POWERED]: {
    capability: GenerationCapability.LLM_POWERED,
    description: 'Uses Large Language Models for intelligent content generation',
    requirements: ['LLM service access', 'API tokens'],
    dependencies: [],
    performance: {
      averageLatencyMs: 2000,
      maxLatencyMs: 10000,
      throughputPerSecond: 5,
      memoryUsageMB: 50,
      cpuIntensive: false,
      scalable: true
    },
    constraints: {
      maxContentLength: 50000,
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        burstLimit: 10
      },
      qualityThresholds: {
        minConfidenceScore: 0.7,
        minReadabilityScore: 0.6,
        maxErrorRate: 0.05,
        minSuccessRate: 0.95
      }
    }
  },

  [GenerationCapability.TEMPLATE_BASED]: {
    capability: GenerationCapability.TEMPLATE_BASED,
    description: 'Uses predefined templates with variable substitution',
    requirements: ['Template storage', 'Variable processor'],
    dependencies: [],
    performance: {
      averageLatencyMs: 100,
      maxLatencyMs: 500,
      throughputPerSecond: 100,
      memoryUsageMB: 10,
      cpuIntensive: false,
      scalable: true
    },
    constraints: {
      maxContentLength: 100000,
      qualityThresholds: {
        minConfidenceScore: 0.9,
        minReadabilityScore: 0.8,
        maxErrorRate: 0.01,
        minSuccessRate: 0.99
      }
    }
  },

  [GenerationCapability.CONTEXT_AWARE]: {
    capability: GenerationCapability.CONTEXT_AWARE,
    description: 'Analyzes context to generate relevant content',
    requirements: ['Context parser', 'Entity extraction'],
    dependencies: [],
    performance: {
      averageLatencyMs: 500,
      maxLatencyMs: 2000,
      throughputPerSecond: 20,
      memoryUsageMB: 25,
      cpuIntensive: true,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.8,
        minReadabilityScore: 0.7,
        maxErrorRate: 0.03,
        minSuccessRate: 0.97
      }
    }
  },

  [GenerationCapability.PLATFORM_OPTIMIZATION]: {
    capability: GenerationCapability.PLATFORM_OPTIMIZATION,
    description: 'Optimizes content for specific platforms',
    requirements: ['Platform adapters', 'Format converters'],
    dependencies: [GenerationCapability.FORMAT_ADAPTATION],
    performance: {
      averageLatencyMs: 200,
      maxLatencyMs: 1000,
      throughputPerSecond: 50,
      memoryUsageMB: 15,
      cpuIntensive: false,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.85,
        minReadabilityScore: 0.8,
        maxErrorRate: 0.02,
        minSuccessRate: 0.98
      }
    }
  },

  [GenerationCapability.CONTENT_VALIDATION]: {
    capability: GenerationCapability.CONTENT_VALIDATION,
    description: 'Validates generated content for quality and compliance',
    requirements: ['Validation rules', 'Quality metrics'],
    dependencies: [],
    performance: {
      averageLatencyMs: 300,
      maxLatencyMs: 1500,
      throughputPerSecond: 30,
      memoryUsageMB: 20,
      cpuIntensive: true,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.9,
        minReadabilityScore: 0.85,
        maxErrorRate: 0.01,
        minSuccessRate: 0.99
      }
    }
  },

  // Add other capability definitions as needed...
  [GenerationCapability.HYBRID_GENERATION]: {
    capability: GenerationCapability.HYBRID_GENERATION,
    description: 'Combines multiple generation methods for optimal results',
    requirements: ['Multiple generators', 'Decision logic'],
    dependencies: [GenerationCapability.LLM_POWERED, GenerationCapability.TEMPLATE_BASED],
    performance: {
      averageLatencyMs: 1500,
      maxLatencyMs: 8000,
      throughputPerSecond: 10,
      memoryUsageMB: 40,
      cpuIntensive: true,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.85,
        minReadabilityScore: 0.8,
        maxErrorRate: 0.02,
        minSuccessRate: 0.98
      }
    }
  },

  [GenerationCapability.CONVERSATION_AWARE]: {
    capability: GenerationCapability.CONVERSATION_AWARE,
    description: 'Maintains context across conversation turns',
    requirements: ['Conversation history', 'Context tracking'],
    dependencies: [GenerationCapability.CONTEXT_AWARE],
    performance: {
      averageLatencyMs: 800,
      maxLatencyMs: 3000,
      throughputPerSecond: 15,
      memoryUsageMB: 30,
      cpuIntensive: true,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.85,
        minReadabilityScore: 0.8,
        maxErrorRate: 0.03,
        minSuccessRate: 0.97
      }
    }
  },

  [GenerationCapability.USER_PREFERENCE_AWARE]: {
    capability: GenerationCapability.USER_PREFERENCE_AWARE,
    description: 'Adapts content based on user preferences',
    requirements: ['User profile', 'Preference engine'],
    dependencies: [],
    performance: {
      averageLatencyMs: 300,
      maxLatencyMs: 1000,
      throughputPerSecond: 40,
      memoryUsageMB: 15,
      cpuIntensive: false,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.8,
        minReadabilityScore: 0.75,
        maxErrorRate: 0.04,
        minSuccessRate: 0.96
      }
    }
  },

  [GenerationCapability.MULTI_PLATFORM]: {
    capability: GenerationCapability.MULTI_PLATFORM,
    description: 'Generates content for multiple platforms simultaneously',
    requirements: ['Platform adapters', 'Multi-format support'],
    dependencies: [GenerationCapability.PLATFORM_OPTIMIZATION, GenerationCapability.FORMAT_ADAPTATION],
    performance: {
      averageLatencyMs: 1000,
      maxLatencyMs: 4000,
      throughputPerSecond: 10,
      memoryUsageMB: 35,
      cpuIntensive: true,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.8,
        minReadabilityScore: 0.75,
        maxErrorRate: 0.05,
        minSuccessRate: 0.95
      }
    }
  },

  [GenerationCapability.FORMAT_ADAPTATION]: {
    capability: GenerationCapability.FORMAT_ADAPTATION,
    description: 'Adapts content format for different outputs',
    requirements: ['Format converters', 'Template engine'],
    dependencies: [],
    performance: {
      averageLatencyMs: 200,
      maxLatencyMs: 800,
      throughputPerSecond: 50,
      memoryUsageMB: 10,
      cpuIntensive: false,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.9,
        minReadabilityScore: 0.85,
        maxErrorRate: 0.02,
        minSuccessRate: 0.98
      }
    }
  },

  [GenerationCapability.PERSONALIZATION]: {
    capability: GenerationCapability.PERSONALIZATION,
    description: 'Personalizes content for individual users',
    requirements: ['User data', 'Personalization engine'],
    dependencies: [GenerationCapability.USER_PREFERENCE_AWARE],
    performance: {
      averageLatencyMs: 600,
      maxLatencyMs: 2500,
      throughputPerSecond: 20,
      memoryUsageMB: 25,
      cpuIntensive: true,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.85,
        minReadabilityScore: 0.8,
        maxErrorRate: 0.03,
        minSuccessRate: 0.97
      }
    }
  },

  [GenerationCapability.TONE_ADAPTATION]: {
    capability: GenerationCapability.TONE_ADAPTATION,
    description: 'Adjusts content tone based on requirements',
    requirements: ['Tone analyzer', 'Style guide'],
    dependencies: [],
    performance: {
      averageLatencyMs: 400,
      maxLatencyMs: 1500,
      throughputPerSecond: 30,
      memoryUsageMB: 20,
      cpuIntensive: false,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.8,
        minReadabilityScore: 0.75,
        maxErrorRate: 0.04,
        minSuccessRate: 0.96
      }
    }
  },

  [GenerationCapability.LENGTH_OPTIMIZATION]: {
    capability: GenerationCapability.LENGTH_OPTIMIZATION,
    description: 'Optimizes content length for target requirements',
    requirements: ['Length analyzer', 'Content trimming'],
    dependencies: [],
    performance: {
      averageLatencyMs: 200,
      maxLatencyMs: 800,
      throughputPerSecond: 60,
      memoryUsageMB: 10,
      cpuIntensive: false,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.85,
        minReadabilityScore: 0.8,
        maxErrorRate: 0.02,
        minSuccessRate: 0.98
      }
    }
  },

  [GenerationCapability.REAL_TIME_GENERATION]: {
    capability: GenerationCapability.REAL_TIME_GENERATION,
    description: 'Generates content in real-time with low latency',
    requirements: ['Fast processing', 'Optimized pipelines'],
    dependencies: [],
    performance: {
      averageLatencyMs: 100,
      maxLatencyMs: 500,
      throughputPerSecond: 100,
      memoryUsageMB: 15,
      cpuIntensive: true,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.75,
        minReadabilityScore: 0.7,
        maxErrorRate: 0.06,
        minSuccessRate: 0.94
      }
    }
  },

  [GenerationCapability.BATCH_GENERATION]: {
    capability: GenerationCapability.BATCH_GENERATION,
    description: 'Processes multiple content requests in batches',
    requirements: ['Batch processor', 'Queue management'],
    dependencies: [],
    performance: {
      averageLatencyMs: 3000,
      maxLatencyMs: 15000,
      throughputPerSecond: 50,
      memoryUsageMB: 100,
      cpuIntensive: true,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.8,
        minReadabilityScore: 0.75,
        maxErrorRate: 0.04,
        minSuccessRate: 0.96
      }
    }
  },

  [GenerationCapability.STREAMING_GENERATION]: {
    capability: GenerationCapability.STREAMING_GENERATION,
    description: 'Streams content generation in real-time',
    requirements: ['Streaming engine', 'WebSocket support'],
    dependencies: [GenerationCapability.REAL_TIME_GENERATION],
    performance: {
      averageLatencyMs: 50,
      maxLatencyMs: 200,
      throughputPerSecond: 200,
      memoryUsageMB: 20,
      cpuIntensive: true,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.7,
        minReadabilityScore: 0.65,
        maxErrorRate: 0.08,
        minSuccessRate: 0.92
      }
    }
  },

  [GenerationCapability.FACT_CHECKING]: {
    capability: GenerationCapability.FACT_CHECKING,
    description: 'Verifies factual accuracy of generated content',
    requirements: ['Fact database', 'Verification engine'],
    dependencies: [],
    performance: {
      averageLatencyMs: 1500,
      maxLatencyMs: 5000,
      throughputPerSecond: 10,
      memoryUsageMB: 40,
      cpuIntensive: true,
      scalable: false
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.9,
        minReadabilityScore: 0.85,
        maxErrorRate: 0.01,
        minSuccessRate: 0.99
      }
    }
  },

  [GenerationCapability.ANTI_HALLUCINATION]: {
    capability: GenerationCapability.ANTI_HALLUCINATION,
    description: 'Prevents generation of false or misleading information',
    requirements: ['Hallucination detector', 'Confidence scoring'],
    dependencies: [GenerationCapability.FACT_CHECKING],
    performance: {
      averageLatencyMs: 800,
      maxLatencyMs: 3000,
      throughputPerSecond: 15,
      memoryUsageMB: 30,
      cpuIntensive: true,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.9,
        minReadabilityScore: 0.8,
        maxErrorRate: 0.01,
        minSuccessRate: 0.99
      }
    }
  },

  [GenerationCapability.CACHING]: {
    capability: GenerationCapability.CACHING,
    description: 'Caches generated content for improved performance',
    requirements: ['Cache storage', 'Cache invalidation'],
    dependencies: [],
    performance: {
      averageLatencyMs: 50,
      maxLatencyMs: 200,
      throughputPerSecond: 1000,
      memoryUsageMB: 50,
      cpuIntensive: false,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.95,
        minReadabilityScore: 0.9,
        maxErrorRate: 0.005,
        minSuccessRate: 0.995
      }
    }
  },

  [GenerationCapability.FALLBACK_SUPPORT]: {
    capability: GenerationCapability.FALLBACK_SUPPORT,
    description: 'Provides fallback generation methods when primary fails',
    requirements: ['Fallback strategies', 'Error handling'],
    dependencies: [],
    performance: {
      averageLatencyMs: 1000,
      maxLatencyMs: 5000,
      throughputPerSecond: 20,
      memoryUsageMB: 25,
      cpuIntensive: false,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.7,
        minReadabilityScore: 0.65,
        maxErrorRate: 0.1,
        minSuccessRate: 0.9
      }
    }
  },

  [GenerationCapability.RETRY_LOGIC]: {
    capability: GenerationCapability.RETRY_LOGIC,
    description: 'Implements intelligent retry mechanisms for failed generations',
    requirements: ['Retry strategies', 'Exponential backoff'],
    dependencies: [],
    performance: {
      averageLatencyMs: 500,
      maxLatencyMs: 10000,
      throughputPerSecond: 10,
      memoryUsageMB: 15,
      cpuIntensive: false,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.8,
        minReadabilityScore: 0.75,
        maxErrorRate: 0.05,
        minSuccessRate: 0.95
      }
    }
  },

  [GenerationCapability.PLATFORM_AWARE]: {
    capability: GenerationCapability.PLATFORM_AWARE,
    description: 'Understands and adapts to platform-specific requirements',
    requirements: ['Platform knowledge', 'Constraint engine'],
    dependencies: [GenerationCapability.PLATFORM_OPTIMIZATION],
    performance: {
      averageLatencyMs: 300,
      maxLatencyMs: 1200,
      throughputPerSecond: 35,
      memoryUsageMB: 20,
      cpuIntensive: false,
      scalable: true
    },
    constraints: {
      qualityThresholds: {
        minConfidenceScore: 0.85,
        minReadabilityScore: 0.8,
        maxErrorRate: 0.03,
        minSuccessRate: 0.97
      }
    }
  }
} as const;

// ===== Utility Functions =====

export function validateCapabilitySet(
  capabilities: readonly GenerationCapability[]
): CapabilityValidationResult {
  const missingCapabilities: GenerationCapability[] = [];
  const conflictingCapabilities: GenerationCapability[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check dependencies
  for (const capability of capabilities) {
    const definition = CAPABILITY_DEFINITIONS[capability];
    for (const dependency of definition.dependencies) {
      if (!capabilities.includes(dependency)) {
        missingCapabilities.push(dependency);
      }
    }
  }

  // Check for conflicts (example: streaming vs batch)
  if (capabilities.includes(GenerationCapability.STREAMING_GENERATION) &&
    capabilities.includes(GenerationCapability.BATCH_GENERATION)) {
    conflictingCapabilities.push(
      GenerationCapability.STREAMING_GENERATION,
      GenerationCapability.BATCH_GENERATION
    );
  }

  return {
    isValid: missingCapabilities.length === 0 && conflictingCapabilities.length === 0,
    missingCapabilities,
    conflictingCapabilities,
    warnings,
    recommendations
  };
}

export function getCapabilitiesForContentType(
  contentType: ContentType
): readonly GenerationCapability[] {
  switch (contentType) {
    case ContentType.EMAIL_SUBJECT:
    case ContentType.EMAIL_BODY:
    case ContentType.EMAIL_REPLY:
    case ContentType.EMAIL_FORWARD:
      return EMAIL_GENERATOR_CAPABILITIES;

    case ContentType.SOCIAL_POST:
    case ContentType.SOCIAL_COMMENT:
    case ContentType.SOCIAL_MESSAGE:
      return SOCIAL_MEDIA_GENERATOR_CAPABILITIES;

    case ContentType.DOCUMENT_TEXT:
    case ContentType.DOCUMENT_SPREADSHEET:
    case ContentType.DOCUMENT_PRESENTATION:
      return DOCUMENT_GENERATOR_CAPABILITIES;

    case ContentType.CALENDAR_EVENT:
    case ContentType.CALENDAR_AGENDA:
    case ContentType.CALENDAR_INVITE:
      return CALENDAR_GENERATOR_CAPABILITIES;

    default:
      return [
        GenerationCapability.LLM_POWERED,
        GenerationCapability.CONTEXT_AWARE,
        GenerationCapability.CONTENT_VALIDATION,
        GenerationCapability.FALLBACK_SUPPORT
      ];
  }
} 