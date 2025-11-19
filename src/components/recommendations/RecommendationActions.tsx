import React, { useState, useMemo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  useTheme,
  Menu,
  Portal,
  Dialog,
  Text,
  RadioButton,
  IconButton,
} from "react-native-paper";

import type { AppTheme } from "@/constants/theme";
import type { Recommendation } from "@/models/recommendation.schemas";
import { spacing } from "@/theme/spacing";
import { logger } from "@/services/logger/LoggerService";
import { ContentRecommendationService } from "@/services/ai/recommendations/ContentRecommendationService";
import { useNotInterestedItems } from "@/hooks/useNotInterestedItems";

export interface RecommendationActionsProps {
  /** The recommendation */
  recommendation: Recommendation;
  /** Callback when user accepts the recommendation */
  onAccept: (recommendationOrId: Recommendation | string) => Promise<void>;
  /** Callback when user rejects the recommendation */
  onReject: (
    recommendationOrId: Recommendation | string,
    reason?: string,
  ) => Promise<void>;
  /** Whether the app is offline */
  isOffline: boolean;
  /** Whether feedback is being submitted */
  isSubmitting: boolean;
  /** User ID of the current user */
  userId: string;
}

type ServiceType = "sonarr" | "radarr" | "jellyseerr";

const REJECTION_REASONS = [
  { label: "Not interested in this genre", value: "genre" },
  { label: "Already watched it", value: "watched" },
  { label: "Don't like this type of content", value: "type" },
  { label: "Rating is too low", value: "rating" },
  { label: "Other", value: "other" },
];

/**
 * Action buttons for recommendation cards
 *
 * Features:
 * - Add to Library button with service selection
 * - View in Jellyfin button (when in library)
 * - Not Interested button
 * - More Info button
 * - Disabled state when offline
 * - Loading states during actions
 * - Success/error feedback
 */
export const RecommendationActions: React.FC<RecommendationActionsProps> = ({
  recommendation,
  onAccept,
  onReject,
  isOffline,
  isSubmitting,
  userId,
}) => {
  const theme = useTheme<AppTheme>();
  const recommendationService = ContentRecommendationService.getInstance();
  const notInterestedHook = useNotInterestedItems(userId);

  const [serviceMenuVisible, setServiceMenuVisible] = useState(false);
  const [rejectDialogVisible, setRejectDialogVisible] = useState(false);
  const [infoDialogVisible, setInfoDialogVisible] = useState(false);
  const [selectedRejectionReason, setSelectedRejectionReason] = useState<
    string | null
  >(null);
  const [isAddingToService, setIsAddingToService] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
    undo?: () => void;
  } | null>(null);

  const isInLibrary = recommendation.availability?.inLibrary ?? false;
  const isInQueue = recommendation.availability?.inQueue ?? false;
  const availableServices =
    recommendation.availability?.availableServices ?? [];

  // Handle add to service
  const handleAddToService = useCallback(
    async (service: ServiceType) => {
      setServiceMenuVisible(false);
      setIsAddingToService(true);
      setActionFeedback(null);

      try {
        void logger.info("Adding recommendation to service", {
          recommendationId: recommendation.id,
          service,
          title: recommendation.title,
        });

        // Call the appropriate service method
        let result: { success: boolean; message: string; error?: string };
        switch (service) {
          case "sonarr":
            result = await recommendationService.addToSonarr(recommendation);
            break;
          case "radarr":
            result = await recommendationService.addToRadarr(recommendation);
            break;
          case "jellyseerr":
            result =
              await recommendationService.addToJellyseerr(recommendation);
            break;
        }

        if (result.success) {
          setActionFeedback({
            type: "success",
            message: result.message,
          });
          // Record acceptance
          await onAccept(recommendation);

          void logger.info("Successfully added recommendation to service", {
            recommendationId: recommendation.id,
            service,
          });
        } else {
          setActionFeedback({
            type: "error",
            message: result.message,
          });
        }
      } catch (error) {
        void logger.error("Failed to add recommendation to service", {
          recommendationId: recommendation.id,
          service,
          error: error instanceof Error ? error.message : String(error),
        });

        setActionFeedback({
          type: "error",
          message: "Failed to add to library. Please try again.",
        });
      } finally {
        setIsAddingToService(false);
      }
    },
    [recommendation, recommendationService, onAccept],
  );

  // Handle view in Jellyfin
  const handleViewInJellyfin = useCallback(async () => {
    try {
      void logger.info("Opening recommendation in Jellyfin", {
        recommendationId: recommendation.id,
        title: recommendation.title,
      });

      const result = await recommendationService.viewInJellyfin(recommendation);

      if (result.success) {
        // Record acceptance
        await onAccept(recommendation);
      } else {
        setActionFeedback({
          type: "error",
          message: result.message,
        });
      }
    } catch (error) {
      void logger.error("Failed to open in Jellyfin", {
        recommendationId: recommendation.id,
        error: error instanceof Error ? error.message : String(error),
      });

      setActionFeedback({
        type: "error",
        message: "Failed to open in Jellyfin.",
      });
    }
  }, [recommendation, recommendationService, onAccept]);

  // Handle rejection
  const handleReject = useCallback(async () => {
    if (!selectedRejectionReason) return;

    setRejectDialogVisible(false);

    try {
      const reasonLabel =
        REJECTION_REASONS.find((r) => r.value === selectedRejectionReason)
          ?.label ?? "Not interested";

      await onReject(recommendation, reasonLabel);

      setActionFeedback({
        type: "success",
        message: "Feedback recorded. We'll improve future recommendations.",
        undo: () => {
          void notInterestedHook.remove(recommendation.id!);
          setActionFeedback(null);
        },
      });

      void logger.info("Recommendation rejected", {
        recommendationId: recommendation.id,
        reason: reasonLabel,
      });
    } catch (error) {
      void logger.error("Failed to reject recommendation", {
        recommendationId: recommendation.id,
        error: error instanceof Error ? error.message : String(error),
      });

      setActionFeedback({
        type: "error",
        message: "Failed to record feedback.",
      });
    } finally {
      setSelectedRejectionReason(null);
    }
  }, [recommendation, selectedRejectionReason, onReject, notInterestedHook]);

  // Handle more info
  const handleMoreInfo = useCallback(() => {
    void logger.info("Viewing more info for recommendation", {
      recommendationId: recommendation.id,
      type: recommendation.type,
      title: recommendation.title,
    });

    setInfoDialogVisible(true);
  }, [recommendation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: spacing.sm,
        },
        buttonRow: {
          flexDirection: "row",
          gap: spacing.sm,
        },
        primaryButton: {
          flex: 1,
        },
        secondaryButton: {
          flex: 1,
        },
        iconButton: {
          margin: 0,
        },
        feedbackContainer: {
          padding: spacing.sm,
          borderRadius: 8,
          backgroundColor:
            actionFeedback?.type === "success"
              ? theme.colors.primaryContainer
              : theme.colors.errorContainer,
        },
        feedbackText: {
          fontSize: 13,
          color:
            actionFeedback?.type === "success"
              ? theme.colors.onPrimaryContainer
              : theme.colors.onErrorContainer,
        },
        dialogContent: {
          gap: spacing.md,
        },
        dialogTitle: {
          textAlign: "center",
        },
        radioGroup: {
          gap: spacing.xs,
        },
        radioItem: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: spacing.xs,
        },
        radioLabel: {
          flex: 1,
          marginLeft: spacing.sm,
        },
        dialogActions: {
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: spacing.sm,
          marginTop: spacing.md,
        },
      }),
    [theme, actionFeedback],
  );

  return (
    <View style={styles.container}>
      {/* Action feedback */}
      {actionFeedback && (
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackText}>{actionFeedback.message}</Text>
          {actionFeedback.undo && (
            <Button
              onPress={() => {
                actionFeedback.undo!();
              }}
              compact
              mode="text"
            >
              Undo
            </Button>
          )}
        </View>
      )}

      {/* Primary actions */}
      <View style={styles.buttonRow}>
        {isInLibrary ? (
          // View in Jellyfin button
          <Button
            mode="contained"
            icon="play-circle"
            onPress={handleViewInJellyfin}
            disabled={isOffline || isSubmitting}
            loading={isSubmitting}
            style={styles.primaryButton}
            accessibilityLabel="View in Jellyfin"
            accessibilityHint="Opens this content in Jellyfin"
          >
            View in Jellyfin
          </Button>
        ) : (
          // Add to Library button
          <>
            <Button
              mode="contained"
              icon="plus"
              onPress={() => {
                const firstService = availableServices[0];
                if (availableServices.length === 1 && firstService) {
                  void handleAddToService(firstService);
                } else {
                  setServiceMenuVisible(true);
                }
              }}
              disabled={
                isOffline ||
                isSubmitting ||
                isAddingToService ||
                availableServices.length === 0
              }
              loading={isAddingToService}
              style={styles.primaryButton}
              accessibilityLabel="Add to library"
              accessibilityHint="Adds this content to your library"
            >
              {isInQueue ? "In Queue" : "Add to Library"}
            </Button>

            {/* Service selection menu */}
            {availableServices.length > 1 && (
              <Menu
                visible={serviceMenuVisible}
                onDismiss={() => setServiceMenuVisible(false)}
                anchor={<View />}
              >
                {availableServices.map((service) => (
                  <Menu.Item
                    key={service}
                    onPress={() => void handleAddToService(service)}
                    title={service.charAt(0).toUpperCase() + service.slice(1)}
                    leadingIcon={
                      service === "sonarr"
                        ? "television"
                        : service === "radarr"
                          ? "movie"
                          : "download"
                    }
                  />
                ))}
              </Menu>
            )}
          </>
        )}

        {/* More info button */}
        <IconButton
          icon="information-outline"
          mode="contained-tonal"
          onPress={handleMoreInfo}
          disabled={isOffline}
          style={styles.iconButton}
          accessibilityLabel="More information"
          accessibilityHint="View detailed information about this content"
        />
      </View>

      {/* Secondary actions */}
      <View style={styles.buttonRow}>
        <Button
          mode="outlined"
          icon="close"
          onPress={() => setRejectDialogVisible(true)}
          disabled={isSubmitting}
          style={styles.secondaryButton}
          accessibilityLabel="Not interested"
          accessibilityHint="Mark this recommendation as not interested"
        >
          Not Interested
        </Button>
      </View>

      {/* Info dialog */}
      <Portal>
        <Dialog
          visible={infoDialogVisible}
          onDismiss={() => setInfoDialogVisible(false)}
        >
          <Dialog.Title style={styles.dialogTitle}>
            {recommendation.title}
          </Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text variant="bodyMedium">
              {recommendation.metadata.overview ||
                "No description available for this content."}
            </Text>

            {recommendation.metadata.genres.length > 0 && (
              <View>
                <Text
                  variant="labelMedium"
                  style={{ marginBottom: spacing.xs }}
                >
                  Genres
                </Text>
                <Text variant="bodySmall">
                  {recommendation.metadata.genres.join(", ")}
                </Text>
              </View>
            )}

            {recommendation.year && (
              <View>
                <Text
                  variant="labelMedium"
                  style={{ marginBottom: spacing.xs }}
                >
                  Release Year
                </Text>
                <Text variant="bodySmall">{recommendation.year}</Text>
              </View>
            )}

            {recommendation.metadata.rating > 0 && (
              <View>
                <Text
                  variant="labelMedium"
                  style={{ marginBottom: spacing.xs }}
                >
                  Rating
                </Text>
                <Text variant="bodySmall">
                  ⭐ {recommendation.metadata.rating.toFixed(1)} / 10
                </Text>
              </View>
            )}

            <View style={styles.dialogActions}>
              <Button onPress={() => setInfoDialogVisible(false)}>Close</Button>
            </View>
          </Dialog.Content>
        </Dialog>
      </Portal>

      {/* Rejection dialog */}
      <Portal>
        <Dialog
          visible={rejectDialogVisible}
          onDismiss={() => {
            setRejectDialogVisible(false);
            setSelectedRejectionReason(null);
          }}
        >
          <Dialog.Title style={styles.dialogTitle}>
            Why aren't you interested?
          </Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text variant="bodyMedium">
              Help us improve your recommendations by telling us why.
            </Text>

            <RadioButton.Group
              onValueChange={setSelectedRejectionReason}
              value={selectedRejectionReason ?? ""}
            >
              <View style={styles.radioGroup}>
                {REJECTION_REASONS.map((reason) => (
                  <View key={reason.value} style={styles.radioItem}>
                    <RadioButton value={reason.value} />
                    <Text style={styles.radioLabel}>{reason.label}</Text>
                  </View>
                ))}
              </View>
            </RadioButton.Group>

            <View style={styles.dialogActions}>
              <Button
                onPress={() => {
                  setRejectDialogVisible(false);
                  setSelectedRejectionReason(null);
                }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleReject}
                disabled={!selectedRejectionReason}
              >
                Submit
              </Button>
            </View>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </View>
  );
};
