import type { WeatherPayload } from "@/services/widgets/dataProviders/weatherProvider";

export type WeatherBackdropCondition =
  | "clear"
  | "clouds"
  | "rain"
  | "drizzle"
  | "snow"
  | "thunderstorm"
  | "fog";

export interface BackdropMappingInput {
  weather: Pick<WeatherPayload, "current" | "astronomy" | "location">;
}

export interface BackdropMappingResult {
  condition: WeatherBackdropCondition;
  isDaytime: boolean;
  intensity: "low" | "medium" | "high";
}

export const mapWeatherToBackdrop = ({
  weather,
}: BackdropMappingInput): BackdropMappingResult => {
  const text = (weather.current?.condition?.text ?? "").toLowerCase();
  const precipMm = weather.current?.precipitationMm ?? 0;
  const cloudCover = weather.current?.cloudCover ?? 0;

  // Rough day/night inference using astronomy when available
  const now = new Date();
  const sunrise = weather.astronomy?.sunrise
    ? parseAstronomyTimeToToday(weather.astronomy.sunrise)
    : undefined;
  const sunset = weather.astronomy?.sunset
    ? parseAstronomyTimeToToday(weather.astronomy.sunset)
    : undefined;
  const isDaytime = sunrise && sunset ? now >= sunrise && now <= sunset : true;

  let condition: WeatherBackdropCondition = "clear";
  if (includesAny(text, ["thunder", "storm"])) {
    condition = "thunderstorm";
  } else if (includesAny(text, ["snow", "sleet", "blizzard"])) {
    condition = "snow";
  } else if (includesAny(text, ["drizzle"])) {
    condition = "drizzle";
  } else if (includesAny(text, ["rain", "shower"])) {
    condition = "rain";
  } else if (includesAny(text, ["fog", "mist", "haze", "smoke"])) {
    condition = "fog";
  } else if (includesAny(text, ["overcast", "cloud"])) {
    condition = "clouds";
  } else {
    condition = "clear";
  }

  const intensity = computeIntensity(condition, precipMm, cloudCover);

  return { condition, isDaytime, intensity };
};

const computeIntensity = (
  condition: WeatherBackdropCondition,
  precipMm: number,
  cloudCover: number,
): "low" | "medium" | "high" => {
  switch (condition) {
    case "rain":
    case "drizzle":
      if (precipMm >= 6) return "high";
      if (precipMm >= 2) return "medium";
      return "low";
    case "snow":
      if (precipMm >= 4) return "high";
      if (precipMm >= 1) return "medium";
      return "low";
    case "thunderstorm":
      return precipMm >= 2 ? "high" : "medium";
    case "clouds":
      if (cloudCover >= 80) return "high";
      if (cloudCover >= 40) return "medium";
      return "low";
    case "fog":
      return cloudCover >= 50 ? "medium" : "low";
    case "clear":
    default:
      return "low";
  }
};

const includesAny = (text: string, needles: string[]): boolean =>
  needles.some((n) => text.includes(n));

function parseAstronomyTimeToToday(hhmm: string): Date | undefined {
  // Accept formats like "6:45 AM" or "18:12 PM" (WeatherAPI style)
  const match = hhmm.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*$/i);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const suffix = (match[3] ?? "").toUpperCase();

  let h24 = hours;
  if (suffix === "PM" && hours < 12) h24 = hours + 12;
  if (suffix === "AM" && hours === 12) h24 = 0;

  const d = new Date();
  d.setHours(h24, minutes, 0, 0);
  return d;
}
