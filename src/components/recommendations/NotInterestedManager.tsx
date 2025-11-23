import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Text,
  Button,
  List,
  Portal,
  Dialog,
  IconButton,
} from "react-native-paper";
import { spacing } from "@/theme/spacing";
import { useNotInterestedItems } from "@/hooks/useNotInterestedItems";

export interface NotInterestedManagerProps {
  userId: string;
  visible: boolean;
  onDismiss: () => void;
}

export const NotInterestedManager: React.FC<NotInterestedManagerProps> = ({
  userId,
  visible,
  onDismiss,
}) => {
  const { items, isLoading, remove, clear } = useNotInterestedItems(userId);

  const styles = StyleSheet.create({
    container: { padding: spacing.md, gap: spacing.sm },
    list: { maxHeight: 420 },
    footer: { flexDirection: "row", justifyContent: "space-between" },
  });

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Not Interested</Dialog.Title>
        <Dialog.Content>
          {isLoading ? (
            <Text>Loading...</Text>
          ) : items.length === 0 ? (
            <Text variant="bodyMedium">No items marked as not interested.</Text>
          ) : (
            <ScrollView style={styles.list}>
              {items.map((i) => (
                <List.Item
                  key={i.recommendationId}
                  title={i.recommendation.title}
                  description={i.reason || "Marked not interested"}
                  right={() => (
                    <IconButton
                      icon="trash-can-outline"
                      onPress={() => void remove(i.recommendationId)}
                    />
                  )}
                />
              ))}
            </ScrollView>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <View style={styles.footer}>
            <Button onPress={onDismiss}>Close</Button>
            <Button
              onPress={() => {
                void clear();
              }}
              mode="contained"
              disabled={items.length === 0}
            >
              Clear All
            </Button>
          </View>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default NotInterestedManager;
