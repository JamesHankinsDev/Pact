import type { ReactNode } from 'react';

type EyebrowProps = {
  children: ReactNode;
  dark?: boolean;
  color?: string;
};

export function Eyebrow({ children, dark = true, color }: EyebrowProps) {
  return (
    <div
      style={{
        fontFamily: 'var(--f-mono)',
        fontSize: 10,
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        color: color ?? (dark ? 'rgba(245,243,238,0.45)' : 'rgba(20,19,15,0.45)'),
      }}
    >
      {children}
    </div>
  );
}
