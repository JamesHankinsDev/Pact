'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, Brand, Card, Chip, Eyebrow, Icon } from '@/components/primitives';
import { useAuth } from '@/lib/auth-context';
import { getFirebase } from '@/lib/firebase';
import {
  createHousehold,
  joinHouseholdByCode,
  loadHousehold,
  loadHouseholdMembers,
  normalizeHouseholdInviteCode,
  type HouseholdDoc,
  type HouseholdMemberDoc,
} from '@/lib/households';
import { loadHouseholdInventory, type InventoryRecord } from '@/lib/inventory';
import {
  loadBodyProfile,
  loadNutritionGoals,
  type BodyProfile,
  type NutritionGoals,
} from '@/lib/nutrition-goals';
import {
  addShoppingItems,
  clearBoughtItems,
  loadShoppingList,
  removeShoppingItem,
  toggleShoppingItem,
  type ShoppingItem as ShoppingListItem,
} from '@/lib/shopping';

type Mode = 'choose' | 'create' | 'join';

type State =
  | { status: 'loading' }
  | { status: 'no-household' }
  | { status: 'in-household'; household: HouseholdDoc; members: HouseholdMemberDoc[] }
  | { status: 'error'; message: string };

export function HouseholdInner() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [mode, setMode] = useState<Mode>('choose');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent('/household')}`);
      return;
    }
    if (!profile) {
      setState({ status: 'loading' });
      return;
    }
    if (!profile.currentHouseholdId) {
      setState({ status: 'no-household' });
      return;
    }
    let cancelled = false;
    Promise.all([
      loadHousehold(profile.currentHouseholdId),
      loadHouseholdMembers(profile.currentHouseholdId),
    ])
      .then(([h, members]) => {
        if (cancelled) return;
        if (!h) setState({ status: 'no-household' });
        else setState({ status: 'in-household', household: h, members });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ status: 'error', message: e instanceof Error ? e.message : 'Could not load household' });
      });
    return () => { cancelled = true; };
  }, [authLoading, user, profile, router]);

  const refresh = () => setState({ status: 'loading' });

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--ink)', color: 'var(--text-on-dark)', padding: '32px 24px 64px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <Link href="/dashboard" style={{ ...mono, color: 'var(--text-on-dark-mute)', textDecoration: 'none', fontSize: 12 }}>
            ← DASHBOARD
          </Link>
        </header>

        <div>
          <Eyebrow>HOUSEHOLD</Eyebrow>
          <h1 style={{ ...display, fontSize: 'clamp(28px, 7vw, 32px)', fontWeight: 700, marginTop: 6, marginBottom: 6 }}>
            Fridge &amp; pantry crew
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', margin: 0, lineHeight: 1.5 }}>
            The people you share a kitchen with. Independent of your pact — your roommate doesn&rsquo;t need to be on
            the same accountability circle.
          </p>
        </div>

        {state.status === 'loading' && (
          <Card>
            <p style={{ fontSize: 13, margin: 0, color: 'var(--text-on-dark-mute)' }}>Loading…</p>
          </Card>
        )}

        {state.status === 'error' && (
          <Card style={{ borderColor: 'rgba(255,107,74,0.3)', background: 'rgba(255,107,74,0.08)' }}>
            <Eyebrow color="var(--coral)">ERROR</Eyebrow>
            <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, color: 'var(--coral)' }}>{state.message}</p>
          </Card>
        )}

        {state.status === 'no-household' && user && (
          <NoHousehold mode={mode} setMode={setMode} uid={user.uid} onCreated={refresh} onJoined={refresh} />
        )}

        {state.status === 'in-household' && user && (
          <InHousehold household={state.household} members={state.members} selfUid={user.uid} />
        )}
      </div>
    </main>
  );
}

/* ── No household yet ────────────────────────────────────────────────── */

function NoHousehold({
  mode,
  setMode,
  uid,
  onCreated,
  onJoined,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  uid: string;
  onCreated: () => void;
  onJoined: () => void;
}) {
  if (mode === 'create') return <CreateForm uid={uid} onCancel={() => setMode('choose')} onCreated={onCreated} />;
  if (mode === 'join') return <JoinForm uid={uid} onCancel={() => setMode('choose')} onJoined={onJoined} />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <button
        type="button"
        onClick={() => setMode('create')}
        style={chooseBtn}
      >
        <span style={chooseIcon}>
          <Icon name="home" size={20} color="var(--lime)" />
        </span>
        <div>
          <div style={chooseLabel}>Make a household</div>
          <div style={chooseSub}>Start fresh, share your code</div>
        </div>
      </button>
      <button
        type="button"
        onClick={() => setMode('join')}
        style={chooseBtn}
      >
        <span style={chooseIcon}>
          <Icon name="user" size={20} color="var(--lime)" />
        </span>
        <div>
          <div style={chooseLabel}>Join with a code</div>
          <div style={chooseSub}>Got a HEARTH-XYZ link?</div>
        </div>
      </button>
    </div>
  );
}

function CreateForm({
  uid,
  onCancel,
  onCreated,
}: {
  uid: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr('Give your household a name first.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await createHousehold({ uid, householdName: trimmed });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create household');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Eyebrow>NEW HOUSEHOLD</Eyebrow>
      <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
        Pick a name only your household sees. We&rsquo;ll generate an invite code you can send to roommates / partner /
        family.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Hayes House"
        maxLength={40}
        style={input}
      />
      {err && (
        <p style={{ fontSize: 12, color: 'var(--coral)', marginTop: 8, marginBottom: 0 }}>{err}</p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !name.trim()}
          className="btn btn-lime"
          style={{ padding: '12px 18px', fontSize: 14, opacity: busy || !name.trim() ? 0.5 : 1 }}
        >
          {busy ? 'Creating…' : 'Create household'}
          <Icon name="arrow" size={14} color="#0a0a0a" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="btn btn-ghost-dark"
          style={{ padding: '12px 16px', fontSize: 13 }}
        >
          Cancel
        </button>
      </div>
    </Card>
  );
}

function JoinForm({
  uid,
  onCancel,
  onJoined,
}: {
  uid: string;
  onCancel: () => void;
  onJoined: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const normalized = normalizeHouseholdInviteCode(code);
    if (!normalized) {
      setErr("That doesn't look like a code. Paste the link or just the code at the end.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await joinHouseholdByCode(uid, normalized);
      onJoined();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not join household');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Eyebrow>JOIN HOUSEHOLD</Eyebrow>
      <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
        Paste the link or the code at the end (e.g. HEARTH-K7P).
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="HEARTH-K7P"
        maxLength={120}
        style={{ ...input, fontFamily: 'var(--f-mono)', textTransform: 'uppercase' }}
      />
      {err && (
        <p style={{ fontSize: 12, color: 'var(--coral)', marginTop: 8, marginBottom: 0 }}>{err}</p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !code.trim()}
          className="btn btn-lime"
          style={{ padding: '12px 18px', fontSize: 14, opacity: busy || !code.trim() ? 0.5 : 1 }}
        >
          {busy ? 'Joining…' : 'Join household'}
          <Icon name="arrow" size={14} color="#0a0a0a" strokeWidth={2.5} />
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="btn btn-ghost-dark" style={{ padding: '12px 16px', fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </Card>
  );
}

/* ── Has household ───────────────────────────────────────────────────── */

function InHousehold({
  household,
  members,
  selfUid,
}: {
  household: HouseholdDoc;
  members: HouseholdMemberDoc[];
  selfUid: string;
}) {
  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/household?code=${household.inviteCode}`
      : `/household?code=${household.inviteCode}`;
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const copy = async (text: string, kind: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1500);
    } catch {
      // no-op when clipboard unavailable
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ background: 'rgba(218,255,63,0.06)', borderColor: 'rgba(218,255,63,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <Eyebrow color="var(--lime)">HOUSEHOLD</Eyebrow>
            <div style={{ ...display, fontSize: 24, fontWeight: 700, marginTop: 4 }}>{household.name}</div>
          </div>
          <Chip color="ghost">
            {household.memberUids.length}/6 MEMBER{household.memberUids.length === 1 ? '' : 'S'}
          </Chip>
        </div>
      </Card>

      <Card>
        <Eyebrow>MEMBERS</Eyebrow>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((m) => (
            <div
              key={m.uid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <Avatar initials={m.initials} color={m.color} size={28} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                {m.name}
                {m.uid === selfUid && (
                  <span style={{ ...mono, fontSize: 9, color: 'var(--text-on-dark-faint)', marginLeft: 6, letterSpacing: '0.1em' }}>
                    YOU
                  </span>
                )}
              </span>
              <span style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
                JOINED {new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Eyebrow>INVITE</Eyebrow>
        <p style={{ fontSize: 13, color: 'var(--text-on-dark-mute)', marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
          Share the code or link. Anyone you trust to share a fridge with — they don&rsquo;t need to be in your pact.
        </p>

        <div
          style={{
            background: 'rgba(218,255,63,0.08)',
            border: '1px solid rgba(218,255,63,0.2)',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>CODE</div>
          <div style={{ ...display, fontSize: 28, fontWeight: 800, letterSpacing: '0.04em', color: 'var(--lime)', wordBreak: 'break-all' }}>
            {household.inviteCode}
          </div>
          <button
            type="button"
            onClick={() => copy(household.inviteCode, 'code')}
            className="btn btn-ghost-dark"
            style={{ padding: '10px 14px', fontSize: 13, alignSelf: 'flex-start' }}
          >
            {copied === 'code' ? 'Copied!' : 'Copy code'}
            <Icon name={copied === 'code' ? 'check' : 'upload'} size={13} color="currentColor" strokeWidth={2} />
          </button>
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>LINK</div>
          <div
            style={{
              ...mono,
              fontSize: 12,
              color: 'var(--text-on-dark-mute)',
              padding: '10px 12px',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              wordBreak: 'break-all',
            }}
          >
            {inviteUrl}
          </div>
          <button
            type="button"
            onClick={() => copy(inviteUrl, 'link')}
            className="btn btn-lime"
            style={{ padding: '12px 16px', fontSize: 13, alignSelf: 'flex-start' }}
          >
            {copied === 'link' ? 'Copied!' : 'Copy link'}
            <Icon name={copied === 'link' ? 'check' : 'upload'} size={13} color="#0a0a0a" strokeWidth={2.5} />
          </button>
        </div>
      </Card>

      <Card>
        <Eyebrow>WHAT&rsquo;S SHARED</Eyebrow>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '10px 0 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <SharedRow icon="cart" label="Fridge & pantry inventory" />
          <SharedRow icon="bag" label="Shopping list" />
        </ul>
      </Card>

      <ShoppingListProvider householdId={household.id} selfUid={selfUid}>
        <MealSuggestionsSection householdId={household.id} />
        <ShoppingListSection />
      </ShoppingListProvider>
    </div>
  );
}

function SharedRow({ icon, label, hint }: { icon: 'cart' | 'bag'; label: string; hint?: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'rgba(218,255,63,0.1)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={14} color="var(--lime)" />
      </span>
      <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
      {hint && <span style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-faint)' }}>{hint}</span>}
    </li>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────── */

/* ── Shopping list (persistent) ──────────────────────────────────────── */

type ShoppingContextValue = {
  list: ShoppingListItem[];
  addingId: string | null; // tracks which item key is being added (for AI rows)
  addAi: (item: { name: string; quantity: string; estCost?: number; unlocks?: string }) => Promise<void>;
  addManual: (name: string, quantity: string) => Promise<void>;
  toggle: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearBought: () => Promise<void>;
  isOnList: (name: string) => boolean;
  refreshing: boolean;
};

const ShoppingContext = createContext<ShoppingContextValue | null>(null);

function useShopping(): ShoppingContextValue {
  const ctx = useContext(ShoppingContext);
  if (!ctx) {
    throw new Error('useShopping must be used inside <ShoppingListProvider>');
  }
  return ctx;
}

function ShoppingListProvider({
  householdId,
  selfUid,
  children,
}: {
  householdId: string;
  selfUid: string;
  children: ReactNode;
}) {
  const [list, setList] = useState<ShoppingListItem[]>([]);
  const [refreshing, setRefreshing] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await loadShoppingList(householdId);
      setList(next.items);
    } finally {
      setRefreshing(false);
    }
  }, [householdId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const isOnList = useCallback(
    (name: string) => {
      const key = name.trim().toLowerCase();
      return list.some((it) => it.name.trim().toLowerCase() === key);
    },
    [list],
  );

  const addAi = useCallback(
    async (item: { name: string; quantity: string; estCost?: number; unlocks?: string }) => {
      const key = item.name.trim().toLowerCase();
      setAddingId(key);
      try {
        await addShoppingItems(householdId, selfUid, [
          {
            name: item.name,
            quantity: item.quantity,
            estCost: item.estCost ?? null,
            source: 'ai-suggestion',
            unlocks: item.unlocks,
          },
        ]);
        await refresh();
      } finally {
        setAddingId(null);
      }
    },
    [householdId, selfUid, refresh],
  );

  const addManual = useCallback(
    async (name: string, quantity: string) => {
      if (!name.trim()) return;
      await addShoppingItems(householdId, selfUid, [
        {
          name,
          quantity: quantity.trim() || '1',
          source: 'manual',
        },
      ]);
      await refresh();
    },
    [householdId, selfUid, refresh],
  );

  const toggle = useCallback(async (id: string) => {
    // Optimistic toggle for snappiness; server then truth-syncs via refresh.
    setList((prev) => prev.map((it) => (it.id === id ? { ...it, bought: !it.bought } : it)));
    await toggleShoppingItem(householdId, id);
    await refresh();
  }, [householdId, refresh]);

  const remove = useCallback(async (id: string) => {
    setList((prev) => prev.filter((it) => it.id !== id));
    await removeShoppingItem(householdId, id);
    await refresh();
  }, [householdId, refresh]);

  const clearBought = useCallback(async () => {
    await clearBoughtItems(householdId);
    await refresh();
  }, [householdId, refresh]);

  const value = useMemo<ShoppingContextValue>(
    () => ({ list, addingId, addAi, addManual, toggle, remove, clearBought, isOnList, refreshing }),
    [list, addingId, addAi, addManual, toggle, remove, clearBought, isOnList, refreshing],
  );

  return <ShoppingContext.Provider value={value}>{children}</ShoppingContext.Provider>;
}

function ShoppingListSection() {
  const { list, toggle, remove, clearBought, addManual, refreshing } = useShopping();
  const boughtCount = list.filter((it) => it.bought).length;
  const remaining = list.length - boughtCount;
  const sorted = useMemo(
    () =>
      [...list].sort((a, b) => {
        if (a.bought !== b.bought) return a.bought ? 1 : -1; // unbought first
        return b.addedAt - a.addedAt;
      }),
    [list],
  );

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Eyebrow>SHOPPING LIST</Eyebrow>
          <div style={{ ...display, fontSize: 18, fontWeight: 700, marginTop: 2 }}>
            {list.length === 0 ? 'Empty' : `${remaining} to buy · ${boughtCount} got`}
          </div>
        </div>
        {boughtCount > 0 && (
          <button
            type="button"
            onClick={() => void clearBought()}
            className="btn btn-ghost-dark"
            style={{ padding: '8px 12px', fontSize: 12 }}
          >
            Clear bought
          </button>
        )}
      </div>

      <ManualAddRow onAdd={addManual} />

      {refreshing && list.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', margin: '12px 0 0' }}>Loading…</p>
      ) : list.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', margin: '12px 0 0', lineHeight: 1.5 }}>
          Nothing here yet. Add items manually above, or tap <strong style={{ color: 'var(--lime)' }}>+ Add</strong> on
          a smart suggestion below to drop it onto the list.
        </p>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((it) => (
            <ShoppingListRow key={it.id} item={it} onToggle={toggle} onRemove={remove} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ManualAddRow({ onAdd }: { onAdd: (name: string, quantity: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onAdd(name, qty);
      setName('');
      setQty('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 12,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add an item…"
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        style={{ ...input, flex: '1 1 200px' }}
      />
      <input
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder="qty"
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        style={{ ...input, width: 90, flex: '0 0 90px' }}
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!name.trim() || busy}
        className="btn btn-ghost-dark"
        style={{
          padding: '12px 14px',
          fontSize: 13,
          opacity: !name.trim() || busy ? 0.5 : 1,
        }}
      >
        Add
      </button>
    </div>
  );
}

function ShoppingListRow({
  item,
  onToggle,
  onRemove,
}: {
  item: ShoppingListItem;
  onToggle: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        opacity: item.bought ? 0.55 : 1,
      }}
    >
      <button
        type="button"
        onClick={() => void onToggle(item.id)}
        aria-label={item.bought ? 'Mark not bought' : 'Mark bought'}
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          border: item.bought ? '2px solid var(--lime)' : '2px solid rgba(255,255,255,0.25)',
          background: item.bought ? 'var(--lime)' : 'transparent',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {item.bought && <Icon name="check" size={12} color="#0a0a0a" strokeWidth={2.5} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              textDecoration: item.bought ? 'line-through' : 'none',
            }}
          >
            {item.name}
          </span>
          <span style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)' }}>
            {item.quantity.toUpperCase()}
            {item.estCost != null ? ` · ~$${item.estCost.toFixed(2)}` : ''}
          </span>
        </div>
        {item.unlocks && (
          <div style={{ fontSize: 11, color: 'var(--text-on-dark-mute)', marginTop: 4, lineHeight: 1.4 }}>
            {item.unlocks}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => void onRemove(item.id)}
        aria-label="Remove item"
        style={{
          width: 24,
          height: 24,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="x" size={12} color="var(--text-on-dark-faint)" />
      </button>
    </div>
  );
}

/* ── Smart suggestions ───────────────────────────────────────────────── */

type MealSuggestion = {
  name: string;
  usesFromInventory: string[];
  alsoNeedsCommon: string[];
  estimatedMacros: { calories: number; proteinG: number; carbsG: number; fatG: number };
  prepNote: string;
};

type ShoppingItem = {
  name: string;
  quantity: string;
  estCost?: number;
  unlocks: string;
};

type SuggestionResult = {
  rationale: string;
  meals: MealSuggestion[];
  shoppingList: ShoppingItem[];
};

type SuggestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: SuggestionResult; inventoryCount: number }
  | { status: 'error'; message: string };

function MealSuggestionsSection({ householdId }: { householdId: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<SuggestState>({ status: 'idle' });

  const generate = async () => {
    if (!user) return;
    setState({ status: 'loading' });
    try {
      const [inventory, goals, body] = await Promise.all([
        loadHouseholdInventory(householdId, 100),
        loadNutritionGoals(user.uid).catch<NutritionGoals | null>(() => null),
        loadBodyProfile(user.uid).catch<BodyProfile | null>(() => null),
      ]);

      if (inventory.length === 0) {
        setState({
          status: 'error',
          message: 'Inventory is empty. Scan a receipt first so we have something to cook with.',
        });
        return;
      }

      const { auth } = getFirebase();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in');

      const res = await fetch('/api/text/meal-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          inventory: inventory.map((it: InventoryRecord) => ({
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
          })),
          caloriesTarget: goals?.caloriesDaily.target,
          proteinTargetG: goals?.proteinG.target,
          notes: body?.notes,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const result = (await res.json()) as SuggestionResult;
      setState({ status: 'ready', result, inventoryCount: inventory.length });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not load suggestions' });
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Eyebrow>SMART SUGGESTIONS</Eyebrow>
          <div style={{ ...display, fontSize: 18, fontWeight: 700, marginTop: 2 }}>
            Cook with what you have
          </div>
        </div>
        {state.status !== 'loading' && (
          <button
            type="button"
            onClick={generate}
            className="btn btn-lime"
            style={{ padding: '10px 14px', fontSize: 13 }}
          >
            {state.status === 'ready' ? 'Regenerate' : 'Suggest meals'}
            <Icon name="sparkle" size={13} color="#0a0a0a" strokeWidth={2.5} />
          </button>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 8, marginBottom: 0, lineHeight: 1.5 }}>
        Built from your household&rsquo;s current inventory + your personal nutrition goals. Suggestions stay private to you.
      </p>

      {state.status === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  background: 'var(--lime)',
                  opacity: 0.6,
                  animation: `pact-pulse 1s ${i * 0.18}s infinite ease-in-out`,
                }}
              />
            ))}
          </div>
          <span style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
            ASKING CLAUDE…
          </span>
          <style>{`@keyframes pact-pulse { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }`}</style>
        </div>
      )}

      {state.status === 'error' && (
        <p style={{ fontSize: 13, marginTop: 12, marginBottom: 0, color: 'var(--coral)', lineHeight: 1.5 }}>
          {state.message}
        </p>
      )}

      {state.status === 'ready' && <SuggestionResults result={state.result} inventoryCount={state.inventoryCount} />}
    </Card>
  );
}

function SuggestionResults({
  result,
  inventoryCount,
}: {
  result: SuggestionResult;
  inventoryCount: number;
}) {
  return (
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 12,
          background: 'rgba(218,255,63,0.06)',
          border: '1px solid rgba(218,255,63,0.2)',
        }}
      >
        <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em' }}>
          BASED ON {inventoryCount} ITEM{inventoryCount === 1 ? '' : 'S'}
        </div>
        <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>{result.rationale}</p>
      </div>

      {result.meals.length > 0 && (
        <div>
          <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-mute)', letterSpacing: '0.1em', marginBottom: 8 }}>
            MEALS · {result.meals.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {result.meals.map((m, i) => <MealCard key={i} meal={m} />)}
          </div>
        </div>
      )}

      {result.shoppingList.length > 0 && (
        <div>
          <div
            style={{
              ...mono,
              fontSize: 10,
              color: 'var(--text-on-dark-mute)',
              letterSpacing: '0.1em',
              marginBottom: 8,
            }}
          >
            SUPPLEMENT · {result.shoppingList.length} CHEAP ADDITIONS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.shoppingList.map((it, i) => <ShoppingRow key={i} item={it} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function MealCard({ meal }: { meal: MealSuggestion }) {
  const m = meal.estimatedMacros;
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ ...display, fontSize: 15, fontWeight: 700 }}>{meal.name}</div>
        <div style={{ ...mono, fontSize: 11, color: 'var(--lime)' }}>
          {Math.round(m.calories)} KCAL · {Math.round(m.proteinG)}P · {Math.round(m.carbsG)}C · {Math.round(m.fatG)}F
        </div>
      </div>

      {meal.usesFromInventory.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {meal.usesFromInventory.map((it, i) => (
            <span
              key={i}
              style={{
                ...mono,
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 999,
                background: 'rgba(218,255,63,0.1)',
                color: 'var(--lime)',
                letterSpacing: '0.05em',
              }}
            >
              {it.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {meal.alsoNeedsCommon.length > 0 && (
        <div style={{ ...mono, fontSize: 10, color: 'var(--text-on-dark-faint)', marginTop: 6, letterSpacing: '0.05em' }}>
          ALSO NEEDS · {meal.alsoNeedsCommon.join(', ').toUpperCase()}
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--text-on-dark-mute)', marginTop: 8, marginBottom: 0, lineHeight: 1.5 }}>
        {meal.prepNote}
      </p>
    </div>
  );
}

function ShoppingRow({ item }: { item: ShoppingItem }) {
  const { addAi, addingId, isOnList } = useShopping();
  const key = item.name.trim().toLowerCase();
  const onList = isOnList(item.name);
  const isAdding = addingId === key;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'rgba(218,255,63,0.1)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="cart" size={13} color="var(--lime)" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>
          <span style={{ ...mono, fontSize: 11, color: 'var(--text-on-dark-mute)' }}>
            {item.quantity.toUpperCase()}
            {item.estCost != null ? ` · ~$${item.estCost.toFixed(2)}` : ''}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-on-dark-mute)', marginTop: 4, lineHeight: 1.5 }}>
          {item.unlocks}
        </div>
      </div>
      <button
        type="button"
        onClick={() =>
          void addAi({
            name: item.name,
            quantity: item.quantity,
            estCost: item.estCost,
            unlocks: item.unlocks,
          })
        }
        disabled={onList || isAdding}
        aria-label={onList ? 'Already on list' : 'Add to shopping list'}
        title={onList ? 'Already on list' : 'Add to shopping list'}
        style={{
          alignSelf: 'center',
          padding: '6px 10px',
          fontSize: 11,
          borderRadius: 999,
          border: onList ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(218,255,63,0.4)',
          background: onList ? 'transparent' : 'rgba(218,255,63,0.12)',
          color: onList ? 'var(--text-on-dark-faint)' : 'var(--lime)',
          fontFamily: 'var(--f-mono)',
          fontWeight: 600,
          letterSpacing: '0.06em',
          cursor: onList || isAdding ? 'default' : 'pointer',
          flexShrink: 0,
        }}
      >
        {onList ? 'ON LIST' : isAdding ? 'ADDING…' : '+ ADD'}
      </button>
    </div>
  );
}

const display: CSSProperties = {
  fontFamily: 'var(--f-display)',
  letterSpacing: '-0.02em',
};

const mono: CSSProperties = {
  fontFamily: 'var(--f-mono)',
};

const input: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.03)',
  color: 'var(--text-on-dark)',
  fontFamily: 'var(--f-ui)',
  fontSize: 14,
  outline: 'none',
};

const chooseBtn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '16px 18px',
  borderRadius: 14,
  background: 'var(--ink-card)',
  border: '1px solid rgba(255,255,255,0.06)',
  color: 'var(--text-on-dark)',
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'background 0.15s ease, border-color 0.15s ease',
};

const chooseIcon: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: 'rgba(218,255,63,0.1)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const chooseLabel: CSSProperties = {
  fontFamily: 'var(--f-ui)',
  fontWeight: 600,
  fontSize: 14,
};

const chooseSub: CSSProperties = {
  fontFamily: 'var(--f-mono)',
  fontSize: 10,
  color: 'var(--text-on-dark-mute)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginTop: 2,
};
