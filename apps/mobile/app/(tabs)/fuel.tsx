import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Brand, Card, Eyebrow, Icon, type IconName } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { parseMealPhoto } from '@/lib/meal-vision';
import { logMeal } from '@/lib/meal-log';
import { colors } from '@/constants/theme';
import type { MealParseResult } from '@pact/types';

type Photo = { uri: string; base64: string; mediaType: AllowedMediaType };
type AllowedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

type State =
  | { status: 'empty' }
  | { status: 'analyzing'; photo: Photo }
  | { status: 'reviewing'; photo: Photo; result: MealParseResult }
  | { status: 'logging'; photo: Photo; result: MealParseResult }
  | { status: 'logged'; mealId: string }
  | { status: 'error'; message: string; previous?: State };

const ALLOWED: AllowedMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export default function FuelScreen() {
  const { user, profile, configured } = useAuth();
  const [state, setState] = useState<State>({ status: 'empty' });

  const pickFromCamera = () => pick('camera');
  const pickFromLibrary = () => pick('library');

  const pick = async (source: 'camera' | 'library') => {
    if (!configured) {
      setState({ status: 'error', message: 'Firebase isn’t configured.' });
      return;
    }

    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setState({
        status: 'error',
        message:
          source === 'camera'
            ? 'Camera permission is needed to take a meal photo.'
            : 'Photo library permission is needed to pick a meal photo.',
      });
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.85,
            base64: true,
            allowsEditing: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.85,
            base64: true,
            allowsEditing: false,
          });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) {
      setState({ status: 'error', message: 'Could not read the selected photo.' });
      return;
    }

    const mediaType = inferMediaType(asset.mimeType, asset.uri);
    if (!ALLOWED.includes(mediaType)) {
      setState({
        status: 'error',
        message: `Unsupported image type (${mediaType}). Try JPEG or PNG.`,
      });
      return;
    }

    const photo: Photo = { uri: asset.uri, base64: asset.base64, mediaType };
    setState({ status: 'analyzing', photo });

    try {
      const parsed = await parseMealPhoto(photo.base64, photo.mediaType);
      setState({ status: 'reviewing', photo, result: parsed });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not parse meal',
      });
    }
  };

  const handleLog = async () => {
    if (state.status !== 'reviewing') return;
    if (!user) {
      setState({ status: 'error', message: 'Sign in first.' });
      return;
    }
    if (!profile?.currentGroupId) {
      Alert.alert(
        'No pact yet',
        'Make or join a pact on the web app first, then come back to log meals.',
      );
      return;
    }

    const { photo, result } = state;
    setState({ status: 'logging', photo, result });

    try {
      const blob = await fetch(photo.uri).then((r) => r.blob());
      const { mealId } = await logMeal({
        uid: user.uid,
        groupId: profile.currentGroupId,
        parsed: result,
        photo: { blob, mediaType: photo.mediaType },
      });
      setState({ status: 'logged', mealId });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not save meal',
        previous: { status: 'reviewing', photo: state.photo, result: state.result },
      });
    }
  };

  const reset = () => setState({ status: 'empty' });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ink }}
      contentContainerStyle={{ paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerWrap}>
        <View style={styles.headerTop}>
          <Brand showWordmark={false} size={32} />
          <Eyebrow>FUEL · PHOTO LOG</Eyebrow>
        </View>
        <Text style={styles.title}>What did you eat?</Text>
        <Text style={styles.body}>
          Snap a photo. We&rsquo;ll estimate macros and log it to your pact.
        </Text>
      </View>

      <View style={styles.section}>
        <PhotoCard state={state} />
      </View>

      {state.status === 'empty' && (
        <View style={styles.section}>
          <PrimaryButton onPress={pickFromCamera} icon="camera" label="Take a photo" />
          <SecondaryButton onPress={pickFromLibrary} icon="upload" label="Choose from library" />
        </View>
      )}

      {state.status === 'analyzing' && (
        <View style={styles.section}>
          <ParsingPulse label="Parsing macros…" />
        </View>
      )}

      {(state.status === 'reviewing' || state.status === 'logging') && (
        <>
          <View style={styles.section}>
            <Eyebrow>DETECTED</Eyebrow>
            <ItemsList items={state.result.items} />
          </View>

          <View style={styles.section}>
            <Eyebrow>MACROS</Eyebrow>
            <MacrosGrid totals={state.result.totals} />
          </View>

          {state.result.notes && (
            <View style={styles.section}>
              <Card style={styles.noteCard}>
                <Eyebrow color={colors.lime}>NOTES</Eyebrow>
                <Text style={styles.noteText}>{state.result.notes}</Text>
              </Card>
            </View>
          )}

          <View style={styles.section}>
            {state.status === 'reviewing' ? (
              <PrimaryButton
                onPress={handleLog}
                icon="check"
                label={profile?.currentGroupId ? 'Log this meal' : 'Need a pact to log'}
                disabled={!profile?.currentGroupId}
              />
            ) : (
              <ParsingPulse label="Saving to your pact…" />
            )}
            <SecondaryButton onPress={reset} icon="x" label="Discard and start over" />
          </View>
        </>
      )}

      {state.status === 'logged' && (
        <View style={styles.section}>
          <Card style={styles.successCard}>
            <Eyebrow color={colors.lime}>LOGGED</Eyebrow>
            <Text style={styles.successTitle}>Saved to your pact.</Text>
            <Text style={styles.successSub}>
              The photo gets cleared in 24h. The macros are yours to keep.
            </Text>
          </Card>
          <PrimaryButton onPress={reset} icon="plus" label="Log another meal" />
        </View>
      )}

      {state.status === 'error' && (
        <View style={styles.section}>
          <Card style={styles.errorCard}>
            <Eyebrow color={colors.coral}>ERROR</Eyebrow>
            <Text style={styles.errorText}>{state.message}</Text>
          </Card>
          <SecondaryButton onPress={reset} icon="arrow" label="Try again" />
        </View>
      )}
    </ScrollView>
  );
}

/* ── Photo card ──────────────────────────────────────────────────────── */

function PhotoCard({ state }: { state: State }) {
  const photo =
    state.status === 'analyzing' || state.status === 'reviewing' || state.status === 'logging'
      ? state.photo
      : null;

  if (photo) {
    return (
      <View style={styles.photoFrame}>
        <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View style={[styles.photoFrame, styles.photoPlaceholder]}>
      <View style={styles.photoIconBubble}>
        <Icon name="camera" size={28} color={colors.lime} />
      </View>
      <Text style={styles.photoPlaceholderTitle}>Meal photo</Text>
      <Text style={styles.photoPlaceholderSub}>JPEG or PNG, up to 10 MB</Text>
    </View>
  );
}

/* ── Items list ──────────────────────────────────────────────────────── */

function ItemsList({ items }: { items: MealParseResult['items'] }) {
  if (items.length === 0) {
    return (
      <Card style={{ marginTop: 8 }}>
        <Text style={styles.emptyItems}>Nothing recognized.</Text>
      </Card>
    );
  }
  return (
    <Card style={{ marginTop: 8, paddingVertical: 6 }}>
      {items.map((it, i) => (
        <View
          key={i}
          style={[
            styles.itemRow,
            i < items.length - 1 && {
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.06)',
            },
          ]}
        >
          <View style={styles.itemIconBubble}>
            <Icon name="bowl" size={14} color={colors.lime} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.itemName} numberOfLines={1}>
              {it.name}
            </Text>
            <Text style={styles.itemSub}>
              {it.portion ?? (it.grams != null ? `${Math.round(it.grams)} g` : '—')}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.itemCal}>{Math.round(it.calories)} cal</Text>
            <Text style={styles.itemMacros}>
              {Math.round(it.proteinG)}P · {Math.round(it.carbsG)}C · {Math.round(it.fatG)}F
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

/* ── Macros 2x2 grid ─────────────────────────────────────────────────── */

function MacrosGrid({ totals }: { totals: MealParseResult['totals'] }) {
  const tiles: Array<{ label: string; value: number; suffix: string; tint: string }> = [
    { label: 'CALORIES', value: totals.calories, suffix: 'kcal', tint: colors.lime },
    { label: 'PROTEIN',  value: totals.proteinG, suffix: 'g',    tint: colors.lime },
    { label: 'CARBS',    value: totals.carbsG,   suffix: 'g',    tint: colors.sky },
    { label: 'FAT',      value: totals.fatG,     suffix: 'g',    tint: colors.coral },
  ];
  return (
    <View style={styles.macrosGrid}>
      {tiles.map((t) => (
        <Card key={t.label} style={styles.macroTile}>
          <Text style={[styles.macroLabel, { color: t.tint }]}>{t.label}</Text>
          <View style={styles.macroValueRow}>
            <Text style={styles.macroValue}>{Math.round(t.value).toLocaleString()}</Text>
            <Text style={styles.macroSuffix}>{t.suffix}</Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

/* ── Buttons ─────────────────────────────────────────────────────────── */

function PrimaryButton({
  onPress,
  label,
  icon,
  disabled,
}: {
  onPress: () => void;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryBtn,
        pressed && !disabled && { transform: [{ scale: 0.97 }] },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
      {icon && <Icon name={icon} size={16} color={colors.ink} strokeWidth={2.5} />}
    </Pressable>
  );
}

function SecondaryButton({
  onPress,
  label,
  icon,
}: {
  onPress: () => void;
  label: string;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryBtn,
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      {icon && <Icon name={icon} size={14} color={colors.textOnDark} strokeWidth={2} />}
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </Pressable>
  );
}

/* ── Loading pulse ───────────────────────────────────────────────────── */

function ParsingPulse({ label }: { label: string }) {
  return (
    <View style={styles.parsingWrap}>
      <View style={styles.parsingDots}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.parsingDot,
              { opacity: i === 0 ? 1 : i === 1 ? 0.6 : 0.3 },
            ]}
          />
        ))}
      </View>
      <Text style={styles.parsingLabel}>{label}</Text>
    </View>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function inferMediaType(mimeType: string | undefined, uri: string): AllowedMediaType {
  if (mimeType && ALLOWED.includes(mimeType as AllowedMediaType)) {
    return mimeType as AllowedMediaType;
  }
  const ext = uri.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg'; // best-guess fallback for camera output
  }
}

/* ── Styles ──────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  headerWrap: {
    paddingTop: 70,
    paddingHorizontal: 22,
    gap: 6,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: 'InterTight_700Bold',
    fontSize: 28,
    color: colors.textOnDark,
    letterSpacing: -0.84,
    marginTop: 6,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.textOnDarkMute,
    lineHeight: 19,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 22,
    paddingTop: 18,
    gap: 8,
  } as ViewStyle,
  photoFrame: {
    aspectRatio: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.inkCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  photoIconBubble: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(218,255,63,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderTitle: {
    fontFamily: 'InterTight_700Bold',
    fontSize: 18,
    color: colors.textOnDark,
    letterSpacing: -0.36,
  },
  photoPlaceholderSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.textOnDarkMute,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  itemIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(218,255,63,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: colors.textOnDark,
  },
  itemSub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: colors.textOnDarkMute,
    marginTop: 2,
  },
  itemCal: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 13,
    color: colors.lime,
  },
  itemMacros: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    color: colors.textOnDarkMute,
    marginTop: 2,
  },
  emptyItems: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.textOnDarkMute,
    textAlign: 'center',
    paddingVertical: 12,
  },
  macrosGrid: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  macroTile: {
    flexBasis: '47%',
    flexGrow: 1,
  } as ViewStyle,
  macroLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    letterSpacing: 1.4,
  } as TextStyle,
  macroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 6,
  },
  macroValue: {
    fontFamily: 'InterTight_800ExtraBold',
    fontSize: 32,
    color: colors.textOnDark,
    letterSpacing: -1.28,
  },
  macroSuffix: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
    color: colors.textOnDarkMute,
    textTransform: 'uppercase',
  },
  primaryBtn: {
    backgroundColor: colors.lime,
    borderRadius: 9999,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: colors.ink,
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 9999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: colors.textOnDark,
  },
  parsingWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
  },
  parsingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  parsingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.lime,
  },
  parsingLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: colors.textOnDark,
  },
  noteCard: {
    backgroundColor: 'rgba(218,255,63,0.06)',
    borderColor: 'rgba(218,255,63,0.2)',
  } as ViewStyle,
  noteText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.textOnDark,
    lineHeight: 19,
    marginTop: 6,
  },
  successCard: {
    backgroundColor: 'rgba(218,255,63,0.1)',
    borderColor: 'rgba(218,255,63,0.3)',
  } as ViewStyle,
  successTitle: {
    fontFamily: 'InterTight_700Bold',
    fontSize: 18,
    color: colors.textOnDark,
    marginTop: 6,
    letterSpacing: -0.36,
  },
  successSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.textOnDarkMute,
    lineHeight: 18,
    marginTop: 4,
  },
  errorCard: {
    backgroundColor: 'rgba(255,107,74,0.08)',
    borderColor: 'rgba(255,107,74,0.3)',
  } as ViewStyle,
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.coral,
    lineHeight: 19,
    marginTop: 6,
  },
});
