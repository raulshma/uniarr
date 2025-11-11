import { Stack } from "expo-router";

export default function SonarrServiceLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="queue"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="series/[id]"
        options={{
          presentation: "transparentModal",
          contentStyle: { backgroundColor: "transparent" },
          headerShown: false,
          gestureDirection: "vertical",
          animation: "slide_from_bottom",
          sheetGrabberVisible: true,
          sheetInitialDetentIndex: 0,
          sheetAllowedDetents: [0.5, 0.75, 1],
          sheetCornerRadius: 20,
          sheetExpandsWhenScrolledToEdge: true,
          sheetElevation: 24,
        }}
      />
      <Stack.Screen
        name="add"
        options={{
          title: "Add Series",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
