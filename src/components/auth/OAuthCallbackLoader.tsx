import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import {
  Animated,
  ANIMATION_DURATIONS,
  shouldAnimateLayout,
} from "@/utils/animations.utils";

interface OAuthCallbackLoaderProps {
  message?: string;
  title?: string;
  minShowTimeMs?: number;
  onComplete?: () => void;
  status?: "loading" | "success" | "failure";
}

// Developer quotes about UniArr and development wisdom
const DEVELOPER_QUOTES = [
  "Loading your unified media dashboard... because managing Sonarr, Radarr, and qBittorrent separately is so 2023.",
  "While you wait, remember: the best error message is the one that never appears.",
  "Connecting to your media empire... because one dashboard to rule them all is the way to go!",
  "Loading... because good things come to those who wait, and great code comes to those who debug.",
  "Please hold while we turn your scattered services into one beautiful dashboard. Poof! ✨",
  "Debugging is like being the detective in a crime movie where you are also the murderer.",
  "Loading your release calendar... because knowing when your favorite shows/movies drop is half the battle.",
  "While waiting, ponder this: 'There are only two hard things in Computer Science: cache invalidation and naming things.' - Phil Karlton",
  "Connecting to VPN diagnostics... because who doesn't love a good network health check?",
  "Loading... because even developers need coffee breaks sometimes ☕",
  "Patience is a virtue, but so is a good loading animation.",
  "Loading Jellyseerr integration... because requesting media should be as easy as liking a post.",
  "While you wait, here's a fun fact: the first computer bug was an actual bug - a moth stuck in a relay.",
  "Loading... because great apps are worth the wait, and mediocre ones load instantly.",
  "Remember: 'First, solve the problem. Then, write the code.' - John Johnson",
  "Connecting all your services... because why manage four apps when you can manage one?",
  "Loading... because we're connecting the dots, not just drawing them.",
  "While waiting, reflect: 'Code is poetry written in logic.' - Unknown",
  "Loading VPN diagnostics... because network issues are like ninjas - they strike when you least expect them.",
  "Loading... because authentication is like dating - it takes time to find the right match.",
  "Syncing your media libraries... because nothing says 'organized' like seeing all your content in one place.",
  "Loading release calendar... because anticipation is the best part of any media binge.",
  "Connecting to qBittorrent... because downloading should be as smooth as streaming.",
  "Loading... because building a unified dashboard is like herding cats, but way more rewarding.",
  "While you wait, think about this: your media collection just got a whole lot smarter.",
  "Loading Jellyseerr requests... because democracy in media selection is beautiful.",
  "Connecting services... because one API call to rule them all, one API call to find them...",
  "Loading... because patience is a virtue, and so is a well-integrated media experience.",
  "While waiting, remember: great software is invisible - it just works, and you love it.",
  "Loading VPN diagnostics... because a secure connection is the foundation of good streaming.",
  "Initializing Sonarr connection... because TV shows deserve their own kingdom.",
  "Loading Radarr integration... because movies are like fine wine - they need proper curation.",
  "Connecting to Jellyfin/Plex... because your media should play, not buffer.",
  "Loading unified search... because finding 'that one episode' shouldn't require four different apps.",
  "Syncing download progress... because watching a progress bar fill up is oddly satisfying.",
  "Loading media health checks... because corrupted files are the enemy of good streaming.",
  "Connecting service diagnostics... because knowing what's broken is the first step to fixing it.",
  "Loading offline sync... because airplane mode shouldn't mean media blackout.",
  "Initializing theme system... because dark mode isn't just cool, it's essential.",
  "Loading widget dashboard... because customizable is just a fancy word for 'exactly how you want it'.",
  "Connecting API bridges... because REST APIs are like bridges - they connect everything.",
  "Loading backup services... because losing your media configuration would be tragic.",
  "Syncing notification system... because you deserve to know when your downloads finish.",
  "Loading queue management... because download priorities shouldn't be a free-for-all.",
  "Connecting metadata fetchers... because movie posters make everything look better.",
  "Loading quality profiles... because 4K is great, but sometimes 1080p is just fine.",
  "Initializing user preferences... because one size doesn't fit all media servers.",
  "Loading activity feeds... because seeing what everyone's watching is social media for media geeks.",
  "Connecting external services... because your media library shouldn't live in isolation.",
  "Loading performance metrics... because fast loading screens are the ultimate flex.",
  "Syncing watch history... because 'what episode was I on?' is the eternal question.",
  "Loading recommendation engine... because discovering new content shouldn't be a chore.",
  "Connecting to Trakt/TMDb... because ratings and reviews help you choose wisely.",
  "Loading subtitle management... because foreign films are better with subtitles.",
  "Initializing file organization... because a messy library is a sad library.",
  "Loading duplicate detection... because nobody needs the same movie twice.",
  "Connecting to media analysis... because knowing your library stats is nerdy fun.",
  "Loading smart scheduling... because downloads at 3 AM are perfectly reasonable.",
  "Syncing cross-platform sync... because your media should follow you everywhere.",
  "Loading bandwidth controls... because roommates also download stuff.",
];

export const OAuthCallbackLoader = ({
  message = "Processing authentication...",
  title = "Signing In",
  minShowTimeMs = 1500,
  onComplete,
  status = "loading",
}: OAuthCallbackLoaderProps) => {
  const theme = useTheme();
  const mountTimeRef = useRef(Date.now());
  const hasTriggeredExitRef = useRef(false);

  // Initialize with a random quote
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(() =>
    Math.floor(Math.random() * DEVELOPER_QUOTES.length),
  );

  // Animated shared values for quote transitions
  const quoteOpacity = useSharedValue(1);

  // Cycle through quotes randomly every 3 seconds during loading
  useEffect(() => {
    if (status !== "loading") return;

    const interval = setInterval(() => {
      if (shouldAnimateLayout(false)) {
        // Fade out current quote
        quoteOpacity.value = withTiming(
          0,
          {
            duration: 500,
            easing: Easing.inOut(Easing.ease),
          },
          () => {
            // Change to a random quote after fade out
            setCurrentQuoteIndex(() =>
              Math.floor(Math.random() * DEVELOPER_QUOTES.length),
            );
            // Fade in new quote
            quoteOpacity.value = withTiming(1, {
              duration: 500,
              easing: Easing.inOut(Easing.ease),
            });
          },
        );
      } else {
        // No animation, just change to random quote
        setCurrentQuoteIndex(() =>
          Math.floor(Math.random() * DEVELOPER_QUOTES.length),
        );
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, quoteOpacity]);

  // Monitor status and trigger exit animation when success
  useEffect(() => {
    if (status !== "success" || hasTriggeredExitRef.current) return;

    const elapsedMs = Date.now() - mountTimeRef.current;
    const remainingMs = Math.max(0, minShowTimeMs - elapsedMs);

    const exitTimer = setTimeout(() => {
      hasTriggeredExitRef.current = true;

      if (shouldAnimateLayout(false)) {
        // Exit animation: fade out
        quoteOpacity.value = withTiming(0, {
          duration: ANIMATION_DURATIONS.NORMAL,
          easing: Easing.out(Easing.ease),
        });
      }

      // Call onComplete after exit animation finishes
      setTimeout(() => {
        onComplete?.();
      }, ANIMATION_DURATIONS.NORMAL);
    }, remainingMs);

    return () => clearTimeout(exitTimer);
  }, [status, minShowTimeMs, quoteOpacity, onComplete]);

  // Animated style for quote
  const animatedQuoteStyle = useAnimatedStyle(() => ({
    opacity: quoteOpacity.value,
  }));

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
    },
    content: {
      alignItems: "center",
      maxWidth: 380,
    },
    quoteContainer: {
      marginBottom: 20,
      paddingHorizontal: 20,
      paddingVertical: 30,
      justifyContent: "center",
      alignItems: "center",
    },
    quoteRow: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
    },
    quote: {
      fontSize: 18,
      fontStyle: "italic",
      color: theme.colors.onSurface,
      textAlign: "center",
      lineHeight: 28,
      fontWeight: "400",
      flex: 1,
    },
    quoteMark: {
      fontSize: 48,
      color: theme.colors.primary,
      opacity: 0.6,
      fontFamily: "serif",
    },
    quoteMarkEnd: {
      fontSize: 48,
      color: theme.colors.primary,
      opacity: 0.6,
      fontFamily: "serif",
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      opacity: 0.8,
      marginTop: 16,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {shouldAnimateLayout(false) ? (
          <Animated.View style={[styles.quoteContainer, animatedQuoteStyle]}>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteMark}>"</Text>
              <Text style={styles.quote}>
                {DEVELOPER_QUOTES[currentQuoteIndex]}
              </Text>
              <Text style={styles.quoteMarkEnd}>"</Text>
            </View>
            <Text style={styles.subtitle}>Developer Wisdom</Text>
          </Animated.View>
        ) : (
          <View style={styles.quoteContainer}>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteMark}>"</Text>
              <Text style={styles.quote}>
                {DEVELOPER_QUOTES[currentQuoteIndex]}
              </Text>
              <Text style={styles.quoteMarkEnd}>"</Text>
            </View>
            <Text style={styles.subtitle}>Developer Wisdom</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};
