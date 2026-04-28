import { View, Text, StyleSheet } from 'react-native';
import { Brand, Eyebrow } from '@/components/primitives';
import { colors } from '@/constants/theme';

export default function FuelScreen() {
  return (
    <View style={styles.container}>
      <Brand />
      <Eyebrow>FUEL</Eyebrow>
      <Text style={styles.title}>Meals &amp; pantry</Text>
      <Text style={styles.body}>
        M3 + M4 — coming next. Camera-first meal photo capture with vision-parsed
        macros, plus the inventory-aware shopping list.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingHorizontal: 22,
    paddingTop: 70,
    gap: 12,
  },
  title: {
    fontFamily: 'InterTight_700Bold',
    fontSize: 28,
    color: colors.textOnDark,
    letterSpacing: -0.84,
  },
  body: {
    fontSize: 14,
    color: colors.textOnDarkMute,
    fontFamily: 'Inter_400Regular',
    lineHeight: 21,
  },
});
