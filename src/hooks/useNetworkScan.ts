import { useCallback, useMemo, useState } from 'react';

import { NetworkScannerService, type NetworkScanResult, type DiscoveredService } from '@/services/network/NetworkScannerService';

export interface UseNetworkScanReturn {
  isScanning: boolean;
  scanResult: NetworkScanResult | null;
  error: string | null;
  scanNetwork: () => Promise<void>;
  stopScan: () => void;
  reset: () => void;
}

export const useNetworkScan = (): UseNetworkScanReturn => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<NetworkScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scanner = useMemo(() => new NetworkScannerService(), []);

  const scanNetwork = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    setScanResult(null);

    try {
      const result = await scanner.scanNetwork();
      setScanResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan network';
      setError(message);
    } finally {
      setIsScanning(false);
    }
  }, [scanner]);

  const stopScan = useCallback(() => {
    scanner.stopScan();
    setIsScanning(false);
  }, [scanner]);

  const reset = useCallback(() => {
    setScanResult(null);
    setError(null);
    setIsScanning(false);
  }, []);

  return {
    isScanning,
    scanResult,
    error,
    scanNetwork,
    stopScan,
    reset,
  };
};