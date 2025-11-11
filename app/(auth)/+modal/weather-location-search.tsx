import React, { useCallback, useState, useRef } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, TextInput, useTheme, Divider } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import axios, { isAxiosError } from "axios";

import type { AppTheme } from "@/constants/theme";
import { useWeatherLocationStore } from "@/store/weatherLocationStore";
import { useSettingsStore } from "@/store/settingsStore";
import { logger } from "@/services/logger/LoggerService";

export interface LocationSearchResult {
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface GeocodeMapsCoResult {
  lat: string;
  lon: string;
  name?: string;
  address?: {
    name?: string;
    county?: string;
    state?: string;
    country?: string;
    city?: string;
  };
}

interface StructuredSearchFields {
  street?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  postalcode?: string;
  amenity?: string;
}

const WeatherLocationSearchSheet: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const setSelectedLocationSearch = useWeatherLocationStore(
    (state) => state.setSelectedLocationSearch,
  );
  const byokGeocodeMapsCoApiKey = useSettingsStore(
    (state) => state.byokGeocodeMapsCoApiKey,
  );
  const { apiKey } = useLocalSearchParams<{
    apiKey?: string;
  }>();

  // Use BYOK key if available, otherwise fall back to passed apiKey
  const effectiveGeocodeApiKey = byokGeocodeMapsCoApiKey || apiKey;

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const searchLocations = useCallback(
    async (query: string, fields?: StructuredSearchFields) => {
      if (!query.trim() && !fields) {
        setResults([]);
        setError(null);
        return;
      }

      if (!effectiveGeocodeApiKey) {
        setError("Geocoding API key not configured");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        setHasSearched(true);
        // Check if query is coordinates (lat,lon format)
        const coordMatch = query
          .trim()
          .match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);

        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]!);
          const lon = parseFloat(coordMatch[2]!);

          if (
            !isNaN(lat) &&
            !isNaN(lon) &&
            lat >= -90 &&
            lat <= 90 &&
            lon >= -180 &&
            lon <= 180
          ) {
            // Use reverse geocoding for coordinates
            const geoResponse = await axios.get<GeocodeMapsCoResult[]>(
              `https://geocode.maps.co/reverse`,
              {
                params: {
                  lat,
                  lon,
                  api_key: effectiveGeocodeApiKey,
                  addressdetails: 1,
                },
                timeout: 5000,
              },
            );

            const result = geoResponse.data?.[0];
            if (result) {
              const location: LocationSearchResult = {
                name:
                  result.address?.name ||
                  result.name ||
                  `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                region: result.address?.state || result.address?.county || "",
                country: result.address?.country || "",
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
              };
              setResults([location]);
            } else {
              setResults([]);
            }
            return;
          }
        }

        // Use forward geocoding with either free-form or structured search
        const params: Record<string, unknown> = {
          api_key: effectiveGeocodeApiKey,
          addressdetails: 1,
          limit: 10,
        };

        if (fields && Object.values(fields).some((v) => v)) {
          // Structured search - use individual fields
          if (fields.street) params.street = fields.street;
          if (fields.city) params.city = fields.city;
          if (fields.county) params.county = fields.county;
          if (fields.state) params.state = fields.state;
          if (fields.country) params.country = fields.country;
          if (fields.postalcode) params.postalcode = fields.postalcode;
          if (fields.amenity) params.amenity = fields.amenity;
        } else {
          // Free-form search
          params.q = query;
        }

        const response = await axios.get<GeocodeMapsCoResult[]>(
          "https://geocode.maps.co/search",
          { params, timeout: 5000 },
        );

        if (Array.isArray(response.data) && response.data.length > 0) {
          const locations = response.data.map((result) => ({
            name:
              result.address?.name ||
              result.address?.city ||
              result.name ||
              "Unknown Location",
            region: result.address?.state || result.address?.county || "",
            country: result.address?.country || "",
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
          }));
          setResults(locations);
        } else {
          setResults([]);
        }
      } catch (err) {
        if (isAxiosError(err)) {
          if (err.response?.status === 400) {
            setError("Invalid search query");
          } else if (err.response?.status === 403) {
            setError("API key invalid or rate limited");
          } else {
            setError("Failed to search locations. Please try again.");
          }
        } else {
          setError("An error occurred while searching.");
          logger.warn("Location search error:", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [effectiveGeocodeApiKey],
  );

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!text.trim()) {
        setResults([]);
        setError(null);
        setHasSearched(false);
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        void searchLocations(text);
      }, 500);
    },
    [searchLocations],
  );

  const handleLocationSelect = useCallback(
    (location: LocationSearchResult) => {
      setSelectedLocationSearch({
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.name,
        region: location.region,
        country: location.country,
      });
      router.back();
    },
    [setSelectedLocationSearch, router],
  );

  const renderLocationItem = useCallback(
    ({ item }: { item: LocationSearchResult }) => (
      <Pressable
        onPress={() => handleLocationSelect(item)}
        style={({ pressed }) => ({
          backgroundColor: pressed
            ? theme.colors.surfaceVariant
            : theme.colors.surface,
        })}
      >
        <View style={styles.locationItem}>
          <View style={styles.locationIconColumn}>
            <MaterialCommunityIcons
              name="map-marker"
              size={22}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.locationInfo}>
            <Text
              variant="titleSmall"
              style={{ fontWeight: "600", color: theme.colors.onSurface }}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
              numberOfLines={1}
            >
              {[item.region, item.country].filter(Boolean).join(" • ")}
            </Text>
            <View style={styles.coordsRow}>
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={14}
                color={theme.colors.primary}
              />
              <Text
                variant="labelSmall"
                style={{
                  color: theme.colors.primary,
                  marginLeft: 4,
                }}
              >
                {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={theme.colors.onSurfaceVariant}
          />
        </View>
        <Divider />
      </Pressable>
    ),
    [theme, handleLocationSelect],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>
          Search Location
        </Text>
        <Pressable onPress={() => router.back()}>
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={theme.colors.onSurface}
          />
        </Pressable>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          mode="outlined"
          placeholder="Search by city, address or coordinates"
          value={searchQuery}
          onChangeText={handleSearchChange}
          style={styles.searchInput}
          autoFocus
          editable={!loading}
          left={<TextInput.Icon icon="magnify" />}
          right={
            loading ? (
              <TextInput.Icon
                icon={() => (
                  <ActivityIndicator
                    color={theme.colors.primary}
                    size="small"
                  />
                )}
              />
            ) : searchQuery ? (
              <TextInput.Icon
                icon="close"
                onPress={() => {
                  if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                  }
                  setSearchQuery("");
                  setResults([]);
                  setError(null);
                  setHasSearched(false);
                }}
              />
            ) : undefined
          }
        />
        {!hasSearched && !searchQuery && !error && (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
          >
            Type a city, address, or paste "lat,lon" (e.g. 40.7128,-74.0060).
          </Text>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={20}
            color={theme.colors.error}
          />
          <Text
            variant="bodySmall"
            style={{
              color: theme.colors.error,
              flex: 1,
              marginLeft: 8,
            }}
          >
            {error}
          </Text>
        </View>
      )}

      {results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderLocationItem}
          keyExtractor={(item) => `${item.latitude},${item.longitude}`}
          scrollEnabled
          keyboardShouldPersistTaps="handled"
          style={styles.resultsList}
        />
      ) : hasSearched && !loading && searchQuery.trim() && !error ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="magnify"
            size={40}
            color={theme.colors.surfaceVariant}
          />
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
          >
            No locations found
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontWeight: "600",
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    marginBottom: 8,
  },
  resultsList: {
    flex: 1,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 0,
    paddingVertical: 12,
    columnGap: 10,
  },
  locationIconColumn: {
    width: 26,
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 2,
  },
  locationInfo: {
    flex: 1,
    gap: 2,
  },
  coordsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: "row",
    paddingVertical: 12,
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
});

export default WeatherLocationSearchSheet;
