import { Text, type TextStyle } from 'react-native';
import { colors } from '@/constants/theme';

type EyebrowProps = {
  children: React.ReactNode;
  dark?: boolean;
  color?: string;
};

export function Eyebrow({ children, dark = true, color }: EyebrowProps) {
  const style: TextStyle = {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: color ?? (dark ? colors.textOnDarkFaint : colors.textOnLightFaint),
  };
  return <Text style={style}>{children}</Text>;
}
