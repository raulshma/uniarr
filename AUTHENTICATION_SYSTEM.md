# Authentication System Documentation

## Overview

This document describes the comprehensive authentication system implemented for UniArr, which provides a centralized, extensible, and maintainable way to handle authentication across all service connectors (Jellyseerr, qBittorrent, Sonarr, Radarr, etc.).

## Architecture

### Core Components

1. **Authentication Types** (`src/services/auth/types.ts`)
   - Defines all authentication interfaces and types
   - Supports multiple authentication methods: API key, basic auth, session-based, bearer token, and none

2. **Authentication Manager** (`src/services/auth/AuthManager.ts`)
   - Centralized manager for all authentication operations
   - Handles session management, token refresh, and authentication state
   - Provides a single interface for all authentication needs

3. **Authentication Providers** (`src/services/auth/providers/`)
   - `BaseAuthProvider.ts` - Abstract base class with common functionality
   - `ApiKeyAuthProvider.ts` - For services using API key authentication (Sonarr, Radarr)
   - `BasicAuthProvider.ts` - For services using HTTP basic authentication (Jellyseerr)
   - `SessionAuthProvider.ts` - For services using session-based authentication (qBittorrent)

4. **Service Authentication Helper** (`src/services/auth/ServiceAuthHelper.ts`)
   - High-level helper for service-specific authentication operations
   - Validates service configurations
   - Creates authentication configurations from service configs

5. **Provider Factory** (`src/services/auth/AuthProviderFactory.ts`)
   - Registers authentication providers for each service type
   - Provides utility methods for determining authentication requirements

## Authentication Methods

### API Key Authentication
- **Services**: Sonarr, Radarr, Prowlarr
- **Implementation**: Uses `X-Api-Key` header
- **Provider**: `ApiKeyAuthProvider`

### Basic Authentication
- **Services**: Jellyseerr
- **Implementation**: HTTP Basic Authentication
- **Provider**: `BasicAuthProvider`

### Session Authentication
- **Services**: qBittorrent
- **Implementation**: Login endpoint with session cookies
- **Provider**: `SessionAuthProvider`

## Usage Examples

### Basic Usage

```typescript
import { ServiceAuthHelper } from '@/services/auth/ServiceAuthHelper';

// Authenticate a service
const serviceConfig = {
  id: 'my-jellyseerr',
  name: 'My Jellyseerr',
  type: 'jellyseerr',
  url: 'http://localhost:8080',
  username: 'admin',
  password: 'password',
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Authenticate the service
const authResult = await ServiceAuthHelper.authenticateService(serviceConfig);

if (authResult.success && authResult.authenticated) {
  console.log('Authentication successful');
} else {
  console.error('Authentication failed:', authResult.error);
}
```

### Using in Connectors

The authentication system is automatically integrated into all connectors through the `BaseConnector` class:

```typescript
export class MyConnector extends BaseConnector<MyResource> {
  async initialize(): Promise<void> {
    // Authentication is automatically handled
    await this.ensureAuthenticated();
    // Your initialization logic here
  }

  async getData(): Promise<MyResource[]> {
    // Authentication is automatically handled
    await this.ensureAuthenticated();
    // Your API calls here
  }
}
```

### Manual Authentication Management

```typescript
import { authManager } from '@/services/auth/AuthManager';

// Get current session
const session = authManager.getSession('service-id');

// Check if authentication is needed
if (authManager.needsRefresh('service-id')) {
  const result = await authManager.refreshAuthentication('service-id', authConfig);
}

// Get authentication headers
const headers = authManager.getAuthHeaders('service-id');
```

## Configuration Validation

The system includes comprehensive configuration validation:

```typescript
import { ServiceAuthHelper } from '@/services/auth/ServiceAuthHelper';

const validation = ServiceAuthHelper.validateServiceConfig(serviceConfig);

if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
  // Handle validation errors
}
```

## Adding New Authentication Methods

To add support for a new authentication method:

1. **Create a new provider**:
```typescript
// src/services/auth/providers/NewAuthProvider.ts
export class NewAuthProvider extends BaseAuthProvider {
  getAuthMethod(): AuthMethod {
    return 'new-method';
  }

  async authenticate(config: AuthConfig): Promise<AuthResult> {
    // Implementation
  }

  getAuthHeaders(session: AuthSession): Record<string, string> {
    // Implementation
  }
}
```

2. **Register the provider**:
```typescript
// src/services/auth/AuthProviderFactory.ts
authManager.registerProvider('new-service-type', new NewAuthProvider());
```

3. **Update service types**:
```typescript
// src/models/service.types.ts
export type ServiceType = 
  | 'sonarr'
  | 'radarr'
  | 'jellyseerr'
  | 'qbittorrent'
  | 'prowlarr'
  | 'new-service-type'; // Add new type
```

## Error Handling

The authentication system provides comprehensive error handling:

- **Network errors**: Connection timeouts, DNS resolution failures
- **Authentication errors**: Invalid credentials, expired tokens
- **Service errors**: Service unavailable, maintenance mode
- **Configuration errors**: Missing required fields, invalid URLs

All errors are logged and provide detailed information for troubleshooting.

## Session Management

The system handles session management automatically:

- **Session persistence**: Sessions are stored in memory and persist across requests
- **Token refresh**: Automatic token refresh when supported by the service
- **Session validation**: Automatic validation of session validity
- **Cleanup**: Automatic cleanup of expired sessions

## Security Considerations

- **Credential storage**: Credentials are stored securely in the service configuration
- **Token handling**: Tokens are handled securely and not logged
- **Session security**: Sessions use secure cookies where supported
- **Error information**: Sensitive information is not exposed in error messages

## Testing

The authentication system includes comprehensive tests:

- **Unit tests**: Test individual components and methods
- **Integration tests**: Test the complete authentication flow
- **Mock support**: Full mock support for testing without actual services

Run tests with:
```bash
npm test __tests__/auth/
```

## Migration from Old System

The new authentication system is backward compatible with the existing codebase:

1. **Automatic integration**: All existing connectors automatically use the new system
2. **No breaking changes**: Existing service configurations continue to work
3. **Enhanced functionality**: Additional features like session management and error handling

## Troubleshooting

### Common Issues

1. **Authentication failures**: Check credentials and service URL
2. **Session timeouts**: Ensure proper session management
3. **Network errors**: Verify network connectivity and VPN settings
4. **Configuration errors**: Use the validation helper to check configuration

### Debug Information

Enable debug logging to see detailed authentication information:

```typescript
import { logger } from '@/services/logger/LoggerService';

// Debug logs will show:
// - Authentication attempts
// - Session management
// - Error details
// - Network requests
```

## Future Enhancements

The authentication system is designed to be extensible and can support:

- **OAuth 2.0**: For services that support OAuth
- **JWT tokens**: For services using JWT authentication
- **Multi-factor authentication**: For enhanced security
- **Credential encryption**: For additional security
- **Authentication caching**: For improved performance

## Conclusion

The new authentication system provides a robust, extensible, and maintainable solution for handling authentication across all service connectors in UniArr. It centralizes authentication logic, provides comprehensive error handling, and makes it easy to add support for new services and authentication methods.