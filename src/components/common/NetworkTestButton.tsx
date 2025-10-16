import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { alert } from '@/services/dialogService';
import { Button, Text, useTheme } from 'react-native-paper';
import { testServiceAccessibility } from '@/utils/network.utils';

interface NetworkTestButtonProps {
  serviceType: 'sonarr' | 'radarr' | 'qbittorrent';
  baseUrl: string;
  onResult?: (result: { success: boolean; message: string }) => void;
}

export const NetworkTestButton: React.FC<NetworkTestButtonProps> = ({
  serviceType,
  baseUrl,
  onResult,
}) => {
  const [isTesting, setIsTesting] = useState(false);
  const theme = useTheme();

  const handleTest = async () => {
    setIsTesting(true);
    
    try {
      const result = await testServiceAccessibility(baseUrl, serviceType);
      
      if (result.success) {
        const message = `${serviceType} is accessible! Latency: ${result.latency}ms`;
  alert('Network Test', message);
        onResult?.({ success: true, message });
      } else {
        const message = `${serviceType} is not accessible: ${result.error}`;
        console.error(`❌ [NetworkTestButton] ${message}`);
  alert('Network Test Failed', message);
        onResult?.({ success: false, message });
      }
    } catch (error) {
      const message = `Network test failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ [NetworkTestButton] ${message}`);
  alert('Network Test Error', message);
      onResult?.({ success: false, message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Button
        mode="outlined"
        onPress={handleTest}
        loading={isTesting}
        disabled={isTesting}
        style={styles.button}
        labelStyle={styles.buttonLabel}
      >
        Test {serviceType} Connectivity
      </Button>
      <Text variant="bodySmall" style={[styles.helpText, { color: theme.colors.onSurfaceVariant }]}>
        Test if {serviceType} is accessible through VPN
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  button: {
    marginBottom: 4,
  },
  buttonLabel: {
    textTransform: 'none',
  },
  helpText: {
    textAlign: 'center',
    fontSize: 12,
  },
});