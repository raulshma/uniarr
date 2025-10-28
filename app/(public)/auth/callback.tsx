import { useEffect } from "react";
import { useRouter } from "expo-router";
import { logger } from "@/services/logger/LoggerService";
import { OAuthCallbackLoader } from "@/components/auth/OAuthCallbackLoader";

const OAuthCallbackScreen = () => {
  const router = useRouter();

  useEffect(() => {
    // Log the callback
    void logger.info("OAuth callback received", {
      location: "OAuthCallbackScreen",
      timestamp: new Date().toISOString(),
    });
  }, []);

  const handleLoaderComplete = () => {
    void logger.info("Redirecting to dashboard from OAuth callback", {
      location: "OAuthCallbackScreen",
    });
    router.replace("/(auth)/dashboard");
  };

  return (
    <OAuthCallbackLoader
      title="Completing Sign In"
      message="Verifying your credentials and logging you in..."
      minShowTimeMs={1500}
      status="loading"
      onComplete={handleLoaderComplete}
    />
  );
};

export default OAuthCallbackScreen;
