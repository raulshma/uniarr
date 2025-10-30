import { useAuth } from "@clerk/clerk-expo";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { OAuthCallbackLoader } from "@/components/auth/OAuthCallbackLoader";
import { initApp } from "@/services/bootstrap/appInit";
import { logger } from "@/services/logger/LoggerService";

const IndexScreen = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const [isOAuthCallback, setIsOAuthCallback] = useState(false);
  const [oauthStatus, setOauthStatus] = useState("Checking authentication...");
  const [loaderStatus, setLoaderStatus] = useState<
    "loading" | "success" | "failure"
  >("loading");
  const params = useLocalSearchParams();
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // Check if this is an OAuth callback by looking for typical OAuth parameters
    const hasOAuthParams = Boolean(
      params.code || params.state || params.error || params.error_description,
    );

    setIsOAuthCallback(hasOAuthParams);

    if (hasOAuthParams) {
      setOauthStatus("Processing Google sign-in...");
    }
  }, [params]);

  // Update loader status when auth state changes
  useEffect(() => {
    if (isOAuthCallback && isLoaded && isSignedIn) {
      setLoaderStatus("success");
    }
  }, [isLoaded, isSignedIn, isOAuthCallback]);

  // Initialize core services (storage, persister) once on mount.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initApp();
      } catch (err) {
        logger.error("[App Index]: Failed to initApp", {
          error: err,
          location: "AppIndexScreen",
        });
        // initApp logs errors; keep UI alive
      } finally {
        if (mounted) setAppReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Handle loader completion and redirect
  const handleLoaderComplete = () => {
    if (isSignedIn) {
      router.replace("/(auth)/dashboard");
    }
  };

  // If this is an OAuth callback, show loader while Clerk processes it
  if (isOAuthCallback) {
    // If auth is still loading, show loader
    if (!isLoaded) {
      return (
        <OAuthCallbackLoader
          message={oauthStatus}
          minShowTimeMs={1500}
          status={loaderStatus}
          onComplete={handleLoaderComplete}
        />
      );
    }

    // If auth is loaded and user is signed in, success!
    if (isSignedIn) {
      return (
        <OAuthCallbackLoader
          message="Sign-in successful! Redirecting to dashboard..."
          minShowTimeMs={1500}
          status={loaderStatus}
          onComplete={handleLoaderComplete}
        />
      );
    }

    // If auth is loaded but user is not signed in yet, show loader
    // Clerk is still processing the OAuth callback
    return (
      <OAuthCallbackLoader
        message={oauthStatus}
        minShowTimeMs={1500}
        status={loaderStatus}
        onComplete={handleLoaderComplete}
      />
    );
  }

  // If this is not an OAuth callback and auth is still loading, show loader
  if (!isLoaded) {
    return (
      <OAuthCallbackLoader
        message="Loading..."
        minShowTimeMs={1000}
        status={loaderStatus}
      />
    );
  }

  // Wait for app init (storage/persister) to be ready before proceeding
  if (!appReady) {
    return (
      <OAuthCallbackLoader
        message="Initializing app..."
        minShowTimeMs={800}
        status="loading"
      />
    );
  }

  // If user is signed in, let the root layout handle the redirect
  if (isSignedIn) {
    return (
      <OAuthCallbackLoader
        message="Already signed in! Redirecting..."
        minShowTimeMs={800}
        status="success"
        onComplete={() => router.replace("/(auth)/dashboard")}
      />
    );
  }

  // If user is not signed in, redirect to onboarding
  return <Redirect href="/(public)/onboarding" />;
};

export default IndexScreen;
