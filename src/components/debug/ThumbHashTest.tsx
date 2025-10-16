import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Button } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { imageCacheService } from '@/services/image/ImageCacheService';

const ThumbHashTest = () => {
  const [thumbhash, setThumbhash] = useState<string | undefined>();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testImageUrl = 'https://image.tmdb.org/t/p/w500/your-image-url.jpg';

  useEffect(() => {
    addLog('Component mounted');
  }, []);

  const checkThumbhash = () => {
    const existing = imageCacheService.getThumbhash(testImageUrl);
    addLog(`Existing thumbhash: ${existing ? 'found' : 'not found'}`);
    setThumbhash(existing);
  };

  const generateThumbhash = async () => {
    try {
      addLog('Starting thumbhash generation...');
      const hash = await Image.generateThumbhashAsync(testImageUrl);
      addLog(`Generated thumbhash: ${hash ? 'success' : 'failed'}`);
      setThumbhash(hash || undefined);
    } catch (error) {
      addLog(`Error generating thumbhash: ${error}`);
    }
  };

  const prefetchImage = async () => {
    try {
      addLog('Starting image prefetch...');
      await imageCacheService.prefetch(testImageUrl);
      addLog('Prefetch completed');
      // Check if thumbhash was generated during prefetch
      setTimeout(checkThumbhash, 500);
    } catch (error) {
      addLog(`Prefetch error: ${error}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">ThumbHash Debug</Text>

      <View style={styles.section}>
        <Text variant="titleMedium">Current Status</Text>
        <Text>Thumbhash: {thumbhash ? 'available' : 'none'}</Text>
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium">Actions</Text>
        <Button title="Check Thumbhash" onPress={checkThumbhash} />
        <Button title="Generate Thumbhash" onPress={generateThumbhash} />
        <Button title="Prefetch Image" onPress={prefetchImage} />
      </View>

      {thumbhash && (
        <View style={styles.section}>
          <Text variant="titleMedium">Thumbhash Preview</Text>
          <Image
            source={{ uri: testImageUrl }}
            placeholder={thumbhash}
            style={styles.imagePreview}
            contentFit="cover"
          />
          <Text>Thumbhash value: {thumbhash.substring(0, 20)}...</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text variant="titleMedium">Logs</Text>
        {logs.map((log, index) => (
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
  imagePreview: {
    width: 200,
    height: 300,
    borderRadius: 8,
  },
});

export default ThumbHashTest;