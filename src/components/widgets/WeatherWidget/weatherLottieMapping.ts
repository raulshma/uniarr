/**
 * Mapping from weather condition text to Lottie animation filenames
 * Uses the weather-lottie assets from assets/icons/weather-lottie/
 * Covers all 49 weather conditions from WeatherAPI
 */

export const weatherLottieMapping: Record<string, string> = {
  // Clear/Sunny conditions (code 1000)
  Sunny: "time-afternoon.json",
  Clear: "time-night.json",

  // Cloudy conditions (codes 1003, 1006, 1009)
  "Partly cloudy": "time-afternoon.json",
  Cloudy: "time-afternoon.json",
  Overcast: "time-afternoon.json",

  // Mist/Fog conditions (codes 1030, 1135, 1147)
  Mist: "wind-snow.json",
  Fog: "wind-snow.json",
  "Freezing fog": "wind-snow.json",

  // Patchy precipitation possible (codes 1063, 1066, 1069, 1072)
  "Patchy rain possible": "umbrella.json",
  "Patchy snow possible": "thunderstorms-overcast-snow.json",
  "Patchy sleet possible": "thunderstorms-overcast-snow.json",
  "Patchy freezing drizzle possible": "umbrella-wind.json",

  // Thunderstorm conditions (codes 1087, 1273, 1276, 1279, 1282)
  "Thundery outbreaks possible": "thunderstorms.json",
  "Patchy light rain with thunder": "thunderstorms-rain.json",
  "Moderate or heavy rain with thunder": "thunderstorms-day-extreme-rain.json",
  "Patchy light snow with thunder": "thunderstorms-snow.json",
  "Moderate or heavy snow with thunder": "thunderstorms-day-extreme-snow.json",

  // Blowing snow/Blizzard (codes 1114, 1117)
  "Blowing snow": "thunderstorms-day-extreme-snow.json",
  Blizzard: "thunderstorms-day-extreme-snow.json",

  // Drizzle conditions (codes 1150, 1153, 1168, 1171)
  "Patchy light drizzle": "umbrella.json",
  "Light drizzle": "umbrella.json",
  "Freezing drizzle": "umbrella-wind.json",
  "Heavy freezing drizzle": "umbrella-wind.json",

  // Light rain (codes 1180, 1183)
  "Patchy light rain": "thunderstorms-rain.json",
  "Light rain": "thunderstorms-rain.json",

  // Moderate rain (codes 1186, 1189)
  "Moderate rain at times": "thunderstorms-rain.json",
  "Moderate rain": "thunderstorms-rain.json",

  // Heavy rain (codes 1192, 1195)
  "Heavy rain at times": "thunderstorms-day-extreme-rain.json",
  "Heavy rain": "thunderstorms-day-extreme-rain.json",

  // Freezing rain (codes 1198, 1201)
  "Light freezing rain": "umbrella-wind.json",
  "Moderate or heavy freezing rain": "umbrella-wind.json",

  // Sleet conditions (codes 1204, 1207)
  "Light sleet": "thunderstorms-overcast-snow.json",
  "Moderate or heavy sleet": "thunderstorms-day-snow.json",

  // Patchy snow (codes 1210, 1213, 1216, 1219, 1222, 1225)
  "Patchy light snow": "thunderstorms-snow.json",
  "Light snow": "thunderstorms-snow.json",
  "Patchy moderate snow": "thunderstorms-overcast-snow.json",
  "Moderate snow": "thunderstorms-day-snow.json",
  "Patchy heavy snow": "thunderstorms-day-extreme-snow.json",
  "Heavy snow": "thunderstorms-day-extreme-snow.json",

  // Ice pellets (code 1237)
  "Ice pellets": "thunderstorms-day-snow.json",

  // Rain showers (codes 1240, 1243, 1246)
  "Light rain shower": "thunderstorms-overcast-rain.json",
  "Moderate or heavy rain shower": "thunderstorms-day-extreme-rain.json",
  "Torrential rain shower": "thunderstorms-day-extreme-rain.json",

  // Sleet showers (codes 1249, 1252)
  "Light sleet showers": "thunderstorms-night-snow.json",
  "Moderate or heavy sleet showers": "thunderstorms-day-snow.json",

  // Snow showers (codes 1255, 1258)
  "Light snow showers": "thunderstorms-night-snow.json",
  "Moderate or heavy snow showers": "thunderstorms-day-extreme-snow.json",

  // Ice pellet showers (codes 1261, 1264)
  "Light showers of ice pellets": "thunderstorms-day-snow.json",
  "Moderate or heavy showers of ice pellets":
    "thunderstorms-day-extreme-snow.json",
};

/**
 * Map weather condition text to the appropriate Lottie animation filename
 * Falls back to a generic animation if condition not found
 */
export const mapConditionToLottie = (conditionText?: string): string => {
  if (!conditionText) return "time-afternoon.json";

  // Try exact match first
  if (weatherLottieMapping[conditionText]) {
    return weatherLottieMapping[conditionText];
  }

  // Try case-insensitive match
  const normalizedCondition = conditionText.toLowerCase();
  const matchedEntry = Object.entries(weatherLottieMapping).find(
    ([key]) => key.toLowerCase() === normalizedCondition,
  );

  if (matchedEntry) {
    return matchedEntry[1];
  }

  // Fallback logic based on condition keywords
  if (
    normalizedCondition.includes("thunder") ||
    normalizedCondition.includes("storm")
  ) {
    return "thunderstorms.json";
  }
  if (
    normalizedCondition.includes("snow") ||
    normalizedCondition.includes("sleet")
  ) {
    return "thunderstorms-snow.json";
  }
  if (
    normalizedCondition.includes("rain") ||
    normalizedCondition.includes("drizzle")
  ) {
    return "thunderstorms-rain.json";
  }
  if (
    normalizedCondition.includes("fog") ||
    normalizedCondition.includes("mist") ||
    normalizedCondition.includes("haze")
  ) {
    return "wind-snow.json";
  }
  if (normalizedCondition.includes("wind")) {
    return "wind.json";
  }
  if (
    normalizedCondition.includes("clear") ||
    normalizedCondition.includes("sunny")
  ) {
    return "time-afternoon.json";
  }
  if (
    normalizedCondition.includes("cloud") ||
    normalizedCondition.includes("overcast")
  ) {
    return "time-afternoon.json";
  }

  // Default fallback
  return "time-afternoon.json";
};
