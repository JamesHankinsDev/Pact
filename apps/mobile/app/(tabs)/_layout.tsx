import { View, ActivityIndicator } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { PactTabBar } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/constants/theme';

export default function TabsLayout() {
  const { user, loading, configured } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.lime} />
      </View>
    );
  }

  // If Firebase isn't configured, surface the sign-in screen so the user sees
  // the configuration hint instead of a blank tabs view.
  if (!user || !configured) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <PactTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="train" options={{ title: 'Train' }} />
      <Tabs.Screen name="fuel"  options={{ title: 'Fuel' }} />
      <Tabs.Screen name="crew"  options={{ title: 'Crew' }} />
    </Tabs>
  );
}
