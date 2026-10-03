import { Stack } from 'expo-router';

import { MapScreen } from '@/screens/MapScreen';

export default function IndexRoute() {
  return (
    <>
      <MapScreen />
      <Stack.Screen options={{ headerShown: false }} />
    </>
  );
}
