import { View, Text, StyleSheet } from 'react-native';
import { Brand, Eyebrow } from '@/components/primitives';
import { colors } from '@/constants/theme';

export default function TrainScreen() {
  return (
    <View style={styles.container}>
      <Brand />
      <Eyebrow>TRAIN</Eyebrow>
      <Text style={styles.title}>Live workout log</Text>
      <Text style={styles.body}>
        M2 — coming next. Set logger, big-numeral target weight, exercise progression chips.
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
