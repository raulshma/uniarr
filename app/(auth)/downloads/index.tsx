import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const DownloadsScreen = () => {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0F0F0F',
      padding: 16,
    },
    title: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    subtitle: {
      color: '#CCCCCC',
      fontSize: 16,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Downloads</Text>
      <Text style={styles.subtitle}>View and manage your downloads here.</Text>
    </SafeAreaView>
  );
};

export default DownloadsScreen;
