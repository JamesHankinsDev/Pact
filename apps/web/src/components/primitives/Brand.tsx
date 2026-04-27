type BrandProps = {
  size?: number;
  showWordmark?: boolean;
};

export function Brand({ size = 38, showWordmark = true }: BrandProps) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          background: '#daff3f',
          color: '#0a0a0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--f-display)',
          fontWeight: 800,
          fontSize: size * 0.55,
          letterSpacing: '-0.04em',
        }}
      >
        P
      </div>
      {showWordmark && (
        <span
          style={{
            fontFamily: 'var(--f-display)',
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: '-0.02em',
            color: 'var(--text-on-dark)',
          }}
        >
          PACT
        </span>
      )}
    </div>
  );
}
