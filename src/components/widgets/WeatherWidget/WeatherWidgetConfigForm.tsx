import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  HelperText,
  IconButton,
  SegmentedButtons,
  Text,
  TextInput,
} from "react-native-paper";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "expo-router";

import { useHaptics } from "@/hooks/useHaptics";
import { widgetService, type Widget } from "@/services/widgets/WidgetService";
import { widgetCredentialService } from "@/services/widgets/WidgetCredentialService";
import { deviceLocationService } from "@/services/location/DeviceLocationService";
import {
  fetchWeatherForecast,
  type WeatherUnits,
} from "@/services/widgets/dataProviders";
import { useWeatherLocationStore } from "@/store/weatherLocationStore";

const MODE_OPTIONS = ["device", "manual"] as const;
const UNIT_OPTIONS = ["metric", "imperial"] as const;
const FORECAST_OPTIONS = ["1", "2", "3", "4", "5", "6", "7"] as const;

const schema = z.object({
  apiKey: z.string().trim().min(1, "WeatherAPI key is required"),
  mode: z.enum(MODE_OPTIONS),
  locations: z.array(z.object({ value: z.string().trim().optional() })),
  units: z.enum(UNIT_OPTIONS),
  forecastDays: z.enum(FORECAST_OPTIONS),
});

type FormValues = z.infer<typeof schema>;

type WeatherWidgetConfigFormProps = {
  widget: Widget;
  onSaved: () => void;
};

const WeatherWidgetConfigForm: React.FC<WeatherWidgetConfigFormProps> = ({
  widget,
  onSaved,
}) => {
  const { onPress } = useHaptics();
  const router = useRouter();
  const selectedLocationSearch = useWeatherLocationStore(
    (state) => state.selectedLocationSearch,
  );
  const selectedLocationMap = useWeatherLocationStore(
    (state) => state.selectedLocationMap,
  );

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(0);
  const [apiKeyValue, setApiKeyValue] = useState("");

  const defaultValues = useMemo<FormValues>(() => {
    const locations = Array.isArray(widget.config?.locations)
      ? widget.config.locations
      : [];

    const forecastString =
      typeof widget.config?.forecastDays === "number"
        ? String(widget.config.forecastDays)
        : null;

    const forecastDays =
      FORECAST_OPTIONS.find((option) => option === forecastString) ?? "3";

    return {
      apiKey: "",
      mode:
        widget.config?.mode && MODE_OPTIONS.includes(widget.config.mode)
          ? widget.config.mode
          : "device",
      locations:
        locations.length > 0
          ? locations.map((value: string) => ({ value }))
          : [{ value: "" }],
      units:
        widget.config?.units && UNIT_OPTIONS.includes(widget.config.units)
          ? widget.config.units
          : "metric",
      forecastDays,
    } satisfies FormValues;
  }, [widget.config]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "locations",
  });

  const mode = watch("mode");

  const handleTestConfiguration = async (values: FormValues) => {
    setTestResult(null);
    setTesting(true);

    try {
      const trimmedLocations = values.locations
        .map((entry) => entry.value?.trim())
        .filter((entry): entry is string => Boolean(entry && entry.length > 0));

      let query: string | null = null;

      if (values.mode === "manual" && trimmedLocations.length > 0) {
        query = trimmedLocations[0]!;
      } else if (values.mode === "device") {
        const coords = await deviceLocationService.getCurrentLocation();
        if (coords) {
          query = `${coords.latitude},${coords.longitude}`;
        } else if (trimmedLocations.length > 0) {
          query = trimmedLocations[0]!;
        }
      }

      if (!query) {
        setTestResult({
          success: false,
          message:
            "No location available for testing. Please configure a location or allow device location access.",
        });
        return;
      }

      const units: WeatherUnits = values.units;
      const payload = await fetchWeatherForecast({
        apiKey: values.apiKey.trim(),
        query,
        days: Number(values.forecastDays),
        units,
      });

      if (payload) {
        setTestResult({
          success: true,
          message: `Weather data loaded successfully for ${payload.location.name}. Current temperature: ${Math.round(payload.current.temperature)}°${units === "imperial" ? "F" : "C"}`,
        });
      } else {
        setTestResult({
          success: false,
          message:
            "Failed to load weather data. Please check your API key and location.",
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unknown error occurred during testing.",
      });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    const loadCredentials = async () => {
      const credentials = await widgetCredentialService.getCredentials(
        widget.id,
      );
      if (credentials?.apiKey) {
        setValue("apiKey", credentials.apiKey, { shouldDirty: false });
        setApiKeyValue(credentials.apiKey);
      }
    };

    void loadCredentials();
  }, [setValue, widget.id]);

  // Handle location selection from search sheet
  useEffect(() => {
    if (selectedLocationSearch) {
      setValue(
        `locations.${selectedLocationIndex}.value`,
        `${selectedLocationSearch.latitude},${selectedLocationSearch.longitude}`,
        { shouldDirty: true },
      );
      onPress();
    }
  }, [selectedLocationSearch, selectedLocationIndex, setValue, onPress]);

  // Handle location selection from map sheet
  useEffect(() => {
    if (selectedLocationMap) {
      setValue(
        `locations.${selectedLocationIndex}.value`,
        `${selectedLocationMap.latitude},${selectedLocationMap.longitude}`,
        { shouldDirty: true },
      );
      onPress();
    }
  }, [selectedLocationMap, selectedLocationIndex, setValue, onPress]);

  const handleLocationSearch = (index: number) => {
    setSelectedLocationIndex(index);
    router.push({
      pathname: "/(auth)/+modal/weather-location-search",
      params: {
        apiKey: apiKeyValue,
      },
    });
  };

  const handleLocationMapPick = (index: number) => {
    setSelectedLocationIndex(index);
    const currentValue = watch(`locations.${index}.value`);
    let initialLat = 51.5074;
    let initialLon = -0.1278;

    if (currentValue) {
      const coords = currentValue.split(",");
      if (coords.length === 2) {
        const lat = parseFloat(coords[0]?.trim() || "");
        const lon = parseFloat(coords[1]?.trim() || "");
        if (!isNaN(lat) && !isNaN(lon)) {
          initialLat = lat;
          initialLon = lon;
        }
      }
    }

    router.push({
      pathname: "/(auth)/+modal/weather-location-map",
      params: {
        initialLatitude: String(initialLat),
        initialLongitude: String(initialLon),
      },
    });
  };

  const onSubmit = async (values: FormValues) => {
    const trimmedLocations = values.locations
      .map((entry) => entry.value?.trim())
      .filter((entry): entry is string => Boolean(entry && entry.length > 0));

    if (values.mode === "manual" && trimmedLocations.length === 0) {
      setSubmitError(
        "Add at least one manual location or switch to device mode",
      );
      return;
    }

    setSubmitError(null);

    try {
      setSaving(true);
      await widgetCredentialService.setCredentials(widget.id, {
        apiKey: values.apiKey.trim(),
      });

      await widgetService.updateWidget(widget.id, {
        config: {
          ...widget.config,
          mode: values.mode,
          locations: trimmedLocations,
          units: values.units,
          forecastDays: Number(values.forecastDays),
        },
      });

      await widgetService.clearWidgetData(widget.id);
      onSaved();
    } catch {
      setSubmitError("Failed to save weather settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        WeatherAPI key
      </Text>
      <Controller
        control={control}
        name="apiKey"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            mode="outlined"
            label="API key"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        )}
      />
      {errors.apiKey && (
        <HelperText type="error">{errors.apiKey.message}</HelperText>
      )}

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Location source
        </Text>
        <Controller
          control={control}
          name="mode"
          render={({ field: { value, onChange } }) => (
            <SegmentedButtons
              value={value}
              onValueChange={(next) => {
                onPress();
                onChange(next);
              }}
              buttons={MODE_OPTIONS.map((option) => ({
                value: option,
                label:
                  option === "device" ? "Use device location" : "Manual city",
              }))}
            />
          )}
        />
      </View>

      {mode === "manual" && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Manual locations
          </Text>
          <Text variant="bodyMedium" style={styles.sectionDescription}>
            Add cities or latitude/longitude pairs. The first entry is used.
          </Text>

          {fields.map((field, index) => (
            <View key={field.id} style={styles.row}>
              <Controller
                control={control}
                name={`locations.${index}.value`}
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    mode="outlined"
                    label={`Location ${index + 1}`}
                    value={value ?? ""}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    style={styles.flex}
                    placeholder="e.g. London or 37.77,-122.42"
                  />
                )}
              />
              <View style={styles.buttonGroup}>
                <IconButton
                  icon="magnify"
                  size={20}
                  onPress={() => handleLocationSearch(index)}
                />
                <IconButton
                  icon="map-marker"
                  size={20}
                  onPress={() => handleLocationMapPick(index)}
                />
                {fields.length > 1 && (
                  <IconButton
                    icon="delete"
                    onPress={() => {
                      onPress();
                      remove(index);
                    }}
                  />
                )}
              </View>
            </View>
          ))}

          <Button
            mode="outlined"
            icon="plus"
            onPress={() => {
              onPress();
              append({ value: "" });
            }}
          >
            Add Location
          </Button>
        </View>
      )}

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Units
        </Text>
        <Controller
          control={control}
          name="units"
          render={({ field: { value, onChange } }) => (
            <SegmentedButtons
              value={value}
              onValueChange={(next) => {
                onPress();
                onChange(next);
              }}
              buttons={UNIT_OPTIONS.map((option) => ({
                value: option,
                label: option === "metric" ? "Metric" : "Imperial",
              }))}
            />
          )}
        />
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Forecast length
        </Text>
        <Controller
          control={control}
          name="forecastDays"
          render={({ field: { value, onChange } }) => (
            <SegmentedButtons
              value={value}
              onValueChange={(next) => {
                onPress();
                onChange(next as FormValues["forecastDays"]);
              }}
              buttons={FORECAST_OPTIONS.map((option) => ({
                value: option,
                label: `${option} day${option === "1" ? "" : "s"}`,
              }))}
              style={styles.segmented}
            />
          )}
        />
      </View>

      {submitError && <HelperText type="error">{submitError}</HelperText>}

      <Button
        mode="outlined"
        onPress={handleSubmit(handleTestConfiguration)}
        loading={testing}
        disabled={testing}
        style={styles.testButton}
        icon="test-tube"
      >
        Test Configuration
      </Button>

      {testResult && (
        <HelperText type={testResult.success ? "info" : "error"}>
          {testResult.message}
        </HelperText>
      )}

      <Button
        mode="contained"
        onPress={handleSubmit(onSubmit)}
        loading={saving}
        disabled={saving || (!isDirty && !submitError)}
        style={styles.saveButton}
      >
        Save Changes
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingVertical: 16,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  sectionDescription: {
    opacity: 0.7,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  flex: {
    flex: 1,
  },
  segmented: {
    marginTop: 4,
  },
  testButton: {
    marginTop: 8,
  },
  saveButton: {
    marginTop: 8,
  },
});

export default WeatherWidgetConfigForm;
