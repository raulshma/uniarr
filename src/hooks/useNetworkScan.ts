import { useCallback, useMemo, useState } from "react";

import {
  NetworkScannerService,
  type NetworkScanResult,
  type ScanProgress,
  type ProgressCallback,
} from "@/services/network/NetworkScannerService";

export interface UseNetworkScanReturn {
  isScanning: boolean;
  scanResult: NetworkScanResult | null;
  error: string | null;
  scanProgress: ScanProgress | null;
  scanNetwork: (
    progressCallback?: ProgressCallback,
    fastScan?: boolean,
    customIpAddress?: string,
  ) => Promise<void>;
  stopScan: () => void;
  reset: () => void;
}

export const useNetworkScan = (): UseNetworkScanReturn => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<NetworkScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);

  const scanner = useMemo(() => new NetworkScannerService(), []);

  const scanNetwork = useCallback(
    async (
      progressCallback?: ProgressCallback,
      fastScan: boolean = true,
      customIpAddress?: string,
    ) => {
      setIsScanning(true);
      setError(null);
      setScanResult(null);
      setScanProgress(null);

      try {
        const result = await scanner.scanNetwork(
          (progress) => {
            setScanProgress(progress);
            progressCallback?.(progress);
          },
          fastScan,
          customIpAddress,
        );
        setScanResult(result);
        setScanProgress(null); // Clear progress when done
      } catch (err) {
        let message = "Failed to scan network";

        if (err instanceof Error) {
          if (err.message.includes("NetworkInfo is not available")) {
            message =
              "Network scanning is not available on this device. Please check network permissions.";
          } else if (
            err.message.includes("Unable to determine local IP address")
          ) {
            message =
              "Cannot determine your local IP address. Please check your network connection.";
          } else if (
            err.message.includes("Network scan is already in progress")
          ) {
            message =
              "A network scan is already running. Please wait for it to complete.";
          } else {
            message = err.message;
          }
        }

        setError(message);
        setScanProgress(null);
      } finally {
        setIsScanning(false);
      }
    },
    [scanner],
  );

  const stopScan = useCallback(() => {
    scanner.stopScan();
    setIsScanning(false);
  }, [scanner]);

  const reset = useCallback(() => {
    setScanResult(null);
    setError(null);
    setScanProgress(null);
    setIsScanning(false);
  }, []);

  return {
    isScanning,
    scanResult,
    error,
    scanProgress,
    scanNetwork,
    stopScan,
    reset,
  };
};
