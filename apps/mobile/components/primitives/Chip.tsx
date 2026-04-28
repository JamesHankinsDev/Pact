import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { colors } from '@/constants/theme';

type ChipColor = 'lime' | 'coral' | 'sky' | 'plum' | 'ghost' | 'outline';

type ChipProps = {
  children: React.ReactNode;
  color?: ChipColor;
  dark?: boolean;
};

function paletteFor(color: ChipColor, dark: boolean) {
  switch (color) {
    case 'lime':    return { bg: colors.lime, fg: colors.ink, border: undefined };
    case 'coral':   return { bg: colors.coral, fg: colors.ink, border: undefined };
    case 'sky':     return { bg: colors.sky, fg: colors.ink, border: undefined };
    case 'plum':    return { bg: colors.plum, fg: colors.ink, border: undefined };
    case 'ghost':
      return {
        bg: dark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,10,0.06)',
        fg: dark ? colors.textOnDark : colors.textOnLight,
        border: undefined,
      };
    case 'outline':
      return {
        bg: 'transparent',
        fg: dark ? colors.textOnDark : colors.textOnLight,
        border: dark ? 'rgba(255,255,255,0.18)' : 'rgba(10,10,10,0.16)',
      };
  }
}

export function Chip({ children, color = 'lime', dark = true }: ChipProps) {
  const p = paletteFor(color, dark);
  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: p.bg,
    borderColor: p.border,
    borderWidth: p.border ? 1 : 0,
  };
  const textStyle: TextStyle = {
    color: p.fg,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  };
  return (
    <View style={containerStyle}>
      {typeof children === 'string' ? <Text style={textStyle}>{children}</Text> : children}
    </View>
  );
}
