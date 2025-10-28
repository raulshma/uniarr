import axios from "axios";

import { logger } from "@/services/logger/LoggerService";
import { handleApiError } from "@/utils/error.utils";

export type WeatherUnits = "metric" | "imperial";

export interface WeatherCondition {
  text: string;
  icon: string;
  code: number;
}

export interface WeatherDailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  condition: WeatherCondition;
  chanceOfRain: number;
  sunrise?: string;
  sunset?: string;
}

export interface WeatherHourlyForecast {
  time: string;
  temperature: number;
  feelsLike: number;
  condition: WeatherCondition;
  chanceOfRain: number;
  humidity: number;
  windKph: number;
  windMph: number;
  uvIndex: number;
}

export interface WeatherAstronomy {
  sunrise?: string;
  sunset?: string;
  moonrise?: string;
  moonset?: string;
}

export interface WeatherPayload {
  location: {
    name: string;
    region: string;
    country: string;
    timezone: string;
  };
  current: {
    temperature: number;
    feelsLike: number;
    condition: WeatherCondition;
    humidity: number;
    windKph: number;
    windMph: number;
    pressureMb: number;
    pressureIn: number;
    uvIndex: number;
    precipitationMm: number;
    precipitationIn: number;
    cloudCover: number;
    updatedAt: string;
  };
  forecast: WeatherDailyForecast[];
  hourly: WeatherHourlyForecast[];
  astronomy: WeatherAstronomy | null;
}

export interface FetchWeatherOptions {
  apiKey: string;
  query: string;
  days?: number;
  units?: WeatherUnits;
}

export const fetchWeatherForecast = async ({
  apiKey,
  query,
  days = 3,
  units = "metric",
}: FetchWeatherOptions): Promise<WeatherPayload | null> => {
  if (!apiKey || !query) {
    return null;
  }

  const params = new URLSearchParams({
    key: apiKey,
    q: query,
    days: String(Math.min(Math.max(days, 1), 3)),
    aqi: "no",
    alerts: "no",
  });

  try {
    const response = await axios.get(
      "https://api.weatherapi.com/v1/forecast.json",
      {
        timeout: 8000,
        params,
      },
    );

    const payload = response.data;
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const location = payload.location ?? {};
    const current = payload.current ?? {};

    const convertTemp = (tempC: number, tempF: number): number => {
      if (units === "imperial") {
        return typeof tempF === "number" ? tempF : tempC * 1.8 + 32;
      }
      return tempC;
    };

    const forecastDays = Array.isArray(payload.forecast?.forecastday)
      ? payload.forecast.forecastday
      : [];

    const primaryForecastDay = forecastDays[0] ?? {};
    const astronomyRaw = primaryForecastDay?.astro ?? {};

    const hourlyForecast: WeatherHourlyForecast[] = Array.isArray(
      primaryForecastDay?.hour,
    )
      ? primaryForecastDay.hour.map((hourItem: any) => {
          const hourCondition = hourItem?.condition ?? {};
          return {
            time:
              typeof hourItem.time_epoch === "number"
                ? new Date(hourItem.time_epoch * 1000).toISOString()
                : typeof hourItem.time === "string"
                  ? new Date(hourItem.time).toISOString()
                  : new Date().toISOString(),
            temperature: convertTemp(hourItem.temp_c, hourItem.temp_f),
            feelsLike: convertTemp(hourItem.feelslike_c, hourItem.feelslike_f),
            condition: {
              text:
                typeof hourCondition.text === "string"
                  ? hourCondition.text
                  : "",
              icon:
                typeof hourCondition.icon === "string"
                  ? `https:${hourCondition.icon}`
                  : "",
              code:
                typeof hourCondition.code === "number" ? hourCondition.code : 0,
            },
            chanceOfRain:
              typeof hourItem.chance_of_rain === "number"
                ? hourItem.chance_of_rain
                : typeof hourItem.chance_of_snow === "number"
                  ? hourItem.chance_of_snow
                  : 0,
            humidity:
              typeof hourItem.humidity === "number" ? hourItem.humidity : 0,
            windKph:
              typeof hourItem.wind_kph === "number" ? hourItem.wind_kph : 0,
            windMph:
              typeof hourItem.wind_mph === "number" ? hourItem.wind_mph : 0,
            uvIndex:
              typeof hourItem.uv === "number"
                ? hourItem.uv
                : typeof hourItem.uv_index === "number"
                  ? hourItem.uv_index
                  : 0,
          } satisfies WeatherHourlyForecast;
        })
      : [];

    return {
      location: {
        name: typeof location.name === "string" ? location.name : "",
        region: typeof location.region === "string" ? location.region : "",
        country: typeof location.country === "string" ? location.country : "",
        timezone: typeof location.tz_id === "string" ? location.tz_id : "UTC",
      },
      current: {
        temperature: convertTemp(current.temp_c, current.temp_f),
        feelsLike: convertTemp(current.feelslike_c, current.feelslike_f),
        condition: {
          text:
            typeof current.condition?.text === "string"
              ? current.condition.text
              : "",
          icon:
            typeof current.condition?.icon === "string"
              ? `https:${current.condition.icon}`
              : "",
          code:
            typeof current.condition?.code === "number"
              ? current.condition.code
              : 0,
        },
        humidity: typeof current.humidity === "number" ? current.humidity : 0,
        windKph: typeof current.wind_kph === "number" ? current.wind_kph : 0,
        windMph: typeof current.wind_mph === "number" ? current.wind_mph : 0,
        pressureMb:
          typeof current.pressure_mb === "number" ? current.pressure_mb : 0,
        pressureIn:
          typeof current.pressure_in === "number" ? current.pressure_in : 0,
        uvIndex: typeof current.uv === "number" ? current.uv : 0,
        precipitationMm:
          typeof current.precip_mm === "number" ? current.precip_mm : 0,
        precipitationIn:
          typeof current.precip_in === "number" ? current.precip_in : 0,
        cloudCover: typeof current.cloud === "number" ? current.cloud : 0,
        updatedAt:
          typeof current.last_updated === "string"
            ? new Date(current.last_updated).toISOString()
            : new Date().toISOString(),
      },
      forecast: forecastDays.map((day: any) => {
        const dayInfo = day?.day ?? {};
        const astroInfo = day?.astro ?? {};
        return {
          date: typeof day.date === "string" ? day.date : "",
          maxTemp: convertTemp(dayInfo.maxtemp_c, dayInfo.maxtemp_f),
          minTemp: convertTemp(dayInfo.mintemp_c, dayInfo.mintemp_f),
          condition: {
            text:
              typeof dayInfo.condition?.text === "string"
                ? dayInfo.condition.text
                : "",
            icon:
              typeof dayInfo.condition?.icon === "string"
                ? `https:${dayInfo.condition.icon}`
                : "",
            code:
              typeof dayInfo.condition?.code === "number"
                ? dayInfo.condition.code
                : 0,
          },
          chanceOfRain:
            typeof dayInfo.daily_chance_of_rain === "number"
              ? dayInfo.daily_chance_of_rain
              : typeof dayInfo.daily_chance_of_snow === "number"
                ? dayInfo.daily_chance_of_snow
                : 0,
          sunrise:
            typeof astroInfo.sunrise === "string"
              ? astroInfo.sunrise
              : undefined,
          sunset:
            typeof astroInfo.sunset === "string" ? astroInfo.sunset : undefined,
        } satisfies WeatherDailyForecast;
      }),
      hourly: hourlyForecast,
      astronomy: (() => {
        const astronomyData: WeatherAstronomy = {
          sunrise:
            typeof astronomyRaw.sunrise === "string"
              ? astronomyRaw.sunrise
              : undefined,
          sunset:
            typeof astronomyRaw.sunset === "string"
              ? astronomyRaw.sunset
              : undefined,
          moonrise:
            typeof astronomyRaw.moonrise === "string"
              ? astronomyRaw.moonrise
              : undefined,
          moonset:
            typeof astronomyRaw.moonset === "string"
              ? astronomyRaw.moonset
              : undefined,
        };

        if (
          astronomyData.sunrise ||
          astronomyData.sunset ||
          astronomyData.moonrise ||
          astronomyData.moonset
        ) {
          return astronomyData;
        }
        return null;
      })(),
    } satisfies WeatherPayload;
  } catch (error) {
    const apiError = handleApiError(error, {
      operation: "fetchWeatherForecast",
      endpoint: "weatherapi.com/v1/forecast.json",
    });
    void logger.warn("weatherProvider: failed to load forecast", {
      message: apiError.message,
    });
    return null;
  }
};
