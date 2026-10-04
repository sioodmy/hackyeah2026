import { useSignIn, useSignUp } from '@clerk/expo';
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
      setNotice('Zalogowano');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zalogować.');
    } finally {
      setBusy(false);
    }
  }, [email, password, signIn]);

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
      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) {
        setError(finalizeError.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zweryfikować kodu.');
    } finally {
      setBusy(false);
    }
  }, [code, signUp]);

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
      <Text style={[styles.segmentTabText, active && styles.segmentTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, ...input }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...input}
        style={styles.input}
        placeholderTextColor="rgba(155, 161, 170, 0.55)"
        autoCorrect={false}
        accessibilityLabel={label}
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
        rest.disabled && styles.primaryDisabled,
        pressed && !rest.disabled && styles.primaryPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(rest.disabled) }}
    >
      <Text style={styles.primaryText}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.surfaceSolid },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
    flexGrow: 1,
    justifyContent: 'center',
  },

  brandBlock: { alignItems: 'center', gap: spacing.md },
  mark: { marginBottom: spacing.xs },
  brand: { fontSize: 30, fontWeight: '700', color: palette.text, letterSpacing: -0.6 },
  tagline: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 20,
    color: palette.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },

  card: {
    borderRadius: 22,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: 'rgba(26, 29, 35, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },

  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    borderRadius: radii.pill,
    padding: 3,
  },
  segmentTab: { flex: 1, paddingVertical: spacing.sm + 1, borderRadius: radii.pill },
  segmentTabActive: { backgroundColor: 'rgba(255, 255, 255, 0.10)' },
  segmentTabText: { ...type.label, fontSize: 12.5, textAlign: 'center', color: palette.textMuted },
  segmentTabTextActive: { color: palette.text },

  field: { gap: 6 },
  fieldLabel: {
    ...type.caption,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: palette.textFaint,
  },
  input: {
    ...type.body,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    color: palette.text,
    backgroundColor: 'rgba(0, 0, 0, 0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  codeInput: {
    ...type.body,
    fontSize: 19,
    textAlign: 'center',
    letterSpacing: 10,
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 14,
    color: palette.text,
    backgroundColor: 'rgba(0, 0, 0, 0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  hint: { ...type.caption, fontSize: 12.5, color: palette.textMuted, textAlign: 'center' },

  primary: {
    backgroundColor: palette.text,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryPressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  primaryDisabled: { opacity: 0.35 },
  primaryText: { ...type.body, fontSize: 15, fontWeight: '700', color: palette.surfaceSolid },
  link: { ...type.caption, fontSize: 12.5, textAlign: 'center', color: palette.textMuted },

  foot: {
    ...type.caption,
    fontSize: 11.5,
    lineHeight: 18,
    color: palette.textFaint,
    textAlign: 'center',
  },
  notice: { ...type.caption, color: palette.success, textAlign: 'center' },
  error: { ...type.caption, color: palette.level3, textAlign: 'center' },
});
