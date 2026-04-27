import type { CSSProperties, ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  dark?: boolean;
  padded?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
};

export function Card({ children, dark = true, padded = true, onClick, style }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: dark ? '#1a1916' : '#ffffff',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(10,10,10,0.06)'}`,
        borderRadius: 22,
        padding: padded ? 18 : 0,
        color: dark ? '#f5f3ee' : '#14130f',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
