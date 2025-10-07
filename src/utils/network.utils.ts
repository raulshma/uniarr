import axios from 'axios';

export interface NetworkTestResult {
  success: boolean;
  latency?: number;
  error?: string;
  details?: {
    status?: number;
    statusText?: string;
    responseTime?: number;
  };
}

/**
 * Test network connectivity to a specific URL
 */
export async function testNetworkConnectivity(
  url: string,
  timeout: number = 10000
): Promise<NetworkTestResult> {
  const startTime = Date.now();
  
  try {
    console.log('🌐 [NetworkTest] Testing connectivity to:', url);
    
    const response = await axios.get(url, {
      timeout,
      validateStatus: () => true, // Accept any status code
      headers: {
        'User-Agent': 'UniArr/1.0.0',
      },
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
    
    console.error('🌐 [NetworkTest] Connection failed:', {
      url,
      error: errorMessage,
      code: (error as any)?.code,
      latency,
    });
    
    return {
      success: false,
      latency,
      error: errorMessage,
      details: {
        responseTime: latency,
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
  }
  
  if (error.code === 'ENOTFOUND') {
    issues.push(`Host not found for ${serviceType} - DNS resolution failed, check VPN configuration`);
  }
  
  if (error.code === 'ETIMEDOUT') {
    issues.push(`Connection timeout to ${serviceType} - network latency too high or service not responding`);
  }
  
  if (error.code === 'ERR_NETWORK') {
    issues.push(`Network error for ${serviceType} - check VPN connection and routing`);
  }
  
  if (error.response?.status === 401) {
    issues.push(`Authentication failed for ${serviceType} - check API key`);
  }
  
  if (error.response?.status === 403) {
    issues.push(`Access forbidden for ${serviceType} - check permissions and API key`);
  }
  
  if (error.response?.status === 404) {
    issues.push(`Endpoint not found for ${serviceType} - check URL and API version`);
  }
  
  return issues;
}