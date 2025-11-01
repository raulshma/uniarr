# UniArr

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Expo SDK](https://img.shields.io/badge/Expo%20SDK-54-000.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)

A sophisticated unified mobile dashboard for managing your entire media ecosystem, built with React Native and Expo.

## Overview

UniArr provides a comprehensive, unified interface for managing all your media automation and management services from a single mobile application. With support for 15+ different services including Sonarr, Radarr, Jellyseerr, qBittorrent, Jellyfin, and more, it offers advanced features like multi-service data aggregation, intelligent caching, offline support, and a sophisticated widget system.

## 🚀 Core Features

### 📺 Media Management Hub

- **Multi-Service Integration**: Native support for 15+ media services:
  - **Media Managers**: Sonarr (TV), Radarr (Movies), Lidarr (Music), Jellyseerr (Requests)
  - **Download Clients**: qBittorrent, Transmission, Deluge, rTorrent, SABnzbd, NZBGet
  - **Supporting Services**: Prowlarr (Indexer), Bazarr (Subtitles), Jellyfin (Media Server), AdGuard Home (DNS/Ad-blocking)
  - **External APIs**: The Movie Database (TMDb) integration for movie/TV discovery and metadata
- **Unified Search**: Cross-service search with intelligent deduplication and filtering
- **Release Calendar**: Comprehensive calendar merging releases from all Sonarr/Radarr instances with multiple view modes (Month, Week, Day, List)
- **Anime Integration**: MyAnimeList (Jikan) integration with detailed anime information and tracking
- **Download Management**: Centralized download queue management with progress tracking and remote control capabilities
- **Media Editor**: Advanced media metadata editing with multi-source ratings
- **Content Ranking**: Intelligent release quality scoring and ranking system

### 🎨 Advanced User Interface

- **Dynamic Widget System**: 15+ customizable widgets including:
  - **Bookmarks Widget**: Custom navigation shortcuts with health monitoring and icon picker
  - **Weather Widget**: Animated weather gradients with real-time updates and location services
  - **Service Status Widget**: Real-time service monitoring with health checks
  - **Download Progress Widget**: Active download tracking with queue management
  - **Calendar Preview Widget**: Upcoming releases preview with statistics
  - **Statistics Widget**: Overview metrics aggregation and analytics
  - **Social Media Widgets**: Reddit, Twitch, YouTube, Hacker News integration
  - **RSS Feed Widget**: RSS feed reader with custom sources
  - **Recent Activity Widget**: Activity feed across all services
  - **Shortcuts Widget**: Quick access to common actions and navigation
- **Sophisticated Theming**: Custom MD3 themes with multiple presets (UniArr, Netflix, Disney+, Max, etc.)
- **Dark/Light Modes**: Full theme support with OLED optimization for power efficiency
- **Frosted Glass Effects**: Animated UI elements with native blur and transparency effects
- **Responsive Design**: Adaptive layouts for phones, tablets, and web platforms
- **Custom Navigation**: Curved tab bar with advanced navigation patterns
- **Modal System**: Advanced modal management with contextual interactions

### 🌐 Network & Connectivity

- **VPN Diagnostics**: Advanced VPN detection and troubleshooting with connection testing
- **Network Scanner**: Auto-discovery of services on local network with intelligent detection
- **Offline-First Architecture**: Full offline functionality with intelligent synchronization and mutation queuing
- **Connection Health**: Real-time service status monitoring with automatic recovery
- **Network-Aware Updates**: Battery-conscious refresh intervals (5-120 minutes) based on data type
- **AdGuard Home Integration**: Advanced DNS blocking with query log management, protection status monitoring, and filter refresh capabilities
- **Network History**: Recent IP addresses and connection history tracking

### 🔧 Technical Excellence

- **TypeScript Strict Mode**: Complete type safety with comprehensive coverage
- **Performance Optimized**: React Compiler integration, FlashList for high-performance scrolling, and aggressive caching
- **Multi-Layer Caching**: Sophisticated image caching with memory/disk optimization and authenticated requests
- **Error Boundaries**: Comprehensive error handling and recovery mechanisms
- **State Management**: TanStack Query for server state + Zustand for client state with offline support
- **MMKV Storage**: High-performance storage backend with ~30x faster operations than AsyncStorage and automatic fallback
- **Image Cache Intelligence**: Smart prefetching with concurrent background processing and automatic cleanup
- **Mutation Queue Service**: Offline mutation queuing with intelligent synchronization and retry mechanisms
- **Thumbhash Integration**: Blur hash placeholders for better user experience during image loading

### 🔐 Authentication & Security

- **Clerk Authentication**: Complete end-user authentication with social providers and secure token management
- **Multi-Provider Service Auth**: Support for API keys, basic authentication, session-based authentication, and OAuth
- **Secure Storage**: Hardware-backed encrypted credential storage using Expo SecureStore
- **ServiceAuthHelper**: Unified authentication abstraction with automatic token refresh
- **Permission Management**: Fine-grained permission control for app features and services
- **Authentication Providers**: Specialized providers for different service types (Jellyfin, API Key, Basic Auth, Session-based)

### 🎤 Voice Assistant & AI Integration

- **Siri & Google Assistant Integration**: Native voice shortcuts with iOS Siri and Android Google Assistant support
- **Natural Language Processing**: Advanced voice command recognition for media search, service status, and download management
- **Voice Shortcut Customization**: Create custom voice commands for navigation and service actions
- **Platform-Specific Voice Features**: Siri shortcuts on iOS, App Actions on Android with cross-platform compatibility
- **Voice Feedback System**: Optional voice responses for accessibility and hands-free operation

### 🔔 Advanced Notification System

- **Webhook Integration**: Full webhook processing with signature verification, event queuing, and notification management
- **Smart Notification Management**: Type-based notification filtering with quiet hours and do-not-disturb modes
- **Interactive Notifications**: Actionable notifications with buttons for immediate response to events
- **Notification History**: Persistent notification history with read/unread tracking and search capabilities
- **Push Notification Support**: Local and remote notification handling with delivery tracking

### 💾 Advanced Backup & Recovery

- **Comprehensive Backup System**: Full application state backup/restore with granular selection options
- **Encrypted Backups**: AES-256 encryption with password protection for sensitive data
- **Selective Backup Options**: Choose exactly what to backup - settings, services, widgets, credentials, network history
- **Cross-Platform Restore**: Seamless restore across iOS, Android, and Web platforms
- **Backup Profiles**: Save multiple backup configurations for different use cases
- **Cloud Integration**: Export backups to cloud storage with automatic scheduling

### 📊 Analytics & Monitoring

- **Comprehensive Analytics Dashboard**: Detailed statistics for library growth, download performance, and usage patterns
- **Service Health Monitoring**: Real-time service status tracking with automatic failure detection and recovery
- **Performance Metrics**: Battery usage monitoring, network performance tracking, and cache optimization statistics
- **Activity Timeline**: Chronological activity tracking with service-specific event logging
- **Usage Analytics**: User behavior analysis with feature usage statistics and optimization suggestions
- **Quality Profile Distribution**: Content quality analysis across different media types
- **Library Growth Tracking**: Historical data for media library expansion and trends
- **Download Statistics**: Comprehensive download performance analysis with success rates and speeds
- **Request Analytics**: Jellyseerr request tracking and approval rate analysis
- **Indexer Performance**: Prowlarr indexer effectiveness and performance metrics
- **Activity Time Analysis**: Usage pattern analysis with peak activity time tracking

### 🛠️ App Management & Utilities

- **App Update Service**: Automatic update checking with GitHub integration and version tracking
- **Widget Drawer System**: Global widget management with profile-based configurations
- **Haptic Feedback System**: 9+ different haptic feedback types for enhanced user interaction
- **File Sharing Integration**: Native file system integration with document picker and sharing capabilities
- **Location Services**: Device location tracking with caching for weather and location-based features
- **Dialog System**: Theme-aware dialog system with programmatic API for alerts and confirmations
- **Homarr Icons Integration**: Icon management with CDN caching and extensive icon library
- **Video Player**: Native video playback support for media content

### 🧪 Experimental Features & Debug Tools

- **Feature Flag System**: Controlled rollout of experimental features with user opt-in options
- **Debug Panel**: Comprehensive debugging interface with network logs, cache statistics, and system diagnostics
- **Performance Monitoring**: Real-time performance tracking with FPS monitoring, memory usage, and network latency
- **Network Diagnostics**: Advanced connection testing with VPN detection and troubleshooting guidance
- **Developer Tools**: Debug logging, performance profiling, and system status monitoring

## Screenshots

<img width="300" height="520" alt="Screenshot_20251023-011701" src="https://github.com/user-attachments/assets/fb0d9ddf-1011-46b6-86df-663c503770f4" />
<img width="300" height="520" alt="Screenshot_20251023-011614" src="https://github.com/user-attachments/assets/b1fae191-6edf-4736-b8a1-d0556376713c" />
<img width="300" height="520" alt="Screenshot_20251023-011402" src="https://github.com/user-attachments/assets/92ca0ba6-a191-493b-9f79-75b4d217ee04" />
<img width="300" height="520" alt="Screenshot_20251023-011352" src="https://github.com/user-attachments/assets/9e31fd6c-9760-421f-8c4b-d5cab7afd6b6" />
<img width="300" height="520" alt="Screenshot_20251023-011325" src="https://github.com/user-attachments/assets/f99d87ec-044e-488e-b8af-d8f675e82260" />
<img width="300" height="520" alt="Screenshot_20251023-011315" src="https://github.com/user-attachments/assets/df221e25-42fe-4f9e-9db8-5c0706774a0b" />
<img width="300" height="520" alt="Screenshot_20251023-011236" src="https://github.com/user-attachments/assets/6513d9ba-7db4-4268-aa94-56f0c2fa5b62" />
<img width="300" height="520" alt="Screenshot_20251023-012213" src="https://github.com/user-attachments/assets/ff0f1f70-9c7f-4c5c-9cab-140ad76db278" />
<img width="300" height="520" alt="Screenshot_20251023-012202" src="https://github.com/user-attachments/assets/90a13200-5b78-4329-b203-8be7bb490a85" />
<img width="300" height="520" alt="Screenshot_20251023-012147" src="https://github.com/user-attachments/assets/6b20a262-44c1-4531-a9cd-f5514ccba264" />
<img width="300" height="520" alt="Screenshot_20251023-012014" src="https://github.com/user-attachments/assets/ff95d037-70a5-47d3-a844-5398d22e2799" />
<img width="300" height="520" alt="Screenshot_20251023-011953" src="https://github.com/user-attachments/assets/c026d302-0bb4-487f-a2c6-b31c5619690d" />
<img width="300" height="520" alt="Screenshot_20251023-011935" src="https://github.com/user-attachments/assets/10e1df07-967c-424e-ba1e-ab1f0dbdb136" />
<img width="300" height="520" alt="Screenshot_20251023-011906" src="https://github.com/user-attachments/assets/37c5d2b7-032b-41f3-a322-79d99beee6ea" />
<img width="300" height="520" alt="Screenshot_20251023-011851" src="https://github.com/user-attachments/assets/a500be6a-b7bd-4274-aca7-524b9ce0cc09" />
<img width="300" height="520" alt="Screenshot_20251023-011832" src="https://github.com/user-attachments/assets/ff554f6b-8ca6-499f-ba3c-0ff7e1e7a047" />


## Requirements

- Node.js 18+
- Expo CLI (`npm install -g @expo/cli`)
- iOS: Xcode 14+ (for iOS development)
- Android: Android Studio with Android SDK (for Android development)
- Media services: Sonarr, Radarr, Jellyseerr, qBittorrent, etc.

## Installation

### Clone the repository

```bash
git clone https://github.com/yourusername/uniarr.git
cd uniarr
```

### Install dependencies

```bash
npm install
```

### Configure Clerk Authentication

1. Create a [Clerk](https://clerk.com/) account
2. Set up your application and obtain the publishable key
3. Configure the key in your environment

### Start the development server

```bash
# Start Expo development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web
```

## 🚀 Development

### Prerequisites

- **Node.js 18+** - Latest LTS version recommended
- **Expo CLI** - `npm install -g @expo/cli`
- **Platform Dependencies**:
  - **iOS**: Xcode 14+ and iOS Simulator
  - **Android**: Android Studio with Android SDK
  - **Web**: Modern web browser
- **Media Services**: At least one supported service (Sonarr, Radarr, qBittorrent, etc.)

### Quick Start

#### 1. Clone and Install

```bash
git clone https://github.com/yourusername/uniarr.git
cd uniarr
npm install
```

#### 2. Configure Authentication

```bash
# Create a Clerk account at https://clerk.com
# Set your publishable key in environment variables
echo "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key_here" > .env
```

#### 3. Start Development

```bash
# Start the Expo development server
npm start

# Scan QR code with Expo Go app or run on specific platforms:
npm run ios          # iOS Simulator
npm run android      # Android Emulator
npm run web          # Web browser
```

### Available Scripts

```bash
# Development
npm start            # Start Expo development server
npm run ios          # Run on iOS Simulator
npm run android      # Run on Android Emulator
npm run web          # Run in web browser

# Code Quality
npm run lint         # ESLint and Prettier
npm run typecheck    # TypeScript type checking
npm test             # Run Jest tests
npm run test:watch   # Run tests in watch mode

# Code Generation
npm run generate:client-schemas    # Generate OpenAPI TypeScript schemas

# Build & Deploy
npm run build        # Production build
npx eas build        # EAS application service build
npx eas submit       # Submit to app stores
```

### Development Environment

#### **Code Quality Tools**

- **TypeScript Strict Mode** - Complete type safety with `noImplicitAny`
- **ESLint + React Compiler** - Code quality with performance optimization hints
- **Prettier** - Consistent code formatting with automatic integration
- **Husky + lint-staged** - Pre-commit hooks for quality assurance

#### **Testing Infrastructure**

- **Jest** - Unit testing framework with React Native support
- **React Native Testing Library** - Component testing utilities
- **Detox** - End-to-end testing for critical user flows
- **Connector Mocks** - Comprehensive service mocking patterns
- **Integration Testing** - Multi-service flow testing with real-world scenarios
- **Storage Testing** - MMKV and AsyncStorage testing with migration scenarios
- **Widget Testing** - Component testing for all widget types and configurations
- **Service Testing** - End-to-end testing for all 15+ service connectors

#### **Development Features**

- **Hot Reloading** - Instant code updates during development
- **Fast Refresh** - Component state preservation during updates
- **React DevTools** - Component inspection and debugging
- **Flipper** - Advanced debugging and performance profiling

### Configuration

#### **Environment Variables**

```bash
# Required
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key

# Optional
EXPO_PUBLIC_API_BASE_URL=https://your-api.example.com
EXPO_PUBLIC_LOG_LEVEL=info
EXPO_PUBLIC_DEBUG_MODE=false
```

#### **Service Configuration**

Services are configured through the app settings screen:

1. Navigate to Settings → Services
2. Add service configuration (URL, authentication)
3. Test connection for validation
4. Enable/disable services as needed

#### **Platform-Specific Setup**

**iOS Development:**

```bash
# Install additional dependencies
npx pod-install ios

# Run on iOS Simulator
npm run ios
```

**Android Development:**

```bash
# Ensure Android SDK is configured
# Run on Android Emulator or connected device
npm run android
```

**Web Development:**

```bash
# Run in web browser with live reload
npm run web
```

## 🏗️ Architecture Overview

### System Architecture

UniArr employs a sophisticated multi-layered architecture designed for scalability, maintainability, and exceptional mobile performance:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   UI Components │  │   Screens/Layout│  │   Widget System │ │
│  │   (React Native)│  │  (Expo Router)  │  │ (Dynamic Widgets)│ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Custom Hooks    │  │ Service Layer   │  │ State Management │ │
│  │ (useCalendar,   │  │ (API services,  │  │ (TanStack Query,│ │
│  │ useSearch, etc.)│  │ ImageCache, etc)│  │  Zustand stores) │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                  Integration Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Service Connectors│ │ Auth Management │  │ Offline Support │ │
│  │ (BaseConnector,  │  │  (Clerk +       │  │ (Mutation Queue, │ │
│  │ 15+ services)    │  │ ServiceAuth)    │  │ Network Sync)   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ External APIs   │  │ Local Storage   │  │ Cache Layer     │ │
│  │ (Sonarr, Radarr,│  │ (SecureStorage, │  │ (Image Cache,   │ │
│  │  qBittorrent)   │  │  AsyncStorage)  │  │ Query Cache)    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
uniarr/
├── app/                           # Expo Router file-based routing
│   ├── (auth)/                   # Protected routes (Clerk auth)
│   │   ├── (tabs)/              # Main navigation tabs
│   │   │   ├── dashboard/       # Overview dashboard
│   │   │   ├── services/        # Service management
│   │   │   ├── recently-added/  # Recent media activity
│   │   │   ├── downloads/       # Download management
│   │   │   └── settings/        # App configuration
│   │   └── [screens]/           # Individual protected screens
│   ├── (public)/                # Public routes (login, signup)
│   └── _layout.tsx              # Root layout with providers
├── src/
│   ├── components/              # Reusable UI components
│   │   ├── widgets/            # Dynamic widget system (15+ widget types)
│   │   │   ├── BookmarksWidget/
│   │   │   ├── WeatherWidget/
│   │   │   ├── ServiceStatusWidget/
│   │   │   ├── DownloadProgressWidget/
│   │   │   ├── CalendarPreviewWidget/
│   │   │   ├── StatisticsWidget/
│   │   │   ├── RedditWidget/
│   │   │   ├── TwitchWidget/
│   │   │   ├── YouTubeWidget/
│   │   │   ├── HackerNewsWidget/
│   │   │   ├── RssWidget/
│   │   │   └── ...
│   │   ├── calendar/           # Multi-service calendar
│   │   ├── search/             # Unified search components
│   │   └── common/             # Shared UI components
│   ├── connectors/              # Service integration layer
│   │   ├── implementations/    # 15+ service connectors
│   │   ├── openapi-specs/      # External API specifications
│   │   └── client-schemas/     # Generated TypeScript schemas
│   ├── hooks/                   # Custom React hooks
│   │   ├── queryKeys.ts        # Hierarchical query key factory
│   │   └── queryConfig.ts      # Query configuration presets
│   ├── services/               # Business logic services
│   │   ├── analytics/          # Analytics and metrics
│   │   ├── auth/               # Authentication management
│   │   ├── backup/             # Backup/restore functionality
│   │   ├── calendar/           # Calendar aggregation service
│   │   ├── dialogService.ts    # Theme-aware dialog system
│   │   ├── download/           # Download management
│   │   ├── haptic/             # Haptic feedback system
│   │   ├── image/              # Image caching and processing
│   │   ├── location/           # Location services
│   │   ├── network/            # Network diagnostics & VPN
│   │   ├── notifications/      # Push notification system
│   │   ├── search/             # Unified search service
│   │   ├── storage/            # Storage abstraction (MMKV/AsyncStorage)
│   │   ├── voice/              # Voice assistant integration
│   │   ├── webhooks/           # Webhook processing
│   │   ├── widgets/            # Widget data providers
│   │   └── ...
│   ├── store/                   # Zustand state management
│   │   ├── connectorsStore.ts  # Service connector management
│   │   ├── settingsStore.ts    # User preferences
│   │   ├── downloadStore.ts    # Download queue state
│   │   └── ...
│   ├── models/                  # TypeScript type definitions
│   ├── utils/                   # Utility functions & helpers
│   └── constants/               # App constants and theme config
├── __tests__/                    # Test suites
│   ├── connectors/              # Connector unit tests
│   ├── integration/             # Multi-service integration tests
│   └── mocks/                   # Service and component mocks
└── scripts/                     # Build and generation scripts
```

### Technology Stack

#### **Core Framework**

- **React Native 0.81.4** with React 19.1.0 - Latest native mobile framework
- **Expo SDK 54** - Complete development platform with managed workflow
- **Expo Router** - File-based routing with automatic TypeScript support
- **TypeScript 5.x** - Strict mode with comprehensive type coverage

#### **UI & Theming**

- **React Native Paper (MD3)** - Material Design 3 component library
- **React Native Reanimated 3** - High-performance animations and gestures
- **React Native Gesture Handler** - Advanced gesture recognition
- **Expo Image** - Optimized image loading with caching
- **Custom Theme System** - Dynamic theming with OLED optimization

#### **State Management & Data**

- **TanStack Query v5** - Server state management with offline support
- **Zustand** - Lightweight client state management with persistence
- **Expo SecureStore** - Encrypted credential storage
- **AsyncStorage** - Local data persistence with migration support

#### **Authentication & Security**

- **Clerk Expo** - Complete authentication solution with social providers
- **Expo SecureStore** - Hardware-backed secure storage
- **ServiceAuthHelper** - Multi-provider authentication abstraction

#### **Development & Tooling**

- **ESLint with React Compiler** - Code quality with optimization hints
- **Prettier** - Consistent code formatting
- **Husky + lint-staged** - Pre-commit quality gates
- **Jest + React Native Testing Library** - Comprehensive testing
- **Detox** - End-to-end testing for critical user flows

#### **OpenAPI Integration & Schema Generation**

- **Local API Specifications**: OpenAPI specs stored in `src/connectors/openapi-specs/` for each external service
- **Automatic Schema Generation**: TypeScript types generated via `npm run generate:client-schemas` command
- **Client Stub Generation**: Automatic client stubs using `openapi-typescript` and `openapi-fetch`
- **Multi-Spec Support**: Handles both YAML and JSON OpenAPI specifications
- **Schema Validation**: Ensures compatibility with service APIs through generated types
- **OperationId Deduplication**: Automatic handling of duplicate operation identifiers across services

### Service Connector Architecture

The application's service integration follows a sophisticated connector pattern:

#### **BaseConnector Pattern**

```typescript
abstract class BaseConnector {
  protected auth: ServiceAuthHelper;
  protected logger: LoggerService;

  abstract initialize(): Promise<void>;
  abstract testConnection(): Promise<ConnectionResult>;
  abstract getVersion(): Promise<string>;
}
```

#### **Supported Services**

| Service Type            | Services                                    | Capabilities                           |
| ----------------------- | ------------------------------------------- | -------------------------------------- |
| **Media Managers**      | Sonarr, Radarr, Lidarr, Jellyseerr          | Search, Metadata, Monitoring           |
| **Download Clients**    | qBittorrent, Transmission, Deluge, rTorrent | Download Management, Remote Control    |
| **NZB Clients**         | SABnzbd, NZBGet                             | NZB Download Management                |
| **Supporting Services** | Prowlarr, Bazarr, Jellyfin, AdGuard Home    | Indexing, Subtitles, Media Server, DNS |

#### **Key Features**

- **Automatic Authentication** - Support for API keys, basic auth, and session-based authentication
- **Retry Mechanisms** - Exponential backoff with network-aware retry conditions
- **Comprehensive Error Handling** - Structured error feedback with VPN-specific diagnostics
- **OpenAPI Integration** - Automatic client schema generation from service specifications
- **Connection Health Monitoring** - Real-time service status with automatic recovery

### Advanced Widget System

#### **Widget Architecture**

The widget system provides runtime-configurable dashboard components:

```typescript
interface WidgetConfig {
  id: string;
  type: WidgetType;
  instanceId: string;
  config: Record<string, any>;
  position: WidgetPosition;
}
```

#### **Available Widget Types**

- **BookmarksWidget** - Custom navigation shortcuts with icon picker
- **WeatherWidget** - Animated weather with gradient backgrounds
- **ServiceStatusWidget** - Real-time service health monitoring
- **DownloadProgressWidget** - Active download tracking
- **CalendarPreviewWidget** - Upcoming releases preview
- **StatisticsWidget** - Media library statistics
- **RssWidget** - RSS feed consumption
- **Social Widgets** - Reddit, Twitch, YouTube, Hacker News integration

#### **Widget Features**

- **Dynamic Configuration** - Runtime widget creation and configuration
- **Per-Instance Settings** - Individual configuration for each widget instance
- **Global Widget Drawer** - Contextual access to all widgets
- **Animated Transitions** - Smooth enter/exit animations with spring physics
- **Responsive Layouts** - Adaptive sizing and positioning

### Performance Optimization

#### **Image Caching System**

- **Multi-Layer Caching** - Expo Image cache + direct download fallback
- **Smart Prefetching** - Concurrent background processing with configurable limits
- **Memory Management** - Automatic cleanup with size and age-based eviction
- **Authenticated Requests** - Automatic API key injection for protected images

#### **Network Optimization**

- **Battery-Aware Updates** - Configurable refresh intervals (5-120 minutes)
- **Offline-First Architecture** - Mutation queuing and intelligent synchronization
- **Request Deduplication** - Automatic duplicate request prevention
- **VPN-Aware Behavior** - Special handling for VPN connectivity issues

#### **Rendering Performance**

- **FlashList Integration** - High-performance list rendering for large datasets
- **React Compiler** - Experimental optimization with performance hints
- **Component Memoization** - Strategic use of React.memo and useMemo
- **Lazy Loading** - Progressive loading of images and components

## 🤝 Contributing

We welcome contributions from the community! UniArr is a complex project with many moving parts, and we appreciate any help improving it.

### How to Contribute

#### **1. Fork and Clone**

```bash
git clone https://github.com/yourusername/uniarr.git
cd uniarr
```

#### **2. Create a Feature Branch**

```bash
git checkout -b feature/your-feature-name
```

#### **3. Development Workflow**

- Follow the existing code patterns and architecture
- Use TypeScript strict mode - no `any` types allowed
- Add comprehensive JSDoc comments for complex functions
- Ensure all linting and type checks pass before committing

#### **4. Testing**

- Add tests for new functionality using existing patterns
- Test with multiple service configurations when applicable
- Verify offline behavior and error handling
- Test on iOS, Android, and Web platforms when possible

#### **5. Submit Your Contribution**

```bash
git commit -m "feat: add your feature description"
git push origin feature/your-feature-name
# Open a Pull Request with detailed description
```

### Development Guidelines

#### **Code Standards**

- **TypeScript Strict Mode**: All code must pass strict type checking
- **Component Patterns**: Follow existing component structure and prop patterns
- **Service Integration**: Use the BaseConnector pattern for new services
- **State Management**: Use TanStack Query for server state, Zustand for client state
- **Error Handling**: Implement comprehensive error boundaries and user feedback

#### **Adding New Services**

1. **Create Connector**: Extend `BaseConnector` in `src/connectors/implementations/`
2. **Register Service**: Add to `ConnectorFactory.connectorRegistry`
3. **Add Types**: Include service types in `src/models/`
4. **Test Integration**: Add service-specific tests following existing patterns
5. **Update Documentation**: Document service capabilities and configuration

#### **UI/UX Guidelines**

- **Theme Awareness**: All components must use `useTheme()` from React Native Paper
- **Responsive Design**: Ensure layouts work on phones, tablets, and web
- **Accessibility**: Include accessibility labels and screen reader support
- **Performance**: Use FlashList for large datasets, implement lazy loading
- **Animations**: Use Reanimated for smooth, 60fps animations
- **Haptic Feedback**: Use HapticService for consistent tactile interactions
- **Frosted Glass Effects**: Implement blur effects using theme-aware glassmorphism patterns
- **Widget Development**: Follow widget container patterns and configuration forms

#### **Development Workflow**

```bash
# Before committing, ensure all checks pass
npm run lint          # Code formatting and linting
npm run typecheck     # TypeScript strict mode checking
npm test              # Run all tests

# For service integrations
npm run generate:client-schemas  # Generate OpenAPI types if needed
```

### Areas for Contribution

#### **🔧 High Priority**

- **Additional Service Connectors**: Expand support for more media management tools (currently 15+ supported)
- **Enhanced Error Handling**: Improve error reporting and user feedback with better diagnostics
- **Performance Optimizations**: Battery life improvements and memory usage optimization
- **Test Coverage**: Expand test suites for better reliability (currently comprehensive unit + integration tests)
- **Voice Assistant Expansion**: Enhance Siri/Google Assistant integration with NLP improvements
- **Backup System Enhancement**: Cloud integration and automated backup scheduling
- **Analytics Dashboard**: Expand analytics capabilities with custom metrics and reporting

#### **🎨 UI/UX Improvements**

- **Widget Development**: Create new widget types and configurations (currently 13 types available)
- **Theme Enhancements**: Develop additional theme presets (currently 6+ presets including Netflix, Disney+, Max)
- **Animation Polish**: Improve transitions and micro-interactions using Reanimated 3
- **Haptic Feedback**: Expand haptic feedback system with 9+ feedback types
- **Frosted Glass Effects**: Enhance glassmorphism effects and blur implementations
- **Accessibility**: Enhanced screen reader support and accessibility features

#### **🌐 Platform Features**

- **Voice Assistant Integration**: Expand Siri/Google Assistant command recognition and NLP capabilities
- **Webhook System**: Enhanced webhook processing with more event types and integrations
- **Notification System**: Advanced push notifications with rich media and interactive actions
- **Backup/Restore**: Enhanced backup encryption and cloud integration
- **Analytics Dashboard**: Expand analytics capabilities with custom metrics and reporting
- **Localization**: Multi-language support implementation with RTL support

#### **📱 Platform Support**

- **Desktop Applications**: Electron or Tauri desktop versions with full feature parity
- **Watch Integration**: Wear OS or watchOS companion apps with glanceable widgets
- **TV Apps**: Android TV or Apple TV applications with remote control support
- **Web Enhancements**: PWA features, offline web support, and desktop web optimizations
- **Cross-Platform Sync**: Real-time synchronization across all platforms

#### **🔧 Advanced Integrations**

- **Additional Service Connectors**: Expand support for more media management tools (currently 15+ services)
- **Smart Home Integration**: Integration with HomeKit, Google Home, and Alexa
- **Media Server Extensions**: Enhanced Jellyfin/Emby/Plex integration with transcoding controls
- **Network Tools**: Advanced network monitoring and diagnostic capabilities
- **API Extensions**: Public API for third-party integrations and automation

#### **🧪 Experimental Features**

- **AI-Powered Recommendations**: Machine learning for media recommendations and automation
- **Advanced Analytics**: Predictive analytics for storage planning and usage patterns
- **Performance Optimizations**: React Compiler optimizations and advanced caching strategies
- **Security Enhancements**: Biometric authentication and advanced encryption methods
- **Developer Tools**: Plugin system for custom extensions and third-party plugins

### Code Review Process

#### **Before Submitting PR**

- [ ] All tests pass (`npm test`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code is properly formatted
- [ ] Documentation is updated
- [ ] Breaking changes are documented

#### **PR Guidelines**

- Provide clear, concise descriptions of changes
- Include screenshots for UI changes
- Document any breaking changes or migration steps
- Link to relevant issues or discussions
- Ensure PR is focused and atomic

### Community Guidelines

#### **Getting Help**

- **Discussions**: Use GitHub Discussions for questions and ideas
- **Issues**: Report bugs with detailed reproduction steps
- **Documentation**: Suggest improvements to existing documentation
- **Code Review**: Participate in reviewing other contributors' PRs

#### **Code of Conduct**

- Be respectful and inclusive in all interactions
- Provide constructive feedback and suggestions
- Help newcomers learn the codebase and patterns
- Focus on what's best for the community and project

### Recognition

Contributors are recognized in:

- **README.md**: Contributors section with acknowledgments
- **Release Notes**: Credits for new features and improvements
- **Commit Messages**: Proper attribution for all contributions
- **Community**: Recognition in Discord/Slack communities

Thank you for contributing to UniArr! 🎉

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Getting Help

### **Troubleshooting**

#### **Common Issues**

- **Connection Problems**: Check VPN diagnostics in Settings → Network
- **Service Authentication**: Verify API keys and service URLs in Settings → Services
- **Performance Issues**: Enable battery optimization and adjust refresh intervals
- **Sync Problems**: Use Settings → Advanced → Force Sync to resynchronize data

#### **Getting Help**

1. **GitHub Issues**: [Report bugs and request features](https://github.com/yourusername/uniarr/issues)
2. **GitHub Discussions**: [Ask questions and share ideas](https://github.com/yourusername/uniarr/discussions)
3. **Documentation**: Check [CLAUDE.md](./CLAUDE.md) for development guidelines
4. **Community**: Join our Discord/Slack communities (links in GitHub profile)

### **Bug Reports**

When reporting bugs, please include:

- **Environment**: iOS/Android/Web version, app version
- **Services Affected**: Which services are experiencing the issue
- **Reproduction Steps**: Detailed steps to reproduce the problem
- **Expected vs Actual**: What you expected vs what actually happened
- **Logs**: Error messages or logs if available
- **Network Info**: VPN status and connection details

### **Feature Requests**

We love feature requests! Please include:

- **Use Case**: Describe the problem you're trying to solve
- **Proposed Solution**: How you envision the feature working
- **Alternatives**: Any alternative solutions you've considered
- **Priority**: How important this feature is to you

## 🙏 Acknowledgments

### **Core Technologies & Frameworks**

- **Expo Team** - For the incredible React Native development platform
- **React Native Community** - For the amazing ecosystem and libraries
- **TypeScript Team** - For making JavaScript development safe and enjoyable
- **Meta (Facebook)** - For creating and maintaining React Native

### **UI & Design**

- **React Native Paper** - Beautiful Material Design 3 components
- **React Navigation** - Powerful routing and navigation solutions
- **React Native Reanimated** - Smooth 60fps animations and gestures

### **Data & Services**

- **The Movie Database (TMDB)** - Comprehensive movie and TV data
- **MyAnimeList (Jikan API)** - Detailed anime information and tracking
- **OpenAPI Initiative** - Standardized API specifications

### **Media Management Services**

Special thanks to all the open-source media management projects that make this app possible:

- **Sonarr** - TV series management automation
- **Radarr** - Movie collection management
- **Jellyfin** - Free software media system
- **qBittorrent** - Advanced torrent client
- **Prowlarr** - Index manager for various services
- **Bazarr** - Subtitle management
- And all other supported services

### **Development Tools**

- **Microsoft** - TypeScript and VS Code
- **GitHub** - Code hosting and collaboration platform
- **Vercel** - Web hosting and deployment services
- **ESLint & Prettier** - Code quality and formatting tools

### **Community Contributors**

- All the beta testers and early adopters
- Contributors who report bugs and suggest improvements
- The media management community for feedback and ideas
- Open source developers who make this ecosystem possible

---

**Built with ❤️ for the media management community**

_UniArr © 2024 - Unify your media automation experience_
