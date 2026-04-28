import { View, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radii } from '@/constants/theme';

type CardProps = ViewProps & {
  dark?: boolean;
  padded?: boolean;
};

export function Card({ children, dark = true, padded = true, style, ...rest }: CardProps) {
  const cardStyle: ViewStyle = {
    backgroundColor: dark ? colors.inkCard : colors.paperCard,
    borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(10,10,10,0.06)',
    borderWidth: 1,
    borderRadius: radii.card,
    padding: padded ? 18 : 0,
  };
  return (
    <View {...rest} style={[cardStyle, style]}>
      {children}
    </View>
  );
}
