# Standalone Electron App Implementation Plan

## Project Goal

Package the Agent Swarm platform as a standalone Electron desktop application that bundles the Next.js web app, Qdrant vector database, and all dependencies into a single executable. This will provide a seamless user experience without requiring Docker, technical setup, or cloud dependencies, enabling users to run their own local agent swarm with professional installers for Windows, macOS, and Linux.

## Overview

Transform the current web-based Agent Swarm platform into a desktop application that:
- Bundles all services (Next.js, Qdrant, file storage) into a single installer
- Manages service orchestration internally
- Provides professional installation experience
- Maintains all existing functionality while running completely offline
- Targets ~400MB installer size with auto-update capabilities

## Architecture

**Main Process**: Electron orchestrates embedded services
- **QdrantManager**: Manages embedded Qdrant vector database
- **ServerManager**: Controls Next.js development server
- **PortManager**: Handles port conflict resolution
- **AppDataManager**: Manages user data persistence

**User Data Location**: 
- Windows: `%APPDATA%/AgentSwarm/`
- macOS: `~/Library/Application Support/AgentSwarm/`
- Linux: `~/.config/AgentSwarm/`

## 4-Week Implementation Timeline

### Week 1: Project Setup & Foundation
**Duration**: 5-7 days

#### Phase 1.1: Project Structure
- [ ] Create `electron/` directory in project root
- [ ] Initialize Electron project with TypeScript
- [ ] Set up proper TypeScript configuration for Electron
- [ ] Create main process entry point (`electron/main.ts`)
- [ ] Create preload script for secure renderer communication
- [ ] Configure Webpack/Vite for Electron builds
- [ ] Set up development environment with hot reload

#### Phase 1.2: Basic Electron Window
- [ ] Create main window with proper security settings
- [ ] Implement window state management (size, position)
- [ ] Add application menu structure
- [ ] Create splash screen for startup
- [ ] Set up IPC communication between main and renderer
- [ ] Configure CSP and security headers
- [ ] Test basic Electron app launches and loads

#### Phase 1.3: Environment Setup
- [ ] Create environment detection (development vs production)
- [ ] Set up logging system for Electron processes
- [ ] Configure app data directory creation
- [ ] Implement graceful shutdown handling
- [ ] Add error boundary and crash reporting
- [ ] Set up development debugging tools
- [ ] Test application lifecycle events

### Week 2: Service Management Implementation
**Duration**: 7-8 days

#### Phase 2.1: QdrantManager Implementation
- [ ] Download and bundle Qdrant binaries for each platform
- [ ] Create QdrantManager class with lifecycle methods
- [ ] Implement binary path resolution for different OS
- [ ] Add Qdrant process spawning and monitoring
- [ ] Create health check system for Qdrant service
- [ ] Implement automatic restart on failure
- [ ] Add configuration management for Qdrant settings
- [ ] Test Qdrant startup and shutdown sequences

#### Phase 2.2: ServerManager Implementation
- [ ] Create ServerManager for Next.js server control
- [ ] Implement Next.js build process integration
- [ ] Add server process spawning with proper environment
- [ ] Create server health monitoring
- [ ] Implement automatic server restart on crashes
- [ ] Add build caching for faster startups
- [ ] Configure production vs development server modes
- [ ] Test server lifecycle management

#### Phase 2.3: PortManager Implementation
- [ ] Create PortManager for dynamic port allocation
- [ ] Implement port availability checking
- [ ] Add port conflict resolution logic
- [ ] Create port reservation system
- [ ] Implement fallback port strategies
- [ ] Add port range configuration
- [ ] Test port management under various scenarios
- [ ] Document port usage for troubleshooting

#### Phase 2.4: AppDataManager Implementation
- [ ] Create AppDataManager for user data handling
- [ ] Implement cross-platform data directory setup
- [ ] Add database file management (SQLite migration)
- [ ] Create configuration file handling
- [ ] Implement data backup and restore functionality
- [ ] Add data migration between app versions
- [ ] Create data cleanup and maintenance routines
- [ ] Test data persistence across app restarts

### Week 3: Build Pipeline & Distribution
**Duration**: 7-8 days

#### Phase 3.1: Electron Builder Configuration
- [ ] Install and configure Electron Builder
- [ ] Create build configuration for Windows (NSIS)
- [ ] Create build configuration for macOS (DMG)
- [ ] Create build configuration for Linux (AppImage)
- [ ] Configure code signing for production builds
- [ ] Set up notarization for macOS builds
- [ ] Add build scripts to package.json
- [ ] Test basic builds for each platform

#### Phase 3.2: Asset Bundling
- [ ] Bundle Qdrant binaries into app resources
- [ ] Optimize Next.js build for Electron
- [ ] Bundle node_modules efficiently
- [ ] Create asset compression pipeline
- [ ] Implement resource extraction at runtime
- [ ] Add binary verification and integrity checks
- [ ] Optimize bundle size (target <400MB)
- [ ] Test bundled assets work correctly

#### Phase 3.3: Installer Creation
- [ ] Design installer UI and branding
- [ ] Configure Windows installer (NSIS) with proper UAC
- [ ] Configure macOS installer (DMG) with drag-and-drop
- [ ] Configure Linux installer (AppImage) with desktop integration
- [ ] Add installation progress indicators
- [ ] Implement uninstaller functionality
- [ ] Add desktop shortcuts and start menu entries
- [ ] Test installation and uninstallation processes

#### Phase 3.4: Cross-Platform Testing
- [ ] Set up Windows build and test environment
- [ ] Set up macOS build and test environment
- [ ] Set up Linux build and test environment
- [ ] Test binary compatibility across OS versions
- [ ] Verify all services start correctly on each platform
- [ ] Test installer behavior on different OS versions
- [ ] Document platform-specific requirements
- [ ] Create troubleshooting guides for each platform

### Week 4: Polish, Testing & Optimization
**Duration**: 7-8 days

#### Phase 4.1: User Experience Polish
- [ ] Implement professional splash screen with progress
- [ ] Add system tray integration with context menu
- [ ] Create proper application icons for all platforms
- [ ] Add "About" dialog with version information
- [ ] Implement graceful error handling and user feedback
- [ ] Add first-run setup wizard
- [ ] Create user preferences and settings management
- [ ] Test complete user onboarding flow

#### Phase 4.2: Auto-Update System
- [ ] Implement auto-update functionality
- [ ] Create update server infrastructure (or GitHub releases)
- [ ] Add update checking and notification system
- [ ] Implement background update downloads
- [ ] Add update installation and restart logic
- [ ] Create rollback functionality for failed updates
- [ ] Test update process end-to-end
- [ ] Document update deployment process

#### Phase 4.3: Performance Optimization
- [ ] Optimize application startup time
- [ ] Implement lazy loading for heavy components
- [ ] Add resource monitoring and cleanup
- [ ] Optimize memory usage patterns
- [ ] Implement efficient service restart strategies
- [ ] Add performance metrics and monitoring
- [ ] Profile and optimize critical paths
- [ ] Test performance under various system loads

#### Phase 4.4: Final Testing & Documentation
- [ ] Create comprehensive test suite for Electron app
- [ ] Test all agent swarm functionality within Electron
- [ ] Verify data persistence and migration
- [ ] Test crash recovery and error scenarios
- [ ] Create user documentation and help system
- [ ] Write developer documentation for maintenance
- [ ] Create release notes and changelog
- [ ] Prepare for production release

## Technical Implementation Details

### Main Process Architecture (`electron/main.ts`)

```typescript
import { app, BrowserWindow, ipcMain, Menu, Tray } from 'electron';
import { QdrantManager } from './services/QdrantManager';
import { ServerManager } from './services/ServerManager';
import { PortManager } from './services/PortManager';
import { AppDataManager } from './services/AppDataManager';
import { Logger } from './utils/Logger';

class AgentSwarmApp {
  private mainWindow: BrowserWindow | null = null;
  private qdrantManager: QdrantManager;
  private serverManager: ServerManager;
  private portManager: PortManager;
  private appDataManager: AppDataManager;
  private logger: Logger;
  private tray: Tray | null = null;

  constructor() {
    this.logger = new Logger('AgentSwarmApp');
    this.appDataManager = new AppDataManager();
    this.portManager = new PortManager();
    this.qdrantManager = new QdrantManager(this.appDataManager, this.portManager);
    this.serverManager = new ServerManager(this.appDataManager, this.portManager);
  }

  async initialize() {
    // Initialize services in dependency order
    await this.appDataManager.initialize();
    await this.portManager.initialize();
    await this.qdrantManager.start();
    await this.serverManager.start();
    
    this.createWindow();
    this.createTray();
    this.setupIPC();
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        sandbox: true
      },
      show: false // Show after services are ready
    });

    // Load the Next.js app
    const serverUrl = this.serverManager.getServerUrl();
    this.mainWindow.loadURL(serverUrl);
  }

  async shutdown() {
    this.logger.info('Shutting down Agent Swarm...');
    
    await this.serverManager.stop();
    await this.qdrantManager.stop();
    await this.portManager.cleanup();
    
    this.logger.info('Shutdown complete');
  }
}
```

### QdrantManager Implementation

```typescript
export class QdrantManager {
  private qdrantProcess: ChildProcess | null = null;
  private qdrantPort: number;
  private binaryPath: string;
  private configPath: string;
  private dataPath: string;

  constructor(
    private appDataManager: AppDataManager,
    private portManager: PortManager
  ) {
    this.qdrantPort = 6333;
    this.setupPaths();
  }

  private setupPaths() {
    const platform = process.platform;
    const arch = process.arch;
    
    // Binary paths for different platforms
    const binaryName = platform === 'win32' ? 'qdrant.exe' : 'qdrant';
    this.binaryPath = path.join(
      process.resourcesPath,
      'binaries',
      platform,
      arch,
      binaryName
    );
    
    this.dataPath = path.join(this.appDataManager.getDataDir(), 'qdrant');
    this.configPath = path.join(this.dataPath, 'config.yaml');
  }

  async start(): Promise<void> {
    try {
      // Reserve port
      this.qdrantPort = await this.portManager.reservePort(6333);
      
      // Ensure data directory exists
      await fs.ensureDir(this.dataPath);
      
      // Create config file
      await this.createConfig();
      
      // Start Qdrant process
      this.qdrantProcess = spawn(this.binaryPath, [
        '--config-path', this.configPath
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      // Setup process monitoring
      this.setupProcessMonitoring();
      
      // Wait for service to be ready
      await this.waitForReady();
      
      this.logger.info(`Qdrant started on port ${this.qdrantPort}`);
    } catch (error) {
      this.logger.error('Failed to start Qdrant:', error);
      throw error;
    }
  }

  private async waitForReady(): Promise<void> {
    const maxAttempts = 30;
    const delay = 1000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`http://localhost:${this.qdrantPort}/health`);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Service not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    throw new Error('Qdrant failed to start within timeout period');
  }
}
```

### Build Configuration (electron-builder)

```json
{
  "build": {
    "appId": "com.agentswarm.desktop",
    "productName": "Agent Swarm",
    "directories": {
      "output": "dist/electron"
    },
    "files": [
      "electron/**/*",
      "!electron/src/**/*",
      ".next/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "resources/binaries",
        "to": "binaries"
      }
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico",
      "requestedExecutionLevel": "asInvoker"
    },
    "mac": {
      "target": "dmg",
      "icon": "assets/icon.icns",
      "category": "public.app-category.productivity",
      "hardenedRuntime": true,
      "entitlements": "entitlements.mac.plist"
    },
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png",
      "category": "Development"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

## Success Metrics

### Phase 1 Success Criteria
- [ ] Electron app launches and displays Next.js content
- [ ] IPC communication working between processes
- [ ] Basic window management functional
- [ ] Development environment with hot reload working

### Phase 2 Success Criteria
- [ ] All services (Qdrant, Next.js) start automatically
- [ ] Health monitoring and auto-restart working
- [ ] Port conflict resolution functional
- [ ] User data persists between sessions

### Phase 3 Success Criteria
- [ ] Installers build successfully for all platforms
- [ ] Installation and uninstallation work correctly
- [ ] All bundled assets extract and function properly
- [ ] Bundle size under 400MB target

### Phase 4 Success Criteria
- [ ] Professional user experience with splash screen and tray
- [ ] Auto-update system functional
- [ ] Performance meets acceptable standards
- [ ] All agent swarm features work identically to web version

## Risk Mitigation

### Technical Risks
- **Binary compatibility**: Test extensively on different OS versions
- **Service startup failures**: Implement robust retry and fallback mechanisms
- **Port conflicts**: Use dynamic port allocation with fallback ranges
- **Data corruption**: Implement backup and recovery systems

### User Experience Risks
- **Slow startup**: Optimize service initialization and add progress indicators
- **Confusing errors**: Provide clear error messages and troubleshooting guides
- **Update failures**: Implement rollback mechanisms and staged updates

## Maintenance Considerations

### Long-term Maintenance
- [ ] Set up automated testing pipeline for all platforms
- [ ] Create update deployment process
- [ ] Establish monitoring for crash reports
- [ ] Plan for Electron and dependency updates
- [ ] Document troubleshooting procedures
- [ ] Create user support documentation

### Version Management
- [ ] Implement semantic versioning
- [ ] Create changelog automation
- [ ] Set up release branch strategy
- [ ] Plan backward compatibility for user data

## Resources Required

### Development Environment
- Windows, macOS, and Linux development/testing machines
- Code signing certificates for production builds
- CI/CD pipeline for automated builds
- Distribution infrastructure (or GitHub releases)

### Binary Dependencies
- Qdrant binaries for Windows (x64), macOS (x64, arm64), Linux (x64)
- Node.js runtime embedded in Electron
- Platform-specific system libraries

## Deliverables

1. **Complete Electron Application**
   - Cross-platform desktop app with professional installers
   - Embedded services with orchestration
   - Auto-update functionality

2. **Documentation**
   - User installation and setup guide
   - Developer maintenance documentation
   - Troubleshooting guides for each platform

3. **Build System**
   - Automated build pipeline
   - Distribution workflow
   - Version management system

4. **Testing Suite**
   - Automated testing for core functionality
   - Platform-specific test coverage
   - Performance benchmarking

This implementation plan transforms the Agent Swarm platform into a professional desktop application that users can install and run without any technical expertise, while maintaining all the functionality of the original web-based system. 