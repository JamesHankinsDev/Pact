import { Tabs } from 'expo-router';
import { PactTabBar } from '@/components/primitives';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <PactTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="train" options={{ title: 'Train' }} />
      <Tabs.Screen name="fuel"  options={{ title: 'Fuel' }} />
      <Tabs.Screen name="crew"  options={{ title: 'Crew' }} />
    </Tabs>
  );
}
