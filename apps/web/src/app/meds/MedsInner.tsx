'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Brand, Card, Eyebrow, Icon } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import {
  UI_DAY_LABELS,
  addSchedule,
  deleteSchedule,
  loadSchedules,
  loadTicksForDay,
  setTicked,
  todayDateString,
  todayUIIndex,
  uiIndexToJsDay,
  type MedSchedule,
  type MedTick,
} from '@/lib/meds';

export function MedsInner() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [schedules, setSchedules] = useState<MedSchedule[]>([]);
  const [ticks, setTicks] = useState<MedTick[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [working, setWorking] = useState(false);

  const todayDate = useMemo(() => todayDateString(), []);
  const todayJsDay = useMemo(() => new Date().getDay(), []);
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase(),
    [],
  );

  // Initial load
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent('/meds')}`);
      return;
    }
    let cancelled = false;
    Promise.all([loadSchedules(user.uid), loadTicksForDay(user.uid, todayDate)])
      .then(([s, t]) => {
        if (cancelled) return;
        setSchedules(s);
        setTicks(t);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadErr(err instanceof Error ? err.message : 'Could not load');
      });
    return () => { cancelled = true; };
  }, [loading, user, router, todayDate]);

  const tickedIds = useMemo(() => new Set(ticks.map((t) => t.scheduleId)), [ticks]);

  const dueToday = useMemo(
    () => schedules.filter((s) => s.active && s.daysOfWeek.includes(todayJsDay)),
    [schedules, todayJsDay],
  );

  const handleToggle = useCallback(
    async (scheduleId: string) => {
      if (!user) return;
      const wasTicked = tickedIds.has(scheduleId);
      // Optimistic update
      if (wasTicked) {
        setTicks((prev) => prev.filter((t) => t.scheduleId !== scheduleId));
      } else {
        setTicks((prev) => [
          ...prev,
          { id: `${scheduleId}_${todayDate}`, scheduleId, date: todayDate },
        ]);
      }
      try {
        await setTicked({
          uid: user.uid,
          scheduleId,
          date: todayDate,
          ticked: !wasTicked,
        });
      } catch (err) {
        // Roll back on failure
        if (wasTicked) {
          setTicks((prev) => [
            ...prev,
            { id: `${scheduleId}_${todayDate}`, scheduleId, date: todayDate },
          ]);
        } else {
          setTicks((prev) => prev.filter((t) => t.scheduleId !== scheduleId));
        }
        console.error('Failed to toggle tick', err);
      }
    },
    [user, tickedIds, todayDate],
  );

  const handleAdd = useCallback(
    async (title: string, daysOfWeek: number[]) => {
      if (!user || working) return;
      setWorking(true);
      try {
        const fresh = await addSchedule({ uid: user.uid, title, daysOfWeek });
        setSchedules((prev) => [...prev, fresh]);
        setAdding(false);
      } catch (err) {
        console.error('Failed to add schedule', err);
      } finally {
        setWorking(false);
      }
    },
    [user, working],
  );

  const handleDelete = useCallback(
    async (scheduleId: string) => {
      if (!user) return;
      // Optimistic
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      setTicks((prev) => prev.filter((t) => t.scheduleId !== scheduleId));
      try {
        await deleteSchedule(user.uid, scheduleId);
      } catch (err) {
        console.error('Failed to delete schedule', err);
      }
    },
    [user],
  );

  return (
    <main style={pageStyle}>
      <div style={shell}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <Link href="/dashboard" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none' }}>
            ← BACK
          </Link>
        </header>

        <div>
          <Eyebrow>PILLS &amp; SUPPLEMENTS · PRIVATE</Eyebrow>
          <h1 style={{ ...display, fontSize: 'clamp(28px, 7vw, 32px)', fontWeight: 700, marginTop: 6, marginBottom: 6 }}>
            What are you taking?
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            Crew never sees this — yours alone. Add anything you want to remember to take.
          </p>
        </div>

        {loadErr && (
          <Card style={{ background: 'rgba(255,107,74,0.08)', borderColor: 'rgba(255,107,74,0.3)' }}>
            <Eyebrow color="var(--coral)">ERROR</Eyebrow>
            <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, color: 'var(--coral)' }}>{loadErr}</p>
          </Card>
        )}

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Eyebrow>TODAY · {todayLabel}</Eyebrow>
            <span style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)' }}>
              {dueToday.filter((s) => tickedIds.has(s.id)).length} / {dueToday.length} done
            </span>
          </div>
          {dueToday.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: '12px 0 0' }}>
              {schedules.length === 0
                ? 'Nothing tracked yet. Add your first item below.'
                : 'Nothing due today.'}
            </p>
          ) : (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {dueToday.map((s) => (
                <ChecklistRow
                  key={s.id}
                  title={s.title}
                  ticked={tickedIds.has(s.id)}
                  onToggle={() => handleToggle(s.id)}
                />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Eyebrow>SCHEDULES</Eyebrow>
            {!adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="btn btn-ghost-dark"
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                <Icon name="plus" size={12} color="var(--text-on-dark)" strokeWidth={2.5} />
                Add new
              </button>
            )}
          </div>

          {schedules.length === 0 && !adding && (
            <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: '12px 0 0' }}>
              No schedules. Tap <strong style={{ color: 'var(--text-on-dark)' }}>Add new</strong>
              {' '}to define what you&rsquo;re tracking.
            </p>
          )}

          {schedules.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column' }}>
              {schedules.map((s, i, arr) => (
                <ScheduleRow
                  key={s.id}
                  schedule={s}
                  isLast={i === arr.length - 1}
                  onDelete={() => handleDelete(s.id)}
                />
              ))}
            </div>
          )}

          {adding && (
            <div style={{ marginTop: 14 }}>
              <AddScheduleForm
                onCancel={() => setAdding(false)}
                onSave={handleAdd}
                disabled={working}
              />
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

/* ── Today checklist row ─────────────────────────────────────────────── */

function ChecklistRow({
  title,
  ticked,
  onToggle,
}: {
  title: string;
  ticked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'inherit',
        textAlign: 'left',
      }}
    >
      <span style={ticked ? tickOn : tickOff}>
        {ticked && <Icon name="check" size={16} color="#0a0a0a" strokeWidth={2.5} />}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          textDecoration: ticked ? 'line-through' : 'none',
          color: ticked ? 'var(--text-on-dark-mute)' : 'var(--text-on-dark)',
          flex: 1,
        }}
      >
        {title}
      </span>
    </button>
  );
}

/* ── Schedule list row ───────────────────────────────────────────────── */

function ScheduleRow({
  schedule,
  isLast,
  onDelete,
}: {
  schedule: MedSchedule;
  isLast: boolean;
  onDelete: () => void;
}) {
  const cadence = describeCadence(schedule.daysOfWeek);
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{schedule.title}</div>
        <div style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)', marginTop: 2 }}>
          {cadence}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${schedule.title}`}
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="x" size={14} color="var(--text-on-dark-faint)" strokeWidth={2} />
      </button>
    </div>
  );
}

function describeCadence(daysOfWeek: number[]): string {
  if (daysOfWeek.length === 7) return 'EVERY DAY';
  if (daysOfWeek.length === 0) return 'INACTIVE';
  // Sort + map to UI labels (Mon-first)
  const sorted = [...daysOfWeek].sort((a, b) => {
    const ai = a === 0 ? 6 : a - 1;
    const bi = b === 0 ? 6 : b - 1;
    return ai - bi;
  });
  return sorted
    .map((js) => {
      const ui = js === 0 ? 6 : js - 1;
      return ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][ui];
    })
    .join(' · ');
}

/* ── Add schedule form ───────────────────────────────────────────────── */

function AddScheduleForm({
  onCancel,
  onSave,
  disabled,
}: {
  onCancel: () => void;
  onSave: (title: string, daysOfWeek: number[]) => void;
  disabled: boolean;
}) {
  const todayUi = todayUIIndex();
  const [title, setTitle] = useState('');
  // Default to "every day"
  const [days, setDays] = useState<boolean[]>(() => [true, true, true, true, true, true, true]);

  const toggleDay = (uiIdx: number) => {
    setDays((prev) => prev.map((d, i) => (i === uiIdx ? !d : d)));
  };

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const selected = days
      .map((on, uiIdx) => (on ? uiIndexToJsDay(uiIdx) : -1))
      .filter((d) => d >= 0);
    if (selected.length === 0) return;
    onSave(trimmed, selected);
  };

  const dayCount = days.filter(Boolean).length;
  const allSelected = dayCount === 7;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Eyebrow>NEW SCHEDULE</Eyebrow>
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Vitamin D, Magnesium, GLP-1"
        style={inputStyle}
      />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {UI_DAY_LABELS.map((label, uiIdx) => {
          const on = days[uiIdx];
          const isToday = uiIdx === todayUi;
          return (
            <button
              key={uiIdx}
              type="button"
              onClick={() => toggleDay(uiIdx)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${on ? 'var(--lime)' : 'rgba(255,255,255,0.1)'}`,
                background: on ? 'var(--lime)' : 'transparent',
                color: on ? 'var(--ink)' : 'var(--text-on-dark)',
                fontFamily: 'var(--f-ui)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                position: 'relative',
              }}
              aria-pressed={on}
              aria-label={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][uiIdx]}
            >
              {label}
              {isToday && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: -3,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    background: 'var(--lime)',
                  }}
                />
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setDays(allSelected ? [false, false, false, false, false, false, false] : [true, true, true, true, true, true, true])}
          style={{
            ...mono,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-on-dark-mute)',
            fontSize: 11,
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: 0,
            marginLeft: 4,
          }}
        >
          {allSelected ? 'CLEAR' : 'EVERY DAY'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !title.trim() || dayCount === 0}
          className="btn btn-lime"
          style={{
            padding: '12px 18px',
            fontSize: 13,
            opacity: disabled || !title.trim() || dayCount === 0 ? 0.5 : 1,
          }}
        >
          {disabled ? 'Saving…' : 'Save'}
          <Icon name="check" size={12} color="#0a0a0a" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost-dark"
          style={{ padding: '12px 18px', fontSize: 13 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────── */

const pageStyle: CSSProperties = {
  minHeight: '100dvh',
  background: 'var(--ink)',
  color: 'var(--text-on-dark)',
  padding: '40px 24px',
};

const shell: CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
};

const display: CSSProperties = {
  fontFamily: 'var(--f-display)',
  letterSpacing: '-0.02em',
};

const mono: CSSProperties = {
  fontFamily: 'var(--f-mono)',
};

const inputStyle: CSSProperties = {
  background: '#0e0d0a',
  color: 'var(--text-on-dark)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '12px 14px',
  fontFamily: 'var(--f-ui)',
  fontSize: 15,
  outline: 'none',
  width: '100%',
};

const tickBase: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 14,
  borderWidth: 2,
  borderStyle: 'solid',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'all 0.15s ease',
};

const tickOn: CSSProperties = {
  ...tickBase,
  background: 'var(--lime)',
  borderColor: 'var(--lime)',
};

const tickOff: CSSProperties = {
  ...tickBase,
  background: 'transparent',
  borderColor: 'rgba(255,255,255,0.25)',
};
