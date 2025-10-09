import { Stack } from 'expo-router';

export default function RadarrServiceLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="movies/[id]"
        options={{
          presentation: 'transparentModal',
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'none', // Disable default animation since we're using custom sheet transitions
          headerShown: false, // Hide the header completely
        }}
      />
      <Stack.Screen
        name="add"
        options={{
          title: 'Add Movie',
          headerShown: false
        }}
      />
    </Stack>
  );
}
