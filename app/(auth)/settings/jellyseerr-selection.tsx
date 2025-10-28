import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, Button, useTheme } from "react-native-paper";
import {
  useConnectorsStore,
  selectGetConnectorsByType,
} from "@/store/connectorsStore";
import {
  useSettingsStore,
  selectPreferredJellyseerrServiceId,
} from "@/store/settingsStore";
import type { ServiceType } from "@/models/service.types";
import {
  SettingsListItem,
  SettingsGroup,
  getGroupPositions,
} from "@/components/common";

export default function JellyseerrSelectionScreen() {
  const router = useRouter();
  const theme = useTheme();

  const getConnectorsByType = useConnectorsStore(selectGetConnectorsByType);
  const preferredServiceId = useSettingsStore(
    selectPreferredJellyseerrServiceId,
  );

  const jellyseerrConnectors = getConnectorsByType("jellyseerr" as ServiceType);
  const groupPositions = getGroupPositions(jellyseerrConnectors.length);

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
          <SettingsGroup>
            {jellyseerrConnectors.map((connector, index) => {
              const isSelected = connector.config.id === preferredServiceId;
              return (
                <SettingsListItem
                  key={connector.config.id}
                  title={connector.config.id}
                  subtitle={`URL: ${connector.config.url || "N/A"}`}
                  left={{ iconName: "server-network" }}
                  trailing={
                    isSelected ? (
                      <View style={styles.selectedBadge}>
                        <Text
                          style={{
                            color: theme.colors.primary,
                            fontWeight: "600",
                            fontSize: 12,
                          }}
                        >
                          ✓
                        </Text>
                      </View>
                    ) : undefined
                  }
                  selected={isSelected}
                  onPress={() => handleSelectService(connector.config.id)}
                  groupPosition={groupPositions[index]}
                />
              );
            })}
          </SettingsGroup>
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
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
