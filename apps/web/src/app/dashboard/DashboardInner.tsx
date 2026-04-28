'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarStack, Card, Chip, Eyebrow, Icon } from '@/components/primitives';
import { HomeAuthBar } from '@/components/HomeAuthBar';
import { useAuth } from '@/lib/auth-context';
import {
  formatWeekRange,
  loadDashboardData,
  todayIndexInWeek,
  weekDayNumbers,
  type DashboardData,
} from '@/lib/group-data';
import type { GroupMemberDoc } from '@/lib/groups';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function DashboardInner() {
  const router = useRouter();
  const { user, profile, loading: authLoading, configured } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent('/dashboard')}`);
      return;
    }
    if (!profile?.currentGroupId) return;
    let cancelled = false;
    loadDashboardData(profile.currentGroupId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        if (cancelled) return;
        setLoadErr(err instanceof Error ? err.message : 'Could not load your pact');
      });
    return () => { cancelled = true; };
  }, [authLoading, user, profile, router]);

  if (!configured) return <FullPageNote title="Firebase not configured" body="Set NEXT_PUBLIC_FIREBASE_* in apps/web/.env.local and restart pnpm dev." />;
  if (authLoading || !user) return <FullPageNote title="Loading…" />;
  if (!profile?.currentGroupId) return <NoGroupPrompt />;
  if (loadErr) return <FullPageNote title="Couldn't load your pact" body={loadErr} />;
  if (!data) return <FullPageNote title="Loading your pact…" />;

  return <Dashboard data={data} />;
}

/* ── Main dashboard ──────────────────────────────────────────────────── */

function Dashboard({ data }: { data: DashboardData }) {
  const { group, members } = data;
  const week = formatWeekRange(group.currentWeek);
  const dayNums = weekDayNumbers(group.currentWeek);
  const todayIdx = todayIndexInWeek(group.currentWeek);
  const stackMembers = members.map((m) => ({ initials: m.initials, color: m.color }));

  return (
    <div style={{ background: 'var(--ink)', color: 'var(--text-on-dark)', minHeight: '100dvh' }}>
      <TopBar week={week} stackMembers={stackMembers} />
      <div style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto' }}>
        <HeroStrip group={group} members={members} />
        <WeekGrid members={members} dayNums={dayNums} todayIdx={todayIdx} />
        <BottomRow members={members} />
      </div>
    </div>
  );
}

/* ── Top bar ─────────────────────────────────────────────────────────── */

function TopBar({
  week,
  stackMembers,
}: {
  week: { label: string; range: string };
  stackMembers: Array<{ initials: string; color: string }>;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'var(--lime)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--f-display)',
              fontWeight: 800,
              fontSize: 16,
              color: 'var(--ink)',
              letterSpacing: '-0.04em',
            }}
          >
            P
          </div>
          <span className="display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-on-dark)' }}>
            PACT
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['week', 'crew', 'archive'] as const).map((t) => {
            const active = t === 'week';
            return (
              <button
                key={t}
                type="button"
                style={{
                  border: 'none',
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: active ? 'var(--text-on-dark)' : 'var(--text-on-dark-mute)',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontFamily: 'var(--f-ui)',
                  fontWeight: 600,
                  fontSize: 13,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {t === 'week' ? 'This week' : t}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--text-on-dark-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {week.label} · {week.range}
        </span>
        {stackMembers.length > 0 && <AvatarStack members={stackMembers} size={28} dark />}
        <HomeAuthBar />
      </div>
    </div>
  );
}

/* ── Hero strip ──────────────────────────────────────────────────────── */

function HeroStrip({
  group,
  members,
}: {
  group: { name: string; memberUids: string[] };
  members: GroupMemberDoc[];
}) {
  const stack = members.slice(0, 4).map((m) => ({ initials: m.initials, color: m.color }));
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.7fr 1fr 1fr',
        gap: 16,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          background: 'var(--lime)',
          color: 'var(--ink)',
          borderRadius: 22,
          padding: '22px 26px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div>
          <Eyebrow color="rgba(10,10,10,0.55)">{group.name.toUpperCase()} · ALL IN</Eyebrow>
          <div className="numeral" style={{ fontSize: 84, marginTop: 4 }}>
            23
            <span
              style={{
                fontSize: 20,
                fontFamily: 'var(--f-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginLeft: 6,
              }}
            >
              days
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
            Best: 31d (Feb) · Don&rsquo;t break it
          </div>
        </div>
        {stack.length > 0 && (
          <div style={{ display: 'flex' }}>
            {stack.map((m, i) => (
              <div key={i} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                <Avatar initials={m.initials} color={m.color} size={48} ring />
              </div>
            ))}
          </div>
        )}
      </div>

      <Card style={{ padding: '20px 22px' }}>
        <Eyebrow>WORKOUTS LOGGED</Eyebrow>
        <div className="numeral" style={{ fontSize: 60, marginTop: 4 }}>
          21
          <span style={{ fontSize: 18, color: 'var(--text-on-dark-faint)', fontFamily: 'var(--f-mono)' }}>
            /25
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 3,
            marginTop: 10,
            overflow: 'hidden',
          }}
        >
          <div style={{ height: '100%', width: '84%', background: 'var(--lime)' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 8 }}>
          4 to hit weekly goal
        </div>
      </Card>

      <Card style={{ padding: '20px 22px' }}>
        <Eyebrow>MED ADHERENCE</Eyebrow>
        <div className="numeral" style={{ fontSize: 60, marginTop: 4 }}>
          92
          <span style={{ fontSize: 18, fontFamily: 'var(--f-mono)', color: 'var(--text-on-dark-faint)' }}>
            %
          </span>
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 10 }}>
          {[1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1].map((d, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 14,
                borderRadius: 2,
                background: d ? 'var(--lime)' : 'rgba(255,255,255,0.08)',
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 8 }}>
          2 missed · last 2 weeks
        </div>
      </Card>
    </div>
  );
}

/* ── Week grid ───────────────────────────────────────────────────────── */

const ACTIVITY_PALETTE = {
  lime: '#daff3f',
  sky: '#7cd4ff',
  coral: '#ff6b4a',
  plum: '#c58cff',
} as const;

const ACTIVITY_LABEL = {
  dumbbell: 'lift',
  bowl: 'meal',
  book: 'pract',
  run: 'run',
  flame: 'pr',
} as const;

type ActivityKind = keyof typeof ACTIVITY_LABEL;
type ActivityColor = keyof typeof ACTIVITY_PALETTE;
type Activity = { color: ActivityColor; kind: ActivityKind };

function seededRand(uid: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
  h = (h * 1103515245 + 12345) | 0;
  return ((h >>> 16) & 0x7fff) / 0x7fff;
}

function memberWeekActivity(uid: string): Activity[][] {
  const palette: Array<Activity[]> = [
    [{ color: 'lime', kind: 'dumbbell' }],
    [{ color: 'sky', kind: 'bowl' }],
    [{ color: 'lime', kind: 'dumbbell' }, { color: 'coral', kind: 'flame' }],
    [{ color: 'plum', kind: 'book' }],
    [{ color: 'sky', kind: 'run' }],
    [],
  ];
  return Array.from({ length: 7 }, (_, day) => {
    const r = seededRand(uid, day + 1);
    return palette[Math.floor(r * palette.length)] ?? [];
  });
}

function ActivityPill({ activity }: { activity: Activity }) {
  return (
    <div
      style={{
        background: ACTIVITY_PALETTE[activity.color],
        color: 'var(--ink)',
        borderRadius: 8,
        padding: '5px 8px',
        fontSize: 10,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <Icon name={activity.kind} size={11} color="#0a0a0a" strokeWidth={2} />
      <span style={{ textTransform: 'capitalize' }}>{ACTIVITY_LABEL[activity.kind]}</span>
    </div>
  );
}

function WeekGrid({
  members,
  dayNums,
  todayIdx,
}: {
  members: GroupMemberDoc[];
  dayNums: number[];
  todayIdx: number;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 12,
        }}
      >
        <div>
          <Eyebrow>THE WEEK · MON → SUN</Eyebrow>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            Together this week
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Chip color="ghost"><DotSwatch color="#daff3f" />WORKOUT</Chip>
          <Chip color="ghost"><DotSwatch color="#7cd4ff" />MEAL</Chip>
          <Chip color="ghost"><DotSwatch color="#ff6b4a" />PR</Chip>
          <Chip color="ghost"><DotSwatch color="#c58cff" />PRACTICE</Chip>
        </div>
      </div>

      <Card padded={false} style={{ overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px repeat(7, 1fr)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ padding: '14px 18px' }} />
          {WEEKDAYS.map((d, i) => {
            const isToday = i === todayIdx;
            return (
              <div
                key={d}
                style={{
                  padding: '14px 12px',
                  textAlign: 'center',
                  borderLeft: '1px solid rgba(255,255,255,0.04)',
                  background: isToday ? 'rgba(218,255,63,0.04)' : 'transparent',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--f-mono)',
                    color: 'var(--text-on-dark-mute)',
                    textTransform: 'uppercase',
                  }}
                >
                  {d}
                </div>
                <div
                  className="numeral"
                  style={{
                    fontSize: 22,
                    marginTop: 2,
                    color: isToday ? 'var(--lime)' : 'var(--text-on-dark)',
                  }}
                >
                  {dayNums[i] ?? ''}
                </div>
              </div>
            );
          })}
        </div>

        {members.slice(0, 6).map((m, idx) => {
          const schedule = memberWeekActivity(m.uid);
          const completed = schedule.filter((day) => day.length > 0).length;
          return (
            <div
              key={m.uid}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px repeat(7, 1fr)',
                borderBottom:
                  idx < Math.min(members.length, 6) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                minHeight: 90,
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Avatar initials={m.initials} color={m.color} size={32} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-on-dark-mute)' }}>
                    {completed}/7
                  </div>
                </div>
              </div>
              {schedule.map((day, di) => {
                const isToday = di === todayIdx;
                return (
                  <div
                    key={di}
                    style={{
                      padding: 8,
                      borderLeft: '1px solid rgba(255,255,255,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      background: isToday ? 'rgba(218,255,63,0.02)' : 'transparent',
                    }}
                  >
                    {day.length === 0 ? (
                      <div style={{ height: 8 }} />
                    ) : (
                      day.map((a, k) => <ActivityPill key={k} activity={a} />)
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function DotSwatch({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        background: color,
        display: 'inline-block',
      }}
    />
  );
}

/* ── Bottom row ──────────────────────────────────────────────────────── */

function BottomRow({ members }: { members: GroupMemberDoc[] }) {
  const m1 = members[0];
  const m2 = members[1];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 14,
          }}
        >
          <div>
            <Eyebrow>WEIGHT · LAST 8 WEEKS</Eyebrow>
            <div className="display" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
              Trends
            </div>
          </div>
          <Chip color="lime">−4.2 LB</Chip>
        </div>
        <svg viewBox="0 0 320 120" style={{ width: '100%', height: 120 }}>
          <defs>
            <linearGradient id="wfade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#daff3f" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#daff3f" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,40 L40,42 L80,38 L120,46 L160,52 L200,58 L240,68 L280,72 L320,78 L320,120 L0,120 Z"
            fill="url(#wfade)"
          />
          <path
            d="M0,40 L40,42 L80,38 L120,46 L160,52 L200,58 L240,68 L280,72 L320,78"
            stroke="#daff3f"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M0,60 L40,58 L80,62 L120,55 L160,58 L200,52 L240,55 L280,50 L320,48"
            stroke="#ff6b4a"
            strokeWidth="2"
            fill="none"
            strokeDasharray="3 3"
          />
          {[
            [0, 40], [40, 42], [80, 38], [120, 46], [160, 52],
            [200, 58], [240, 68], [280, 72], [320, 78],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill="#daff3f" />
          ))}
        </svg>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {m1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 8, height: 2, background: '#daff3f' }} />
              {m1.name}
            </div>
          )}
          {m2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 8, height: 2, background: '#ff6b4a' }} />
              {m2.name}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 14,
          }}
        >
          <div>
            <Eyebrow>FRIDGE & PANTRY</Eyebrow>
            <div className="display" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
              Inventory
            </div>
          </div>
          <Chip color="ghost">28 ITEMS</Chip>
        </div>
        {[
          { name: 'Eggs', meter: 0.66, sub: '8 of 12 left' },
          { name: 'Chicken breast', meter: 0.2, sub: 'Running low' },
          { name: 'Olive oil', meter: 0.7, sub: '70% left' },
          { name: 'Quinoa', meter: 0.15, sub: 'Add to list' },
          { name: 'Greek yogurt', meter: 0.4, sub: '3 servings' },
        ].map((it, i) => {
          const low = it.meter < 0.25;
          return (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 500 }}>{it.name}</span>
                <span
                  className="mono"
                  style={{ color: low ? '#ff6b4a' : 'var(--text-on-dark-mute)' }}
                >
                  {it.sub}
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 2,
                  marginTop: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${it.meter * 100}%`,
                    background: low ? '#ff6b4a' : 'var(--lime)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </Card>

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 14,
          }}
        >
          <div>
            <Eyebrow>CREW · LIVE</Eyebrow>
            <div className="display" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
              Recent
            </div>
          </div>
          <Icon name="chat" size={18} color="rgba(245,243,238,0.5)" />
        </div>
        {sampleChatter(members).map((p, i, arr) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 0',
              borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            <Avatar initials={p.initials} color={p.color} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600 }}>{p.who}</span>
                <span
                  className="mono"
                  style={{ fontSize: 10, color: 'var(--text-on-dark-faint)' }}
                >
                  {p.t}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 2 }}>
                {p.msg}
              </div>
            </div>
            <Chip color="ghost">{p.tag}</Chip>
          </div>
        ))}
      </Card>
    </div>
  );
}

function sampleChatter(
  members: GroupMemberDoc[],
): Array<{ who: string; initials: string; color: string; t: string; msg: string; tag: string }> {
  const m0 = members[0];
  const m1 = members[1];
  const m2 = members[2];
  const out: Array<{ who: string; initials: string; color: string; t: string; msg: string; tag: string }> = [];
  if (m0) out.push({ who: m0.name, initials: m0.initials, color: m0.color, t: '22m', msg: 'Crushed 5k pace', tag: 'PR' });
  if (m1) out.push({ who: m1.name, initials: m1.initials, color: m1.color, t: '1h', msg: 'Lunch was 52g protein', tag: 'MEAL' });
  if (m2) out.push({ who: m2.name, initials: m2.initials, color: m2.color, t: '3h', msg: 'Journaling streak: 12 days', tag: 'PRAC' });
  out.push({ who: 'Pact', initials: '✦', color: '#daff3f', t: '5h', msg: 'Crew goal: 21/25 workouts', tag: 'NUDGE' });
  return out;
}

/* ── Empty / loading states ──────────────────────────────────────────── */

function FullPageNote({ title, body }: { title: string; body?: string }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--ink)',
        color: 'var(--text-on-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <h1 className="display" style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {title}
        </h1>
        {body && (
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', marginTop: 8, lineHeight: 1.5 }}>
            {body}
          </p>
        )}
      </div>
    </div>
  );
}

function NoGroupPrompt() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--ink)',
        color: 'var(--text-on-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Eyebrow>NO PACT YET</Eyebrow>
          <h1 className="display" style={{ fontSize: 28, fontWeight: 800, marginTop: 8, marginBottom: 6 }}>
            You&rsquo;re not in a pact yet.
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            Make one with your people, or join one with an invite code.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <Link href="/onboarding" className="btn btn-lime" style={{ padding: '12px 18px', fontSize: 13 }}>
            Make a pact
            <Icon name="arrow" size={14} color="#0a0a0a" strokeWidth={2.5} />
          </Link>
          <Link href="/onboarding/join" className="btn btn-ghost-dark" style={{ padding: '12px 18px', fontSize: 13 }}>
            I have an invite code
          </Link>
        </div>
      </div>
    </div>
  );
}

