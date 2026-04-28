import { View, Text, type TextStyle } from 'react-native';
import { colors } from '@/constants/theme';

type StatNumeralProps = {
  value: string | number;
  unit?: string;
  size?: number;
  dark?: boolean;
  color?: string;
};

export function StatNumeral({ value, unit, size = 56, dark = true, color }: StatNumeralProps) {
  const numeralStyle: TextStyle = {
    fontFamily: 'InterTight_800ExtraBold',
    fontSize: size,
    letterSpacing: -size * 0.04,
    lineHeight: size * 0.95,
    color: color ?? (dark ? colors.textOnDark : colors.textOnLight),
  };
  const unitStyle: TextStyle = {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: size * 0.22,
    color: dark ? 'rgba(245,243,238,0.5)' : 'rgba(20,19,15,0.5)',
    textTransform: 'uppercase',
    letterSpacing: size * 0.013,
    marginLeft: 4,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <Text style={numeralStyle}>{value}</Text>
      {unit && <Text style={unitStyle}>{unit}</Text>}
    </View>
  );
}
