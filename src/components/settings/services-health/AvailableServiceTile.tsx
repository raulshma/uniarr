import { View, StyleSheet } from "react-native";
import { Text, useTheme, Card, IconButton, Button } from "react-native-paper";

import { AnimatedListItem } from "@/components/common";
import type { AppTheme } from "@/constants/theme";
import { spacing } from "@/theme/spacing";
import { borderRadius } from "@/constants/sizes";
import type { AvailableService } from "@/hooks/useAvailableServices";

interface AvailableServiceTileProps {
  service: AvailableService;
  index: number;
  totalItems: number;
  animated: boolean;
  onAddService: () => void;
}

export const AvailableServiceTile: React.FC<AvailableServiceTileProps> = ({
  service,
  index,
  totalItems,
  animated,
  onAddService,
}) => {
  const theme = useTheme<AppTheme>();

  const styles = StyleSheet.create({
    container: {
      marginHorizontal: spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.elevation.level1,
      borderRadius: borderRadius.xxl,
      opacity: service.isConfigured ? 0.7 : 1,
    },
    cardContent: {
      padding: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    serviceIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.xl,
      backgroundColor: theme.colors.secondaryContainer,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    serviceInfo: {
      flex: 1,
    },
    serviceName: {
      color: theme.colors.onSurface,
      fontSize: theme.custom.typography.titleMedium.fontSize,
      fontFamily: theme.custom.typography.titleMedium.fontFamily,
      lineHeight: theme.custom.typography.titleMedium.lineHeight,
      fontWeight: theme.custom.typography.titleMedium.fontWeight as any,
    },
    serviceType: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      marginTop: 2,
      textTransform: "capitalize",
    },
    description: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.bodySmall.fontSize,
      fontFamily: theme.custom.typography.bodySmall.fontFamily,
      lineHeight: 16,
      marginBottom: spacing.sm,
    },
    availabilityHint: {
      color: theme.colors.primary,
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
      marginBottom: spacing.sm,
      fontStyle: "italic",
    },
    capabilities: {
      marginBottom: spacing.sm,
    },
    capabilityTag: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs / 2,
      marginRight: spacing.xs,
      marginBottom: spacing.xs,
    },
    capabilityText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    configuredBadge: {
      color: theme.colors.primary,
      fontSize: theme.custom.typography.labelSmall.fontSize,
      fontFamily: theme.custom.typography.labelSmall.fontFamily,
    },
    addButton: {
      borderRadius: borderRadius.lg,
    },
  });

  return (
    <AnimatedListItem
      index={index}
      totalItems={totalItems}
      animated={animated}
      style={styles.container}
    >
      <Card style={styles.card}>
        <View style={styles.cardContent}>
          {/* Header with service info */}
          <View style={styles.header}>
            <View style={styles.serviceIcon}>
              <IconButton
                icon={service.icon}
                size={20}
                iconColor={theme.colors.onSecondaryContainer}
              />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceType}>{service.type}</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.description}>{service.description}</Text>

          {/* Availability hint */}
          <Text style={styles.availabilityHint}>
            Ready to configure • {service.capabilities.length} capabilities
          </Text>

          {/* Capabilities */}
          {service.capabilities.length > 0 && (
            <View style={styles.capabilities}>
              {service.capabilities.slice(0, 3).map((capability, idx) => (
                <View key={idx} style={styles.capabilityTag}>
                  <Text style={styles.capabilityText}>{capability}</Text>
                </View>
              ))}
              {service.capabilities.length > 3 && (
                <View style={styles.capabilityTag}>
                  <Text style={styles.capabilityText}>
                    +{service.capabilities.length - 3} more
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            {service.isConfigured ? (
              <Text style={styles.configuredBadge}>
                {service.configuredCount} instance
                {service.configuredCount !== 1 ? "s" : ""} configured
              </Text>
            ) : (
              <Text style={styles.configuredBadge}>Not configured</Text>
            )}

            {!service.isConfigured && (
              <Button
                mode="contained-tonal"
                onPress={onAddService}
                compact
                style={styles.addButton}
              >
                Add Service
              </Button>
            )}
          </View>
        </View>
      </Card>
    </AnimatedListItem>
  );
};
