import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, List, Button, useTheme } from "react-native-paper";
import {
  useConnectorsStore,
  selectGetConnectorsByType,
} from "@/store/connectorsStore";
import {
  useSettingsStore,
  selectPreferredJellyseerrServiceId,
} from "@/store/settingsStore";
import type { ServiceType } from "@/models/service.types";

export default function JellyseerrSelectionScreen() {
  const router = useRouter();
  const theme = useTheme();

  const getConnectorsByType = useConnectorsStore(selectGetConnectorsByType);
  const preferredServiceId = useSettingsStore(
    selectPreferredJellyseerrServiceId,
  );

  const jellyseerrConnectors = getConnectorsByType("jellyseerr" as ServiceType);

  const handleSelectService = (serviceId: string) => {
    useSettingsStore.getState().setPreferredJellyseerrServiceId(serviceId);
    router.back();
  };

  const handleClear = () => {
    useSettingsStore.getState().setPreferredJellyseerrServiceId(undefined);
    router.back();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.content}>
        <Text variant="titleLarge" style={styles.title}>
          Select Jellyseerr Service for TMDB Mapping
        </Text>
        <Text variant="bodyMedium" style={styles.description}>
          When looking up series from TMDB items, the selected Jellyseerr
          service will be used to resolve the series ID in Sonarr.
        </Text>

        {jellyseerrConnectors.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text variant="bodyMedium" style={styles.emptyStateText}>
              No Jellyseerr services configured. Please add a Jellyseerr service
              in your connectors.
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {jellyseerrConnectors.map((connector) => {
              const isSelected = connector.config.id === preferredServiceId;
              return (
                <List.Item
                  key={connector.config.id}
                  title={connector.config.id}
                  description={`URL: ${connector.config.url || "N/A"}`}
                  onPress={() => handleSelectService(connector.config.id)}
                  right={() => (
                    <Text
                      variant="labelMedium"
                      style={{
                        color: isSelected
                          ? theme.colors.primary
                          : theme.colors.outline,
                      }}
                    >
                      {isSelected ? "✓ Selected" : ""}
                    </Text>
                  )}
                  style={[
                    styles.listItem,
                    isSelected && {
                      backgroundColor: theme.colors.primaryContainer,
                    },
                  ]}
                />
              );
            })}
          </View>
        )}

        {preferredServiceId && (
          <Button
            mode="outlined"
            onPress={handleClear}
            style={styles.clearButton}
          >
            Clear Selection
          </Button>
        )}

        <Button
          mode="contained"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          Done
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  title: {
    marginTop: 8,
    marginBottom: 8,
  },
  description: {
    marginBottom: 12,
    lineHeight: 20,
  },
  listContainer: {
    gap: 8,
  },
  listItem: {
    marginBottom: 4,
    borderRadius: 8,
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyStateText: {
    textAlign: "center",
    lineHeight: 20,
  },
  clearButton: {
    marginTop: 12,
  },
  backButton: {
    marginTop: 16,
  },
});
