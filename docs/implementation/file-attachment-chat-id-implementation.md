# File Attachment Implementation for Chat/[id] Endpoint

## Claude Prompt Section

**IMPORTANT INSTRUCTIONS FOR CLAUDE:**

When implementing file attachment functionality for the chat/[id] endpoint, follow these guidelines:

1. Reference the Main Implementation:
   - Always check `src/app/page.tsx` for the original implementation
   - Understand how each feature was implemented in the main chat
   - Note which parts worked well and should be preserved
   - Identify areas that need improvement or refactoring
   - Pay special attention to:
     * File attachment handling logic
     * Image storage and retrieval methods
     * Message action implementations
     * Event handling patterns
     * Error handling approaches

2. Adhere strictly to the IMPLEMENTATION_GUIDELINES.md principles, particularly:
   - Replace, don't extend legacy code patterns
   - Eliminate anti-patterns completely
   - Follow strict type safety (never use 'any' type)
   - Use interface-first design
   - Create smaller, modular files (<300 lines per file)

3. Implement in a modular fashion:
   - Create focused components with clear responsibilities
   - Use dependency injection for all components
   - Define interfaces before implementations
   - Break functionality into smaller, reusable services
   - Extract reusable logic from main page implementation

4. Prioritize performance:
   - Optimize image storage and retrieval
   - Create efficient thumbnails
   - Consider memory usage for large files
   - Reuse efficient patterns from main implementation

5. Ensure comprehensive error handling:
   - Create custom error types for file operations
   - Handle all edge cases (file too large, invalid type, etc.)
   - Provide helpful error messages to users
   - Learn from error handling in main implementation

6. Migration Strategy:
   - Identify which parts of the main implementation can be reused
   - Plan how to break down monolithic functions into services
   - Consider backward compatibility during transition
   - Document any breaking changes or API differences

## Implementation Checklist

### 1. Core File Service Infrastructure

- [x] 1.1. Create `FileStorageService` interface
  - [x] Define methods for saving, retrieving, and managing file data
  - [x] Include strong typing for all operations
  - [x] Add proper error handling types

- [x] 1.2. Implement `IndexedDBFileStorage` class
  - [x] Initialize IndexedDB database for file storage
  - [x] Implement CRUD operations for files
  - [x] Add robust error handling
  - [x] Add file type detection
  - [x] Implement file metadata management

- [x] 1.3. Create `ThumbnailService` utility
  - [x] Define methods for thumbnail generation
  - [x] Add configurable thumbnail sizes
  - [x] Optimize for performance
  - [x] Add caching for generated thumbnails
  - [x] Support multiple image formats
  - [x] Implement aspect ratio handling

### 2. File Handling Components

- [x] 2.1. Create `FileAttachmentHandler` class
  - [x] Process different file types (images, PDFs, documents)
  - [x] Extract metadata and generate previews
  - [x] Integrate with storage service
  - [x] Add error handling and validation
  - [x] Implement progress tracking
  - [x] Add file type validation
  - [x] Implement file size limits
  - [x] Add placeholder previews for non-image files

- [x] 2.2. Implement `ClipboardHandler` utility
  - [x] Extract images from clipboard events
  - [x] Process pasted content
  - [x] Generate file objects from clipboard data
  - [x] Handle paste events in chat input
  - [x] Support multiple file types
  - [x] Add error handling
  - [x] Implement text content handling
  - [x] Add HTML content processing
  - [x] Support custom event dispatching

- [x] 2.3. Create `DragDropHandler` utility
  - [x] Handle file drag and drop events
  - [x] Process dropped files
  - [x] Provide feedback during drag operations
  - [x] Support folder drops
  - [x] Handle multiple files
  - [x] Add visual feedback
  - [x] Implement file validation
  - [x] Add error handling
  - [x] Support custom events

### 3. UI Components

- [x] 3.1. Create `ImageModal` component
  - [x] Display full-size images
  - [x] Support image navigation
  - [x] Include image metadata display
  - [x] Add zoom controls
  - [x] Support keyboard navigation
  - [x] Add rotation controls
  - [x] Implement image dragging
  - [x] Add download functionality

- [x] 3.2. Create `FilePreview` component
  - [x] Display file thumbnails
  - [x] Show file metadata
  - [x] Support different file types
  - [x] Add loading states
  - [x] Handle errors gracefully

- [x] 3.3. Create `UploadProgress` component
  - [x] Show upload progress
  - [x] Display file information
  - [x] Support cancellation
  - [x] Handle errors
  - [x] Show success/failure states

- [x] 3.4. Create `ErrorDisplay` component
  - [x] Show error messages
  - [x] Support different error types
  - [x] Add retry functionality
  - [x] Provide error details
  - [x] Include help information

### 4. Integration with Message Handler

- [x] 4.1. Update `MessageHandlerService`
  - [x] Create interface for message handling
  - [x] Define message types and states
  - [x] Add file attachment support
  - [x] Implement message validation
  - [x] Add error handling

- [x] 4.2. Implement `MessageHandlerImplementation`
  - [x] Implement message handling interface
  - [x] Add file attachment processing
  - [x] Integrate with storage service
  - [x] Add validation logic
  - [x] Implement error handling

- [x] 4.3. Create `FileUploadService`
  - [x] Define upload interface
  - [x] Define event system
  - [x] Add progress tracking
  - [x] Add cancellation support
  - [x] Add retry handling

- [x] 4.4. Implement `FileUploadImplementation`
  - [x] Implement upload interface
  - [x] Add progress calculation
  - [x] Implement cancellation
  - [x] Add retry logic
  - [x] Handle errors

### 5. Page Integration

- [x] 5.1. Update `chat/[id]/page.tsx`
  - [x] Add file attachment UI
  - [x] Integrate message handler
  - [x] Add upload progress display
  - [x] Implement error handling
  - [x] Add file preview support

### 6. ChatBubbleMenu Integration

- [x] 6.1. Create `MessageActionService` interface
  - [x] Define methods for all message actions (flag, copy, delete, etc.)
  - [x] Include strong typing for all operations
  - [x] Add proper error handling and return types

- [x] 6.2. Implement `MessageActionHandler` class
  - [x] Implement all message action methods
  - [x] Connect to appropriate backend APIs
  - [x] Handle success/failure states
  - [x] Add proper error handling and user feedback

- [x] 6.3. Create action-specific services
  - [x] `ImportanceService` for flagging messages
  - [x] `KnowledgeService` for knowledge base operations
  - [x] `RegenerationService` for message regeneration
  - [x] `ExportService` for Coda exports
  - [x] `ReliabilityService` for unreliable flags

- [x] 6.4. Update ChatBubbleMenu component
  - [x] Integrate with MessageActionService
  - [x] Add loading states for actions
  - [x] Improve error handling and user feedback
  - [x] Add success/failure notifications
  - [x] Add progress indicators for long-running operations
  - [x] Implement retry mechanisms for failed actions
  - [x] Add tooltips and accessibility improvements

- [x] 6.5. Add unit tests for message actions
  - [x] Test each action service independently
  - [x] Test error scenarios and edge cases
  - [x] Test integration with backend APIs
  - [x] Add mock API responses for testing
  - [x] Test event handling and callbacks
  - [x] Test loading and error states
  - [x] Test accessibility features

### 7. Testing and Validation

- [x] 7.1. Create unit tests for file services
  - [x] Test storage and retrieval
  - [x] Test thumbnail generation
  - [x] Test error handling
  - [x] Test file type validation
  - [x] Test progress tracking
  - [x] Test cancellation handling

- [x] 7.2. Fix linter errors in file services
  - [x] Update FileMetadata interface usage
  - [x] Fix File interface implementation in tests
  - [x] Update storage service mock implementation

### 8. UI Polish and Accessibility

- [x] 8.1. Enhance UI components
  - [x] Add keyboard navigation support
  - [x] Improve focus management
  - [x] Add ARIA labels and roles
  - [x] Implement screen reader support
  - [ ] Add high contrast mode support

- [x] 8.2. Improve error handling and feedback
  - [x] Add descriptive error messages
  - [x] Implement retry mechanism for failed uploads
  - [x] Add progress indicators for long operations
  - [x] Implement toast notifications for status updates

- [ ] 8.3. Optimize performance
  - [ ] Implement file chunking for large files
  - [ ] Add file compression for images
  - [ ] Implement lazy loading for thumbnails
  - [ ] Add caching for frequently accessed files

### 9. Documentation and Cleanup

- [ ] 9.1. Update documentation
  - [ ] Add API documentation
  - [ ] Update component documentation
  - [ ] Add usage examples
  - [ ] Document error codes and handling

- [x] 9.2. Code cleanup
  - [x] Remove unused code
  - [x] Optimize imports
  - [x] Add missing comments
  - [x] Fix code style issues

## Next Steps

1. Proceed with implementing performance optimizations (Section 8.3)
2. Complete documentation updates (Section 9.1)
3. Add high contrast mode support for accessibility (Section 8.1) 