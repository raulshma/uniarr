import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Button } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { imageCacheService } from '@/services/image/ImageCacheService';

const SimpleThumbhashTest = () => {
  const [thumbhash, setThumbhash] = useState<string | undefined>();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Use a simple, reliable image URL for testing
  const testImageUrl = 'https://picsum.photos/200/300';

  useEffect(() => {
    addLog('Component mounted');
  }, []);

  const testDirectThumbhash = async () => {
    try {
      addLog('Testing direct thumbhash generation...');
      const hash = await Image.generateThumbhashAsync(testImageUrl);
      addLog(`Direct generation result: ${hash ? 'SUCCESS' : 'FAILED'}`);
      if (hash) {
        setThumbhash(hash);
        addLog(`Thumbhash length: ${hash.length}`);
        addLog(`Thumbhash preview: ${hash.substring(0, 20)}...`);
      }
    } catch (error) {
      addLog(`Direct generation error: ${error}`);
    }
  };

  const testCacheService = async () => {
    try {
      addLog('Testing cache service thumbhash...');
      await imageCacheService.generateThumbhash(testImageUrl);

      // Wait a moment then check if it was stored
      setTimeout(() => {
        const stored = imageCacheService.getThumbhash(testImageUrl);
        addLog(`Cache service result: ${stored ? 'FOUND' : 'NOT FOUND'}`);
        if (stored) {
          setThumbhash(stored);
          addLog(`Stored thumbhash length: ${stored.length}`);
        }
      }, 1000);
    } catch (error) {
      addLog(`Cache service error: ${error}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">Simple ThumbHash Test</Text>

      <View style={styles.section}>
        <Text variant="titleMedium">Test Image</Text>
        <Image
          source={{ uri: testImageUrl }}
          style={styles.testImage}
          contentFit="cover"
        />
        <Text variant="bodySmall">URL: {testImageUrl}</Text>
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium">Actions</Text>
        <Button title="Generate Direct Thumbhash" onPress={testDirectThumbhash} />
        <Button title="Test Cache Service" onPress={testCacheService} />
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium">Thumbhash Test</Text>
        {thumbhash ? (
          <>
            <Text variant="bodyMedium">Thumbhash Available!</Text>
            <Image
              source={{ uri: testImageUrl }}
              placeholder={thumbhash}
              style={styles.thumbhashTest}
              contentFit="cover"
            />
            <Text variant="bodySmall">This should show a thumbhash placeholder</Text>
          </>
        ) : (
          <Text variant="bodyMedium">No thumbhash generated yet</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium">Logs</Text>
        {logs.slice(-10).map((log, index) => (
          <Text key={index} variant="bodySmall">{log}</Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  testImage: {
    width: 100,
    height: 150,
    borderRadius: 8,
  },
  thumbhashTest: {
    width: 200,
    height: 300,
    borderRadius: 8,
  },
});

export default SimpleThumbhashTest;