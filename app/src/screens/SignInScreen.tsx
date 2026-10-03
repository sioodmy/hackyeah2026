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

import { palette, radii, spacing, type } from '@/theme';

type Mode = 'sign-in' | 'sign-up' | 'verify';

/**
 * Sign-in, built on Clerk's hooks.
 *
 * `@clerk/expo` no longer ships a `<SignIn />` component, so the flow is ours:
 * email + password, with the email-code verification step that Clerk requires
 * for new accounts.
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
      setNotice('Wysłaliśmy kod na maila');
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
        <Text style={styles.brand}>PanicMap</Text>
        <Text style={styles.tagline}>
          Aplikacja wygląda jak mapa. Znajomi widzą, gdzie jesteś — tylko wtedy, gdy naprawdę tego
          potrzebujesz.
        </Text>

        {mode === 'verify' ? (
          <>
            <Field
              label="Kod z maila"
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              keyboardType="number-pad"
            />
            <Primary onPress={submitCode} disabled={busy || code.length < 4}>
              {busy ? 'Sprawdzam…' : 'Potwierdź'}
            </Primary>
            <Link onPress={() => setMode('sign-up')}>Wróć</Link>
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
            />
            <Field
              label="Hasło"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            {mode === 'sign-in' ? (
              <Primary onPress={submitSignIn} disabled={busy || !email || !password}>
                {busy ? 'Loguję…' : 'Zaloguj się'}
              </Primary>
            ) : (
              <Primary onPress={submitSignUp} disabled={busy || !email || !password}>
                {busy ? 'Zakładam…' : 'Załóż konto'}
              </Primary>
            )}

            <Link
              onPress={() => {
                setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
                setError(null);
              }}
            >
              {mode === 'sign-in' ? 'Nie mam konta — załóż' : 'Mam już konto'}
            </Link>
          </>
        )}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...input }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...input}
        style={styles.input}
        placeholderTextColor={palette.textFaint}
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
      style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
      accessibilityRole="button"
    >
      <Text style={styles.primaryText}>{children}</Text>
    </Pressable>
  );
}

function Link({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
      <Text style={styles.link}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.surfaceSolid },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    flexGrow: 1,
    justifyContent: 'center',
  },
  brand: { fontSize: 34, fontWeight: '700', color: palette.text, letterSpacing: -0.5 },
  tagline: { ...type.caption, lineHeight: 18, marginBottom: spacing.lg },
  field: { gap: spacing.xs },
  label: { ...type.label },
  input: {
    ...type.body,
    backgroundColor: palette.surfaceRaised,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: palette.text,
  },
  primary: {
    backgroundColor: palette.text,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryPressed: { opacity: 0.8 },
  primaryText: { ...type.body, fontWeight: '700', color: palette.surfaceSolid },
  link: { ...type.caption, textAlign: 'center', paddingVertical: spacing.sm },
  notice: { ...type.caption, color: palette.success, textAlign: 'center' },
  error: { ...type.caption, color: palette.level3, textAlign: 'center' },
});
