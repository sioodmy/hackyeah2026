import { useClerk, useSignIn, useSignUp } from '@clerk/expo';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { floatingShadow, palette, radii, spacing, type } from '@/theme';

type Mode = 'sign-in' | 'sign-up' | 'verify';

const MIN_PASSWORD = 8;

/**
 * Sign-in, built on Clerk's hooks.
 *
 * `@clerk/expo` no longer ships a `<SignIn />` component, so the flow is ours:
 * email + password, with the email-code verification step that Clerk requires
 * for new accounts.
 *
 * Layout mirrors the web preview (`web/src/components/Tabs.tsx`, `SignInPanel`):
 * mark, nazwa, tagline, karta z przełącznikiem Logowanie/Konto, pola z
 * wielkimi literami i focus ringiem, oraz stopka o prywatności.
 */
export function SignInScreen() {
  const insets = useSafeAreaInsets();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = Boolean(email) && password.length >= MIN_PASSWORD;

  const submitSignIn = useCallback(async () => {
    if (!signIn) return;
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await signIn.password({
        emailAddress: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      const sid = signIn.createdSessionId;
      if (sid && clerk.setActive) {
        await clerk.setActive({ session: sid });
        setNotice('Zalogowano');
        return;
      }

      // If status is complete or session is ready, try finalize
      if (signIn.status === 'complete' || sid) {
        try {
          await signIn.finalize();
          const finalSid = signIn.createdSessionId;
          if (finalSid && clerk.setActive) {
            await clerk.setActive({ session: finalSid });
          }
        } catch (finErr) {
          console.warn('Finalize error', finErr);
        }
      }

      // If clerk client has an active session, activate it
      const firstSession = clerk.client?.sessions?.[0]?.id;
      if (firstSession && clerk.setActive) {
        await clerk.setActive({ session: firstSession });
        setNotice('Zalogowano');
        return;
      }

      setError('Logowanie nie utworzyło aktywnej sesji. Spróbuj ponownie.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zalogować.');
    } finally {
      setBusy(false);
    }
  }, [email, password, signIn, clerk]);

  const submitSignUp = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: signUpError } = await signUp.password({
        emailAddress: email.trim(),
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      const { error: codeError } = await signUp.verifications.sendEmailCode();
      if (codeError) {
        setError(codeError.message);
        return;
      }
      setMode('verify');
      setNotice('Wysłaliśmy sześciocyfrowy kod na Twój mail.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się założyć konta.');
    } finally {
      setBusy(false);
    }
  }, [email, password, signUp]);

  const submitCode = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({
        code: code.trim(),
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }
      const sid = signUp.createdSessionId;
      if (sid && clerk.setActive) {
        await clerk.setActive({ session: sid });
        return;
      }
      try {
        await signUp.finalize();
        const finalSid = signUp.createdSessionId;
        if (finalSid && clerk.setActive) {
          await clerk.setActive({ session: finalSid });
        }
      } catch (finErr) {
        console.warn('Finalize error', finErr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zweryfikować kodu.');
    } finally {
      setBusy(false);
    }
  }, [code, signUp, clerk]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandBlock}>
          {/* Znacznik: pierścień z pojedynczą kropką — echo celownika na mapie. */}
          <View style={styles.mark}>
            <Svg width={62} height={62} viewBox="0 0 62 62" fill="none">
              <Circle cx={31} cy={31} r={30} stroke="rgba(244, 245, 247, 0.30)" strokeWidth={1.5} />
              <Circle cx={31} cy={31} r={8} fill={palette.text} />
              <Circle cx={31} cy={31} r={13} stroke="rgba(244, 245, 247, 0.10)" strokeWidth={6} />
            </Svg>
          </View>
          <Text style={styles.brand}>Mokosh</Text>
          <Text style={styles.tagline}>
            Wygląda jak mapa. Znajomi wiedzą, gdzie jesteś — tylko wtedy, gdy naprawdę tego
            potrzebujesz.
          </Text>
        </View>

        <View style={[styles.card, floatingShadow(12)]}>
          <View style={styles.segment}>
            <SegmentTab
              label="Logowanie"
              active={mode === 'sign-in'}
              onPress={() => setMode('sign-in')}
            />
            <SegmentTab
              label="Konto"
              active={mode === 'sign-up'}
              onPress={() => setMode('sign-up')}
            />
          </View>

          {mode === 'verify' ? (
            <>
              <Text style={styles.hint}>
                Wysłaliśmy sześciocyfrowy kod na {email.trim() || 'Twój mail'}.
              </Text>
              <TextInput
                style={styles.codeInput}
                placeholder="• • • • • •"
                placeholderTextColor="rgba(155, 161, 170, 0.55)"
                value={code}
                onChangeText={(next) => setCode(next.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                accessibilityLabel="Kod z maila"
              />
              <Primary onPress={submitCode} disabled={busy || code.length < 6}>
                {busy ? 'Sprawdzam…' : 'Potwierdź'}
              </Primary>
              <Pressable onPress={() => setMode('sign-up')} accessibilityRole="button">
                <Text style={styles.link}>Wróć</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="ty@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              <Field
                label="Hasło"
                value={password}
                onChangeText={setPassword}
                placeholder={`min. ${MIN_PASSWORD} znaków`}
                secureTextEntry
                textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
              />
              <Primary
                onPress={mode === 'sign-in' ? submitSignIn : submitSignUp}
                disabled={busy || !canSubmit}
              >
                {busy
                  ? mode === 'sign-in'
                    ? 'Loguję…'
                    : 'Zakładam…'
                  : mode === 'sign-in'
                    ? 'Zaloguj się'
                    : 'Załóż konto'}
              </Primary>
            </>
          )}
        </View>

        <Text style={styles.foot}>
          Twoja lokalizacja jest udostępniana wyłącznie przy podwyższonym poziomie zagrożenia.
          Wszystko, co zbieramy, zostaje między Tobą a Twoimi kontaktami zaufania.
        </Text>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SegmentTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.segmentTab, active && styles.segmentTabActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, ...input }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...input}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.inputFocused]}
        placeholderTextColor="rgba(155, 161, 170, 0.40)"
        autoCorrect={false}
      />
    </View>
  );
}

function Primary({
  children,
  ...rest
}: { children: React.ReactNode } & React.ComponentProps<typeof Pressable>) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        styles.primary,
        pressed && styles.primaryPressed,
        rest.disabled && styles.primaryDisabled,
      ]}
      accessibilityRole="button"
    >
      <Text style={styles.primaryText}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.surfaceSolid },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  brandBlock: { alignItems: 'center', gap: spacing.sm },
  mark: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  brand: {
    fontSize: 34,
    fontWeight: '700',
    color: palette.text,
    letterSpacing: -0.5,
  },
  tagline: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: palette.textMuted,
    textAlign: 'center',
    maxWidth: 320,
  },
  card: {
    backgroundColor: palette.surfaceRaised,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(244, 245, 247, 0.08)',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: radii.pill,
  },
  segmentTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  segmentText: {
    ...type.body,
    fontSize: 13,
    fontWeight: '600',
    color: palette.textMuted,
  },
  segmentTextActive: {
    color: palette.text,
  },
  field: { gap: 6 },
  label: {
    ...type.label,
    fontSize: 11,
    letterSpacing: 1.2,
    color: palette.textMuted,
  },
  input: {
    ...type.body,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: palette.text,
  },
  inputFocused: {
    borderColor: 'rgba(244, 245, 247, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  primary: {
    backgroundColor: palette.text,
    borderRadius: radii.pill,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  primaryPressed: { opacity: 0.8 },
  primaryDisabled: { opacity: 0.4 },
  primaryText: {
    ...type.body,
    fontWeight: '700',
    color: palette.surfaceSolid,
  },
  hint: {
    ...type.caption,
    color: palette.textMuted,
    textAlign: 'center',
  },
  codeInput: {
    ...type.title,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 14,
    color: palette.text,
  },
  link: {
    ...type.caption,
    textAlign: 'center',
    color: palette.textMuted,
    textDecorationLine: 'underline',
  },
  foot: {
    ...type.caption,
    color: palette.textFaint,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.md,
  },
  notice: { ...type.caption, color: palette.success, textAlign: 'center' },
  error: { ...type.caption, color: palette.level3, textAlign: 'center' },
});
