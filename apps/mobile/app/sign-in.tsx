import { StyleSheet, Text, View } from "react-native";
import { SignIn } from "@clerk/clerk-react";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { ScreenHeader } from "@/ui";
import { isClerkConfigured } from "@/lib/env";
import { colors, radius, space, type } from "@/theme";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const router = useRouter();

  if (!isClerkConfigured) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Logowanie" onBack={() => router.replace("/")} />
        <View style={styles.note}>
          <Text style={styles.noteTitle}>Brak konfiguracji Clerk</Text>
          <Text style={styles.noteBody}>
            Ustaw EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY i uruchom aplikację
            ponownie. Jeśli serwer działa z DEV_AUTH=1, aplikacja wejdzie w tryb
            demo automatycznie i ten ekran nie będzie potrzebny.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Zaloguj się" onBack={() => router.replace("/")} />
      <View style={styles.body}>
        <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.void },
  body: { flex: 1 },
  note: {
    margin: space.xl,
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineSoft,
  },
  noteTitle: { ...type.label, color: colors.text },
  noteBody: { ...type.body, color: colors.textDim, lineHeight: 21 },
});
