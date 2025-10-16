import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Button } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { thumbhashService } from '@/services/image/ThumbhashService';

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
    const existing = thumbhashService.getThumbhash(testImageUrl);
    addLog(`Existing thumbhash: ${existing ? 'found' : 'not found'}`);
    setThumbhash(existing || undefined);
  };

  const generateThumbhash = async () => {
    try {
      addLog('Starting thumbhash generation via ThumbhashService...');
      const hash = await thumbhashService.generateThumbhash(testImageUrl);
      addLog(`Generated thumbhash: ${hash ? 'success' : 'failed'}`);
      setThumbhash(hash || undefined);
    } catch (error) {
      addLog(`Error generating thumbhash: ${error}`);
    }
  };

  const clearThumbhashes = async () => {
    try {
      addLog('Clearing all thumbhashes...');
      await thumbhashService.clearThumbhashes();
      setThumbhash(undefined);
      addLog('Thumbhashes cleared');
    } catch (error) {
      addLog(`Error clearing thumbhashes: ${error}`);
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
        <Button title="Clear All Thumbhashes" onPress={clearThumbhashes} />
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