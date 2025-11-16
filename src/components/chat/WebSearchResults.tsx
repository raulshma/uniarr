import React, { memo } from "react";
import { StyleSheet, View, Linking, Pressable } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

type WebSearchResultsProps = {
  results: WebSearchResult[];
};

const WebSearchResultsComponent: React.FC<WebSearchResultsProps> = ({
  results,
}) => {
  const theme = useTheme();

  const handleOpenUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch {
      // Silently fail
    }
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 12,
      padding: 12,
      marginVertical: 8,
      gap: 8,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: `${theme.colors.primary}20`,
      alignItems: "center",
      justifyContent: "center",
    },
    headerText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.onSurface,
    },
    resultItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 12,
      gap: 6,
    },
    resultTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primary,
      marginBottom: 4,
    },
    resultSnippet: {
      fontSize: 13,
      color: theme.colors.onSurface,
      lineHeight: 18,
    },
    resultUrl: {
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      marginTop: 4,
    },
    linkIcon: {
      marginLeft: 4,
    },
  });

  if (!results || results.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons
            name="web"
            size={18}
            color={theme.colors.primary}
          />
        </View>
        <Text style={styles.headerText}>
          Web Search Results ({results.length})
        </Text>
      </View>

      {results.map((result, index) => (
        <Pressable
          key={index}
          style={({ pressed }) => [
            styles.resultItem,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() => handleOpenUrl(result.url)}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.resultTitle} numberOfLines={2}>
              {result.title}
            </Text>
            <MaterialCommunityIcons
              name="open-in-new"
              size={14}
              color={theme.colors.primary}
              style={styles.linkIcon}
            />
          </View>
          <Text style={styles.resultSnippet} numberOfLines={3}>
            {result.snippet}
          </Text>
          <Text style={styles.resultUrl} numberOfLines={1}>
            {result.url}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

export const WebSearchResults = memo(WebSearchResultsComponent);
