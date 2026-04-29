import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Stack, Redirect } from 'expo-router';
import * as Linking from 'expo-linking';
import { Brand, Eyebrow, Icon } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { sendMagicLink, tryCompleteMagicLink, clearPendingEmail } from '@/lib/auth';
import { colors } from '@/constants/theme';

type State =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent'; email: string }
  | { status: 'completing' }
  | { status: 'error'; message: string };

export default function SignInScreen() {
  const { user, loading, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  // Listen for the email-tap deep link. Fires both on cold-launch via the
  // link and on warm receive while the screen is mounted.
  useEffect(() => {
    let cancelled = false;

    const handle = async (url: string | null | undefined) => {
      if (cancelled || !url) return;
      setState({ status: 'completing' });
      const result = await tryCompleteMagicLink(url);
      if (cancelled) return;
      if (result.ok) {
        // AuthProvider's onAuthStateChanged kicks in, the <Redirect> below
        // sends us to /. Nothing else to do here.
        return;
      }
      if (result.error) {
        setState({ status: 'error', message: result.error });
      } else {
        // Wasn't a sign-in link; reset.
        setState({ status: 'idle' });
      }
    };

    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (event) => handle(event.url));
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  if (!loading && user) return <Redirect href="/" />;

  const handleSend = async () => {
    if (!email.trim()) return;
    setState({ status: 'sending' });
    try {
      await sendMagicLink(email.trim());
      setState({ status: 'sent', email: email.trim() });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not send link',
      });
    }
  };

  const reset = () => {
    setState({ status: 'idle' });
    void clearPendingEmail();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.ink }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingTop: 70, paddingHorizontal: 28, gap: 24 }}>
          <Brand />

          <View style={{ gap: 6 }}>
            <Eyebrow>SIGN IN</Eyebrow>
            <Text style={styles.title}>Welcome back.</Text>
            <Text style={styles.body}>
              We&rsquo;ll email you a one-tap sign-in link. No password.
            </Text>
          </View>

          {!configured && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                Firebase isn&rsquo;t configured. Set EXPO_PUBLIC_FIREBASE_* in apps/mobile/.env
                and restart the dev server.
              </Text>
            </View>
          )}

          {state.status === 'sent' ? (
            <View style={{ gap: 12 }}>
              <View style={styles.successBox}>
                <Eyebrow color={colors.lime}>CHECK YOUR EMAIL</Eyebrow>
                <Text style={styles.successTitle}>Sent to {state.email}</Text>
                <Text style={styles.successBody}>
                  Tap the link in the email on this device. It bounces through the web app and
                  back here automatically.
                </Text>
              </View>
              <Pressable
                onPress={reset}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                <Text style={styles.secondaryBtnText}>Use a different email</Text>
              </Pressable>
            </View>
          ) : state.status === 'completing' ? (
            <View style={styles.softNote}>
              <Icon name="sparkle" size={14} color={colors.lime} />
              <Text style={styles.softNoteText}>Signing you in…</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="rgba(245,243,238,0.35)"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                inputMode="email"
                returnKeyType="send"
                onSubmitEditing={handleSend}
                editable={state.status === 'idle' || state.status === 'error'}
                style={styles.input}
              />

              <Pressable
                onPress={handleSend}
                disabled={
                  !configured ||
                  !email.trim() ||
                  state.status === 'sending'
                }
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (!configured || !email.trim() || state.status === 'sending') && { opacity: 0.5 },
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {state.status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
                </Text>
                <Icon name="arrow" size={16} color={colors.ink} strokeWidth={2.5} />
              </Pressable>

              <View style={styles.softNote}>
                <Icon name="sparkle" size={14} color={colors.lime} />
                <Text style={styles.softNoteText}>
                  Google &amp; phone sign-in need an EAS dev build to play nicely on iOS — landing
                  in a follow-up.
                </Text>
              </View>
            </View>
          )}

          {state.status === 'error' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{state.message}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 60,
  },
  title: {
    fontFamily: 'InterTight_700Bold',
    fontSize: 32,
    color: colors.textOnDark,
    letterSpacing: -0.96,
    marginTop: 8,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.textOnDarkMute,
    lineHeight: 21,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#0e0d0a',
    color: colors.textOnDark,
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: colors.lime,
    borderRadius: 9999,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: colors.ink,
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 9999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: colors.textOnDark,
  },
  softNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(218,255,63,0.06)',
    borderColor: 'rgba(218,255,63,0.2)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  softNoteText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(245,243,238,0.85)',
    lineHeight: 17,
  },
  successBox: {
    backgroundColor: 'rgba(218,255,63,0.08)',
    borderColor: 'rgba(218,255,63,0.25)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  successTitle: {
    fontFamily: 'InterTight_700Bold',
    fontSize: 18,
    color: colors.textOnDark,
    letterSpacing: -0.36,
    marginTop: 4,
  },
  successBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.textOnDarkMute,
    lineHeight: 19,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: 'rgba(255,107,74,0.1)',
    borderColor: 'rgba(255,107,74,0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.coral,
    lineHeight: 17,
  },
});
