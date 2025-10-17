# UniArr

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Expo SDK](https://img.shields.io/badge/Expo%20SDK-54-000.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)

A unified mobile dashboard for managing your media services, built with React Native and Expo.

## Overview

UniArr provides a single, intuitive interface for managing all your media management services including Sonarr, Radarr, Jellyseerr, qBittorrent, and more. Features a comprehensive release calendar, VPN diagnostics, anime integration, and powerful search capabilities.

## Features

### 🎬 Media Management

- **Unified Dashboard**: Single interface for multiple media services
- **Release Calendar**: Track upcoming releases across all services
- **Service Integration**: Native support for Sonarr, Radarr, Jellyseerr, qBittorrent, Bazarr, Prowlarr
- **Anime Hub**: MyAnimeList integration with detailed anime information
- **Search & Discover**: Unified search across TMDB and integrated services

### 🌐 Network & Connectivity

- **VPN Diagnostics**: Built-in VPN connection testing and troubleshooting
- **Network Scanner**: Auto-discover services on your local network
- **Offline Support**: Full offline functionality with data synchronization
- **Connection Health Monitoring**: Real-time service status tracking

### 🎨 User Experience

- **Theme System**: Dark/light themes with OLED mode support
- **Voice Assistant**: Hands-free control with voice commands
- **Responsive Design**: Optimized for phones, tablets, and web
- **Push Notifications**: Smart notifications with quiet hours
- **Gestures & Animations**: Smooth, native-feeling interactions

### 🔧 Technical Features

- **TypeScript**: Full type safety in strict mode
- **Offline-First**: Aggressive caching with 24-hour data persistence
- **Authentication**: Secure Clerk integration with end-to-end encryption
- **Error Boundaries**: Comprehensive error handling and recovery
- **Performance Optimized**: Battery-conscious refresh intervals

## Screenshots

_Coming soon_

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

## Development

### Available Scripts

```bash
# Start development server
npm start

# Build and run on platforms
npm run ios
npm run android
npm run web

# Type checking
npm run type-check

# Run tests
npm test

# Lint code
npm run lint

# Generate OpenAPI client schemas
npm run generate:client-schemas
```

### Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: Expo and Prettier configuration
- **Testing**: Jest with React Native Testing Library
- **Git Hooks**: Pre-commit checks for code quality

## Architecture

### Project Structure

```
uniarr/
├── app/                    # Expo Router screens and layouts
│   ├── (auth)/            # Protected routes
│   ├── (public)/          # Public routes (login, signup)
│   └── _layout.tsx        # Root layout with providers
├── src/
│   ├── components/        # Reusable UI components
│   ├── connectors/        # Service integration layer
│   ├── hooks/            # Custom React hooks
│   ├── services/         # Business logic and API services
│   ├── store/            # Zustand state management
│   ├── models/           # TypeScript type definitions
│   └── utils/            # Utility functions
├── __tests__/            # Test suites
└── scripts/              # Build and generation scripts
```

### Key Technologies

- **React Native 0.81.4** with React 19.1.0
- **Expo SDK 54** with Expo Router for navigation
- **TypeScript** in strict mode
- **React Native Paper** (MD3) for UI components
- **TanStack Query v5** for server state management
- **Zustand** for client state management
- **Clerk** for authentication
- **Axios** with OpenAPI integration for API calls

### Service Integration

The app uses a connector-based architecture for integrating with external services:

- **BaseConnector**: Common functionality and error handling
- **ServiceAuthHelper**: Authentication management for each service
- **ConnectorFactory**: Service instantiation and configuration
- **OpenAPI Generation**: Automatic client schema generation

## Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow the existing code style and patterns
- Add TypeScript types for new functionality
- Include tests for new features when appropriate
- Update documentation for API changes
- Ensure all linting and type checks pass

### Code Style

- Use Prettier for code formatting
- Follow ESLint rules (configured in `eslint.config.js`)
- Prefer explicit TypeScript types over `any`
- Use meaningful variable and function names
- Add JSDoc comments for complex functions

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/uniarr/issues) page
2. Create a new issue with detailed information
3. Join our community discussions

## Acknowledgments

- **Expo Team** for the amazing React Native framework
- **Clerk** for authentication services
- **React Native Paper** for beautiful UI components
- **TMDB** for movie and TV data
- **MyAnimeList (Jikan)** for anime information
- All the media management services that make this app possible

---

Made with ❤️ for the media management community
