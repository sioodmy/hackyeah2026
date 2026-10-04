import { ClerkProvider, useAuth, useUser } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiContext } from '@/lib/ApiContext';
import { createApiClient } from '@/lib/api';
import { useAuthToken } from '@/lib/useAuthToken';
import { FriendAlarmOverlay } from '@/components/FriendAlarmOverlay';
import { useIncomingAlerts } from '@/hooks/useIncomingAlerts';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { SignInScreen } from '@/screens/SignInScreen';
import { palette } from '@/theme';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  // Fail loudly at startup rather than rendering a broken sign-in screen.
  throw new Error(
    'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Copy app/.env.example to app/.env and fill it in.',
  );
}

const clerkPublishableKey: string = publishableKey;

/**
 * The API client is rebuilt only when the token source changes, so the context
 * value stays stable across renders.
 */
function Providers({ children }: { children: ReactNode }) {
  const getToken = useAuthToken();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const signedIn = Boolean(isSignedIn);

  const api = useMemo(() => createApiClient(getToken), [getToken]);

  usePushRegistration({ api, enabled: signedIn, userId: user?.id ?? null });
  useIncomingAlerts(signedIn);

  if (!isLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.textMuted} />
      </View>
    );
  }

  if (!signedIn) {
    return <SignInScreen />;
  }

  return (
    <ApiContext.Provider value={api}>
      {/* Above the router: a call request or an alarm has to reach the friend
          whatever screen they happened to be on. */}
      <FriendAlarmOverlay />
      {children}
    </ApiContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Providers>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: palette.surfaceSolid },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="friends/index" />
              <Stack.Screen name="friends/scan" options={{ presentation: 'modal' }} />
            </Stack>
          </Providers>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceSolid,
  },
});
