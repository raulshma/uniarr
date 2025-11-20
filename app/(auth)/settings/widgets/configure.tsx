import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useTheme } from "@/hooks/useTheme";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import {
  AnimatedScrollView,
  AnimatedSection,
  UniArrLoader,
} from "@/components/common";
import { TabHeader } from "@/components/common/TabHeader";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import RssWidgetConfigForm from "@/components/widgets/RssWidget/RssWidgetConfigForm";
import RedditWidgetConfigForm from "@/components/widgets/RedditWidget/RedditWidgetConfigForm";
import WeatherWidgetConfigForm from "@/components/widgets/WeatherWidget/WeatherWidgetConfigForm";
import YouTubeWidgetConfigForm from "@/components/widgets/YouTubeWidget/YouTubeWidgetConfigForm";
import TwitchWidgetConfigForm from "@/components/widgets/TwitchWidget/TwitchWidgetConfigForm";
import ShortcutsWidgetConfigForm from "@/components/widgets/ShortcutsWidget/ShortcutsWidgetConfigForm";
import ServiceStatusWidgetConfigForm from "@/components/widgets/ServiceStatusWidget/ServiceStatusWidgetConfigForm";
import StatisticsWidgetConfigForm from "@/components/widgets/StatisticsWidget/StatisticsWidgetConfigForm";
import CalendarPreviewWidgetConfigForm from "@/components/widgets/CalendarPreviewWidget/CalendarPreviewWidgetConfigForm";
import DownloadProgressWidgetConfigForm from "@/components/widgets/DownloadProgressWidget/DownloadProgressWidgetConfigForm";
import HackerNewsWidgetConfigForm from "@/components/widgets/HackerNewsWidget/HackerNewsWidgetConfigForm";
import RecommendationsWidgetConfigForm from "@/components/widgets/RecommendationsWidget/RecommendationsWidgetConfigForm";

const WidgetConfigureScreen: React.FC = () => {
  const params = useLocalSearchParams<{ widgetId?: string }>();
  const theme = useTheme();
  const [widget, setWidget] = useState<Widget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWidget = async () => {
      try {
        setLoading(true);
        setError(null);

        await widgetService.initialize();

        let result: Widget | undefined;
        if (params.widgetId && typeof params.widgetId === "string") {
          result = await widgetService.getWidget(params.widgetId);
        }

        if (!result) {
          const widgets = await widgetService.getWidgets();
          result = widgets.find((w) => w.id === params.widgetId);
        }

        if (!result) {
          setError("Widget not found");
          return;
        }

        setWidget(result);
      } catch {
        setError("Unable to load widget settings");
      } finally {
        setLoading(false);
      }
    };

    void loadWidget();
  }, [params.widgetId]);

  const handleClose = () => {
    router.back();
  };

  const handleSaved = useCallback(async () => {
    await widgetService.refreshWidgetsFromStorage();
    router.back();
  }, []);

  const form = useMemo(() => {
    if (!widget) {
      return null;
    }

    switch (widget.type) {
      case "rss-feed":
        return <RssWidgetConfigForm widget={widget} onSaved={handleSaved} />;
      case "subreddit":
        return <RedditWidgetConfigForm widget={widget} onSaved={handleSaved} />;
      case "weather":
        return (
          <WeatherWidgetConfigForm widget={widget} onSaved={handleSaved} />
        );
      case "youtube":
        return (
          <YouTubeWidgetConfigForm widget={widget} onSaved={handleSaved} />
        );
      case "twitch":
        return <TwitchWidgetConfigForm widget={widget} onSaved={handleSaved} />;
      case "shortcuts":
        return (
          <ShortcutsWidgetConfigForm widget={widget} onSaved={handleSaved} />
        );
      case "service-status":
        return (
          <ServiceStatusWidgetConfigForm
            widget={widget}
            onSaved={handleSaved}
          />
        );
      case "statistics":
        return (
          <StatisticsWidgetConfigForm widget={widget} onSaved={handleSaved} />
        );
      case "calendar-preview":
        return (
          <CalendarPreviewWidgetConfigForm
            widget={widget}
            onSaved={handleSaved}
          />
        );
      case "download-progress":
        return (
          <DownloadProgressWidgetConfigForm
            widget={widget}
            onSaved={handleSaved}
          />
        );
      case "hacker-news":
        return (
          <HackerNewsWidgetConfigForm widget={widget} onSaved={handleSaved} />
        );
      case "recommendations":
        return (
          <RecommendationsWidgetConfigForm
            widget={widget}
            onConfigChange={handleSaved}
          />
        );
      default:
        return (
          <View style={styles.placeholderContainer}>
            <Text
              variant="bodyLarge"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              This widget does not have configurable options yet.
            </Text>
          </View>
        );
    }
  }, [handleSaved, theme.colors.onSurfaceVariant, widget]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <TabHeader
        title={widget?.title ?? "Widget Settings"}
        leftAction={{ icon: "arrow-left", onPress: handleClose }}
        showTitle
      />

      {loading ? (
        <View style={styles.centered}>
          <UniArrLoader size={80} />
          <Text
            style={[
              styles.helperText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Loading widget...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.helperText, { color: theme.colors.error }]}>
            {error}
          </Text>
        </View>
      ) : (
        <AnimatedScrollView contentContainerStyle={styles.scrollContainer}>
          <AnimatedSection>{form}</AnimatedSection>
        </AnimatedScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  helperText: {
    textAlign: "center",
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  placeholderContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
});

export default WidgetConfigureScreen;
