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
}

export interface WeatherPayload {
  location: {
    name: string;
    region: string;
    country: string;
  };
  current: {
    temperature: number;
    feelsLike: number;
    condition: WeatherCondition;
    humidity: number;
    windKph: number;
    windMph: number;
    updatedAt: string;
  };
  forecast: WeatherDailyForecast[];
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

    return {
      location: {
        name: typeof location.name === "string" ? location.name : "",
        region: typeof location.region === "string" ? location.region : "",
        country: typeof location.country === "string" ? location.country : "",
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
        updatedAt:
          typeof current.last_updated === "string"
            ? new Date(current.last_updated).toISOString()
            : new Date().toISOString(),
      },
      forecast: forecastDays.map((day: any) => {
        const dayInfo = day?.day ?? {};
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
        } satisfies WeatherDailyForecast;
      }),
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
