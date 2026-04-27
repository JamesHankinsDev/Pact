import type { ReactNode } from 'react';

type ChipColor = 'lime' | 'coral' | 'sky' | 'plum' | 'ghost' | 'outline';

type ChipProps = {
  children: ReactNode;
  color?: ChipColor;
  dark?: boolean;
};

const palette = (color: ChipColor, dark: boolean) => {
  switch (color) {
    case 'lime':    return { bg: '#daff3f', fg: '#0a0a0a' };
    case 'coral':   return { bg: '#ff6b4a', fg: '#0a0a0a' };
    case 'sky':     return { bg: '#7cd4ff', fg: '#0a0a0a' };
    case 'plum':    return { bg: '#c58cff', fg: '#0a0a0a' };
    case 'ghost':   return {
      bg: dark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,10,0.06)',
      fg: dark ? '#f5f3ee' : '#14130f',
    };
    case 'outline': return {
      bg: 'transparent',
      fg: dark ? '#f5f3ee' : '#14130f',
      border: dark ? 'rgba(255,255,255,0.18)' : 'rgba(10,10,10,0.16)',
    };
  }
};

export function Chip({ children, color = 'lime', dark = true }: ChipProps) {
  const p = palette(color, dark);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 9px',
        borderRadius: 999,
        background: p.bg,
        color: p.fg,
        border: 'border' in p && p.border ? `1px solid ${p.border}` : 'none',
        fontFamily: 'var(--f-ui)',
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
