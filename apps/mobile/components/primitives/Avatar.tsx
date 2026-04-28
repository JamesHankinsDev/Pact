import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/theme';

type AvatarProps = {
  initials: string;
  color?: string;
  size?: number;
  ring?: boolean;
  dark?: boolean;
};

export function Avatar({
  initials,
  color = colors.lime,
  size = 32,
  ring = false,
  dark = false,
}: AvatarProps) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: ring ? 2 : 0,
          borderColor: dark ? colors.ink : '#fff',
        },
      ]}
    >
      <Text
        style={{
          color: colors.ink,
          fontFamily: 'InterTight_700Bold',
          fontSize: size * 0.4,
          letterSpacing: -0.4,
          lineHeight: size,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

type AvatarStackProps = {
  members: Array<{ initials: string; color: string }>;
  size?: number;
  dark?: boolean;
};

export function AvatarStack({ members, size = 28, dark = false }: AvatarStackProps) {
  return (
    <View style={styles.stack}>
      {members.map((m, i) => (
        <View key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar initials={m.initials} color={m.color} size={size} ring dark={dark} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    flexDirection: 'row',
  },
});
