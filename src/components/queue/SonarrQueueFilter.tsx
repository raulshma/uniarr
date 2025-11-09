import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Button, Chip, Dialog, Portal, Text } from "react-native-paper";
import type { QueueFilters, QueueStatus } from "@/models/queue.types";
import type { components } from "@/connectors/client-schemas/sonarr-openapi";
type DownloadProtocol = components["schemas"]["DownloadProtocol"];

interface SonarrQueueFilterProps {
  visible: boolean;
  filters: QueueFilters;
  onDismiss: () => void;
  onApply: (filters: QueueFilters) => void;
  onReset: () => void;
}

const SonarrQueueFilterComponent = ({
  visible,
  filters,
  onDismiss,
  onApply,
  onReset,
}: SonarrQueueFilterProps) => {
  const [tempFilters, setTempFilters] = useState<QueueFilters>(filters);

  // Memoize filter options to prevent unnecessary re-renders
  const statusOptions = useMemo(
    () => [
      { value: "cancelled" as const, label: "Cancelled" },
      { value: "completed" as const, label: "Completed" },
      { value: "delay" as const, label: "Delayed" },
      {
        value: "downloadClientUnavailable" as const,
        label: "Client Unavailable",
      },
      { value: "downloading" as const, label: "Downloading" },
      { value: "failed" as const, label: "Failed" },
      { value: "fallback" as const, label: "Fallback" },
      { value: "paused" as const, label: "Paused" },
      { value: "queued" as const, label: "Queued" },
      { value: "unknown" as const, label: "Unknown" },
      { value: "warning" as const, label: "Warning" },
    ],
    [],
  );

  const protocolOptions = useMemo(
    () => [
      { value: "usenet" as DownloadProtocol, label: "Usenet" },
      { value: "torrent" as DownloadProtocol, label: "Torrent" },
    ],
    [],
  );

  const includeOptions = useMemo(
    () => [
      {
        key: "includeUnknownSeriesItems" as keyof QueueFilters,
        label: "Unknown Series",
      },
      { key: "includeSeries" as keyof QueueFilters, label: "Series Details" },
      { key: "includeEpisode" as keyof QueueFilters, label: "Episode Details" },
    ],
    [],
  );

  const handleStatusChange = useCallback((status: QueueStatus) => {
    setTempFilters((prev) => {
      const currentStatuses = prev.status || [];
      const newStatuses = currentStatuses.includes(status)
        ? currentStatuses.filter((s) => s !== status)
        : [...currentStatuses, status];
      return { ...prev, status: newStatuses };
    });
  }, []);

  const handleProtocolChange = useCallback((protocol: DownloadProtocol) => {
    setTempFilters((prev) => {
      const currentProtocols = prev.protocol || [];
      const newProtocols = currentProtocols.includes(protocol)
        ? currentProtocols.filter((p) => p !== protocol)
        : [...currentProtocols, protocol];
      return { ...prev, protocol: newProtocols };
    });
  }, []);

  const handleBooleanFilterChange = useCallback(
    (key: "includeUnknownSeriesItems" | "includeSeries" | "includeEpisode") => {
      setTempFilters((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    },
    [],
  );

  const handleApply = useCallback(() => {
    // Validate filters before applying
    const validatedFilters = {
      ...tempFilters,
      // Ensure protocol values are valid DownloadProtocol values
      protocol: tempFilters.protocol?.filter((p) =>
        protocolOptions.some((opt) => opt.value === p),
      ),
      // Ensure status values are valid QueueStatus values
      status: tempFilters.status?.filter((s) =>
        statusOptions.some((opt) => opt.value === s),
      ),
    };

    onApply(validatedFilters);
    onDismiss();
  }, [tempFilters, onApply, onDismiss, protocolOptions, statusOptions]);

  const handleReset = useCallback(() => {
    setTempFilters({});
    onReset();
  }, [onReset]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Queue Filters</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            {/* Status Filters */}
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Status
              </Text>
              <View style={styles.chipsContainer}>
                {statusOptions.map(({ value, label }) => (
                  <Chip
                    key={value}
                    mode="outlined"
                    selected={tempFilters.status?.includes(
                      value as QueueStatus,
                    )}
                    onPress={() => handleStatusChange(value as QueueStatus)}
                    compact
                  >
                    {label}
                  </Chip>
                ))}
              </View>
            </View>

            {/* Protocol Filters */}
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Protocol
              </Text>
              <View style={styles.chipsContainer}>
                {protocolOptions.map(({ value, label }) => (
                  <Chip
                    key={value}
                    mode="outlined"
                    selected={tempFilters.protocol?.includes(
                      value as DownloadProtocol,
                    )}
                    onPress={() =>
                      handleProtocolChange(value as DownloadProtocol)
                    }
                    compact
                  >
                    {label}
                  </Chip>
                ))}
              </View>
            </View>

            {/* Include Options */}
            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Include Options
              </Text>
              {includeOptions.map(({ key, label }) => (
                <View key={key} style={styles.optionRow}>
                  <Text>{label}</Text>
                  <Button
                    mode={tempFilters[key] ? "contained" : "outlined"}
                    onPress={() =>
                      handleBooleanFilterChange(
                        key as
                          | "includeUnknownSeriesItems"
                          | "includeSeries"
                          | "includeEpisode",
                      )
                    }
                    compact
                  >
                    {tempFilters[key] ? "Enabled" : "Disabled"}
                  </Button>
                </View>
              ))}
            </View>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={handleReset}>Reset</Button>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button mode="contained" onPress={handleApply}>
            Apply
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export const SonarrQueueFilter = React.memo(SonarrQueueFilterComponent);

const styles = StyleSheet.create({
  dialog: {
    maxHeight: "80%",
  },
  scrollArea: {
    paddingHorizontal: 0,
    maxHeight: 500,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
});
