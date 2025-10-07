import { DebugStep } from '@/components/common/DebugPanel';

class DebugLogger {
  private steps: DebugStep[] = [];
  private listeners: ((steps: DebugStep[]) => void)[] = [];

  addStep(step: Omit<DebugStep, 'timestamp'>) {
    const newStep: DebugStep = {
      id: step.id,
      title: step.title,
      status: step.status,
      message: step.message,
      details: step.details,
      timestamp: new Date(),
    };
    
    this.steps.push(newStep);
    this.notifyListeners();
  }

  updateStep(stepId: string, updates: Partial<Omit<DebugStep, 'id' | 'timestamp'>>) {
    const stepIndex = this.steps.findIndex(step => step.id === stepId);
    if (stepIndex !== -1 && this.steps[stepIndex]) {
      const existingStep = this.steps[stepIndex];
      this.steps[stepIndex] = {
        id: existingStep.id,
        title: updates.title ?? existingStep.title,
        status: updates.status ?? existingStep.status,
        message: updates.message ?? existingStep.message,
        details: updates.details ?? existingStep.details,
        timestamp: existingStep.timestamp,
      };
      this.notifyListeners();
    }
  }

  clear() {
    this.steps = [];
    this.notifyListeners();
  }

  getSteps(): DebugStep[] {
    return [...this.steps];
  }

  subscribe(listener: (steps: DebugStep[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.steps]));
  }

  // Helper methods for common debug scenarios
  startConnectionTest(serviceType: string, url: string) {
    this.addStep({
      id: 'connection-test-start',
      title: `Testing ${serviceType} Connection`,
      status: 'running',
      message: `Connecting to ${url}`,
    });
  }

  addNetworkTest(success: boolean, error?: string) {
    this.addStep({
      id: 'network-test',
      title: 'Network Connectivity Test',
      status: success ? 'success' : 'error',
      message: success ? 'Network is reachable' : `Network error: ${error}`,
    });
  }

  addWarning(message: string, details?: string) {
    this.addStep({
      id: `warning-${Date.now()}`,
      title: 'Warning',
      status: 'warning',
      message,
      details,
    });
  }

  addApiKeyValidation(isValid: boolean, message: string, suggestions?: string[]) {
    this.addStep({
      id: 'api-key-validation',
      title: 'API Key Validation',
      status: isValid ? 'success' : 'error',
      message,
      details: suggestions?.join('\n'),
    });
  }

  addApiTest(method: string, success: boolean, status?: number, error?: string) {
    this.addStep({
      id: `api-test-${method}`,
      title: `API Test (${method})`,
      status: success ? 'success' : 'error',
      message: success ? `API responded with status ${status}` : `API test failed: ${error}`,
    });
  }

  addServiceTest(serviceType: string, success: boolean, version?: string, error?: string) {
    this.addStep({
      id: 'service-test',
      title: `${serviceType} Service Test`,
      status: success ? 'success' : 'error',
      message: success ? `Connected successfully${version ? ` (v${version})` : ''}` : `Service test failed: ${error}`,
    });
  }

  addError(error: string, details?: string) {
    this.addStep({
      id: `error-${Date.now()}`,
      title: 'Error',
      status: 'error',
      message: error,
      details,
    });
  }

  addSuccess(message: string, details?: string) {
    this.addStep({
      id: `success-${Date.now()}`,
      title: 'Success',
      status: 'success',
      message,
      details,
    });
  }

  addInfo(message: string, details?: string) {
    this.addStep({
      id: `info-${Date.now()}`,
      title: 'Info',
      status: 'success',
      message,
      details,
    });
  }
}

export const debugLogger = new DebugLogger();