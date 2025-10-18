import { useAuth } from "@clerk/clerk-expo";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { OAuthCallbackLoader } from "@/components/auth/OAuthCallbackLoader";

const IndexScreen = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const [isOAuthCallback, setIsOAuthCallback] = useState(false);
  const [oauthStatus, setOauthStatus] = useState("Checking authentication...");
  const params = useLocalSearchParams();

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

  // If this is an OAuth callback, show loader while Clerk processes it
  if (isOAuthCallback) {
    // If auth is still loading, show loader
    if (!isLoaded) {
      return <OAuthCallbackLoader message={oauthStatus} />;
    }

    // If auth is loaded and user is signed in, success!
    if (isSignedIn) {
      return (
        <OAuthCallbackLoader message="Sign-in successful! Redirecting to dashboard..." />
      );
    }

    // If auth is loaded but user is not signed in yet, show loader
    // Clerk is still processing the OAuth callback
    return <OAuthCallbackLoader message={oauthStatus} />;
  }

  // If this is not an OAuth callback and auth is still loading, show loader
  if (!isLoaded) {
    return <OAuthCallbackLoader message="Loading..." />;
  }

  // If user is signed in, let the root layout handle the redirect
  if (isSignedIn) {
    return <OAuthCallbackLoader message="Already signed in! Redirecting..." />;
  }

  // If user is not signed in, redirect to onboarding
  return <Redirect href="/(public)/onboarding" />;
};

export default IndexScreen;
