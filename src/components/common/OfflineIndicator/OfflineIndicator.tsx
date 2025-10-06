import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface OfflineIndicatorProps {
  isVisible: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ isVisible }) => {
  const theme = useTheme();

  if (!isVisible) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.error }]}>
      <Text style={[styles.text, { color: theme.colors.onError }]}>
        No Internet Connection
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
});
