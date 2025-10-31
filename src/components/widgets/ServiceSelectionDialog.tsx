import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import {
  Dialog,
  Portal,
  Checkbox,
  Text,
  Button,
  useTheme,
} from "react-native-paper";
import type { AppTheme } from "@/constants/theme";
import { useConnectorsStore } from "@/store/connectorsStore";

export interface ServiceSelectionDialogProps {
  visible: boolean;
  selectedIds: string[];
  serviceTypes?: ("sonarr" | "radarr")[];
  onSelectionChange: (selectedIds: string[]) => void;
  onClose: () => void;
  title?: string;
}

const ServiceSelectionDialog: React.FC<ServiceSelectionDialogProps> = ({
  visible,
  selectedIds,
  serviceTypes,
  onSelectionChange,
  onClose,
  title = "Select Services",
}) => {
  const theme = useTheme<AppTheme>();
  // Use stable Map selector to avoid creating new array references on every render
  const connectors = useConnectorsStore((state) => state.connectors);
  const allConnectors = useMemo(
    () => Array.from(connectors.values()),
    [connectors],
  );
  const [localSelection, setLocalSelection] = useState<Set<string>>(
    new Set(selectedIds),
  );

  const services = useMemo(() => {
    let filtered = allConnectors.map((connector) => ({
      id: connector.config.id,
      name: connector.config.name,
      type: connector.config.type,
    }));

    if (serviceTypes && serviceTypes.length > 0) {
      filtered = filtered.filter((svc) =>
        serviceTypes.includes(svc.type as "sonarr" | "radarr"),
      );
    }

    return filtered;
  }, [allConnectors, serviceTypes]);

  useEffect(() => {
    if (visible) {
      setLocalSelection(new Set(selectedIds));
    }
  }, [visible, selectedIds]);

  const handleToggleService = useCallback((serviceId: string) => {
    setLocalSelection((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (localSelection.size === services.length) {
      setLocalSelection(new Set());
    } else {
      setLocalSelection(new Set(services.map((s) => s.id)));
    }
  }, [services, localSelection.size]);

  const handleConfirm = useCallback(() => {
    onSelectionChange(Array.from(localSelection));
    onClose();
  }, [localSelection, onSelectionChange, onClose]);

  const allSelected = useMemo(
    () => localSelection.size === services.length && services.length > 0,
    [localSelection.size, services.length],
  );

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onClose}
        style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={styles.dialogTitle}>{title}</Dialog.Title>

        <Dialog.Content style={styles.content}>
          {services.length > 0 ? (
            <View style={styles.contentInner}>
              <View style={styles.selectAllRow}>
                <Checkbox
                  status={allSelected ? "checked" : "unchecked"}
                  onPress={handleSelectAll}
                />
                <Text
                  variant="labelLarge"
                  style={[
                    styles.selectAllText,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Select All
                </Text>
              </View>

              <ScrollView
                style={styles.scrollView}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {services.map((service) => (
                  <View
                    key={service.id}
                    style={[
                      styles.serviceRow,
                      {
                        borderBottomColor: `${theme.colors.outlineVariant}40`,
                      },
                    ]}
                  >
                    <Checkbox
                      status={
                        localSelection.has(service.id) ? "checked" : "unchecked"
                      }
                      onPress={() => handleToggleService(service.id)}
                    />
                    <View style={styles.serviceInfo}>
                      <Text
                        variant="bodyMedium"
                        style={{ color: theme.colors.onSurface }}
                      >
                        {service.name}
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={{
                          color: theme.colors.onSurfaceVariant,
                          opacity: 0.7,
                        }}
                      >
                        {service.type.charAt(0).toUpperCase() +
                          service.type.slice(1)}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <Text
                variant="bodySmall"
                style={[
                  styles.helperText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {localSelection.size} of {services.length} selected
              </Text>
            </View>
          ) : (
            <Text
              variant="bodyMedium"
              style={[
                styles.emptyText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              No services available. Add services in settings first.
            </Text>
          )}
        </Dialog.Content>

        <Dialog.Actions style={styles.actions}>
          <Button onPress={onClose}>Cancel</Button>
          <Button onPress={handleConfirm} mode="contained">
            Confirm
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxHeight: "80%",
  },
  dialogTitle: {
    paddingBottom: 12,
  },
  content: {
    paddingHorizontal: 0,
  },
  contentInner: {
    maxHeight: 400,
    gap: 12,
  },
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectAllText: {
    marginLeft: 8,
    fontWeight: "600",
  },
  scrollView: {
    marginHorizontal: 16,
    borderRadius: 8,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  serviceInfo: {
    marginLeft: 8,
    flex: 1,
    gap: 2,
  },
  helperText: {
    textAlign: "center",
    paddingHorizontal: 16,
    marginTop: 4,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 32,
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});

export default ServiceSelectionDialog;
