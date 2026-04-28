import { View, Text } from 'react-native';
import { colors } from '@/constants/theme';

type BrandProps = {
  size?: number;
  showWordmark?: boolean;
};

export function Brand({ size = 38, showWordmark = true }: BrandProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: colors.lime,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: colors.ink,
            fontFamily: 'InterTight_800ExtraBold',
            fontSize: size * 0.55,
            letterSpacing: -size * 0.04,
            lineHeight: size,
          }}
        >
          P
        </Text>
      </View>
      {showWordmark && (
        <Text
          style={{
            fontFamily: 'InterTight_800ExtraBold',
            fontSize: 18,
            letterSpacing: -0.36,
            color: colors.textOnDark,
          }}
        >
          PACT
        </Text>
      )}
    </View>
  );
}
