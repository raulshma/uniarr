/**
 * Centralized authentication system for all services
 */

// Core types and interfaces
export * from './types';

// Authentication manager
export { AuthManager, authManager } from './AuthManager';

// Service authentication helper
export { ServiceAuthHelper } from './ServiceAuthHelper';

// Authentication providers
export { BaseAuthProvider } from './providers/BaseAuthProvider';
export { ApiKeyAuthProvider } from './providers/ApiKeyAuthProvider';
export { BasicAuthProvider } from './providers/BasicAuthProvider';
export { SessionAuthProvider } from './providers/SessionAuthProvider';

// Provider factory
export { AuthProviderFactory } from './AuthProviderFactory';

// Re-export existing auth service for backward compatibility
export * from './AuthService';