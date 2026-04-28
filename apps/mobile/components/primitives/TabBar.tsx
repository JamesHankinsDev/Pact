import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon, type IconName } from './Icon';
import { colors } from '@/constants/theme';

const TAB_META: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Today', icon: 'home' },
  train: { label: 'Train', icon: 'dumbbell' },
  fuel:  { label: 'Fuel',  icon: 'bowl' },
  crew:  { label: 'Crew',  icon: 'chat' },
};

/**
 * Custom bottom tab bar matching the Pact design — floating pill above the
 * safe area, lime active state with rounded inset background.
 */
export function PactTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: 28,
        left: 12,
        right: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.ink,
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          borderRadius: 28,
          padding: 6,
          shadowColor: '#000',
          shadowOpacity: 0.16,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 24,
          elevation: 8,
        }}
      >
        {state.routes.map((route, idx) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const isActive = idx === state.index;
          const { options } = descriptors[route.key]!;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isActive && !event.defaultPrevented) {
              Haptics.selectionAsync().catch(() => {});
              navigation.navigate(route.name as never);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isActive ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? meta.label}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                paddingHorizontal: 6,
                borderRadius: 22,
                backgroundColor: isActive ? colors.lime : 'transparent',
                gap: 2,
              }}
            >
              <Icon
                name={meta.icon}
                size={20}
                color={isActive ? colors.ink : 'rgba(245,243,238,0.4)'}
              />
              <Text
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 11,
                  color: isActive ? colors.ink : 'rgba(245,243,238,0.4)',
                }}
              >
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
