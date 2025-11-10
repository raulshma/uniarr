import React, { useCallback, useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text, useTheme } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import axios from "axios";

import type { AppTheme } from "@/constants/theme";
import { logger } from "@/services/logger/LoggerService";
import { useWeatherLocationStore } from "@/store/weatherLocationStore";
import { useSettingsStore } from "@/store/settingsStore";

export interface LocationMapResult {
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface GeocodeMapsCoResult {
  address?: {
    name?: string;
    state?: string;
    country?: string;
  };
}

const WeatherLocationMapSheet: React.FC = () => {
  const theme = useTheme<AppTheme>();
  const router = useRouter();
  const setSelectedLocationMap = useWeatherLocationStore(
    (state) => state.setSelectedLocationMap,
  );
  const byokGeocodeMapsCoApiKey = useSettingsStore(
    (state) => state.byokGeocodeMapsCoApiKey,
  );
  const { initialLatitude = "51.5074", initialLongitude = "-0.1278" } =
    useLocalSearchParams<{
      initialLatitude?: string;
      initialLongitude?: string;
    }>();

  const mapRef = useRef<MapView>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationInfo, setLocationInfo] = useState<LocationMapResult | null>(
    null,
  );

  const fetchLocationName = useCallback(
    async (latitude: number, longitude: number) => {
      setLoading(true);

      try {
        const response = await axios.get<GeocodeMapsCoResult>(
          `https://geocode.maps.co/reverse?lat=${latitude}&lon=${longitude}${byokGeocodeMapsCoApiKey ? `&api_key=${byokGeocodeMapsCoApiKey}` : ""}`,
          {
            timeout: 5000,
          },
        );

        if (response.data?.address) {
          const address = response.data.address;
          const coordsStr = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setLocationInfo({
            name: address.name || coordsStr,
            region: address.state || "",
            country: address.country || "",
            latitude,
            longitude,
          });
        } else {
          const coordsStr = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setLocationInfo({
            name: coordsStr,
            region: "",
            country: "",
            latitude,
            longitude,
          });
        }
      } catch (err) {
        logger.warn("Failed to fetch location name from coordinates:", {
          error: err instanceof Error ? err.message : String(err),
        });

        const coordsStr = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        setLocationInfo({
          name: coordsStr,
          region: "",
          country: "",
          latitude,
          longitude,
        });
      } finally {
        setLoading(false);
      }
    },
    [byokGeocodeMapsCoApiKey],
  );

  const handleMapPress = useCallback(
    (event: any) => {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      setSelectedLocation({ latitude, longitude });
      void fetchLocationName(latitude, longitude);
    },
    [fetchLocationName],
  );

  const handleCenterPress = useCallback(async () => {
    if (mapRef.current) {
      try {
        const center = await mapRef.current.getCamera();
        if (center) {
          setSelectedLocation({
            latitude: center.center.latitude,
            longitude: center.center.longitude,
          });
          void fetchLocationName(
            center.center.latitude,
            center.center.longitude,
          );
        }
      } catch (err) {
        logger.warn("Failed to get map center:", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }, [fetchLocationName]);

  const handleSelectLocation = useCallback(() => {
    if (!locationInfo) {
      Alert.alert("Error", "Please select a location first");
      return;
    }

    setSelectedLocationMap({
      latitude: locationInfo.latitude,
      longitude: locationInfo.longitude,
      name: locationInfo.name,
      region: locationInfo.region,
      country: locationInfo.country,
    });

    router.back();
  }, [locationInfo, setSelectedLocationMap, router]);

  const handleDismiss = useCallback(() => {
    router.back();
  }, [router]);

  const initialLatNum = parseFloat(initialLatitude);
  const initialLonNum = parseFloat(initialLongitude);
  const markerLatitude = selectedLocation?.latitude || initialLatNum;
  const markerLongitude = selectedLocation?.longitude || initialLonNum;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>
          Pick Location on Map
        </Text>
        <Pressable onPress={handleDismiss}>
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={theme.colors.onSurface}
          />
        </Pressable>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: initialLatNum,
            longitude: initialLonNum,
            latitudeDelta: 5,
            longitudeDelta: 5,
          }}
          onPress={handleMapPress}
          zoomEnabled
          scrollEnabled
          pitchEnabled={false}
          rotateEnabled={false}
        >
          {selectedLocation && (
            <Marker
              coordinate={{
                latitude: markerLatitude,
                longitude: markerLongitude,
              }}
              title="Selected Location"
              description={`${markerLatitude.toFixed(4)}, ${markerLongitude.toFixed(4)}`}
            />
          )}
        </MapView>

        <Pressable
          style={({ pressed }) => [
            styles.centerButton,
            {
              backgroundColor: pressed
                ? theme.colors.primaryContainer
                : theme.colors.primary,
            },
          ]}
          onPress={handleCenterPress}
        >
          <MaterialCommunityIcons
            name="crosshairs"
            size={24}
            color={theme.colors.onPrimary}
          />
        </Pressable>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}
      </View>

      {locationInfo && (
        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Text variant="labelSmall" style={styles.infoLabel}>
              Location:
            </Text>
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurface,
                flex: 1,
              }}
            >
              {locationInfo.name}
            </Text>
          </View>
          {locationInfo.region && (
            <View style={styles.infoRow}>
              <Text variant="labelSmall" style={styles.infoLabel}>
                Region:
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {locationInfo.region}
              </Text>
            </View>
          )}
          {locationInfo.country && (
            <View style={styles.infoRow}>
              <Text variant="labelSmall" style={styles.infoLabel}>
                Country:
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {locationInfo.country}
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text variant="labelSmall" style={styles.infoLabel}>
              Coordinates:
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
              {`${locationInfo.latitude.toFixed(4)}, ${locationInfo.longitude.toFixed(4)}`}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button onPress={handleDismiss}>Cancel</Button>
        <Button
          mode="contained"
          onPress={handleSelectLocation}
          disabled={!locationInfo || loading}
        >
          Select
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontWeight: "600",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  centerButton: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  infoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  infoLabel: {
    minWidth: 80,
    fontWeight: "600",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});

export default WeatherLocationMapSheet;
