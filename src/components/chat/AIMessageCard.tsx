import React, { useMemo } from "react";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import type { MD3Theme } from "react-native-paper/lib/typescript/types";
import type { Message } from "@/models/chat.types";

type Props = {
  message: Message;
  onAddToRadarr?: () => void;
  onShowCast?: () => void;
  onFindSimilar?: () => void;
};

export const AIMessageCard: React.FC<Props> = ({
  message,
  onAddToRadarr,
  onShowCast,
  onFindSimilar,
}) => {
  const theme = useTheme<MD3Theme>();
  const card = message.metadata?.card;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginTop: 12,
        },
        glassCard: {
          borderRadius: 20,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.25)",
          backgroundColor: "rgba(13,19,32,0.55)",
        },
        posterWrapper: {
          position: "relative",
          width: "100%",
          aspectRatio: 16 / 9,
          overflow: "hidden",
        },
        image: {
          width: "100%",
          height: "100%",
        },
        posterOverlay: {
          position: "absolute",
          inset: 0,
        },
        content: {
          padding: 16,
          gap: 8,
        },
        title: {
          fontSize: 20,
          fontWeight: "700",
          color: "white",
        },
        meta: {
          color: "rgba(255,255,255,0.75)",
          fontSize: 13,
        },
        overview: {
          color: "rgba(255,255,255,0.85)",
          fontSize: 14,
          lineHeight: 20,
        },
        actionsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          paddingHorizontal: 16,
          paddingBottom: 16,
        },
        actionButton: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.25)",
          backgroundColor: "rgba(255,255,255,0.08)",
          minWidth: 140,
        },
        actionPrimary: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
        actionLabel: {
          color: "rgba(255,255,255,0.9)",
          fontWeight: "600",
          marginLeft: 6,
        },
        actionLabelPrimary: {
          color: theme.colors.onPrimary,
        },
      }),
    [theme.colors.primary, theme.colors.onPrimary],
  );

  if (!card) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BlurView intensity={70} tint="dark" style={styles.glassCard}>
        {card.posterUrl ? (
          <View style={styles.posterWrapper}>
            <Image source={{ uri: card.posterUrl }} style={styles.image} />
            <LinearGradient
              colors={["rgba(2,4,20,0)", "rgba(2,4,20,0.85)"]}
              style={styles.posterOverlay}
            />
          </View>
        ) : null}

        <View style={styles.content}>
          <Text style={styles.title}>{card.title}</Text>
          <Text style={styles.meta}>
            {[card.year, card.genres?.length ? card.genres.join(" • ") : null]
              .filter(Boolean)
              .join(" • ")}
          </Text>
          {card.overview ? (
            <Text numberOfLines={3} style={styles.overview}>
              {card.overview}
            </Text>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={onAddToRadarr}
            style={[styles.actionButton, styles.actionPrimary]}
          >
            <MaterialIcons
              name="add"
              size={18}
              color={theme.colors.onPrimary}
            />
            <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>
              Add to Radarr
            </Text>
          </Pressable>
          <Pressable onPress={onShowCast} style={styles.actionButton}>
            <MaterialIcons name="groups" size={18} color="white" />
            <Text style={styles.actionLabel}>Show me the cast</Text>
          </Pressable>
          <Pressable onPress={onFindSimilar} style={styles.actionButton}>
            <MaterialIcons name="travel-explore" size={18} color="white" />
            <Text style={styles.actionLabel}>Find similar</Text>
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
};

export default AIMessageCard;
