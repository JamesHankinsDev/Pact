import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { Brand, Eyebrow, Icon } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { useGoogleSignIn } from '@/lib/auth';
import { colors } from '@/constants/theme';

export default function SignInScreen() {
  const { user, loading, configured } = useAuth();
  const { signIn, isReady } = useGoogleSignIn();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) return <Redirect href="/" />;

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    const result = await signIn();
    setBusy(false);
    if (!result.ok && result.error && result.error !== 'Cancelled') {
      setError(result.error);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.ink }}
        contentContainerStyle={styles.container}
      >
        <View style={{ paddingTop: 70, paddingHorizontal: 28, gap: 24 }}>
          <Brand />

          <View style={{ gap: 6 }}>
            <Eyebrow>SIGN IN</Eyebrow>
            <Text style={styles.title}>Welcome back.</Text>
            <Text style={styles.body}>
              Sign in to see your crew&rsquo;s pact, log your day, and keep the streak.
            </Text>
          </View>

          {!configured && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                Firebase isn&rsquo;t configured. Set EXPO_PUBLIC_FIREBASE_* in apps/mobile/.env and
                restart the dev server.
              </Text>
            </View>
          )}

          <View style={{ gap: 10 }}>
            <Pressable
              onPress={handleGoogle}
              disabled={!configured || !isReady || busy}
              style={({ pressed }) => [
                styles.primaryBtn,
                (!configured || !isReady || busy) && { opacity: 0.5 },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {busy ? 'Opening Google…' : 'Continue with Google'}
              </Text>
              <Icon name="arrow" size={16} color={colors.ink} strokeWidth={2.5} />
            </Pressable>

            <View style={styles.softNote}>
              <Icon name="sparkle" size={14} color={colors.lime} />
              <Text style={styles.softNoteText}>
                Email link &amp; phone are landing in a follow-up — they need a native build (EAS)
                to handle deep links and SMS auth properly.
              </Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
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
