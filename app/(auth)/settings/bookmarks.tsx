import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { UniArrLoader } from "@/components/common";
import { Text, useTheme } from "react-native-paper";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import type { AppTheme } from "@/constants/theme";
import BookmarksConfig from "@/components/widgets/BookmarksWidget/BookmarksConfig";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";

const BookmarksSettingsScreen: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const params = useLocalSearchParams<{ widgetId?: string }>();
  const [widget, setWidget] = useState<Widget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWidget = async () => {
      try {
        setLoading(true);
        setError(null);

        await widgetService.initialize();

        let targetWidget: Widget | undefined;
        if (params.widgetId && typeof params.widgetId === "string") {
          targetWidget = await widgetService.getWidget(params.widgetId);
        }

        if (!targetWidget) {
          const widgets = await widgetService.getWidgets();
          targetWidget = widgets.find((w) => w.type === "bookmarks");
        }

        if (!targetWidget) {
          setError("Bookmarks widget is not available.");
          return;
        }

        setWidget(targetWidget);
      } catch (err) {
        console.error("Failed to load bookmarks widget:", err);
        setError("Unable to load bookmarks widget configuration.");
      } finally {
        setLoading(false);
      }
    };

    void loadWidget();
  }, [params.widgetId]);

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.centerContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <UniArrLoader size={80} centered />
        <Text style={styles.statusText}>Loading bookmarks settings...</Text>
      </SafeAreaView>
    );
  }

  if (error || !widget) {
    return (
      <SafeAreaView
        style={[
          styles.centerContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Text style={[styles.statusText, { color: theme.colors.error }]}>
          {error ?? "Bookmarks widget not found."}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <BookmarksConfig
        visible
        isScreenMode
        widget={widget}
        onDismiss={() => {
          router.back();
        }}
        onSave={() => {
          router.back();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  statusText: {
    textAlign: "center",
    fontSize: 16,
  },
});

export default BookmarksSettingsScreen;
