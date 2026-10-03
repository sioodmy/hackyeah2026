import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";

import { SessionProvider, useSession } from "@/providers/SessionProvider";
import { SafetyProvider } from "@/providers/SafetyProvider";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SessionProvider>
          <SafetyGate />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function SafetyGate() {
  const session = useSession();

  return (
    <SafetyProvider token={session.token}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.void },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="friends" />
        <Stack.Screen
          name="scan"
          options={{ presentation: "modal", animation: "fade" }}
        />
        <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
        <Stack.Screen
          name="alert/[id]"
          options={{ presentation: "fullScreenModal" }}
        />
      </Stack>
    </SafetyProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.void },
});
