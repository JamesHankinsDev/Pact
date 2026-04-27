type StatNumeralProps = {
  value: string | number;
  unit?: string;
  size?: number;
  dark?: boolean;
  color?: string;
};

export function StatNumeral({ value, unit, size = 56, dark = true, color }: StatNumeralProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span
        className="numeral"
        style={{ fontSize: size, color: color ?? (dark ? '#f5f3ee' : '#14130f') }}
      >
        {value}
      </span>
      {unit && (
        <span
          style={{
            fontFamily: 'var(--f-mono)',
            fontSize: size * 0.22,
            color: dark ? 'rgba(245,243,238,0.5)' : 'rgba(20,19,15,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {unit}
        </span>
      )}
    </div>
  );
}
