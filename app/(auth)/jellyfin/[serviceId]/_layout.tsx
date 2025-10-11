import { Stack } from "expo-router";

const JellyfinServiceLayout = () => {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="details/[itemId]"
        options={{
          headerShown: false,
          presentation: "modal",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen
        name="now-playing"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "fade",
        }}
      />
    </Stack>
  );
};

export default JellyfinServiceLayout;
