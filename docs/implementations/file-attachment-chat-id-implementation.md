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

- [ ] 3.2. Create `FilePreview` component
  - [ ] Display file thumbnails
  - [ ] Show file metadata
  - [ ] Support different file types
  - [ ] Add loading states
  - [ ] Handle errors gracefully

- [ ] 3.3. Create `UploadProgress` component
  - [ ] Show upload progress
  - [ ] Display file information
  - [ ] Support cancellation
  - [ ] Handle errors
  - [ ] Show success/failure states

- [ ] 3.4. Create `ErrorDisplay` component
  - [ ] Show error messages
  - [ ] Support different error types
  - [ ] Add retry functionality
  - [ ] Provide error details
  - [ ] Include help information

### 4. Integration with Message Handler

- [ ] 4.1. Update `MessageHandlerService`
  - Integrate file attachment handling
  - Process files during message submission
  - Handle file references in received messages

- [ ] 4.2. Implement `FileUploadService`
  - Handle the upload process to backend
  - Track upload progress
  - Manage upload failures and retries

- [ ] 4.3. Create `AttachmentMetadataService`
  - Track attachments across chat sessions
  - Manage references to file data
  - Support cleanup of unused attachments

### 5. Page Integration

- [ ] 5.1. Update `chat/[id]/page.tsx`
  - Add event listeners for clipboard and drag/drop
  - Integrate with file handling services
  - Connect UI components for file interaction

- [ ] 5.2. Add event handling hooks
  - Create custom hooks for paste events
  - Implement hooks for drag and drop
  - Add hooks for file selection

### 6. Testing and Validation

- [ ] 6.1. Create unit tests for file services
  - Test storage and retrieval
  - Test thumbnail generation
  - Test error handling

- [ ] 6.2. Implement integration tests
  - Test end-to-end file handling
  - Validate proper display of attachments
  - Verify persistence across page refreshes

### 7. ChatBubbleMenu Integration

- [ ] 7.1. Create `MessageActionService` interface
  - Define methods for all message actions (flag, copy, delete, etc.)
  - Include strong typing for all operations
  - Add proper error handling and return types

- [ ] 7.2. Implement `MessageActionHandler` class
  - Implement all message action methods
  - Connect to appropriate backend APIs
  - Handle success/failure states
  - Add proper error handling and user feedback

- [ ] 7.3. Create action-specific services
  - [ ] `ImportanceService` for flagging messages
  - [ ] `KnowledgeService` for knowledge base operations
  - [ ] `RegenerationService` for message regeneration
  - [ ] `ExportService` for Coda exports
  - [ ] `ReliabilityService` for unreliable flags

- [ ] 7.4. Update ChatBubbleMenu component
  - Integrate with MessageActionService
  - Add loading states for actions
  - Improve error handling and user feedback
  - Add success/failure notifications

- [ ] 7.5. Add unit tests for message actions
  - Test each action service independently
  - Test error scenarios and edge cases
  - Test integration with backend APIs

## Next Steps

1. **UI Components**: Continue implementing:
   - File preview component
   - Upload progress indicator
   - Error message displays
   - Loading states

2. **Integration Testing**: Write tests for:
   - File storage operations
   - Thumbnail generation
   - Clipboard handling
   - Drag and drop operations
   - Image modal functionality

3. **UI Integration**: Start integrating with:
   - Chat input component
   - Message display
   - File preview modals
   - Progress indicators

4. **Error Handling**: Implement:
   - Upload progress tracking
   - Error message displays
   - Retry mechanisms
   - Validation feedback

5. **Performance Optimization**: 
   - Optimize image loading
   - Implement lazy loading
   - Add request debouncing
   - Cache frequently accessed files

6. **Documentation**: Update with:
   - Component usage guides
   - Event handling patterns
   - Error handling strategies
   - Configuration options

7. **Code Review**: Ensure:
   - Type safety
   - Error handling
   - Performance optimization
   - Security best practices 