import axios from 'axios';

export interface NetworkTestResult {
  success: boolean;
  latency?: number;
  error?: string;
  details?: {
    status?: number;
    statusText?: string;
    responseTime?: number;
    code?: string;
    isPartialSuccess?: boolean;
  };
}

/**
 * Test network connectivity to a specific URL
 */
export async function testNetworkConnectivity(
  url: string,
  timeout: number = 15000
): Promise<NetworkTestResult> {
  const startTime = Date.now();
  
  try {
    console.log('🌐 [NetworkTest] Testing connectivity to:', url);
    console.log('🌐 [NetworkTest] Timeout:', timeout);
    
    const response = await axios.get(url, {
      timeout,
      validateStatus: () => true, // Accept any status code
      headers: {
        'User-Agent': 'UniArr/1.0.0',
        'Accept': 'application/json, text/plain, */*',
      },
      // Add retry configuration for VPN connections
      maxRedirects: 5,
      maxContentLength: 50 * 1024 * 1024, // 50MB
    });
    
    const latency = Date.now() - startTime;
    
    console.log('🌐 [NetworkTest] Response received:', {
      status: response.status,
      statusText: response.statusText,
      latency,
      headers: response.headers
    });
    
    return {
      success: true,
      latency,
      details: {
        status: response.status,
        statusText: response.statusText,
        responseTime: latency,
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as any)?.code;
    
    console.error('🌐 [NetworkTest] Connection failed:', {
      url,
      error: errorMessage,
      code: errorCode,
      latency,
    });
    
    // For VPN connections, some errors might still indicate partial connectivity
    const isPartialSuccess = errorCode === 'ECONNRESET' || errorCode === 'EPIPE';
    
    return {
      success: false,
      latency,
      error: errorMessage,
      details: {
        responseTime: latency,
        code: errorCode,
        isPartialSuccess,
      },
    };
  }
}

/**
 * Test if a service is accessible through VPN
 */
export async function testServiceAccessibility(
  baseUrl: string,
  serviceType: 'sonarr' | 'radarr' | 'qbittorrent'
): Promise<NetworkTestResult> {
  let endpoint = '';
  
  switch (serviceType) {
    case 'sonarr':
      endpoint = '/api/v3/system/status';
      break;
    case 'radarr':
      endpoint = '/api/v3/system/status';
      break;
    case 'qbittorrent':
      endpoint = '/api/v2/app/version';
      break;
    default:
      throw new Error(`Unsupported service type: ${serviceType}`);
  }
  
  const fullUrl = `${baseUrl}${endpoint}`;
  console.log(`🌐 [ServiceTest] Testing ${serviceType} accessibility:`, fullUrl);
  
  return testNetworkConnectivity(fullUrl);
}

/**
 * Diagnose VPN connectivity issues
 */
export function diagnoseVpnIssues(error: any, serviceType: string): string[] {
  const issues: string[] = [];
  
  if (error.code === 'ECONNREFUSED') {
    issues.push(`Connection refused to ${serviceType} - service might not be running or firewall blocking`);
    issues.push(`VPN troubleshooting: Check if ${serviceType} is bound to 0.0.0.0 (not 127.0.0.1)`);
    issues.push(`Verify firewall allows connections on the ${serviceType} port through VPN`);
  }
  
  if (error.code === 'ENOTFOUND') {
    issues.push(`Host not found for ${serviceType} - DNS resolution failed, check VPN configuration`);
    issues.push(`VPN troubleshooting: Try using IP address instead of hostname`);
    issues.push(`Check if VPN is routing traffic to the correct subnet`);
  }
  
  if (error.code === 'ETIMEDOUT') {
    issues.push(`Connection timeout to ${serviceType} - network latency too high or service not responding`);
    issues.push(`VPN troubleshooting: Increase timeout settings, check VPN latency`);
    issues.push(`Verify ${serviceType} is responding on the expected port`);
  }
  
  if (error.code === 'ERR_NETWORK') {
    issues.push(`Network error for ${serviceType} - check VPN connection and routing`);
    issues.push(`VPN troubleshooting: Verify WireGuard configuration includes correct routes`);
    issues.push(`Check if VPN client can reach the server's internal IP`);
  }
  
  if (error.code === 'AUTH_ERROR') {
    issues.push(`Authentication failed for ${serviceType} - check API key`);
    issues.push(`VPN troubleshooting: Verify API key is correct and not expired`);
    issues.push(`Check if ${serviceType} requires authentication to be enabled`);
  }
  
  if (error.code === 'API_ERROR') {
    issues.push(`API error for ${serviceType} - check service configuration`);
    issues.push(`VPN troubleshooting: Verify ${serviceType} is running and accessible`);
  }
  
  if (error.response?.status === 401) {
    issues.push(`Authentication failed for ${serviceType} - check API key`);
    issues.push(`VPN troubleshooting: Verify API key is correct and not expired`);
  }
  
  if (error.response?.status === 403) {
    issues.push(`Access forbidden for ${serviceType} - check permissions and API key`);
    issues.push(`VPN troubleshooting: Check if ${serviceType} allows connections from VPN subnet`);
  }
  
  if (error.response?.status === 404) {
    issues.push(`Endpoint not found for ${serviceType} - check URL and API version`);
    issues.push(`VPN troubleshooting: Verify the correct API endpoint path`);
  }
  
  // Add general VPN troubleshooting tips
  if (issues.length > 0) {
    issues.push(`\nGeneral VPN troubleshooting:`);
    issues.push(`1. Test with browser: http://YOUR_SERVER_IP:PORT`);
    issues.push(`2. Check service binding: Should be 0.0.0.0, not 127.0.0.1`);
    issues.push(`3. Verify firewall: Allow ports through VPN`);
    issues.push(`4. Test with curl: curl -H "X-Api-Key: KEY" http://IP:PORT/api/v3/system/status`);
  }
  
  return issues;
}