import { useSettingsStore } from "@/store/settingsStore";

const DEFAULT_SKIA_LOADER_CONFIG = {
  size: 80,
  strokeWidth: 10,
  duration: 1000,
  blur: 5,
  blurStyle: "outer" as const,
  colors: [
    "#FF0080", // Hot Pink
    "#FF1493", // Deep Pink
    "#FF69B4", // Hot Pink (lighter)
    "#00FFFF", // Electric Blue
    "#00BFFF", // Deep Sky Blue
    "#1E90FF", // Dodger Blue
    "#FF4500", // Neon Red
    "#FF6347", // Tomato
    "#FFA500", // Orange
    "#00FF7F", // Spring Green
    "#32CD32", // Lime Green
    "#00FA9A", // Medium Spring Green
    "#FF0080", // Hot Pink (repeat for smooth transition)
  ],
};

export const useSkiaLoaderConfig = () => {
  const skiaLoaderConfig = useSettingsStore((s) => s.skiaLoaderConfig);

  return skiaLoaderConfig ?? DEFAULT_SKIA_LOADER_CONFIG;
};
