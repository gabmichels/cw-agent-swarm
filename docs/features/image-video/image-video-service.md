# Image and Video Generation Service Implementation Plan

## Executive Summary

This document outlines the implementation of **FAL AI Service** as a unified gateway for media generation, along with **ImageGenerationService**, **VideoGenerationService**, and **ImageToVideoService**. These services integrate seamlessly with our existing **Unified Tools Foundation** while providing AI-powered media generation capabilities for agents and social media workflows.

**Following @IMPLEMENTATION_GUIDELINES.md principles:**
- ✅ **REPLACE LEGACY PATTERNS** - Modern, type-safe service architecture
- ✅ **NO BACKWARD COMPATIBILITY LAYERS** - Clean service design
- ✅ **ELIMINATE ANTI-PATTERNS** - No string literals, proper error handling
- ✅ **INCREMENTAL INTEGRATION** - Build on existing unified tools foundation
- ✅ ULID for business logic, structured error handling
- ✅ Centralized constants and dependency injection
- ✅ **Test-driven development** - Comprehensive testing ensures correctness
- ✅ Interface-first design with strict typing

## Architecture Overview

### Core Services Architecture
```
FAL AI Media Generation System:
├── FAL AI Service (Gateway)
│   ├── Model management and routing
│   ├── API communication and rate limiting
│   ├── Response formatting and validation
│   └── Cost tracking and analytics
├── Image Generation Service
│   ├── Text-to-image generation
│   ├── Style and model selection
│   ├── Parameter optimization
│   └── Quality validation
├── Video Generation Service
│   ├── Text-to-video generation
│   ├── Model routing (VEO3, etc.)
│   ├── Duration and quality management
│   └── Processing status tracking
└── Image-to-Video Service
    ├── Image preprocessing
    ├── Video model selection
    ├── Transition optimization
    └── Composite workflow management
```

### Integration with Unified Tools Foundation
- **Tool Registration**: All services registered as discoverable tools
- **Cross-System Discovery**: Available to agents, social media, and workflow systems
- **ULID Identifiers**: Consistent with foundation patterns
- **Structured Error Handling**: AppError-based hierarchy
- **Performance Monitoring**: Built-in metrics and health tracking

## Current Implementation Status

### ✅ PHASE 0 - PLANNING AND ARCHITECTURE (COMPLETE)
**Status**: ✅ **COMPLETE** - Comprehensive implementation plan documented
- **Architecture Design**: Media generation system architecture with FAL AI gateway
- **Integration Strategy**: Unified tools foundation integration approach
- **Technical Specifications**: Service interfaces and tool registration patterns
- **Risk Assessment**: Technical and integration risk mitigation strategies

### 🎯 **FAL AI Model Registry**

The FAL AI system supports a comprehensive range of models across three categories:

#### **Text-to-Image Models** (5 models)
- `fal-ai/flux-pro` → `TEXT_TO_IMAGE` → NLP: `["flux", "pro", "realistic", "photorealistic"]`
- `fal-ai/midjourney` → `TEXT_TO_IMAGE` → NLP: `["midjourney", "artistic", "creative", "stylized"]`
- `fal-ai/stable-diffusion-v3` → `TEXT_TO_IMAGE` → NLP: `["stable diffusion", "sd3", "open source", "community"]`
- `fal-ai/dall-e-3` → `TEXT_TO_IMAGE` → NLP: `["dall-e", "openai", "detailed", "precise"]`
- `fal-ai/pixart-alpha` → `TEXT_TO_IMAGE` → NLP: `["pixart", "stylized", "anime", "cartoon", "pixar"]`

#### **Text-to-Video Models** (4 models)
- `fal-ai/veo3` → `TEXT_TO_VIDEO` → NLP: `["veo3", "google veo", "cinematic", "high quality"]`
- `fal-ai/minimax` → `TEXT_TO_VIDEO` → NLP: `["minimax", "fast", "efficient", "quick"]`
- `fal-ai/runway-gen3` → `TEXT_TO_VIDEO` → NLP: `["runway", "gen3", "professional", "commercial"]`
- `fal-ai/pika-labs` → `TEXT_TO_VIDEO` → NLP: `["pika", "creative", "artistic", "experimental"]`

#### **Image-to-Video Models** (3 models)
- `fal-ai/kling` → `IMAGE_TO_VIDEO` → NLP: `["kling", "smooth", "transitions", "seamless"]`
- `fal-ai/stable-video` → `IMAGE_TO_VIDEO` → NLP: `["stable video", "consistent", "quality", "stable"]`
- `fal-ai/animate-diff` → `IMAGE_TO_VIDEO` → NLP: `["animate", "motion", "fluid", "animation"]`

## Implementation Plan

### Phase 1: Foundation and Constants 🏗️ ⏳ PENDING

#### 1.1 FAL AI Constants and Enums ⏳ PENDING
- [ ] **Create `src/constants/fal-ai-models.ts`** with comprehensive model definitions
  - [ ] **Text-to-Image Models**:
    - [ ] `"fal-ai/flux-pro"` - `"TEXT_TO_IMAGE"` - `["flux", "pro", "realistic"]`
    - [ ] `"fal-ai/midjourney"` - `"TEXT_TO_IMAGE"` - `["midjourney", "artistic", "creative"]`
    - [ ] `"fal-ai/stable-diffusion-v3"` - `"TEXT_TO_IMAGE"` - `["stable diffusion", "sd3", "open source"]`
    - [ ] `"fal-ai/dall-e-3"` - `"TEXT_TO_IMAGE"` - `["dall-e", "openai", "detailed"]`
    - [ ] `"fal-ai/pixart-alpha"` - `"TEXT_TO_IMAGE"` - `["pixart", "stylized", "anime"]`
  
  - [ ] **Text-to-Video Models**:
    - [ ] `"fal-ai/veo3"` - `"TEXT_TO_VIDEO"` - `["veo3", "google veo", "cinematic"]`
    - [ ] `"fal-ai/minimax"` - `"TEXT_TO_VIDEO"` - `["minimax", "fast", "efficient"]`
    - [ ] `"fal-ai/runway-gen3"` - `"TEXT_TO_VIDEO"` - `["runway", "gen3", "professional"]`
    - [ ] `"fal-ai/pika-labs"` - `"TEXT_TO_VIDEO"` - `["pika", "creative", "artistic"]`
  
  - [ ] **Image-to-Video Models**:
    - [ ] `"fal-ai/kling"` - `"IMAGE_TO_VIDEO"` - `["kling", "smooth", "transitions"]`
    - [ ] `"fal-ai/stable-video"` - `"IMAGE_TO_VIDEO"` - `["stable video", "consistent", "quality"]`
    - [ ] `"fal-ai/animate-diff"` - `"IMAGE_TO_VIDEO"` - `["animate", "motion", "fluid"]`

- [ ] **Create `src/constants/media-generation-tools.ts`** with tool name constants
  - [ ] **FAL AI Tools**: `GENERATE_IMAGE_FAL`, `GENERATE_VIDEO_FAL`, `GET_MODEL_STATUS`
  - [ ] **Image Generation Tools**: `GENERATE_IMAGE`, `ENHANCE_IMAGE`, `STYLE_TRANSFER`
  - [ ] **Video Generation Tools**: `GENERATE_VIDEO`, `ANIMATE_TEXT`, `CREATE_SLIDESHOW`
  - [ ] **Image-to-Video Tools**: `ANIMATE_IMAGE`, `CREATE_VIDEO_FROM_IMAGE`, `ADD_MOTION`

- [ ] **Create `src/components/media-generation/` directory structure**
  - [ ] `MediaGenerationProgress.tsx` - Real-time progress tracking component
  - [ ] `MediaResultBubble.tsx` - Media display with metadata and actions
  - [ ] `MediaGenerationError.tsx` - Error handling with retry options
  - [ ] `ImageResultDisplay.tsx` - Image viewer with zoom and download
  - [ ] `VideoResultDisplay.tsx` - Video player with quality controls
  - [ ] `MediaGenerationChatBubble.tsx` - Chat integration wrapper
  - [ ] `types.ts` - TypeScript interfaces for all media UI components
  - [ ] `hooks/` - Custom React hooks for media generation state

- [ ] **Create `src/types/media-generation.ts`** with comprehensive type definitions
  - [ ] Model category enums and interfaces
  - [ ] Generation request and response types
  - [ ] Error handling and validation types
  - [ ] Performance metrics and tracking types

#### 1.2 Service Interfaces and Error Handling ⏳ PENDING
- [ ] **Create `src/services/media-generation/interfaces/`** directory structure
  - [ ] `IFalAIService.ts` - Core FAL AI gateway interface
  - [ ] `IImageGenerationService.ts` - Image generation service interface
  - [ ] `IVideoGenerationService.ts` - Video generation service interface
  - [ ] `IImageToVideoService.ts` - Image-to-video service interface

- [ ] **Create media generation error hierarchy** extending AppError
  - [ ] `MediaGenerationError` - Base error for all media generation failures
  - [ ] `ModelNotFoundError` - Specific model not available or invalid
  - [ ] `GenerationTimeoutError` - Generation process exceeded time limits
  - [ ] `InvalidPromptError` - Prompt validation or safety filter failures
  - [ ] `QuotaExceededError` - API rate limits or usage quotas exceeded
  - [ ] `ModelUnavailableError` - Model temporarily unavailable or maintenance

### Phase 2: FAL AI Service Implementation 🚀 ⏳ PENDING

#### 2.1 Core FAL AI Service ⏳ PENDING
- [ ] **Create `src/services/media-generation/fal-ai/FalAIService.ts`**
  - [ ] HTTP client with proper authentication and rate limiting
  - [ ] Model routing based on category and NLP patterns
  - [ ] Request/response transformation and validation
  - [ ] Cost tracking integration with existing cost management
  - [ ] Retry logic with exponential backoff for failed requests
  - [ ] Response caching for optimization (with TTL management)

- [ ] **Implement model selection algorithms**
  - [ ] NLP pattern matching for model selection (e.g., "midjourney" → `fal-ai/midjourney`)
  - [ ] Fallback model selection based on availability and performance
  - [ ] Performance-based model recommendation system
  - [ ] Cost optimization for model selection based on requirements

- [ ] **Create model management utilities**
  - [ ] Model availability checking and health monitoring
  - [ ] Model performance metrics collection and analysis
  - [ ] Dynamic model discovery and registration
  - [ ] Model versioning and compatibility management

#### 2.2 FAL AI Integration Layer ⏳ PENDING
- [ ] **Create `src/services/media-generation/fal-ai/FalAIIntegrationService.ts`**
  - [ ] Bridge between unified tools foundation and FAL AI service
  - [ ] Tool registration for FAL AI capabilities
  - [ ] Execution context handling and parameter validation
  - [ ] Result formatting and metadata enrichment

- [ ] **Implement FAL AI tool system**
  - [ ] Register FAL AI tools with unified foundation
  - [ ] Enable cross-system discovery for FAL AI capabilities
  - [ ] Integrate with existing tool health monitoring
  - [ ] Support for batch operations and parallel processing

- [ ] **Create API endpoints for UI integration**
  - [ ] `GET /api/media-generation/:id/progress` - SSE endpoint for real-time progress
  - [ ] `POST /api/media-generation/:id/cancel` - Cancel ongoing generation
  - [ ] `POST /api/media-generation/:id/regenerate` - Regenerate with same/different model
  - [ ] `GET /api/media-generation/:id/download` - Download generated media
  - [ ] `POST /api/media-generation/:id/share` - Share to social media platforms

### Phase 3: Specialized Generation Services 🎨 ⏳ PENDING

#### 3.1 Image Generation Service ⏳ PENDING
- [ ] **Create `src/services/media-generation/image/ImageGenerationService.ts`**
  - [ ] Text-to-image generation with model selection
  - [ ] Style parameter optimization and preset management
  - [ ] Image quality validation and enhancement
  - [ ] Batch image generation for efficiency
  - [ ] Image metadata extraction and storage

- [ ] **Implement advanced image features**
  - [ ] Style transfer and artistic filtering
  - [ ] Image upscaling and quality enhancement
  - [ ] Multi-style generation with comparison options
  - [ ] Custom aspect ratio and resolution management
  - [ ] Watermarking and branding integration

- [ ] **Create image tool integrations**
  - [ ] Register image generation tools with unified foundation
  - [ ] Integration with social media posting workflows
  - [ ] File storage and CDN integration for generated images
  - [ ] Image optimization for different platforms and use cases

#### 3.2 Video Generation Service ⏳ PENDING
- [ ] **Create `src/services/media-generation/video/VideoGenerationService.ts`**
  - [ ] Text-to-video generation with duration management
  - [ ] Model selection based on video requirements (length, quality, style)
  - [ ] Video processing status tracking and notification
  - [ ] Video format optimization for different platforms
  - [ ] Subtitle and caption generation integration

- [ ] **Implement advanced video features**
  - [ ] Multi-scene video composition and editing
  - [ ] Audio integration and synchronization
  - [ ] Video quality optimization and compression
  - [ ] Custom video templates and presets
  - [ ] Video analytics and performance tracking

- [ ] **Create video tool integrations**
  - [ ] Register video generation tools with unified foundation
  - [ ] Integration with social media video posting
  - [ ] Video storage and streaming optimization
  - [ ] Platform-specific video format conversion

#### 3.3 Image-to-Video Service ⏳ PENDING
- [ ] **Create `src/services/media-generation/image-to-video/ImageToVideoService.ts`**
  - [ ] Image preprocessing and optimization for video generation
  - [ ] Model selection for image-to-video conversion (Kling, etc.)
  - [ ] Motion parameter configuration and optimization
  - [ ] Quality preservation during video conversion
  - [ ] Composite workflow management for multi-step processes

- [ ] **Implement workflow orchestration**
  - [ ] Integration with ImageGenerationService for complete workflows
  - [ ] Automated image enhancement before video conversion
  - [ ] Batch processing for multiple images to video
  - [ ] Progress tracking and status notifications
  - [ ] Error recovery and partial completion handling

- [ ] **Create composite tool integrations**
  - [ ] Register image-to-video tools with unified foundation
  - [ ] Workflow templates for common image-to-video patterns
  - [ ] Integration with existing image and video services
  - [ ] Cross-system workflow composition support

### Phase 4: Tool System Integration 🔧 ⏳ PENDING

#### 4.1 Unified Tools Foundation Integration ⏳ PENDING
- [ ] **Register all media generation tools with foundation**
  - [ ] FAL AI gateway tools (model management, generation requests)
  - [ ] Image generation tools (text-to-image, style transfer, enhancement)
  - [ ] Video generation tools (text-to-video, animation, composition)
  - [ ] Image-to-video tools (animation, motion, transitions)

- [ ] **Enable cross-system discovery**
  - [ ] Tools discoverable by agents across all systems
  - [ ] Integration with existing tool recommendation engine
  - [ ] Semantic search support for media generation capabilities
  - [ ] Tool substitution and fallback mechanisms

- [ ] **Implement tool health monitoring**
  - [ ] Model availability and performance tracking
  - [ ] Generation success rates and error monitoring
  - [ ] Cost tracking and usage analytics
  - [ ] Performance benchmarking and optimization

#### 4.2 Social Media Integration ⏳ PENDING
- [ ] **Update SocialMediaToolSystem**
  - [ ] Integration with image generation for post creation
  - [ ] Video generation for platform-specific content
  - [ ] Automated media optimization for different platforms
  - [ ] Content approval workflows for generated media

- [ ] **Enhance social media workflows**
  - [ ] Multi-platform content generation with variations
  - [ ] Brand consistency and style guide enforcement
  - [ ] Automated hashtag and caption generation
  - [ ] Performance tracking for generated content

#### 4.3 Agent System Integration ⏳ PENDING
- [ ] **Update DefaultAgent capabilities**
  - [ ] Natural language media generation requests
  - [ ] Model selection based on user preferences and intent
  - [ ] Quality assessment and regeneration capabilities
  - [ ] Cost awareness and optimization for generation requests

- [ ] **Implement agent workflows**
  - [ ] Multi-step media generation workflows
  - [ ] Content iteration and refinement processes
  - [ ] Quality control and approval mechanisms
  - [ ] Usage analytics and learning from user feedback

#### 4.4 Chat UI Integration ⏳ PENDING
- [ ] **Create media generation chat components**
  - [ ] MediaGenerationProgress component for in-progress status
  - [ ] MediaResultBubble component for displaying generated content
  - [ ] ProgressIndicator with model selection and ETA display
  - [ ] Error handling UI with retry and model suggestion options

- [ ] **Implement real-time progress tracking**
  - [ ] WebSocket/SSE integration for generation status updates
  - [ ] Progress percentage and estimated completion time
  - [ ] Model information display (selected model, cost estimation)
  - [ ] Cancellation functionality for long-running generations

- [ ] **Create media display components**
  - [ ] ImageResultDisplay with zoom, download, and regeneration options
  - [ ] VideoResultDisplay with play controls and quality selection
  - [ ] MediaMetadata display (model used, generation time, cost)
  - [ ] Social media sharing integration from chat results

### Phase 5: Advanced Features and Optimization 🚀 ⏳ PENDING

#### 5.1 NLP and Intent Recognition ⏳ PENDING
- [ ] **Create media generation NLP processor**
  - [ ] Intent classification for media generation requests
  - [ ] Parameter extraction from natural language (style, model, quality)
  - [ ] Context understanding for image/video requirements
  - [ ] Multi-language support for international usage

- [ ] **Implement smart model selection**
  - [ ] NLP pattern matching for model recommendation
  - [ ] Context-aware model selection based on use case
  - [ ] Performance-based model optimization
  - [ ] Cost-effective model selection algorithms

#### 5.2 Quality and Performance Optimization ⏳ PENDING
- [ ] **Implement quality assessment**
  - [ ] Automated quality scoring for generated media
  - [ ] User feedback integration for quality improvement
  - [ ] Quality-based model recommendation
  - [ ] Continuous quality monitoring and analytics

- [ ] **Create performance optimization**
  - [ ] Caching strategies for common generation requests
  - [ ] Batch processing optimization for efficiency
  - [ ] Load balancing across multiple model providers
  - [ ] Performance analytics and bottleneck identification

#### 5.3 Cost Management and Analytics ⏳ PENDING
- [ ] **Integrate with existing cost tracking**
  - [ ] Per-model cost tracking and optimization
  - [ ] Usage analytics and budget management
  - [ ] Cost-effective model recommendation
  - [ ] Usage reporting and cost optimization insights

- [ ] **Implement usage analytics**
  - [ ] Generation success rates and performance metrics
  - [ ] Model usage patterns and optimization opportunities
  - [ ] User behavior analysis for service improvement
  - [ ] Predictive analytics for capacity planning

### Phase 6: Testing and Documentation 🧪 ⏳ PENDING

#### 6.1 UI Component Development and Testing ⏳ PENDING
- [ ] **Create React UI components**
  - [ ] MediaGenerationProgress with real-time updates
  - [ ] MediaResultBubble with interactive media display
  - [ ] MediaGenerationError with retry mechanisms
  - [ ] ImageResultDisplay with zoom and download functionality
  - [ ] VideoResultDisplay with play controls and quality selection

- [ ] **Implement real-time progress tracking**
  - [ ] SSE/WebSocket integration for live status updates
  - [ ] Progress percentage calculation and ETA estimation
  - [ ] Generation cancellation functionality
  - [ ] Queue position and processing stage display
  - [ ] Cost estimation and model information display

- [ ] **Create comprehensive UI tests**
  - [ ] Unit tests for all media generation components
  - [ ] Integration tests for real-time progress updates
  - [ ] Visual regression tests for media display components
  - [ ] Accessibility tests for screen reader compatibility
  - [ ] Mobile responsiveness tests for chat bubbles

#### 6.2 Comprehensive Service Testing ⏳ PENDING
- [ ] **Create unit tests for all services**
  - [ ] FAL AI Service with mock API responses
  - [ ] Image/Video Generation Services with test scenarios
  - [ ] Tool integration tests with foundation
  - [ ] Error handling and edge case validation

- [ ] **Implement integration tests**
  - [ ] End-to-end media generation workflows
  - [ ] Cross-system tool discovery and execution
  - [ ] Social media integration testing
  - [ ] Agent workflow validation
  - [ ] UI integration with backend services

- [ ] **Create performance tests**
  - [ ] Load testing for concurrent generation requests
  - [ ] Model performance benchmarking
  - [ ] Cost optimization validation
  - [ ] Quality assessment accuracy testing
  - [ ] Real-time progress update performance

#### 6.3 Documentation and Examples ⏳ PENDING
- [ ] **Create developer documentation**
  - [ ] API reference for all media generation services
  - [ ] Tool integration guides and examples
  - [ ] Model selection and optimization guidelines
  - [ ] Troubleshooting and debugging guides

- [ ] **Create user guides**
  - [ ] Natural language media generation examples
  - [ ] Model selection recommendations
  - [ ] Quality optimization tips
  - [ ] Cost management best practices

## Technical Implementation Details

### Service Architecture

```typescript
// Core FAL AI Service
interface IFalAIService {
  // Model management
  getAvailableModels(category?: MediaCategory): Promise<readonly FalAIModel[]>;
  selectModel(prompt: string, category: MediaCategory, preferences?: ModelPreferences): Promise<FalAIModel>;
  
  // Generation requests
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
  generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResult>;
  
  // Status and monitoring
  getGenerationStatus(generationId: ULID): Promise<GenerationStatus>;
  getModelHealth(modelId: string): Promise<ModelHealthStatus>;
}

// Image Generation Service
interface IImageGenerationService {
  generateImage(prompt: string, options?: ImageGenerationOptions): Promise<ImageResult>;
  enhanceImage(imageUrl: string, options?: ImageEnhancementOptions): Promise<ImageResult>;
  transferStyle(imageUrl: string, stylePrompt: string): Promise<ImageResult>;
  batchGenerate(requests: readonly ImageGenerationRequest[]): Promise<readonly ImageResult[]>;
}

// Video Generation Service
interface IVideoGenerationService {
  generateVideo(prompt: string, options?: VideoGenerationOptions): Promise<VideoResult>;
  animateText(text: string, style: AnimationStyle): Promise<VideoResult>;
  createSlideshow(images: readonly string[], options?: SlideshowOptions): Promise<VideoResult>;
  batchGenerate(requests: readonly VideoGenerationRequest[]): Promise<readonly VideoResult[]>;
}

// Image-to-Video Service
interface IImageToVideoService {
  animateImage(imageUrl: string, options?: AnimationOptions): Promise<VideoResult>;
  createVideoFromImages(images: readonly string[], transitions?: TransitionOptions): Promise<VideoResult>;
  addMotionToImage(imageUrl: string, motionType: MotionType): Promise<VideoResult>;
  
  // Composite workflows
  generateAndAnimate(prompt: string, options?: CompositeOptions): Promise<VideoResult>;
}
```

### Tool Registration with Foundation

```typescript
// Example tool registration for image generation
class MediaGenerationToolSystem {
  constructor(
    private readonly foundation: IUnifiedToolFoundation,
    private readonly imageService: IImageGenerationService,
    private readonly videoService: IVideoGenerationService,
    private readonly imageToVideoService: IImageToVideoService
  ) {
    this.initializeMediaGenerationTools();
  }
  
  private async initializeMediaGenerationTools() {
    // Register image generation tools
    await this.foundation.registerTool({
      id: ulid(),
      name: MEDIA_GENERATION_TOOLS.GENERATE_IMAGE,
      displayName: "Generate Image",
      description: "Generate images from text prompts using AI models",
      category: ToolCategory.MEDIA_GENERATION,
      capabilities: [ToolCapability.IMAGE_GENERATION],
      parameters: this.getImageParameterSchema(),
      executor: this.executeImageGeneration.bind(this),
      metadata: {
        provider: 'fal-ai',
        version: '1.0.0',
        author: 'media-generation-system'
      },
      enabled: true
    });
    
    // Register video generation tools
    await this.foundation.registerTool({
      id: ulid(),
      name: MEDIA_GENERATION_TOOLS.GENERATE_VIDEO,
      displayName: "Generate Video",
      description: "Generate videos from text prompts using AI models",
      category: ToolCategory.MEDIA_GENERATION,
      capabilities: [ToolCapability.VIDEO_GENERATION],
      parameters: this.getVideoParameterSchema(),
      executor: this.executeVideoGeneration.bind(this),
      metadata: {
        provider: 'fal-ai',
        version: '1.0.0',
        author: 'media-generation-system'
      },
      enabled: true
    });
  }
  
  // Tool execution with model selection
  private async executeImageGeneration(
    params: ImageGenerationParams,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const { prompt, style, model: preferredModel } = params;
    
    // Use NLP to select appropriate model
    const selectedModel = preferredModel || 
      await this.selectModelFromNLP(prompt, style);
    
    const result = await this.imageService.generateImage(prompt, {
      model: selectedModel,
      style,
      quality: params.quality || 'high',
      aspectRatio: params.aspectRatio || '16:9'
    });
    
    return {
      success: true,
      data: result,
      metadata: {
        model: selectedModel,
        generationTime: result.processingTime,
        cost: result.cost
      }
    };
  }
}
```

### Chat UI Architecture

```typescript
// Chat bubble components for media generation
interface MediaGenerationChatComponents {
  // Progress tracking component
  MediaGenerationProgress: React.FC<{
    generationId: string;
    prompt: string;
    selectedModel: string;
    progress: number;
    estimatedTimeRemaining: number;
    onCancel: () => void;
  }>;
  
  // Media result display component
  MediaResultBubble: React.FC<{
    result: MediaGenerationResult;
    showMetadata: boolean;
    onRegenerate: () => void;
    onShare: (platform: SocialPlatform) => void;
    onDownload: () => void;
  }>;
  
  // Error handling component
  MediaGenerationError: React.FC<{
    error: MediaGenerationError;
    suggestedModels: FalAIModel[];
    onRetry: (newModel?: string) => void;
    onCancel: () => void;
  }>;
}

// Real-time progress tracking
interface MediaGenerationProgress {
  generationId: ULID;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  estimatedTimeRemaining: number; // seconds
  selectedModel: string;
  prompt: string;
  cost: number;
  startTime: Date;
  metadata?: {
    modelInfo: ModelInfo;
    queuePosition?: number;
    processingStage?: string;
  };
}

// Media result types for chat display
interface MediaGenerationResult {
  id: ULID;
  type: 'image' | 'video' | 'image-to-video';
  url: string;
  thumbnailUrl?: string;
  prompt: string;
  model: string;
  generationTime: number;
  cost: number;
  metadata: {
    resolution: string;
    aspectRatio: string;
    fileSize: number;
    quality: 'low' | 'medium' | 'high' | 'ultra';
    duration?: number; // for videos
  };
  actions: {
    canRegenerate: boolean;
    canEnhance: boolean;
    canAnimateToVideo: boolean; // for images
    canShare: boolean;
  };
}
```

### Chat Integration Implementation

```typescript
// Chat message types for media generation
interface MediaGenerationMessage extends ChatMessage {
  type: 'media-generation';
  content: {
    prompt: string;
    generationRequest: MediaGenerationRequest;
    progress?: MediaGenerationProgress;
    result?: MediaGenerationResult;
    error?: MediaGenerationError;
  };
}

// Chat bubble component integration
const MediaGenerationChatBubble: React.FC<{message: MediaGenerationMessage}> = ({ message }) => {
  const { content } = message;
  
  // Show progress if generation is in progress
  if (content.progress && content.progress.status === 'processing') {
    return (
      <ChatBubble variant="media-progress">
        <MediaGenerationProgress
          generationId={content.progress.generationId}
          prompt={content.prompt}
          selectedModel={content.progress.selectedModel}
          progress={content.progress.progress}
          estimatedTimeRemaining={content.progress.estimatedTimeRemaining}
          onCancel={() => cancelGeneration(content.progress!.generationId)}
        />
      </ChatBubble>
    );
  }
  
  // Show result if generation completed
  if (content.result) {
    return (
      <ChatBubble variant="media-result">
        <MediaResultBubble
          result={content.result}
          showMetadata={true}
          onRegenerate={() => regenerateMedia(content.result!.id)}
          onShare={(platform) => shareToSocialMedia(content.result!.url, platform)}
          onDownload={() => downloadMedia(content.result!.url)}
        />
      </ChatBubble>
    );
  }
  
  // Show error if generation failed
  if (content.error) {
    return (
      <ChatBubble variant="media-error">
        <MediaGenerationError
          error={content.error}
          suggestedModels={getSuggestedModels(content.error)}
          onRetry={(newModel) => retryGeneration(content.generationRequest, newModel)}
          onCancel={() => cancelGeneration(content.generationRequest.id)}
        />
      </ChatBubble>
    );
  }
  
  return null;
};

// Real-time updates via SSE/WebSocket
const useMediaGenerationProgress = (generationId: ULID) => {
  const [progress, setProgress] = useState<MediaGenerationProgress | null>(null);
  
  useEffect(() => {
    const eventSource = new EventSource(`/api/media-generation/${generationId}/progress`);
    
    eventSource.onmessage = (event) => {
      const progressUpdate: MediaGenerationProgress = JSON.parse(event.data);
      setProgress(progressUpdate);
    };
    
    return () => eventSource.close();
  }, [generationId]);
  
  return progress;
};
```

### UI Component Specifications

#### **MediaGenerationProgress Component**
```typescript
const MediaGenerationProgress: React.FC<MediaGenerationProgressProps> = ({
  generationId,
  prompt,
  selectedModel,
  progress,
  estimatedTimeRemaining,
  onCancel
}) => {
  return (
    <div className="media-generation-progress">
      <div className="progress-header">
        <h4>Generating {getMediaType(prompt)}...</h4>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="progress-content">
        <p className="prompt-text">"{truncate(prompt, 100)}"</p>
        <div className="model-info">
          <Badge variant="secondary">{selectedModel}</Badge>
          <span className="eta">~{formatTime(estimatedTimeRemaining)} remaining</span>
        </div>
        
        <Progress value={progress} className="progress-bar" />
        <div className="progress-details">
          <span>{progress}% complete</span>
          <span>${formatCost(estimatedCost)}</span>
        </div>
      </div>
    </div>
  );
};
```

#### **MediaResultBubble Component**
```typescript
const MediaResultBubble: React.FC<MediaResultBubbleProps> = ({
  result,
  showMetadata,
  onRegenerate,
  onShare,
  onDownload
}) => {
  return (
    <div className="media-result-bubble">
      <div className="media-display">
        {result.type === 'image' ? (
          <ImageResultDisplay
            src={result.url}
            alt={result.prompt}
            resolution={result.metadata.resolution}
            onZoom={() => openImageModal(result.url)}
          />
        ) : (
          <VideoResultDisplay
            src={result.url}
            thumbnail={result.thumbnailUrl}
            duration={result.metadata.duration}
            quality={result.metadata.quality}
          />
        )}
      </div>
      
      {showMetadata && (
        <div className="media-metadata">
          <p className="prompt">"{result.prompt}"</p>
          <div className="metadata-grid">
            <span>Model: {result.model}</span>
            <span>Time: {formatTime(result.generationTime)}</span>
            <span>Cost: ${formatCost(result.cost)}</span>
            <span>Quality: {result.metadata.quality}</span>
          </div>
        </div>
      )}
      
      <div className="media-actions">
        {result.actions.canRegenerate && (
          <Button variant="outline" size="sm" onClick={onRegenerate}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
        )}
        
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
        
        {result.actions.canShare && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onShare('instagram')}>
                Instagram
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShare('twitter')}>
                Twitter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShare('linkedin')}>
                LinkedIn
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {result.type === 'image' && result.actions.canAnimateToVideo && (
          <Button variant="outline" size="sm" onClick={() => animateToVideo(result.id)}>
            <Play className="h-4 w-4 mr-2" />
            Animate
          </Button>
        )}
      </div>
    </div>
  );
};
```

#### **Real-time Progress Integration**
```typescript
// WebSocket/SSE service for real-time updates
class MediaGenerationProgressService {
  private eventSource: EventSource | null = null;
  private subscribers = new Map<ULID, Set<(progress: MediaGenerationProgress) => void>>();
  
  subscribeToProgress(
    generationId: ULID, 
    callback: (progress: MediaGenerationProgress) => void
  ): () => void {
    if (!this.subscribers.has(generationId)) {
      this.subscribers.set(generationId, new Set());
      this.startProgressTracking(generationId);
    }
    
    this.subscribers.get(generationId)!.add(callback);
    
    return () => {
      const callbacks = this.subscribers.get(generationId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.stopProgressTracking(generationId);
        }
      }
    };
  }
  
  private startProgressTracking(generationId: ULID) {
    this.eventSource = new EventSource(`/api/media-generation/${generationId}/progress`);
    
    this.eventSource.onmessage = (event) => {
      const progress: MediaGenerationProgress = JSON.parse(event.data);
      const callbacks = this.subscribers.get(generationId);
      
      if (callbacks) {
        callbacks.forEach(callback => callback(progress));
      }
      
      // Clean up if generation completed
      if (['completed', 'failed', 'cancelled'].includes(progress.status)) {
        this.stopProgressTracking(generationId);
      }
    };
  }
  
  private stopProgressTracking(generationId: ULID) {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.subscribers.delete(generationId);
  }
}
```

### NLP Model Selection

```typescript
class ModelSelectionService {
  private readonly modelPatterns = new Map([
    // Image models
    [['midjourney', 'artistic', 'creative'], FAL_AI_MODELS.MIDJOURNEY],
    [['flux', 'pro', 'realistic'], FAL_AI_MODELS.FLUX_PRO],
    [['stable diffusion', 'sd3', 'open source'], FAL_AI_MODELS.STABLE_DIFFUSION_V3],
    [['pixar', 'cartoon', 'animated'], FAL_AI_MODELS.PIXART_ALPHA],
    
    // Video models
    [['veo3', 'google veo', 'cinematic'], FAL_AI_MODELS.VEO3],
    [['runway', 'gen3', 'professional'], FAL_AI_MODELS.RUNWAY_GEN3],
    [['pika', 'creative', 'artistic'], FAL_AI_MODELS.PIKA_LABS],
    
    // Image-to-video models
    [['kling', 'smooth', 'transitions'], FAL_AI_MODELS.KLING],
    [['animate', 'motion', 'fluid'], FAL_AI_MODELS.ANIMATE_DIFF]
  ]);
  
  async selectModel(
    prompt: string, 
    category: MediaCategory,
    preferences?: ModelPreferences
  ): Promise<FalAIModel> {
    const promptLower = prompt.toLowerCase();
    
    // Check for explicit model mentions
    for (const [patterns, model] of this.modelPatterns) {
      if (patterns.some(pattern => promptLower.includes(pattern))) {
        if (this.isModelCompatible(model, category)) {
          return model;
        }
      }
    }
    
    // Fallback to performance-based selection
    return await this.selectByPerformance(category, preferences);
  }
}
```

## Integration Points

### Social Media Integration
- **Automated Content Creation**: Generate images/videos for social media posts
- **Platform Optimization**: Automatically format media for different platforms
- **Brand Consistency**: Enforce brand guidelines and style consistency
- **Content Approval**: Integration with existing approval workflows

### Agent Integration
- **Natural Language Requests**: "Generate a Pixar-style image of Lionel Messi with the Ninja Turtles using Midjourney"
- **Model Awareness**: Agents understand model capabilities and limitations
- **Quality Control**: Automatic quality assessment and regeneration
- **Cost Management**: Budget-aware generation with cost optimization

### Workflow Integration
- **Multi-Step Workflows**: Image generation → enhancement → video creation
- **Batch Processing**: Generate multiple variations efficiently
- **Template Support**: Reusable workflows for common use cases
- **Error Recovery**: Graceful handling of generation failures

## Success Criteria

### Functional Requirements
- [ ] **All media generation models** accessible through unified FAL AI gateway
- [ ] **NLP model selection** working with 90%+ accuracy for common patterns
- [ ] **Cross-system tool discovery** enabling media generation from any agent
- [ ] **Social media integration** with automated platform optimization
- [ ] **Image-to-video workflows** functioning end-to-end
- [ ] **Cost tracking integration** with existing cost management systems

### Quality Requirements
- [ ] **>95% test coverage** for all media generation services
- [ ] **<5 second response times** for simple generation requests
- [ ] **Zero TypeScript compilation errors**
- [ ] **Zero ESLint violations**
- [ ] **Performance benchmarks met** for all generation types
- [ ] **Error handling coverage** for all failure scenarios

### Architecture Requirements
- [ ] **Unified tools foundation integration** with all media services
- [ ] **Centralized constants** - no string literals for models or tools
- [ ] **ULID identifiers** consistent with foundation patterns
- [ ] **Structured error handling** with comprehensive context
- [ ] **Dependency injection** throughout all services
- [ ] **Service health monitoring** integrated with existing systems

## Risk Mitigation

### Technical Risks
- **API Rate Limits**: Implement intelligent rate limiting and request queuing
- **Model Availability**: Build fallback mechanisms and health monitoring
- **Generation Failures**: Comprehensive error handling with retry logic
- **Cost Management**: Built-in budget controls and usage monitoring

### Integration Risks
- **Tool Foundation Integration**: Extensive testing with existing systems
- **Performance Impact**: Monitoring and optimization for system performance
- **Data Consistency**: Proper validation and error handling throughout
- **Backward Compatibility**: Maintain existing functionality while adding new features

## Timeline Estimate

- **Phase 1 (Foundation and Constants)**: 1-2 weeks
- **Phase 2 (FAL AI Service Implementation)**: 2-3 weeks  
- **Phase 3 (Specialized Generation Services)**: 3-4 weeks
- **Phase 4 (Tool System Integration)**: 2-3 weeks
- **Phase 5 (Advanced Features)**: 2-3 weeks
- **Phase 6 (Testing and Documentation)**: 1-2 weeks

**Total Estimated Timeline**: 11-17 weeks
**Critical Path**: FAL AI Service → Image/Video Services → Tool Integration

## Conclusion

The Image and Video Generation Service implementation provides a comprehensive, type-safe, and scalable solution for AI-powered media generation. By building on the existing Unified Tools Foundation, we ensure seamless integration with all existing systems while providing powerful new capabilities for agents and social media workflows.

The architecture prioritizes performance, reliability, and cost optimization while maintaining the flexibility to add new models and capabilities as they become available. The natural language model selection enables intuitive user interactions while the robust error handling ensures reliable operation in production environments.

This implementation follows all established architectural patterns and guidelines, ensuring consistency with the existing codebase while providing innovative new functionality for the Agent Swarm platform.

## Integration with Unified Tools Foundation

### Tool Registration Architecture

The Media Generation System integrates seamlessly with our existing **Unified Tools Foundation** (Phase 0-5 complete), becoming the **18th specialized system** in our tool ecosystem. This integration provides:

#### **Foundation Integration Benefits**
- **Cross-System Discovery**: Media generation tools discoverable by all agents, social media, workspace, and thinking systems
- **Unified Error Handling**: Consistent AppError-based error hierarchy with structured context
- **Performance Monitoring**: Built-in metrics, health tracking, and circuit breaker patterns
- **ULID Identifiers**: Consistent with foundation patterns for business logic tracking
- **Cost Integration**: Seamless integration with existing cost tracking and optimization systems

#### **Tool Categories Added to Foundation**
```typescript
// New tool capabilities added to ToolEnums.ts
export enum ToolCapability {
  // ... existing capabilities
  IMAGE_GENERATION = 'IMAGE_GENERATION',
  VIDEO_GENERATION = 'VIDEO_GENERATION', 
  IMAGE_TO_VIDEO = 'IMAGE_TO_VIDEO',
  STYLE_TRANSFER = 'STYLE_TRANSFER',
  MEDIA_ENHANCEMENT = 'MEDIA_ENHANCEMENT',
  BATCH_GENERATION = 'BATCH_GENERATION',
}

export enum ToolCategory {
  // ... existing categories
  MEDIA_GENERATION = 'MEDIA_GENERATION',
}
```

#### **Constants Integration**
All 35+ media generation tools use centralized constants, eliminating string literals:

```typescript
// src/constants/media-generation-tools.ts
export const MEDIA_GENERATION_TOOLS = {
  // FAL AI Gateway Tools
  GENERATE_IMAGE_FAL: 'generate_image_fal',
  GENERATE_VIDEO_FAL: 'generate_video_fal', 
  GET_MODEL_STATUS: 'get_model_status',
  
  // Image Generation Tools
  GENERATE_IMAGE: 'generate_image',
  ENHANCE_IMAGE: 'enhance_image',
  STYLE_TRANSFER: 'style_transfer',
  UPSCALE_IMAGE: 'upscale_image',
  BATCH_GENERATE_IMAGES: 'batch_generate_images',
  
  // Video Generation Tools
  GENERATE_VIDEO: 'generate_video',
  ANIMATE_TEXT: 'animate_text',
  CREATE_SLIDESHOW: 'create_slideshow',
  BATCH_GENERATE_VIDEOS: 'batch_generate_videos',
  
  // Image-to-Video Tools
  ANIMATE_IMAGE: 'animate_image',
  CREATE_VIDEO_FROM_IMAGE: 'create_video_from_image',
  ADD_MOTION: 'add_motion',
  CREATE_TRANSITIONS: 'create_transitions',
} as const;
```

### Usage Examples Across Systems

#### **Agent Integration**
```typescript
// DefaultAgent can now generate media through unified foundation
const agent = new DefaultAgent(toolFoundation);

// Natural language request automatically routes to appropriate model
const result = await agent.processRequest(
  "Generate a Pixar-style image of Lionel Messi with the Ninja Turtles using Midjourney"
);
// → Automatically selects fal-ai/midjourney model based on NLP patterns
```

#### **Social Media Integration**
```typescript
// SocialMediaToolSystem can generate media for posts
const socialSystem = new SocialMediaToolSystem(toolFoundation);

await socialSystem.createPost({
  platform: 'instagram',
  content: 'Check out this amazing video!',
  generateMedia: {
    type: 'video',
    prompt: 'A cinematic video of a sunset over mountains',
    model: 'veo3', // Automatically maps to fal-ai/veo3
    aspectRatio: '9:16' // Instagram Stories format
  }
});
```

#### **Workflow Integration**  
```typescript
// Multi-step workflows combining different systems
const workflow = await toolFoundation.discoverTools({
  intent: 'Create marketing content with image and video',
  capabilities: [
    ToolCapability.IMAGE_GENERATION,
    ToolCapability.VIDEO_GENERATION,
    ToolCapability.SOCIAL_MEDIA_POSTING
  ]
});

// Executes: Image Generation → Video Creation → Social Media Posting
```

### Performance Integration

#### **Intelligent Routing**
- **Phase 3.2 Integration**: Media generation benefits from intelligent tool routing with ML-like scoring
- **Load Balancing**: Automatic distribution across multiple FAL AI models based on availability
- **Caching**: Generated media cached intelligently to avoid redundant API calls

#### **Adaptive Learning**
- **Phase 3.3 Integration**: System learns user preferences for model selection
- **Usage Analytics**: Tracks which models work best for different types of prompts
- **Cost Optimization**: Automatically suggests cost-effective models for similar results

### Error Handling Integration

#### **Structured Error Hierarchy**
```typescript
// Media generation errors extend foundation AppError
export class MediaGenerationError extends AppError {
  constructor(message: string, context: MediaGenerationContext) {
    super(message, 'MEDIA_GENERATION_ERROR', context);
  }
}

export class ModelNotFoundError extends MediaGenerationError {
  constructor(modelId: string, availableModels: string[]) {
    super(`Model not found: ${modelId}`, {
      modelId,
      availableModels,
      suggestedModels: findSimilarModels(modelId)
    });
  }
}
```

#### **Graceful Degradation**
- **Model Unavailable**: Automatically suggests alternative models with similar capabilities
- **API Rate Limits**: Intelligent queueing and retry with exponential backoff
- **Generation Failures**: Detailed error context with suggestions for prompt improvements

### Chat System Integration

The media generation system integrates with our existing **SSE Chat System** (see `docs/features/chat-system-sse.md`) to provide real-time updates and interactive media display within chat conversations.

#### **Chat Message Flow**
1. **User Request**: "Generate a Pixar-style image of Lionel Messi with the Ninja Turtles using Midjourney"
2. **Immediate Response**: MediaGenerationProgress component shows in chat with model selection and ETA
3. **Real-time Updates**: Progress percentage and processing stage updates via SSE
4. **Completion**: MediaResultBubble replaces progress component with interactive media display
5. **Actions**: User can regenerate, download, share, or animate (image → video)

#### **SSE Integration Architecture**
```typescript
// Extend existing chat SSE system for media generation
interface ChatSSEMessage {
  type: 'chat-message' | 'media-generation-progress' | 'media-generation-complete' | 'media-generation-error';
  data: ChatMessage | MediaGenerationProgress | MediaGenerationResult | MediaGenerationError;
}

// Media generation progress updates via existing SSE infrastructure
const sendMediaProgressUpdate = (generationId: ULID, progress: MediaGenerationProgress) => {
  const sseMessage: ChatSSEMessage = {
    type: 'media-generation-progress',
    data: progress
  };
  
  // Use existing SSE service to send updates
  chatSSEService.sendToUser(progress.userId, sseMessage);
};
```

#### **Chat Component Integration**
The MediaGenerationChatBubble extends our existing chat bubble architecture:

```typescript
// Add to existing chat bubble types
const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  switch (message.type) {
    case 'text':
      return <TextChatBubble message={message} />;
    case 'media-generation':
      return <MediaGenerationChatBubble message={message} />;
    // ... other bubble types
  }
};
```

#### **Mobile-Responsive Design**
- **Progress Component**: Compact layout for mobile with essential info (model, ETA, progress bar)
- **Media Display**: Touch-friendly controls with swipe gestures for image zoom
- **Action Buttons**: Responsive button layout that adapts to screen size
- **Video Player**: Native mobile video controls with quality selection

#### **Accessibility Features**
- **Screen Reader Support**: Alt text for images, ARIA labels for progress components
- **Keyboard Navigation**: Full keyboard accessibility for all media actions
- **High Contrast**: Support for high contrast mode and custom themes
- **Voice Announcements**: Progress updates announced for screen readers

This comprehensive integration ensures that media generation capabilities are not isolated but become a natural extension of our existing unified tools ecosystem, providing seamless access to AI-powered media creation across all agent workflows, social media operations, and business processes with an intuitive chat-based interface. 