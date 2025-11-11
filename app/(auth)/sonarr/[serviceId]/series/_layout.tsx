import { Stack } from "expo-router";

export default function SeriesDetailsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="episode/[episodeId]"
        options={{
          presentation: "formSheet",
          gestureDirection: "vertical",
          animation: "slide_from_bottom",
          sheetGrabberVisible: true,
          sheetInitialDetentIndex: 0,
          sheetAllowedDetents: [0.5, 0.75, 1],
          sheetCornerRadius: 20,
          sheetExpandsWhenScrolledToEdge: true,
          sheetElevation: 24,
          headerShown: false,
        }}
      />
    </Stack>
  );
}
