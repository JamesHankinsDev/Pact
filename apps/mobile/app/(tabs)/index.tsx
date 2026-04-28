import { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  AvatarStack,
  Card,
  Chip,
  Eyebrow,
  Icon,
  StatNumeral,
  type IconName,
} from '@/components/primitives';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { signOut } from '@/lib/auth';
import { loadDashboardData, type DashboardData, type GroupMemberDoc } from '@/lib/group-data';
import { currentISOWeek } from '@/lib/iso-week';

const todayLabel = () => {
  const d = new Date();
  const day = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const week = currentISOWeek(d).split('-W')[1];
  return `${day} · WEEK ${week}`;
};

type CheckItem = {
  id: string;
  name: string;
  sub: string;
  icon: IconName;
  faded?: boolean;
};

const CHECK_ITEMS: CheckItem[] = [
  { id: 'vitd',    name: 'Vitamin D',          sub: 'Daily · with breakfast', icon: 'pill' },
  { id: 'mag',     name: 'Magnesium',          sub: '3× weekly · before bed', icon: 'pill' },
  { id: 'glp1',    name: 'GLP-1 injection',    sub: 'Sundays · skip today',    icon: 'pill', faded: true },
  { id: 'journal', name: 'Journal · 3 sentences', sub: 'Practice · 2 min',     icon: 'book' },
  { id: 'read',    name: 'Read · 10 pages',    sub: 'Practice',                 icon: 'book' },
];

export default function TodayScreen() {
  const { profile } = useAuth();
  const [done, setDone] = useState<Record<string, boolean>>({ vitd: true, journal: true });
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const groupId = profile?.currentGroupId ?? null;

  useEffect(() => {
    if (!groupId) {
      setData(null);
      return;
    }
    let cancelled = false;
    loadDashboardData(groupId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadErr(err instanceof Error ? err.message : 'Could not load your pact');
      });
    return () => { cancelled = true; };
  }, [groupId]);

  if (!groupId) return <NoGroupView profileName={profile?.displayName ?? 'there'} />;
  if (loadErr) return <FullPageNote title="Couldn't load your pact" body={loadErr} />;
  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.lime} />
      </View>
    );
  }

  const greetingName = (profile?.displayName ?? 'there').split(/\s+/)[0];
  const stack = data.members.slice(0, 3).map((m) => ({ initials: m.initials, color: m.color }));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ink }}
      contentContainerStyle={{ paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: 22, paddingTop: 70 }}>
        <View style={styles.headerRow}>
          <View>
            <Eyebrow>{todayLabel()}</Eyebrow>
            <Text style={styles.greeting}>Hey, {greetingName}</Text>
          </View>
          {stack.length > 0 && <AvatarStack members={stack} size={30} dark />}
        </View>

        <StreakBanner groupName={data.group.name} />
        <PactCard />
      </View>

      <View style={{ paddingHorizontal: 22, paddingTop: 14 }}>
        <Eyebrow>Today&rsquo;s workout · 6:30 AM</Eyebrow>
        <WorkoutCard />

        <View style={{ marginTop: 14 }}>
          <Eyebrow>Fuel today</Eyebrow>
          <MacrosCard />
        </View>

        <View style={{ marginTop: 14 }}>
          <Eyebrow>Pills &amp; practices</Eyebrow>
          <Card style={{ marginTop: 8 }}>
            {CHECK_ITEMS.map((item, i) => (
              <ChecklistRow
                key={item.id}
                item={item}
                checked={!!done[item.id]}
                onToggle={() =>
                  !item.faded && setDone((p) => ({ ...p, [item.id]: !p[item.id] }))
                }
                isLast={i === CHECK_ITEMS.length - 1}
              />
            ))}
          </Card>
        </View>
      </View>
    </ScrollView>
  );
}

/* ── Streak banner ───────────────────────────────────────────────────── */

function StreakBanner({ groupName }: { groupName: string }) {
  return (
    <View style={styles.streakBanner}>
      <View>
        <Text style={styles.streakEyebrow}>{groupName.toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
          <Text style={styles.streakNumeral}>23</Text>
          <Text style={styles.streakUnit}>DAYS</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.streakNote}>Crew is</Text>
        <Text style={styles.streakNote}>all in</Text>
      </View>
    </View>
  );
}

/* ── No group / loading states ───────────────────────────────────────── */

function NoGroupView({ profileName }: { profileName: string }) {
  const first = profileName.split(/\s+/)[0];
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ink }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28, gap: 18 }}
    >
      <Eyebrow>NO PACT YET</Eyebrow>
      <Text style={styles.noGroupTitle}>You&rsquo;re not in a pact yet, {first}.</Text>
      <Text style={styles.noGroupBody}>
        Make one (or join one with an invite code) on the web app, then come back —
        you&rsquo;ll land here automatically. Mobile-side onboarding is on the roadmap.
      </Text>
      <Pressable
        onPress={() => signOut().catch(() => {})}
        style={({ pressed }) => [
          styles.signOutLink,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function FullPageNote({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <Text style={[styles.noGroupTitle, { textAlign: 'center' }]}>{title}</Text>
      {body && <Text style={[styles.noGroupBody, { textAlign: 'center', marginTop: 8 }]}>{body}</Text>}
    </View>
  );
}

/* ── Today's pact card ───────────────────────────────────────────────── */

function PactCard() {
  const done = 4;
  const total = 7;
  const pct = done / total;
  const C = 24;
  const circumference = 2 * Math.PI * C;

  return (
    <Card style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <View>
          <Eyebrow>Today&rsquo;s pact</Eyebrow>
          <Text style={styles.pactDoneTitle}>{done} of {total} done</Text>
        </View>
        <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={56} height={56} viewBox="0 0 56 56" style={{ position: 'absolute' }}>
            <Circle cx="28" cy="28" r={C} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
            <Circle
              cx="28"
              cy="28"
              r={C}
              fill="none"
              stroke={colors.lime}
              strokeWidth={4}
              strokeDasharray={`${pct * circumference} ${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 28 28)"
            />
          </Svg>
          <Text style={styles.pactPctNumeral}>
            {Math.round(pct * 100)}
            <Text style={styles.pactPctSuffix}>%</Text>
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 1, 1, 1, 0, 0, 0].map((d, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              backgroundColor: d ? colors.lime : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </View>
    </Card>
  );
}

/* ── Workout card ────────────────────────────────────────────────────── */

function WorkoutCard() {
  return (
    <Card style={{ marginTop: 8, padding: 0, overflow: 'hidden' }}>
      <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.workoutTitle}>Push · Bench Day</Text>
            <Text style={styles.workoutSub}>5×5 + accessories · ~52 min</Text>
          </View>
          <Chip color="lime">UP NEXT</Chip>
        </View>
      </View>
      <View style={{ padding: 18 }}>
        {[
          { name: 'Bench Press · 5×5', target: '→ 192 lb', primary: true },
          { name: 'Incline DB · 4×8',   target: '~55 lb' },
          { name: 'Cable Fly · 3×12',   target: '~30 lb' },
        ].map((row, i) => (
          <View key={i} style={styles.exerciseRow}>
            <Text style={[styles.exerciseName, !row.primary && { color: 'rgba(245,243,238,0.7)' }]}>
              {row.name}
            </Text>
            <Text
              style={[
                styles.exerciseTarget,
                { color: row.primary ? colors.lime : 'rgba(245,243,238,0.5)' },
              ]}
            >
              {row.target}
            </Text>
          </View>
        ))}
        <View style={styles.coachCue}>
          <Icon name="sparkle" size={14} color={colors.lime} />
          <Text style={styles.coachCueText}>
            You hit 185 × 5×5 last week. Aim 190–195 today.
          </Text>
        </View>
      </View>
    </Card>
  );
}

/* ── Macros card ─────────────────────────────────────────────────────── */

function MacrosCard() {
  const macros = [
    { l: 'Protein', v: '128', t: '180 g', pct: 0.71, c: colors.lime },
    { l: 'Carbs',   v: '142', t: '220 g', pct: 0.65, c: colors.sky },
    { l: 'Fat',     v: '38',  t: '70 g',  pct: 0.54, c: colors.coral },
  ];
  return (
    <Card style={{ marginTop: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 14,
        }}
      >
        <StatNumeral value="1,420" unit="KCAL" size={44} />
        <Text style={{ fontSize: 12, color: 'rgba(245,243,238,0.5)' }}>of 2,200 · 64%</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {macros.map((m) => (
          <View key={m.l} style={{ flex: 1 }}>
            <Text style={styles.macroLabel}>{m.l.toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
              <Text style={styles.macroNumeral}>{m.v}</Text>
              <Text style={styles.macroTarget}>/{m.t}</Text>
            </View>
            <View style={styles.macroTrack}>
              <View
                style={{
                  height: '100%',
                  width: `${m.pct * 100}%`,
                  backgroundColor: m.c,
                }}
              />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

/* ── Checklist row ───────────────────────────────────────────────────── */

function ChecklistRow({
  item,
  checked,
  onToggle,
  isLast,
}: {
  item: CheckItem;
  checked: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.checkRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
        item.faded && { opacity: 0.5 },
      ]}
    >
      <View style={[styles.tick, checked && styles.tickOn]}>
        {checked && <Icon name="check" size={16} color={colors.ink} strokeWidth={2.5} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkName}>{item.name}</Text>
        <Text style={styles.checkSub}>{item.sub}</Text>
      </View>
      <Icon name={item.icon} size={16} color="rgba(245,243,238,0.4)" />
    </Pressable>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontFamily: 'InterTight_700Bold',
    fontSize: 30,
    letterSpacing: -0.9,
    color: colors.textOnDark,
    marginTop: 4,
  },
  streakBanner: {
    backgroundColor: colors.lime,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  streakEyebrow: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    color: 'rgba(10,10,10,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  streakNumeral: {
    fontFamily: 'InterTight_800ExtraBold',
    fontSize: 44,
    letterSpacing: -1.76,
    color: colors.ink,
    lineHeight: 44,
  },
  streakUnit: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 14,
    color: colors.ink,
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.84,
  },
  streakNote: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.ink,
  },
  pactDoneTitle: {
    fontFamily: 'InterTight_700Bold',
    fontSize: 22,
    color: colors.textOnDark,
    marginTop: 4,
    letterSpacing: -0.44,
  },
  pactPctNumeral: {
    fontFamily: 'InterTight_800ExtraBold',
    fontSize: 16,
    color: colors.textOnDark,
  },
  pactPctSuffix: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 9,
    color: 'rgba(245,243,238,0.6)',
  },
  workoutTitle: {
    fontFamily: 'InterTight_700Bold',
    fontSize: 20,
    color: colors.textOnDark,
    letterSpacing: -0.4,
  },
  workoutSub: {
    fontSize: 13,
    color: 'rgba(245,243,238,0.55)',
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  exerciseName: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textOnDark,
  },
  exerciseTarget: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
  },
  coachCue: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    marginTop: 10,
    padding: 12,
    backgroundColor: 'rgba(218,255,63,0.08)',
    borderRadius: 12,
  },
  coachCueText: {
    fontSize: 12,
    color: 'rgba(245,243,238,0.85)',
    flex: 1,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
  macroLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    color: 'rgba(245,243,238,0.5)',
    letterSpacing: 1,
  },
  macroNumeral: {
    fontFamily: 'InterTight_800ExtraBold',
    fontSize: 24,
    color: colors.textOnDark,
    letterSpacing: -0.96,
  },
  macroTarget: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    color: 'rgba(245,243,238,0.5)',
    marginLeft: 2,
  },
  macroTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  tick: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  checkName: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textOnDark,
  },
  checkSub: {
    fontSize: 11,
    color: 'rgba(245,243,238,0.5)',
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
  noGroupTitle: {
    fontFamily: 'InterTight_800ExtraBold',
    fontSize: 28,
    color: colors.textOnDark,
    letterSpacing: -1.12,
    lineHeight: 32,
  },
  noGroupBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.textOnDarkMute,
    lineHeight: 21,
  },
  signOutLink: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 9999,
    marginTop: 8,
  },
  signOutText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.textOnDark,
  },
});
