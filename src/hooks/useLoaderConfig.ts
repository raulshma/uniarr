import { selectLoaderConfig, useSettingsStore } from "@/store/settingsStore";

export const useLoaderConfig = () => {
  const loaderConfig = useSettingsStore(selectLoaderConfig);
  const setLoaderConfig = useSettingsStore((state) => state.setLoaderConfig);

  return {
    loaderConfig,
    setLoaderConfig,
  };
};
