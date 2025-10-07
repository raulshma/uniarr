/**
 * Validate API key format for different services
 */
export function validateApiKey(apiKey: string, serviceType: 'sonarr' | 'radarr' | 'qbittorrent' | 'jellyseerr' | 'prowlarr'): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  if (!apiKey || apiKey.trim().length === 0) {
    issues.push('API key is empty');
    return { isValid: false, issues };
  }
  
  const trimmedKey = apiKey.trim();
  
  // Check minimum length
  if (trimmedKey.length < 8) {
    issues.push('API key is too short (minimum 8 characters)');
  }
  
  // Check for common issues
  if (trimmedKey.includes(' ')) {
    issues.push('API key contains spaces (remove them)');
  }
  
  if (trimmedKey.includes('\n') || trimmedKey.includes('\r')) {
    issues.push('API key contains line breaks (remove them)');
  }
  
  // Service-specific validation
  if (serviceType === 'sonarr' || serviceType === 'radarr' || serviceType === 'prowlarr') {
    // Sonarr/Radarr/Prowlarr API keys are typically 32 characters
    if (trimmedKey.length !== 32) {
      issues.push(`${serviceType} API key should be 32 characters long (current: ${trimmedKey.length})`);
    }
    
    // Check if it looks like a valid API key (alphanumeric)
    if (!/^[a-zA-Z0-9]+$/.test(trimmedKey)) {
      issues.push(`${serviceType} API key should only contain letters and numbers`);
    }
  }
  
  if (serviceType === 'qbittorrent' || serviceType === 'jellyseerr') {
    // qBittorrent and Jellyseerr don't use API keys, they use username/password
    issues.push(`${serviceType} uses username/password authentication, not API keys`);
  }
  
  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Get API key from service settings (for testing)
 */
export function getApiKeyInstructions(serviceType: 'sonarr' | 'radarr' | 'qbittorrent' | 'jellyseerr' | 'prowlarr'): string {
  switch (serviceType) {
    case 'sonarr':
      return 'Go to Sonarr → Settings → General → Security → API Key';
    case 'radarr':
      return 'Go to Radarr → Settings → General → Security → API Key';
    case 'jellyseerr':
      return 'Jellyseerr uses username/password authentication. Use your Jellyfin credentials.';
    case 'prowlarr':
      return 'Go to Prowlarr → Settings → General → API Key';
    case 'qbittorrent':
      return 'qBittorrent uses username/password. Check Settings → Web UI → Authentication';
    default:
      return 'Check service documentation for API key location';
  }
}

/**
 * Test API key format and provide suggestions
 */
export function testApiKeyFormat(apiKey: string, serviceType: 'sonarr' | 'radarr' | 'qbittorrent' | 'jellyseerr' | 'prowlarr'): {
  isValid: boolean;
  message: string;
  suggestions: string[];
} {
  const validation = validateApiKey(apiKey, serviceType);
  const instructions = getApiKeyInstructions(serviceType);
  
  if (validation.isValid) {
    return {
      isValid: true,
      message: 'API key format looks correct',
      suggestions: [],
    };
  }
  
  const suggestions: string[] = [
    `To get your ${serviceType} API key: ${instructions}`,
    'Make sure to copy the entire API key without any extra spaces or characters',
    'If the API key is correct, check if the service is running and accessible',
  ];
  
  if (serviceType === 'qbittorrent' || serviceType === 'jellyseerr') {
    suggestions.push(`${serviceType} uses username/password authentication, not API keys`);
  }
  
  return {
    isValid: false,
    message: `API key validation failed: ${validation.issues.join(', ')}`,
    suggestions,
  };
}